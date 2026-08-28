import { App, Modal, Notice, setIcon } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasInstance } from './mythras-api';
import { ImageSuggestModal } from './modal-image-search';

export class EnemyInstanceEditModal extends Modal {
    plugin: MythrasEncounterPlugin;
    instance: MythrasInstance;
    onSave: (updated: MythrasInstance) => Promise<void>;
    editTab: 'general' | 'hitlocations' | 'stats' | 'skills' | 'weapons' = 'general';

    constructor(app: App, plugin: MythrasEncounterPlugin, instance: MythrasInstance, onSave: (updated: MythrasInstance) => Promise<void>) {
        super(app);
        this.plugin = plugin;
        // Clone instance so changes can be cancelled
        this.instance = JSON.parse(JSON.stringify(instance));
        this.onSave = onSave;
    }

    onOpen() {
        this.display();
    }

    onClose() {
        this.contentEl.empty();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mythras-manager-container');

        const topBar = contentEl.createDiv('mythras-manager-header');
        topBar.createEl('h2', { text: `Edit: ${this.instance.instanceName || this.instance.templateName}` });

        const btnGroup = topBar.createDiv('mythras-manager-header-controls');
        
        const btnCancel = btnGroup.createEl('button', { text: 'Cancel', cls: 'mythras-btn-secondary' });
        btnCancel.onclick = () => this.close();

        const btnSave = btnGroup.createEl('button', { text: 'Save Changes', cls: 'mythras-btn-primary' });
        btnSave.onclick = async () => {
            await this.saveChanges();
        };

        // Navigation Tabs
        const tabsDiv = contentEl.createDiv('armory-tabs mythras-manager-header-controls');
        tabsDiv.style.borderBottom = '1px solid var(--background-modifier-border)';
        tabsDiv.style.paddingBottom = '10px';
        tabsDiv.style.marginBottom = '15px';

        const createTab = (id: typeof this.editTab, label: string) => {
            const btn = tabsDiv.createEl('button', { text: label });
            if (this.editTab === id) btn.addClass('mod-cta');
            btn.onclick = () => {
                this.editTab = id;
                this.display();
            };
        };

        createTab('general', 'General');
        createTab('hitlocations', 'Hit Locations');
        createTab('stats', 'Stats & Attributes');
        createTab('skills', 'Skills');
        createTab('weapons', 'Weapons');

        const formArea = contentEl.createDiv('mythras-manager-form mythras-manager-form-scrollable');
        formArea.style.overflowY = 'auto';
        formArea.style.maxHeight = '60vh';

        const createTextField = (label: string, val: string, onChange: (v: string) => void) => {
            const wrap = formArea.createDiv('mythras-manager-form-group');
            wrap.createEl('label', { text: label });
            const inp = wrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
            inp.value = val || '';
            inp.oninput = (e) => onChange((e.target as HTMLInputElement).value);
        };

        if (this.editTab === 'general') {
            createTextField('Instance Name', this.instance.instanceName, v => this.instance.instanceName = v);
            createTextField('Scenario', this.instance.scenario, v => this.instance.scenario = v);
            createTextField('Encounter', this.instance.encounter, v => this.instance.encounter = v);
            
            const imgWrap = formArea.createDiv('mythras-manager-input-group');
            imgWrap.style.alignItems = 'flex-end';
            
            const fieldWrap = imgWrap.createDiv('mythras-manager-form-group');
            fieldWrap.style.flex = '1';
            fieldWrap.createEl('label', { text: 'Image' });
            
            const imgInp = fieldWrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
            imgInp.value = this.instance.image || '';
            imgInp.placeholder = 'e.g. [[image.png]]';
            imgInp.oninput = (e) => this.instance.image = (e.target as HTMLInputElement).value;
            
            const btnBrowse = imgWrap.createEl('button', { text: 'Search Vault...', cls: 'mythras-btn-secondary' });
            btnBrowse.onclick = () => {
                new ImageSuggestModal(this.app, (file) => {
                    const link = `[[${file.name}]]`;
                    imgInp.value = link;
                    this.instance.image = link;
                }).open();
            };

            const notesWrap = formArea.createDiv('mythras-manager-form-group');
            notesWrap.createEl('label', { text: 'Notes' }).style.fontWeight = 'bold';
            const ta = notesWrap.createEl('textarea');
            ta.value = this.instance.notes || '';
            ta.rows = 5;
            ta.style.width = '100%';
            ta.oninput = (e) => this.instance.notes = (e.target as HTMLTextAreaElement).value;

        } else if (this.editTab === 'hitlocations') {
            const table = formArea.createEl('table', { cls: 'mythras-manager-table' });
            table.style.width = '100%';
            const thead = table.createEl('thead').createEl('tr');
            ['Location', 'Range', 'AP', 'Current HP', 'Max HP'].forEach(h => {
                thead.createEl('th', { text: h, cls: 'mythras-manager-th' });
            });
            const tbody = table.createEl('tbody');

            this.instance.hitLocations.forEach(hl => {
                const tr = tbody.createEl('tr', { cls: 'mythras-manager-tr' });
                tr.createEl('td', { text: hl.name, cls: 'mythras-manager-td' });
                tr.createEl('td', { text: hl.range, cls: 'mythras-manager-td' });
                
                const apTd = tr.createEl('td', { cls: 'mythras-manager-td' });
                const apInp = apTd.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                apInp.style.width = '60px';
                apInp.value = String(hl.currentAp !== undefined ? hl.currentAp : hl.ap);
                apInp.oninput = (e) => {
                    const val = (e.target as HTMLInputElement).value;
                    hl.ap = val;
                    hl.currentAp = val;
                };

                const currTd = tr.createEl('td', { cls: 'mythras-manager-td' });
                const currInp = currTd.createEl('input', { type: 'number', cls: 'mythras-manager-input' });
                currInp.style.width = '60px';
                currInp.value = String(hl.currentHp !== undefined ? hl.currentHp : hl.hp);
                currInp.oninput = (e) => hl.currentHp = parseInt((e.target as HTMLInputElement).value) || 0;

                const maxTd = tr.createEl('td', { cls: 'mythras-manager-td' });
                const maxInp = maxTd.createEl('input', { type: 'number', cls: 'mythras-manager-input' });
                maxInp.style.width = '60px';
                maxInp.value = String(hl.hp);
                maxInp.oninput = (e) => hl.hp = parseInt((e.target as HTMLInputElement).value) || 0;
            });

        } else if (this.editTab === 'stats') {
            formArea.createEl('h3', { text: 'Core Characteristics' });
            const grid = formArea.createDiv();
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
            grid.style.gap = '10px';

            ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'].forEach(stat => {
                const wrap = grid.createDiv('mythras-manager-form-group');
                wrap.createEl('label', { text: stat });
                const inp = wrap.createEl('input', { type: 'number', cls: 'mythras-manager-input' });
                inp.value = String(this.instance.stats[stat] || 10);
                inp.oninput = (e) => this.instance.stats[stat] = parseInt((e.target as HTMLInputElement).value) || 0;
            });

