import { App, Modal, Setting, Notice, TFile, TFolder, normalizePath } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasInstance } from './mythras-api';
import { ConfirmModal } from './ui-armory';

export class PromptModal extends Modal {
    title: string;
    description: string;
    placeholder: string;
    defaultValue: string;
    onSubmit: (result: string | null) => void;

    constructor(app: App, title: string, description: string, placeholder: string, defaultValue: string, onSubmit: (result: string | null) => void) {
        super(app);
        this.title = title;
        this.description = description;
        this.placeholder = placeholder;
        this.defaultValue = defaultValue;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: this.title });
        contentEl.createEl('p', { text: this.description });

        const setting = new Setting(contentEl)
            .addText((text) =>
                text
                    .setPlaceholder(this.placeholder)
                    .setValue(this.defaultValue)
            );

        const inputEl = setting.controlEl.querySelector('input') as HTMLInputElement;

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText('Submit')
                    .setCta()
                    .onClick(() => {
                        this.close();
                        this.onSubmit(inputEl.value);
                    }))
            .addButton((btn) =>
                btn
                    .setButtonText('Cancel')
                    .onClick(() => {
                        this.close();
                        this.onSubmit(null);
                    }));

        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.close();
                this.onSubmit(inputEl.value);
            }
        });
        
        setTimeout(() => inputEl.focus(), 100);
    }

    onClose() {
        this.contentEl.empty();
    }
}

interface RosterScenario {
    name: string;
    path: string;
    encounters: RosterEncounter[];
}

interface RosterEncounter {
    name: string;
    path: string;
    instances: { file: TFile, data: MythrasInstance }[];
}

export class RosterManagerUI {
    app: App;
    plugin: MythrasEncounterPlugin;
    containerEl: HTMLElement;
    scenarios: RosterScenario[] = [];
    
    // UI State
    selectedScenario: string | null = null;
    selectedEncounter: string | null = null;
    currentView: 'list' | 'edit' = 'list';
    selectedInstance: { file: TFile, data: MythrasInstance } | null = null;
    
    // Edit View Tabs
    editTab: 'general' | 'stats' | 'hitlocations' | 'skills' | 'weapons' = 'general';

