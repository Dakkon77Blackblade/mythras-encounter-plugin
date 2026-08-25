import { App, Modal, Notice, TFile, Setting } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasWeapon } from './mythras-api';
import { DEFAULT_ARMORY } from './default-armory';

export class ConfirmModal extends Modal {
    onSubmit: (result: boolean) => void;
    message: string;

    constructor(app: App, message: string, onSubmit: (result: boolean) => void) {
        super(app);
        this.message = message;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Confirm' });
        contentEl.createEl('p', { text: this.message });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText('Yes')
                    .setCta()
                    .onClick(() => {
                        this.close();
                        this.onSubmit(true);
                    }))
            .addButton((btn) =>
                btn
                    .setButtonText('No')
                    .onClick(() => {
                        this.close();
                        this.onSubmit(false);
                    }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class ArmoryManagerModal extends Modal {
    plugin: MythrasEncounterPlugin;
    weapons: MythrasWeapon[] = [];
    currentTab: 'melee' | 'ranged' | 'shields' = 'melee';
    currentView: 'list' | 'edit' = 'list';
    selectedWeapon: MythrasWeapon | null = null;
    isNewWeapon: boolean = false;
    sortAscending: boolean = true;
    sortField: 'name' | 'type' | 'damage' = 'name';

    constructor(app: App, plugin: MythrasEncounterPlugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        this.titleEl.setText('Armory Manager');
        this.modalEl.addClass('mythras-bestiary-modal');
        this.modalEl.style.width = '80vw';
        this.modalEl.style.maxWidth = '1200px';
        this.modalEl.style.height = '80vh';
        await this.loadArmory();
        this.renderView();
    }

    close() {
        if (this.currentView === 'edit') {
            this.currentView = 'list';
            this.renderView();
            return;
        }
        super.close();
    }

    onClose() {
        this.contentEl.empty();
    }

    async loadArmory() {
        const armoryPath = `${this.plugin.settings.baseFolder}/Armory/armory.json`;
        if (await this.app.vault.adapter.exists(armoryPath)) {
            const file = this.app.vault.getAbstractFileByPath(armoryPath);
            if (file instanceof TFile) {
                try {
                    const content = await this.app.vault.read(file);
                    this.weapons = JSON.parse(content) as MythrasWeapon[];
                } catch (e) {
                    console.error("Failed to parse armory.json", e);
                    this.weapons = [];
                }
            }
        } else {
            this.weapons = [];
        }
    }

    async saveArmory() {
        const armoryPath = `${this.plugin.settings.baseFolder}/Armory/armory.json`;
        const folderPath = `${this.plugin.settings.baseFolder}/Armory`;
        if (!(await this.app.vault.adapter.exists(folderPath))) {
            await this.app.vault.createFolder(folderPath);
        }

        const data = JSON.stringify(this.weapons, null, 2);
        
        const file = this.app.vault.getAbstractFileByPath(armoryPath);
        if (file instanceof TFile) {
            await this.app.vault.modify(file, data);
        } else {
            await this.app.vault.create(armoryPath, data);
        }
    }

    async repopulateArmory() {
        const armoryPath = `${this.plugin.settings.baseFolder}/Armory/armory.json`;
        const file = this.app.vault.getAbstractFileByPath(armoryPath);
        if (file instanceof TFile) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${this.plugin.settings.baseFolder}/Armory/armory_backup_${timestamp}.json`;
            const content = await this.app.vault.read(file);
            await this.app.vault.create(backupPath, content);
            new Notice(`Backup created: armory_backup_${timestamp}.json`);
        }
        
        // Deep copy default armory
        this.weapons = JSON.parse(JSON.stringify(DEFAULT_ARMORY));
        await this.saveArmory();
        new Notice("Armory repopulated with Classic Fantasy SRD defaults.");
        this.renderView();
    }

    renderView() {
        this.contentEl.empty();
        if (this.currentView === 'list') {
            this.renderListView();
        } else if (this.currentView === 'edit' && this.selectedWeapon) {
            this.renderEditView();
        }
    }

    renderListView() {
        const container = this.contentEl.createDiv('armory-list-container');
        
        // Header Controls
        const headerDiv = container.createDiv('armory-header-controls');
        headerDiv.style.display = 'flex';
        headerDiv.style.justifyContent = 'space-between';
        headerDiv.style.alignItems = 'center';
        headerDiv.style.marginBottom = '15px';

        const tabsDiv = headerDiv.createDiv('armory-tabs');
        tabsDiv.style.display = 'flex';
        tabsDiv.style.gap = '10px';

        const createTabBtn = (id: 'melee' | 'ranged' | 'shields', label: string) => {
            const btn = tabsDiv.createEl('button', { text: label });
            if (this.currentTab === id) btn.addClass('mod-cta');
            btn.onclick = () => {
                this.currentTab = id;
                this.renderView();
            };
        };

        createTabBtn('melee', 'Melee Weapons');
        createTabBtn('ranged', 'Ranged Weapons');
        createTabBtn('shields', 'Shields');

        const actionsDiv = headerDiv.createDiv();
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '10px';

        const btnAdd = actionsDiv.createEl('button', { text: '+ Add Weapon', cls: 'mod-cta' });
        btnAdd.onclick = () => {
            this.selectedWeapon = {
                name: 'New Weapon',
                isOptional: false,
                type: this.currentTab === 'melee' ? '1h-melee' : (this.currentTab === 'ranged' ? 'ranged' : 'shield')
            };
            this.isNewWeapon = true;
            this.currentView = 'edit';
            this.renderView();
        };

        const btnRepopulate = actionsDiv.createEl('button', { text: 'Repopulate with SRD' });
        btnRepopulate.onclick = async () => {
            await this.repopulateArmory();
        };

        // Table
        const table = container.createEl('table', { cls: 'armory-table' });
        table.style.width = '100%';
        table.style.textAlign = 'left';
        table.style.borderCollapse = 'collapse';

        const thead = table.createEl('thead');
        const tr = thead.createEl('tr');
        
        const headers = [
            { id: 'name', label: 'Name', sortable: true },
            { id: 'type', label: 'Type', sortable: true },
            { id: 'damage', label: 'Damage', sortable: true },
            { id: 'size', label: this.currentTab === 'ranged' ? 'Force' : 'Size', sortable: false },
            { id: 'aphp', label: 'AP/HP', sortable: false },
            { id: 'actions', label: '', sortable: false },
        ];

        headers.forEach(h => {
            const th = tr.createEl('th', { text: h.label });
            th.style.padding = '8px';
            th.style.borderBottom = '1px solid var(--background-modifier-border)';
            if (h.sortable) {
                th.style.cursor = 'pointer';
                if (this.sortField === h.id) {
                    th.setText(`${h.label} ${this.sortAscending ? '▲' : '▼'}`);
                }
                th.onclick = () => {
                    if (this.sortField === h.id) {
                        this.sortAscending = !this.sortAscending;
                    } else {
                        this.sortField = h.id as any;
                        this.sortAscending = true;
                    }
                    this.renderView();
                };
            }
        });

        const tbody = table.createEl('tbody');

        let displayWeapons = this.weapons.filter(w => {
            if (this.currentTab === 'melee') return w.type === '1h-melee' || w.type === '2h-melee';
            if (this.currentTab === 'ranged') return w.type === 'ranged';
            if (this.currentTab === 'shields') return w.type === 'shield';
            return true;
        });

        displayWeapons.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';
            if (this.sortField === 'name') { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }
            else if (this.sortField === 'type') { valA = (a.type || '').toLowerCase(); valB = (b.type || '').toLowerCase(); }
            else if (this.sortField === 'damage') { valA = a.damage || ''; valB = b.damage || ''; }
            
            if (valA < valB) return this.sortAscending ? -1 : 1;
            if (valA > valB) return this.sortAscending ? 1 : -1;
            return 0;
        });

        for (const w of displayWeapons) {
            const row = tbody.createEl('tr');
            row.style.cursor = 'pointer';
            row.style.borderBottom = '1px solid var(--background-modifier-border-alt)';
            row.onmouseenter = () => row.style.backgroundColor = 'var(--background-modifier-hover)';
            row.onmouseleave = () => row.style.backgroundColor = 'transparent';
            row.onclick = () => {
                this.selectedWeapon = w;
                this.isNewWeapon = false;
                this.currentView = 'edit';
                this.renderView();
            };

            row.createEl('td', { text: w.name }).style.padding = '8px';
            row.createEl('td', { text: w.type || '-' }).style.padding = '8px';
            row.createEl('td', { text: w.damage || '-' }).style.padding = '8px';
            row.createEl('td', { text: w.size || '-' }).style.padding = '8px';
            row.createEl('td', { text: `${w.ap || 0}/${w.hp || 0}` }).style.padding = '8px';
            
            const actionsTd = row.createEl('td');
            actionsTd.style.padding = '8px';
            actionsTd.style.textAlign = 'right';
            const btnDeleteList = actionsTd.createEl('button', { text: '🗑️', cls: 'mod-warning' });
            btnDeleteList.style.padding = '4px 8px';
            btnDeleteList.onclick = (e) => {
                e.stopPropagation(); // prevent row click
                new ConfirmModal(this.app, `Do you really want to delete ${w.name}?`, async (result) => {
                    if (result) {
                        this.weapons = this.weapons.filter(weapon => weapon !== w);
                        await this.saveArmory();
                        new Notice(`Weapon ${w.name} deleted.`);
                        this.renderView();
                    }
                }).open();
            };
        }
    }

    renderEditView() {
        if (!this.selectedWeapon) return;
        const weapon = this.selectedWeapon;

        const container = this.contentEl.createDiv('armory-edit-container');
        
        // Buttons
        const buttonDiv = container.createDiv('armory-edit-buttons');
        buttonDiv.style.display = 'flex';
        buttonDiv.style.gap = '10px';
        buttonDiv.style.marginBottom = '20px';

        const btnBack = buttonDiv.createEl('button', { text: 'Cancel' });
        btnBack.onclick = () => {
            this.currentView = 'list';
            this.renderView();
        };

        const btnSave = buttonDiv.createEl('button', { text: 'Save', cls: 'mod-cta' });
        btnSave.onclick = async () => {
            if (this.isNewWeapon) {
                this.weapons.push(weapon);
            }
            await this.saveArmory();
            new Notice(`Weapon ${weapon.name} saved.`);
            this.currentView = 'list';
            this.renderView();
        };

        if (!this.isNewWeapon) {
            const btnDelete = buttonDiv.createEl('button', { text: 'Delete', cls: 'mod-warning' });
            btnDelete.onclick = () => {
                new ConfirmModal(this.app, `Do you really want to delete ${weapon.name}?`, async (result) => {
                    if (result) {
                        this.weapons = this.weapons.filter(w => w !== weapon);
                        await this.saveArmory();
                        new Notice(`Weapon ${weapon.name} deleted.`);
                        this.currentView = 'list';
                        this.renderView();
                    }
                }).open();
            };
        }

        const form = container.createDiv('armory-form');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        
        // Template Loader (only if new)
        if (this.isNewWeapon) {
            const templateWrap = form.createDiv();
            templateWrap.style.display = 'flex';
            templateWrap.style.flexDirection = 'column';
            templateWrap.createEl('label', { text: 'Load Base Stats from...' }).style.fontWeight = 'bold';
            const templateSelect = templateWrap.createEl('select');
            templateSelect.createEl('option', { value: '', text: '-- Select a template --' });
            this.weapons.forEach(w => {
                templateSelect.createEl('option', { value: w.name, text: w.name });
            });
            templateSelect.onchange = (e) => {
                const selectedName = (e.target as HTMLSelectElement).value;
                const tmpl = this.weapons.find(w => w.name === selectedName);
                if (tmpl) {
                    Object.assign(weapon, tmpl);
                    weapon.name = tmpl.name + ' (Copy)';
                    this.renderView(); // re-render to update fields
                }
            };
        }

        const createField = (label: string, renderInput: (wrapper: HTMLElement) => void) => {
            const wrap = form.createDiv();
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.createEl('label', { text: label }).style.fontWeight = 'bold';
            renderInput(wrap);
        };

        const createTextField = (label: string, val: string | undefined, onChange: (v: string) => void) => {
            createField(label, wrap => {
                const inp = wrap.createEl('input', { type: 'text' });
                inp.value = val || '';
                inp.onchange = (e) => onChange((e.target as HTMLInputElement).value);
            });
        };

        createTextField('Name', weapon.name, v => weapon.name = v);
        
        createField('Type', wrap => {
            const sel = wrap.createEl('select');
            const types = ['1h-melee', '2h-melee', 'ranged', 'shield'];
            types.forEach(t => {
                const opt = sel.createEl('option', { value: t, text: t });
                if (t === weapon.type) opt.selected = true;
            });
            sel.onchange = (e) => {
                weapon.type = (e.target as HTMLSelectElement).value;
                this.renderView(); // Re-render to show/hide dynamic fields
            };
        });

        createTextField('Damage', weapon.damage, v => weapon.damage = v);
        createTextField(weapon.type === 'ranged' ? 'Force' : 'Size', weapon.size, v => weapon.size = v);

        if (weapon.type === 'ranged') {
            createTextField('Range (Close/Effective/Long)', weapon.range, v => weapon.range = v);
            createTextField('Load (Turns to reload)', weapon.load, v => weapon.load = v);
            createTextField('Imp. Size', weapon.impSize, v => weapon.impSize = v);
            
            createField('Applies Damage Modifier', wrap => {
                const chk = wrap.createEl('input', { type: 'checkbox' });
                chk.checked = !!weapon.damageModifier;
                chk.onchange = (e) => weapon.damageModifier = (e.target as HTMLInputElement).checked;
            });
        }

        const statsWrap = form.createDiv();
        statsWrap.style.display = 'flex';
        statsWrap.style.gap = '20px';
        
        const apWrap = statsWrap.createDiv();
        apWrap.createEl('label', { text: 'AP' }).style.fontWeight = 'bold';
        const apInp = apWrap.createEl('input', { type: 'number' });
        apInp.value = weapon.ap || '0';
        apInp.onchange = (e) => weapon.ap = (e.target as HTMLInputElement).value;
        
        const hpWrap = statsWrap.createDiv();
        hpWrap.createEl('label', { text: 'HP' }).style.fontWeight = 'bold';
        const hpInp = hpWrap.createEl('input', { type: 'number' });
        hpInp.value = weapon.hp || '0';
        hpInp.onchange = (e) => weapon.hp = (e.target as HTMLInputElement).value;

        createTextField('Combat Effects (SpecialFx)', weapon.specialFx, v => weapon.specialFx = v);
        createTextField('Traits', weapon.traits, v => weapon.traits = v);
        createTextField('Cost', weapon.cost, v => weapon.cost = v);
        createTextField('Notes', weapon.notes, v => weapon.notes = v);
    }
}