            formArea.createEl('h3', { text: 'Derived Attributes' }).style.marginTop = '15px';
            const attrGrid = formArea.createDiv();
            attrGrid.style.display = 'grid';
            attrGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
            attrGrid.style.gap = '10px';

            ['Action Points', 'Damage Mod', 'Strike Rank', 'Movement', 'Magic Points'].forEach(attr => {
                const wrap = attrGrid.createDiv('mythras-manager-form-group');
                wrap.createEl('label', { text: attr });
                const inp = wrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                inp.value = String(this.instance.attributes[attr] || '');
                inp.oninput = (e) => this.instance.attributes[attr] = (e.target as HTMLInputElement).value;
            });

        } else if (this.editTab === 'skills') {
            const renderDict = (label: string, dict: Record<string, number | string> | undefined, keyName: string) => {
                formArea.createEl('h3', { text: label });
                if (!dict) dict = {};
                const listWrap = formArea.createDiv();

                const renderEntries = () => {
                    listWrap.empty();
                    Object.entries(dict!).forEach(([k, v]) => {
                        const row = listWrap.createDiv('mythras-manager-input-group');
                        row.style.marginBottom = '6px';
                        
                        const kInp = row.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                        kInp.value = k;
                        kInp.style.flex = '2';

                        const vInp = row.createEl('input', { type: 'number', cls: 'mythras-manager-input' });
                        vInp.value = String(v);
                        vInp.style.flex = '1';

                        kInp.onchange = (e) => {
                            const newK = (e.target as HTMLInputElement).value;
                            if (newK && newK !== k) {
                                delete dict![k];
                                dict![newK] = v;
                                renderEntries();
                            }
                        };
                        vInp.oninput = (e) => {
                            dict![k] = parseInt((e.target as HTMLInputElement).value) || 0;
                        };

                        const btnDel = row.createEl('button', { text: 'X', cls: 'mythras-btn-danger' });
                        btnDel.onclick = () => {
                            delete dict![k];
                            renderEntries();
                        };
                    });
                };
                renderEntries();

                const btnAdd = formArea.createEl('button', { text: `+ Add ${keyName}`, cls: 'mythras-btn-secondary' });
                btnAdd.style.marginBottom = '15px';
                btnAdd.onclick = () => {
                    const newKey = `New ${keyName}`;
                    dict![newKey] = 50;
                    renderEntries();
                };
            };

            renderDict('Combat Styles', this.instance.combatStyles, 'Combat Style');
            renderDict('Standard Skills', this.instance.standardSkills, 'Standard Skill');
            renderDict('Professional Skills', this.instance.professionalSkills, 'Professional Skill');
            renderDict('Magic Skills', this.instance.magicSkills, 'Magic Skill');
            renderDict('Custom Skills', this.instance.customSkills, 'Custom Skill');

        } else if (this.editTab === 'weapons') {
            formArea.createEl('h3', { text: 'Weapons' });
            if (!this.instance.weapons) this.instance.weapons = [];

            const listWrap = formArea.createDiv();
            const renderWeapons = () => {
                listWrap.empty();
                this.instance.weapons.forEach((w, idx) => {
                    const box = listWrap.createDiv('mythras-manager-card');
                    box.style.marginBottom = '10px';
                    box.style.padding = '10px';

                    const row1 = box.createDiv('mythras-manager-input-group');
                    row1.createEl('label', { text: 'Name: ' });
                    const nameInp = row1.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                    nameInp.value = w.name;
                    nameInp.oninput = (e) => w.name = (e.target as HTMLInputElement).value;

                    row1.createEl('label', { text: 'Damage: ' });
                    const dmgInp = row1.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                    dmgInp.value = w.damage || '';
                    dmgInp.oninput = (e) => w.damage = (e.target as HTMLInputElement).value;

                    const btnDel = row1.createEl('button', { text: 'Delete', cls: 'mythras-btn-danger' });
                    btnDel.onclick = () => {
                        this.instance.weapons.splice(idx, 1);
                        renderWeapons();
                    };
                });
            };
            renderWeapons();

            const btnAddWpn = formArea.createEl('button', { text: '+ Add Weapon', cls: 'mythras-btn-secondary' });
            btnAddWpn.onclick = () => {
                this.instance.weapons.push({ name: 'Shortsword', damage: '1d6' });
                renderWeapons();
            };
        }
    }

    async saveChanges() {
        try {
            const folder = this.plugin.settings.baseFolder || 'Mythras-Helper';
            const rosterFolder = `${folder}/Roster`;
            
            // Recalculate weapon damage modifiers if damage mod attribute changed
            const dmgMod = this.instance.attributes['Damage Mod'] as string;
            if (this.instance.weapons) {
                this.instance.weapons.forEach(w => {
                    const aw = this.plugin.armoryCache?.find(a => a.name.toLowerCase() === w.name.toLowerCase());
                    if (aw && aw.damageModifier !== false) {
                        let baseDmg = aw.damage;
                        if (dmgMod && dmgMod !== '+0' && dmgMod !== '0') {
                            const mod = dmgMod.startsWith('+') || dmgMod.startsWith('-') ? dmgMod : '+' + dmgMod;
                            baseDmg += mod;
                        }
                        w.damage = baseDmg;
                    }
                });
            }

            // Find JSON file on disk by instance id
            const files = this.app.vault.getFiles().filter(f => f.path.startsWith(rosterFolder) && f.extension === 'json');
            let targetFile = null;
            for (const f of files) {
                try {
                    const content = await this.app.vault.read(f);
                    const parsed = JSON.parse(content);
                    if (parsed && parsed.id === this.instance.id) {
                        targetFile = f;
                        break;
                    }
                } catch (e) {}
            }

            const dataStr = JSON.stringify(this.instance, null, 2);
            if (targetFile) {
                await this.app.vault.modify(targetFile, dataStr);
            } else {
                const safeName = `${this.instance.scenario}_${this.instance.encounter}_${this.instance.instanceName}_${this.instance.id}.json`.replace(/[^a-zA-Z0-9._-]/g, '_');
                await this.app.vault.create(`${rosterFolder}/${safeName}`, dataStr);
            }

            await this.onSave(this.instance);
            this.close();
            new Notice(`Saved edits for "${this.instance.instanceName}".`);
        } catch (e) {
            new Notice("Error saving changes.");
        }
    }
}