    constructor(app: App, plugin: MythrasEncounterPlugin, containerEl: HTMLElement) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = containerEl;
    }

    async render() {
        await this.loadInstances();
        
        if (!this.selectedScenario && this.scenarios.length > 0) {
            this.selectedScenario = this.scenarios[0].name;
            if (this.scenarios[0].encounters.length > 0) {
                this.selectedEncounter = this.scenarios[0].encounters[0].name;
            }
        }

        this.display();
    }

    async loadInstances() {
        this.scenarios = [];
        const rosterPath = `${this.plugin.settings.baseFolder}/Roster`;
        const rootFolder = this.app.vault.getAbstractFileByPath(rosterPath);
        
        if (!rootFolder || !(rootFolder instanceof TFolder)) return;

        const generalScenario: RosterScenario = { name: 'General', path: rosterPath, encounters: [] };

        for (const scenarioNode of rootFolder.children) {
            if (scenarioNode instanceof TFile && scenarioNode.extension === 'json') {
                let genEnc = generalScenario.encounters.find(e => e.name === 'Random Encounter');
                if (!genEnc) {
                    genEnc = { name: 'Random Encounter', path: rosterPath, instances: [] };
                    generalScenario.encounters.push(genEnc);
                }
                try {
                    const content = await this.app.vault.read(scenarioNode);
                    genEnc.instances.push({ file: scenarioNode, data: JSON.parse(content) });
                } catch (e) {
                    console.error(e);
                }
            } else if (scenarioNode instanceof TFolder) {
                const scenario: RosterScenario = { name: scenarioNode.name, path: scenarioNode.path, encounters: [] };
                
                for (const encNode of scenarioNode.children) {
                    if (encNode instanceof TFile && encNode.extension === 'json') {
                        let genEnc = scenario.encounters.find(e => e.name === 'Random Encounter');
                        if (!genEnc) {
                            genEnc = { name: 'Random Encounter', path: scenarioNode.path, instances: [] };
                            scenario.encounters.push(genEnc);
                        }
                        try {
                            const content = await this.app.vault.read(encNode);
                            genEnc.instances.push({ file: encNode, data: JSON.parse(content) });
                        } catch (e) { console.error(e); }
                    } else if (encNode instanceof TFolder) {
                        const encounter: RosterEncounter = { name: encNode.name, path: encNode.path, instances: [] };
                        for (const fileNode of encNode.children) {
                            if (fileNode instanceof TFile && fileNode.extension === 'json') {
                                try {
                                    const content = await this.app.vault.read(fileNode);
                                    encounter.instances.push({ file: fileNode, data: JSON.parse(content) });
                                } catch (e) { console.error(e); }
                            }
                        }
                        encounter.instances.sort((a, b) => b.data.lastModified - a.data.lastModified);
                        scenario.encounters.push(encounter);
                    }
                }
                scenario.encounters.sort((a, b) => a.name.localeCompare(b.name));
                this.scenarios.push(scenario);
            }
        }

        if (generalScenario.encounters.length > 0) {
            this.scenarios.push(generalScenario);
        }

        this.scenarios.sort((a, b) => a.name.localeCompare(b.name));
    }

    async saveSelectedInstance() {
        if (!this.selectedInstance) return;
        
        this.selectedInstance.data.lastModified = Date.now();
        const dataStr = JSON.stringify(this.selectedInstance.data, null, 2);
        
        const safeScenario = this.selectedInstance.data.scenario.replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'General';
        const safeEncounter = this.selectedInstance.data.encounter.replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'Random Encounter';
        
        const oldFile = this.selectedInstance.file;
        const oldScenario = oldFile.path.split('/')[2];
        const oldEncounter = oldFile.path.split('/')[3];
        
        if (safeScenario !== oldScenario || safeEncounter !== oldEncounter) {
            const newFolderPath = normalizePath(`${this.plugin.settings.baseFolder}/Roster/${safeScenario}/${safeEncounter}`);
            
            const parts = newFolderPath.split('/');
            let currentPath = '';
            for (const part of parts) {
                if (part === '') continue;
                currentPath = currentPath === '' ? part : `${currentPath}/${part}`;
                if (!await this.app.vault.adapter.exists(currentPath)) {
                    await this.app.vault.createFolder(currentPath);
                }
            }
            
            const newFilePath = normalizePath(`${newFolderPath}/${oldFile.name}`);
            await this.app.vault.create(newFilePath, dataStr);
            await this.app.vault.delete(oldFile);
            
            await this.loadInstances();
            new Notice(`Saved and moved to ${safeScenario}/${safeEncounter}`);
        } else {
            await this.app.vault.modify(this.selectedInstance.file, dataStr);
            await this.loadInstances();
            new Notice("Saved successfully.");
        }
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        
        if (this.currentView === 'edit' && this.selectedInstance) {
            this.renderEditView(containerEl);
            return;
        }

        const layout = containerEl.createDiv('roster-layout');
        layout.style.display = 'flex';
        layout.style.height = '100%';
        layout.style.gap = '20px';

        const sidebar = layout.createDiv('roster-sidebar');
        sidebar.style.flex = '0 0 250px';
        sidebar.style.borderRight = '1px solid var(--background-modifier-border)';
        sidebar.style.paddingRight = '15px';
        sidebar.style.overflowY = 'auto';

        const mainArea = layout.createDiv('roster-main');
        mainArea.style.flex = '1';
        mainArea.style.overflowY = 'auto';
        mainArea.style.paddingRight = '15px';

        this.renderSidebar(sidebar);
        this.renderMainArea(mainArea);
    }

    renderSidebar(sidebar: HTMLElement) {
        sidebar.createEl('h3', { text: 'Scenarios' });
        
        const btnNewScen = sidebar.createEl('button', { text: '+ New Scenario', cls: 'mod-cta' });
        btnNewScen.style.width = '100%';
        btnNewScen.style.marginBottom = '10px';
        btnNewScen.onclick = () => {
            new PromptModal(this.app, 'New Scenario', 'Enter the name of the new Scenario', 'Scenario Name', '', async (name) => {
                if (name) {
                    const safeName = name.replace(/[^a-zA-Z0-9 -]/g, '').trim();
                    if (safeName) {
                        const newPath = normalizePath(`${this.plugin.settings.baseFolder}/Roster/${safeName}`);
                        if (!(await this.app.vault.adapter.exists(newPath))) {
                            await this.app.vault.createFolder(newPath);
                            await this.loadInstances();
                            this.selectedScenario = safeName;
                            this.selectedEncounter = null;
                            this.display();
                        } else {
                            new Notice('Scenario already exists!');
                        }
                    }
                }
            }).open();
        };

        if (this.scenarios.length === 0) {
            sidebar.createEl('p', { text: 'No Scenarios found.' });
            return;
        }

        for (const sc of this.scenarios) {
            const item = sidebar.createDiv('roster-scenario-item');
            if (this.selectedScenario === sc.name) item.addClass('is-active');
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';

            const nameSpan = item.createEl('span', { text: sc.name });
            nameSpan.style.cursor = 'pointer';
            nameSpan.style.flex = '1';
            nameSpan.onclick = () => {
                this.selectedScenario = sc.name;
                this.selectedEncounter = null;
                this.display();
            };

            const btnDel = item.createEl('button', { text: '🗑️', cls: 'mod-warning' });
            btnDel.style.padding = '2px 6px';
            btnDel.onclick = (e) => {
                e.stopPropagation();
                let encCount = sc.encounters.length;
                let instCount = sc.encounters.reduce((sum, e) => sum + e.instances.length, 0);
                const msg = `Are you sure you want to delete the Scenario '${sc.name}'? This will permanently delete ${encCount} Encounters and ${instCount} enemies!`;
                new ConfirmModal(this.app, msg, async (result) => {
                    if (result) {
                        const folder = this.app.vault.getAbstractFileByPath(sc.path);
                        if (folder) {
                            await this.app.vault.trash(folder, true);
                            new Notice(`Deleted Scenario ${sc.name}`);
                            if (this.selectedScenario === sc.name) {
                                this.selectedScenario = null;
                                this.selectedEncounter = null;
                            }
                            await this.loadInstances();
                            this.display();
                        }
                    }
                }).open();
            };
        }
    }

    renderMainArea(mainArea: HTMLElement) {
        if (!this.selectedScenario) {
            mainArea.createEl('p', { text: 'Select a Scenario from the sidebar.' });
            return;
        }

        const scenario = this.scenarios.find(s => s.name === this.selectedScenario);
        if (!scenario) return;

        const header = mainArea.createDiv('roster-header');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        header.createEl('h3', { text: `Scenario: ${scenario.name}`, cls: 'mythras-item-name-grid' });
        
        const btnNewEnc = header.createEl('button', { text: '+ New Encounter', cls: 'mod-cta' });
        btnNewEnc.onclick = () => {
            new PromptModal(this.app, 'New Encounter', 'Enter the name of the new Encounter', 'Encounter Name', '', async (name) => {
                if (name) {
                    const safeName = name.replace(/[^a-zA-Z0-9 -]/g, '').trim();
                    if (safeName) {
                        const newPath = normalizePath(`${scenario.path}/${safeName}`);
                        if (!(await this.app.vault.adapter.exists(newPath))) {
                            await this.app.vault.createFolder(newPath);
                            await this.loadInstances();
                            this.selectedEncounter = safeName;
                            this.display();
                        } else {
                            new Notice('Encounter already exists!');
                        }
                    }
                }
            }).open();
        };

        const tagCloud = mainArea.createDiv('roster-tag-cloud');
        tagCloud.style.display = 'flex';
        tagCloud.style.flexWrap = 'wrap';
        tagCloud.style.gap = '8px';
        tagCloud.style.marginTop = '15px';
        tagCloud.style.marginBottom = '20px';

        for (const enc of scenario.encounters) {
            const tag = tagCloud.createDiv('roster-tag');
            if (this.selectedEncounter === enc.name) tag.addClass('is-active');
            tag.style.display = 'flex';
            tag.style.alignItems = 'center';
            tag.style.gap = '8px';

            const nameSpan = tag.createEl('span', { text: `${enc.name} (${enc.instances.length})` });
            nameSpan.style.cursor = 'pointer';
            nameSpan.onclick = () => {
                this.selectedEncounter = enc.name;
                this.display();
            };

            const btnDel = tag.createEl('button', { text: 'X', cls: 'mod-warning' });
            btnDel.style.padding = '0 4px';
            btnDel.style.fontSize = '0.8em';
            btnDel.onclick = (e) => {
                e.stopPropagation();
                const instCount = enc.instances.length;
                const msg = `Are you sure you want to delete the Encounter '${enc.name}'? This will permanently delete ${instCount} enemies!`;
                new ConfirmModal(this.app, msg, async (result) => {
                    if (result) {
                        const folder = this.app.vault.getAbstractFileByPath(enc.path);
                        if (folder) {
                            await this.app.vault.trash(folder, true);
                            new Notice(`Deleted Encounter ${enc.name}`);
                            if (this.selectedEncounter === enc.name) this.selectedEncounter = null;
                            await this.loadInstances();
                            this.display();
                        }
                    }
                }).open();
            };
        }

        if (!this.selectedEncounter) {
            mainArea.createEl('p', { text: 'Select an Encounter from the tags above to view enemies.' });
            return;
        }

        const encounter = scenario.encounters.find(e => e.name === this.selectedEncounter);
        if (!encounter) return;

        const tableControls = mainArea.createDiv();
        tableControls.style.display = 'flex';
        tableControls.style.justifyContent = 'space-between';
        tableControls.style.alignItems = 'center';

        tableControls.createEl('h4', { text: `Enemies in ${encounter.name}` });

        const btnAddEnemy = tableControls.createEl('button', { text: '+ Add Enemy', cls: 'mod-cta' });
        btnAddEnemy.onclick = () => {
            import('./modal-generate').then((m) => {
                new m.MythrasGenerateModal(this.app, this.plugin, scenario.name, encounter.name, async () => {
                    await this.loadInstances();
                    this.display();
                }).open();
            });
        };

        if (encounter.instances.length === 0) {
            mainArea.createEl('p', { text: 'This encounter is empty. Add some enemies!' });
            return;
        }

        const table = mainArea.createEl('table', { cls: 'armory-table' });
        table.style.width = '100%';
        table.style.textAlign = 'left';
        table.style.borderCollapse = 'collapse';
        table.style.marginTop = '15px';

        const tr = table.createEl('thead').createEl('tr');
        ['Instance Name', 'Template', 'HP', 'Actions'].forEach(h => {
            const th = tr.createEl('th', { text: h });
            th.style.padding = '8px';
            th.style.borderBottom = '1px solid var(--background-modifier-border)';
        });

        const tbody = table.createEl('tbody');

        for (const inst of encounter.instances) {
            const row = tbody.createEl('tr');
            row.style.borderBottom = '1px solid var(--background-modifier-border-alt)';
            row.onmouseenter = () => row.style.backgroundColor = 'var(--background-modifier-hover)';
            row.onmouseleave = () => row.style.backgroundColor = 'transparent';

            row.createEl('td', { text: inst.data.instanceName }).style.padding = '8px';
            row.createEl('td', { text: inst.data.templateName }).style.padding = '8px';
            
            const hpTd = row.createEl('td');
            hpTd.style.padding = '8px';
            if (inst.data.hitLocations && inst.data.hitLocations.length > 0) {
                const totalHp = inst.data.hitLocations.reduce((sum, h) => sum + h.currentHp, 0);
                const maxHp = inst.data.hitLocations.reduce((sum, h) => sum + h.hp, 0);
                hpTd.setText(`${totalHp} / ${maxHp}`);
            } else {
                hpTd.setText('-');
            }

            const actionsTd = row.createEl('td');
            actionsTd.style.padding = '8px';
            actionsTd.style.display = 'flex';
            actionsTd.style.gap = '8px';

            const btnEdit = actionsTd.createEl('button', { text: 'Edit' });
            btnEdit.onclick = (e) => {
                e.stopPropagation();
                const copyData = JSON.parse(JSON.stringify(inst.data));
                this.selectedInstance = { file: inst.file, data: copyData };
                this.currentView = 'edit';
                this.editTab = 'general';
                this.display();
            };

            const btnCopy = actionsTd.createEl('button', { text: 'Copy ID' });
            btnCopy.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(`\`\`\`enemy\n${inst.data.id}\n\`\`\``);
                new Notice("Copied codeblock to clipboard!");
            };

            const btnDelete = actionsTd.createEl('button', { text: '🗑️', cls: 'mod-warning' });
            btnDelete.onclick = (e) => {
                e.stopPropagation();
                new ConfirmModal(this.app, `Do you really want to delete ${inst.data.instanceName}?`, async (result) => {
                    if (result) {
                        await this.app.vault.trash(inst.file, true);
                        new Notice(`Deleted ${inst.data.instanceName}`);
                        await this.loadInstances();
                        this.display();
                    }
                }).open();
            };
        }
    }

    renderEditView(container: HTMLElement) {
        if (!this.selectedInstance) return;
        const data = this.selectedInstance.data;

        const topBar = container.createDiv();
        topBar.style.display = 'flex';
        topBar.style.justifyContent = 'space-between';
        topBar.style.alignItems = 'center';
        topBar.style.marginBottom = '20px';

        topBar.createEl('h2', { text: `Edit: ${data.instanceName}` });

        const btnGroup = topBar.createDiv();
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '10px';

        const btnCancel = btnGroup.createEl('button', { text: 'Cancel / Back' });
        btnCancel.onclick = () => {
            this.selectedInstance = null;
            this.currentView = 'list';
            this.display();
        };

        const btnSave = btnGroup.createEl('button', { text: 'Save & Return', cls: 'mod-cta' });
        btnSave.onclick = async () => {
            const dmgMod = data.attributes['Damage Mod'] as string;
            data.weapons.forEach(w => {
                const aw = this.plugin.armoryCache.find(a => a.name.toLowerCase() === w.name.toLowerCase());
                if (aw && aw.damageModifier !== false) {
                    let baseDmg = aw.damage;
                    if (dmgMod && dmgMod !== '+0' && dmgMod !== '0') {
                        const mod = dmgMod.startsWith('+') || dmgMod.startsWith('-') ? dmgMod : '+' + dmgMod;
                        baseDmg += mod;
                    }
                    w.damage = baseDmg;
                }
            });

            await this.saveSelectedInstance();
            this.selectedInstance = null;
            this.currentView = 'list';
            this.display();
        };

        const tabsDiv = container.createDiv('armory-tabs');
        tabsDiv.style.display = 'flex';
        tabsDiv.style.gap = '10px';
        tabsDiv.style.borderBottom = '1px solid var(--background-modifier-border)';
        tabsDiv.style.paddingBottom = '10px';
        tabsDiv.style.marginBottom = '20px';

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

        const formArea = container.createDiv();
        formArea.style.display = 'flex';
        formArea.style.flexDirection = 'column';
        formArea.style.gap = '15px';
        formArea.style.overflowY = 'auto';
        formArea.style.maxHeight = 'calc(100% - 150px)';
        formArea.style.paddingRight = '10px';

        const createTextField = (label: string, val: string, onChange: (v: string) => void) => {
            const wrap = formArea.createDiv();
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.createEl('label', { text: label }).style.fontWeight = 'bold';
            const inp = wrap.createEl('input', { type: 'text' });
            inp.value = val;
            inp.oninput = (e) => onChange((e.target as HTMLInputElement).value);
        };

        if (this.editTab === 'general') {
            createTextField('Instance Name', data.instanceName, v => data.instanceName = v);
            createTextField('Scenario', data.scenario, v => data.scenario = v);
            createTextField('Encounter', data.encounter, v => data.encounter = v);
            
            const notesWrap = formArea.createDiv();
            notesWrap.style.display = 'flex';
            notesWrap.style.flexDirection = 'column';
            notesWrap.createEl('label', { text: 'Notes' }).style.fontWeight = 'bold';
            const ta = notesWrap.createEl('textarea');
            ta.value = data.notes || '';
            ta.rows = 6;
            ta.oninput = (e) => data.notes = (e.target as HTMLTextAreaElement).value;

        } else if (this.editTab === 'hitlocations') {
            const table = formArea.createEl('table', { cls: 'armory-table' });
            table.style.width = '100%';
            const thead = table.createEl('thead').createEl('tr');
            ['Location', 'Range', 'AP', 'Current HP', 'Max HP'].forEach(h => thead.createEl('th', { text: h }).style.padding = '8px');
            const tbody = table.createEl('tbody');

            data.hitLocations.forEach(hl => {
                const tr = tbody.createEl('tr');
                tr.createEl('td', { text: hl.name }).style.padding = '8px';
                tr.createEl('td', { text: hl.range }).style.padding = '8px';
                
                const apTd = tr.createEl('td');
                apTd.style.padding = '8px';
                const apInp = apTd.createEl('input', { type: 'text' });
                apInp.style.width = '60px';
                apInp.value = hl.ap;
                apInp.oninput = (e) => hl.ap = (e.target as HTMLInputElement).value;

                const currTd = tr.createEl('td');
                currTd.style.padding = '8px';
                const currInp = currTd.createEl('input', { type: 'number' });
                currInp.style.width = '60px';
                currInp.value = hl.currentHp.toString();
                currInp.oninput = (e) => hl.currentHp = parseInt((e.target as HTMLInputElement).value) || 0;

                const maxTd = tr.createEl('td');
                maxTd.style.padding = '8px';
                const maxInp = maxTd.createEl('input', { type: 'number' });
                maxInp.style.width = '60px';
                maxInp.value = hl.hp.toString();
                maxInp.oninput = (e) => hl.hp = parseInt((e.target as HTMLInputElement).value) || 0;
            });

        } else if (this.editTab === 'stats') {
            const grid = formArea.createDiv();
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
            grid.style.gap = '15px';

            const renderObj = (obj: any, label: string) => {
                formArea.createEl('h3', { text: label });
                const wrap = formArea.createDiv();
                wrap.style.display = 'grid';
                wrap.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
                wrap.style.gap = '10px';
                
                Object.keys(obj).forEach(k => {
                    const field = wrap.createDiv();
                    field.style.display = 'flex';
                    field.style.flexDirection = 'column';
                    field.createEl('label', { text: k });
                    const inp = field.createEl('input', { type: typeof obj[k] === 'number' ? 'number' : 'text' });
                    inp.value = obj[k].toString();
                    inp.oninput = (e) => {
                        const val = typeof obj[k] === 'number' 
                            ? parseInt((e.target as HTMLInputElement).value) || 0 
                            : (e.target as HTMLInputElement).value;
                        obj[k] = val;

                        if (k === 'Damage Mod') {
                            data.weapons.forEach(w => {
                                const aw = this.plugin.armoryCache.find(a => a.name.toLowerCase() === w.name.toLowerCase());
                                if (aw && aw.damageModifier !== false) {
                                    let baseDmg = aw.damage;
                                    if (val && val !== '+0' && val !== '0') {
                                        const mod = (val as string).startsWith('+') || (val as string).startsWith('-') ? val : '+' + val;
                                        baseDmg += mod;
                                    }
                                    w.damage = baseDmg;
                                }
                            });
                        }
                    };
                });
            };

            renderObj(data.stats, 'Core Stats');
            renderObj(data.attributes, 'Attributes');

        } else if (this.editTab === 'skills') {
            const renderDict = (obj: Record<string, number>, label: string) => {
                formArea.createEl('h3', { text: label });
                const table = formArea.createEl('table');
                table.style.width = '100%';
                table.style.maxWidth = '600px';
                const tbody = table.createEl('tbody');
                
                Object.keys(obj).forEach(k => {
                    const tr = tbody.createEl('tr');
                    tr.createEl('td', { text: k }).style.padding = '4px';
                    const tdInp = tr.createEl('td');
                    tdInp.style.padding = '4px';
                    const inp = tdInp.createEl('input', { type: 'number' });
                    inp.value = obj[k].toString();
                    inp.oninput = (e) => obj[k] = parseInt((e.target as HTMLInputElement).value) || 0;
                });
            };

            renderDict(data.standardSkills, 'Standard Skills');
            renderDict(data.customSkills, 'Custom Skills');
            renderDict(data.combatStyles, 'Combat Styles');

        } else if (this.editTab === 'weapons') {
            const btnAdd = formArea.createEl('button', { text: '+ Add Weapon', cls: 'mod-cta' });
            btnAdd.style.width = '200px';
            btnAdd.onclick = () => {
                const defaultWeapon = this.plugin.armoryCache.length > 0 ? this.plugin.armoryCache[0] : { name: 'New Weapon' };
                const newWeapon = JSON.parse(JSON.stringify(defaultWeapon));
                newWeapon.isOptional = false;
                data.weapons.push(newWeapon);
                this.display(); // re-render
            };

            data.weapons.forEach((w, idx) => {
                const wrap = formArea.createDiv();
                wrap.style.border = '1px solid var(--background-modifier-border)';
                wrap.style.padding = '10px';
                wrap.style.borderRadius = '6px';
                wrap.style.position = 'relative';

                const btnDel = wrap.createEl('button', { text: '🗑️', cls: 'mod-warning' });
                btnDel.style.position = 'absolute';
                btnDel.style.top = '10px';
                btnDel.style.right = '10px';
                btnDel.onclick = () => {
                    data.weapons.splice(idx, 1);
                    this.display();
                };

                const grid = wrap.createDiv();
                grid.style.display = 'grid';
                grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
                grid.style.gap = '10px';
                grid.style.marginTop = '20px';

                const selWrap = grid.createDiv();
                selWrap.style.display = 'flex';
                selWrap.style.flexDirection = 'column';
                selWrap.createEl('label', { text: 'Select Weapon from Armory' }).style.fontSize = '0.85em';
                const sel = selWrap.createEl('select');
                
                const inArmory = this.plugin.armoryCache.some(aw => aw.name.toLowerCase() === w.name.toLowerCase());
                if (!inArmory) {
                    sel.createEl('option', { value: w.name, text: `${w.name} (Custom)` }).selected = true;
                }

                this.plugin.armoryCache.forEach(aw => {
                    const opt = sel.createEl('option', { value: aw.name, text: aw.name });
                    if (w.name.toLowerCase() === aw.name.toLowerCase()) {
                        opt.selected = true;
                    }
                });

                sel.onchange = (e) => {
                    const selectedName = (e.target as HTMLSelectElement).value;
                    const armoryWeapon = this.plugin.armoryCache.find(aw => aw.name === selectedName);
                    if (armoryWeapon) {
                        let newDamage = armoryWeapon.damage;
                        const damageMod = data.attributes['Damage Mod'] as string;
                        if (newDamage && armoryWeapon.damageModifier !== false && damageMod && damageMod !== '+0' && damageMod !== '0') {
                            const mod = damageMod.startsWith('+') || damageMod.startsWith('-') ? damageMod : '+' + damageMod;
                            newDamage += mod;
                        }

                        Object.assign(w, armoryWeapon);
                        w.damage = newDamage;
                        this.display();
                    }
                };

                const createField = (label: string, field: 'ap' | 'hp') => {
                    const fWrap = grid.createDiv();
                    fWrap.style.display = 'flex';
                    fWrap.style.flexDirection = 'column';
                    fWrap.createEl('label', { text: label }).style.fontSize = '0.85em';
                    const inp = fWrap.createEl('input', { type: 'text' });
                    inp.value = (w[field] as string) || '';
                    inp.oninput = (e) => w[field] = (e.target as HTMLInputElement).value;
                };

                createField('AP', 'ap');
                createField('HP', 'hp');
                
                const readWrap = wrap.createDiv();
                readWrap.style.marginTop = '10px';
                readWrap.style.fontSize = '0.85em';
                readWrap.style.color = 'var(--text-muted)';
                readWrap.setText(`Damage: ${w.damage || '-'} | Type: ${w.type || '-'} | Size/Force: ${w.size || '-'} | Reach/Range: ${w.reach || w.range || '-'} | Special: ${w.specialFx || 'None'}`);
            });
        }
    }
}
