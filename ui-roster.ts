import { App, Modal, Setting, Notice, TFile, TFolder, normalizePath, setIcon } from 'obsidian';
import { ImageSuggestModal } from './modal-image-search';
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

export class MoveModal extends Modal {
    title: string;
    description: string;
    options: string[];
    onSubmit: (result: string | null) => void;

    constructor(app: App, title: string, description: string, options: string[], onSubmit: (result: string | null) => void) {
        super(app);
        this.title = title;
        this.description = description;
        this.options = options;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: this.title });
        contentEl.createEl('p', { text: this.description });

        let selected = this.options.length > 0 ? this.options[0] : '';
        new Setting(contentEl)
            .addDropdown(dropdown => {
                this.options.forEach(opt => dropdown.addOption(opt, opt));
                dropdown.onChange(val => selected = val);
            });

        new Setting(contentEl)
            .addButton(btn => btn.setButtonText('Move').setCta().onClick(() => {
                this.close();
                this.onSubmit(selected);
            }))
            .addButton(btn => btn.setButtonText('Cancel').onClick(() => {
                this.close();
                this.onSubmit(null);
            }));
    }
    
    onClose() {
        this.contentEl.empty();
    }
}

export class NewEncounterModal extends Modal {
    scenarios: string[];
    defaultScenario: string;
    folders: string[];
    onSubmit: (scenario: string | null, encounter: string | null, folderPath: string | null) => void;

    constructor(app: App, scenarios: string[], defaultScenario: string, folders: string[], onSubmit: (scenario: string | null, encounter: string | null, folderPath: string | null) => void) {
        super(app);
        this.scenarios = scenarios;
        this.defaultScenario = defaultScenario;
        this.folders = folders;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'New encounter' });
        contentEl.createEl('p', { text: 'Create a new encounter note in your vault.' });

        let scenarioValue = this.defaultScenario || (this.scenarios.length > 0 ? this.scenarios[0] : '');
        let encounterValue = '';
        let folderValue = this.app.workspace.getActiveFile()?.parent?.path || '/';
        if (folderValue === '/') folderValue = '';

        const scenarioSetting = new Setting(contentEl)
            .setName('Scenario')
            .addText(text => {
                text.setValue(scenarioValue);
                text.onChange(val => scenarioValue = val);
                
                const datalistId = 'scenario-list-' + Math.random().toString(36).substring(7);
                const inputEl = text.inputEl;
                inputEl.setAttribute('list', datalistId);
                
                const datalist = document.createElement('datalist');
                datalist.id = datalistId;
                this.scenarios.forEach(scen => {
                    const option = document.createElement('option');
                    option.value = scen;
                    datalist.appendChild(option);
                });
                inputEl.parentElement?.appendChild(datalist);
            });

        const encounterSetting = new Setting(contentEl)
            .setName('Encounter Name')
            .addText(text => {
                text.onChange(val => encounterValue = val);
            });
            
        const folderSetting = new Setting(contentEl)
            .setName('Vault Path')
            .setDesc('Where should the Markdown note be created?')
            .addText(text => {
                text.setValue(folderValue);
                text.onChange(val => folderValue = val);
                
                const datalistId = 'folder-list-' + Math.random().toString(36).substring(7);
                const inputEl = text.inputEl;
                inputEl.setAttribute('list', datalistId);
                
                const datalist = document.createElement('datalist');
                datalist.id = datalistId;
                this.folders.forEach(f => {
                    const option = document.createElement('option');
                    option.value = f;
                    datalist.appendChild(option);
                });
                inputEl.parentElement?.appendChild(datalist);
            });

        new Setting(contentEl)
            .addButton(btn => btn.setButtonText('Create').setCta().onClick(() => {
                this.close();
                this.onSubmit(scenarioValue.trim(), encounterValue.trim(), folderValue.trim());
            }))
            .addButton(btn => btn.setButtonText('Cancel').onClick(() => {
                this.close();
                this.onSubmit(null, null, null);
            }));
            
        setTimeout(() => encounterSetting.controlEl.querySelector('input')?.focus(), 100);
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
    id: string;
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
    
    selectedInstancePaths: Set<string> = new Set();
    lastSelectedInstancePath: string | null = null;

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
        const scenarioMap = new Map<string, RosterScenario>();
        const encounterMap = new Map<string, RosterEncounter>();

        const getOrCreateScenario = (name: string): RosterScenario => {
            let scen = scenarioMap.get(name);
            if (!scen) {
                scen = { name, path: `${this.plugin.settings.baseFolder}/Roster/${name}`, encounters: [] };
                scenarioMap.set(name, scen);
                this.scenarios.push(scen);
            }
            return scen;
        };

        // 1. Scan Markdown Files for Encounters
        const mdFiles = this.app.vault.getMarkdownFiles();
        for (const file of mdFiles) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.type === 'mythras-encounter') {
                const encounterId = cache.frontmatter['encounter-id'] || file.basename;
                const scenarioName = cache.frontmatter['scenario'] || 'Uncategorized';
                const encounterName = file.basename;

                const scenario = getOrCreateScenario(scenarioName);
                
                let enc = scenario.encounters.find(e => e.id === encounterId || e.name === encounterName);
                if (!enc) {
                    enc = {
                        name: encounterName,
                        path: file.path,
                        id: encounterId,
                        instances: []
                    };
                    scenario.encounters.push(enc);
                }
                
                encounterMap.set(encounterId, enc);
                encounterMap.set(encounterName, enc);
            }
        }

        // 2. Scan JSON Files in Roster for Enemy Instances
        const rosterPath = `${this.plugin.settings.baseFolder}/Roster`;
        const rootFolder = this.app.vault.getAbstractFileByPath(rosterPath);
        
        if (rootFolder && rootFolder instanceof TFolder) {
            const matchingFiles: TFile[] = [];
            const findJsonFiles = (f: any) => {
                if (f && 'children' in f) {
                    for (const child of f.children) {
                        findJsonFiles(child);
                    }
                } else if (f instanceof TFile && f.extension === 'json' && !f.name.startsWith('.')) {
                    matchingFiles.push(f);
                }
            };
            findJsonFiles(rootFolder);

            for (const file of matchingFiles) {
                try {
                    const content = await this.app.vault.read(file);
                    const data = JSON.parse(content) as MythrasInstance;
                    
                    if (!data || !data.templateName || !data.hitLocations || !data.id) {
                        // Skip non-instance JSON files like session state
                        continue;
                    }
                    
                    const encounterId = data.encounterId;
                    const legacyName = data.encounter || 'Random Encounter';
                    const legacyScenarioName = data.scenario || 'General';

                    let targetEnc: RosterEncounter | undefined = undefined;
                    if (encounterId) {
                        targetEnc = encounterMap.get(encounterId);
                    }
                    if (!targetEnc) {
                        targetEnc = encounterMap.get(legacyName);
                    }

                    if (!targetEnc) {
                        const scenario = getOrCreateScenario(legacyScenarioName);
                        targetEnc = scenario.encounters.find(e => e.name === legacyName || (encounterId && e.id === encounterId));
                        if (!targetEnc) {
                            targetEnc = { 
                                name: legacyName, 
                                path: `${rosterPath}/${legacyScenarioName}/${legacyName}`, 
                                id: encounterId || legacyName, 
                                instances: [] 
                            };
                            scenario.encounters.push(targetEnc);
                        }
                        if (encounterId) encounterMap.set(encounterId, targetEnc);
                        encounterMap.set(legacyName, targetEnc);
                    }

                    if (!data.encounterId && targetEnc.id) {
                        data.encounterId = targetEnc.id;
                        this.app.vault.modify(file, JSON.stringify(data, null, 2)).catch(e => {});
                    }

                    targetEnc.instances.push({ file, data });
                } catch (e) {}
            }
        }

        // Sort instances by last modified
        for (const scenario of this.scenarios) {
            for (const enc of scenario.encounters) {
                enc.instances.sort((a, b) => b.data.lastModified - a.data.lastModified);
            }
            scenario.encounters.sort((a, b) => a.name.localeCompare(b.name));
        }

        this.scenarios.sort((a, b) => {
            if (a.name === 'Uncategorized') return 1;
            if (b.name === 'Uncategorized') return -1;
            return a.name.localeCompare(b.name);
        });
    }

    async saveSelectedInstance() {
        if (!this.selectedInstance) return;
        
        this.selectedInstance.data.lastModified = Date.now();
        if (!this.selectedInstance.data.encounterId) {
            for (const scen of this.scenarios) {
                const enc = scen.encounters.find(e => e.name === this.selectedInstance!.data.encounter);
                if (enc) {
                    this.selectedInstance.data.encounterId = enc.id;
                    break;
                }
            }
        }
        
        const dataStr = JSON.stringify(this.selectedInstance.data, null, 2);
        
        const oldFile = this.selectedInstance.file;
        const newFolderPath = normalizePath(`${this.plugin.settings.baseFolder}/Roster`);
        
        if (oldFile.parent?.path !== newFolderPath) {
            if (!await this.app.vault.adapter.exists(newFolderPath)) {
                await this.app.vault.createFolder(newFolderPath);
            }
            
            const newFilePath = normalizePath(`${newFolderPath}/${oldFile.name}`);
            if (await this.app.vault.adapter.exists(newFilePath)) {
                // If a file with the same name already exists in root, maybe handle collision?
                // For now, let's just delete the old one and overwrite the new one, or rename.
                // Usually oldFile.name is unique enough (UUID-based).
                await this.app.vault.modify(this.app.vault.getAbstractFileByPath(newFilePath) as TFile, dataStr);
                await this.app.vault.delete(oldFile);
            } else {
                await this.app.vault.create(newFilePath, dataStr);
                await this.app.vault.delete(oldFile);
            }
            
            const newFile = this.app.vault.getAbstractFileByPath(newFilePath) as TFile;
            this.selectedInstance.file = newFile;
        } else {
            await this.app.vault.modify(oldFile, dataStr);
        }
        
        await this.loadInstances();
        this.display();
        new Notice("Saved successfully.");
    }

    async openEditView(instanceId: string) {
        if (this.scenarios.length === 0) {
            await this.loadInstances();
        }
        for (const scenario of this.scenarios) {
            for (const encounter of scenario.encounters) {
                for (const inst of encounter.instances) {
                    if (inst.data.id === instanceId) {
                        this.selectedInstance = { file: inst.file, data: JSON.parse(JSON.stringify(inst.data)) };
                        this.currentView = 'edit';
                        this.editTab = 'general';
                        this.render();
                        return;
                    }
                }
            }
        }
        new Notice(`Enemy not found: ${instanceId}`);
    }

    openEncounterView(encounterId: string) {
        for (const scenario of this.scenarios) {
            for (const encounter of scenario.encounters) {
                if (encounter.id === encounterId || encounter.name.trim().toLowerCase() === encounterId.trim().toLowerCase()) {
                    this.selectedScenario = scenario.name;
                    this.selectedEncounter = encounter.name;
                    this.currentView = 'list';
                    this.selectedInstance = null;
                    this.render();
                    return;
                }
            }
        }
        new Notice(`Encounter not found: ${encounterId}`);
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        
        if (this.currentView === 'edit' && this.selectedInstance) {
            this.renderEditView(containerEl);
            return;
        }

        const layout = containerEl.createDiv('roster-layout mythras-manager-container');

        const sidebar = layout.createDiv('roster-sidebar');

        const mainArea = layout.createDiv('roster-main');

        this.renderSidebar(sidebar);
        this.renderMainArea(mainArea);
    }

    renderSidebar(sidebar: HTMLElement) {
        sidebar.createEl('h3', { text: 'Scenarios' });
        
        const btnNewEnc = sidebar.createEl('button', { text: '+ New Encounter', cls: 'mythras-btn-primary' });
        btnNewEnc.style.width = '100%';
        btnNewEnc.style.marginBottom = '10px';
        btnNewEnc.onclick = () => {
            const allScenarios = this.scenarios.map(s => s.name);
            const allFolders = this.app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder).map(f => f.path);
            new NewEncounterModal(this.app, allScenarios, this.selectedScenario || '', allFolders, async (scenarioName, encounterName, folderPath) => {
                if (scenarioName && encounterName) {
                    const safeScenario = scenarioName.replace(/[^\p{L}\p{N} -]/gu, '').trim() || 'Uncategorized';
                    const safeName = encounterName.replace(/[^\p{L}\p{N} -]/gu, '').trim();
                    const safeFolder = folderPath ? normalizePath(folderPath) : '';
                    if (safeName) {
                        const targetDir = safeFolder || '/';
                        if (targetDir !== '/' && !(await this.app.vault.adapter.exists(targetDir))) {
                            const parts = targetDir.split('/');
                            let currentPath = '';
                            for (const part of parts) {
                                if (part === '') continue;
                                currentPath = currentPath === '' ? part : `${currentPath}/${part}`;
                                if (!await this.app.vault.adapter.exists(currentPath)) {
                                    await this.app.vault.createFolder(currentPath);
                                }
                            }
                        }
                        
                        const newFilePath = normalizePath(targetDir === '/' ? `${safeName}.md` : `${targetDir}/${safeName}.md`);
                        if (!(await this.app.vault.adapter.exists(newFilePath))) {
                            const encounterId = 'enc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
                            const content = `---\ntype: mythras-encounter\nencounter-id: "${encounterId}"\nscenario: "${safeScenario}"\n---\n\n`;
                            await this.app.vault.create(newFilePath, content);
                            
                            setTimeout(async () => {
                                await this.loadInstances();
                                this.selectedScenario = safeScenario;
                                this.selectedEncounter = safeName;
                                this.selectedInstancePaths.clear();
                                this.display();
                            }, 300);
                        } else {
                            new Notice('A note with this name already exists in that folder!');
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
            item.onclick = () => {
                this.selectedScenario = sc.name;
                this.selectedEncounter = null;
                this.selectedInstancePaths.clear();
                this.display();
            };

            const nameSpan = item.createEl('span', { text: sc.name });

        }
    }

    renderMainArea(mainArea: HTMLElement) {
        if (!this.selectedScenario) {
            mainArea.createEl('p', { text: 'Select a Scenario from the sidebar.' });
            return;
        }

        const scenario = this.scenarios.find(s => s.name === this.selectedScenario);
        if (!scenario) return;

        const header = mainArea.createDiv('roster-header mythras-manager-header');
        
        const titleWrap = header.createDiv('mythras-manager-header-controls');

        const h3 = titleWrap.createEl('h3', { text: scenario.name });
        
        const btnRenameScen = titleWrap.createEl('button', { cls: 'clickable-icon' });
        setIcon(btnRenameScen, 'pencil');
        btnRenameScen.onclick = (e) => {
            e.stopPropagation();
            new PromptModal(this.app, 'Rename Scenario', 'Enter new name:', 'Name', scenario.name, async (name) => {
                if (name && name !== scenario.name) {
                    const safeName = name.replace(/[^\p{L}\p{N} -]/gu, '').trim();
                    if (!safeName) return;
                    
                    const oldPath = normalizePath(`${this.plugin.settings.baseFolder}/Roster/${scenario.name}`);
                    const newPath = normalizePath(`${this.plugin.settings.baseFolder}/Roster/${safeName}`);
                    const folder = this.app.vault.getAbstractFileByPath(oldPath);
                    if (folder && !(await this.app.vault.adapter.exists(newPath))) {
                        await this.app.vault.rename(folder, newPath);
                    }
                    
                    for (const enc of scenario.encounters) {
                        const mdFile = this.app.vault.getAbstractFileByPath(enc.path);
                        if (mdFile instanceof TFile && mdFile.extension === 'md') {
                            await this.app.fileManager.processFrontMatter(mdFile, (fm) => {
                                if (fm.scenario === scenario.name) fm.scenario = safeName;
                            });
                        }
                    }
                    
                    setTimeout(async () => {
                        this.selectedScenario = safeName;
                        await this.loadInstances();
                        this.display();
                        new Notice(`Scenario renamed to ${safeName}`);
                    }, 500);
                }
            }).open();
        };

        const btnDelScen = titleWrap.createEl('button', { cls: 'clickable-icon mod-warning' });
        setIcon(btnDelScen, 'trash-2');
        btnDelScen.onclick = (e) => {
            e.stopPropagation();
            let encCount = scenario.encounters.length;
            let instCount = scenario.encounters.reduce((sum, e) => sum + e.instances.length, 0);
            const msg = `Are you sure you want to delete the Scenario '${scenario.name}'? This will permanently delete ${encCount} Encounters and ${instCount} enemies! Markdown notes will NOT be deleted, but will be disconnected from the roster.`;
            new ConfirmModal(this.app, msg, async (result) => {
                if (result) {
                    for (const enc of scenario.encounters) {
                        for (const inst of enc.instances) {
                            if (inst.file instanceof TFile) {
                                await this.app.vault.trash(inst.file, true);
                            }
                        }
                        
                        const mdFile = this.app.vault.getAbstractFileByPath(enc.path);
                        if (mdFile instanceof TFile && mdFile.extension === 'md') {
                            await this.app.fileManager.processFrontMatter(mdFile, (fm) => {
                                delete fm.scenario;
                            });
                        }
                    }
                    
                    new Notice(`Deleted Scenario ${scenario.name}`);
                    this.selectedScenario = null;
                    this.selectedEncounter = null;
                    this.selectedInstancePaths.clear();
                    
                    setTimeout(async () => {
                        await this.loadInstances();
                        this.display();
                    }, 500);
                }
            }).open();
        };

        const tagCloud = mainArea.createDiv('roster-tag-cloud');

        for (const enc of scenario.encounters) {
            const tag = tagCloud.createDiv('roster-tag');
            if (this.selectedEncounter === enc.name) tag.addClass('is-active');
            tag.onclick = () => {
                this.selectedEncounter = enc.name;
                this.selectedInstancePaths.clear();
                this.display();
            };

            const nameSpan = tag.createEl('span', { text: `${enc.name} (${enc.instances.length})` });

            const btnRename = tag.createEl('button', { cls: 'clickable-icon' });
            setIcon(btnRename, 'pencil');
            btnRename.onclick = (e) => {
                e.stopPropagation();
                new PromptModal(this.app, 'Rename Encounter', 'Enter new name:', 'Name', enc.name, async (name) => {
                    if (name && name !== enc.name) {
                        const safeName = name.replace(/[^\p{L}\p{N} -]/gu, '').trim();
                        if (!safeName) return;
                        
                        const mdFile = this.app.vault.getAbstractFileByPath(enc.path);
                        if (mdFile instanceof TFile && mdFile.extension === 'md') {
                            const newPath = normalizePath(`${mdFile.parent?.path}/${safeName}.md`);
                            if (!(await this.app.vault.adapter.exists(newPath))) {
                                await this.app.fileManager.renameFile(mdFile, newPath);
                                
                                setTimeout(async () => {
                                    if (this.selectedEncounter === enc.name) this.selectedEncounter = safeName;
                                    await this.loadInstances();
                                    this.display();
                                }, 500);
                            } else {
                                new Notice("A note with this name already exists!");
                            }
                        } else {
                            new Notice("Encounter note not found!");
                        }
                    }
                }).open();
            };

            const btnCopyEnc = tag.createEl('button', { cls: 'clickable-icon' });
            setIcon(btnCopyEnc, 'copy');
            btnCopyEnc.onclick = (e) => {
                e.stopPropagation();
                const codeBlock = `\`\`\`mythras-encounter\nid: ${enc.id}\n\`\`\``;
                navigator.clipboard.writeText(codeBlock).then(() => {
                    new Notice("Copied encounter block to clipboard!");
                }).catch(() => {
                    new Notice("Failed to copy to clipboard.");
                });
            };

            const btnMove = tag.createEl('button', { cls: 'clickable-icon' });
            setIcon(btnMove, 'folder-output');
            btnMove.onclick = (e) => {
                e.stopPropagation();
                const otherScenarios = this.scenarios.filter(s => s.name !== scenario.name).map(s => s.name);
                if (otherScenarios.length === 0) {
                    new Notice("No other scenarios available to move to.");
                    return;
                }
                new MoveModal(this.app, 'Move Encounter', 'Select target Scenario', otherScenarios, async (target) => {
                    if (target) {
                        const mdFile = this.app.vault.getAbstractFileByPath(enc.path);
                        if (mdFile instanceof TFile && mdFile.extension === 'md') {
                            await this.app.fileManager.processFrontMatter(mdFile, (fm) => {
                                fm.scenario = target;
                            });
                            
                            setTimeout(async () => {
                                if (this.selectedEncounter === enc.name) {
                                    this.selectedEncounter = null;
                                    this.selectedInstancePaths.clear();
                                }
                                await this.loadInstances();
                                this.display();
                                new Notice(`Moved encounter to ${target}`);
                            }, 500);
                        }
                    }
                }).open();
            };

            const btnDel = tag.createEl('button', { cls: 'clickable-icon mod-warning' });
            setIcon(btnDel, 'trash-2');
            btnDel.onclick = (e) => {
                e.stopPropagation();
                const instCount = enc.instances.length;
                const msg = `Are you sure you want to delete the Encounter '${enc.name}'? This will permanently delete the Markdown note and ${instCount} enemies!`;
                new ConfirmModal(this.app, msg, async (result) => {
                    if (result) {
                        for (const inst of enc.instances) {
                            if (inst.file instanceof TFile) {
                                await this.app.vault.trash(inst.file, true);
                            }
                        }
                        
                        const mdFile = this.app.vault.getAbstractFileByPath(enc.path);
                        if (mdFile) await this.app.vault.trash(mdFile, true);
                        
                        new Notice(`Deleted Encounter ${enc.name}`);
                        if (this.selectedEncounter === enc.name) {
                            this.selectedEncounter = null;
                            this.selectedInstancePaths.clear();
                        }
                        setTimeout(async () => {
                            await this.loadInstances();
                            this.display();
                        }, 500);
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

        const tableControls = mainArea.createDiv('mythras-manager-header');

        tableControls.createEl('h4', { text: `Enemies in ${encounter.name}` });

        const btnGroup = tableControls.createDiv('mythras-manager-header-controls');

        if (this.selectedInstancePaths.size > 0) {
            const btnMoveSel = btnGroup.createEl('button', { text: `Move Selected (${this.selectedInstancePaths.size})`, cls: 'mythras-btn-secondary' });
            btnMoveSel.onclick = () => {
                const targetEncounters = scenario.encounters.filter(e => e.name !== encounter.name).map(e => e.name);
                if (targetEncounters.length === 0) {
                    new Notice("No other encounters in this scenario to move to.");
                    return;
                }
                new MoveModal(this.app, 'Move Enemies', 'Select target Encounter', targetEncounters, async (target) => {
                    if (target) {
                        const targetEnc = scenario.encounters.find(e => e.name === target);
                        if (!targetEnc) return;
                        
                        for (const path of Array.from(this.selectedInstancePaths)) {
                            const inst = encounter.instances.find(i => i.file.path === path);
                            if (inst) {
                                const newFilePath = normalizePath(`${targetEnc.path}/${inst.file.name}`);
                                inst.data.encounter = target;
                                const dataStr = JSON.stringify(inst.data, null, 2);
                                await this.app.vault.create(newFilePath, dataStr);
                                await this.app.vault.trash(inst.file, true);
                            }
                        }
                        this.selectedInstancePaths.clear();
                        this.lastSelectedInstancePath = null;
                        await this.loadInstances();
                        this.display();
                        new Notice(`Moved enemies to ${target}`);
                    }
                }).open();
            };
        }

        const btnAddEnemy = btnGroup.createEl('button', { text: '+ Add Enemy', cls: 'mythras-btn-primary' });
        btnAddEnemy.onclick = () => {
            import('./modal-generate').then((m) => {
                new m.MythrasGenerateModal(this.app, this.plugin, scenario.name, encounter.name, async () => {
                    await this.loadInstances();
                    this.display();
                }, encounter.id).open();
            });
        };

        const btnStartCombat = btnGroup.createEl('button', { text: '⚔️ Start Combat', cls: 'mythras-btn-cta' });
        btnStartCombat.onclick = () => {
            const rawInstances = encounter.instances.map(i => i.data);
            this.plugin.combatTrackerService.addInstances(rawInstances, scenario.name, encounter.name);
            new Notice(`Added ${rawInstances.length} enemies from "${encounter.name}" to Combat Tracker.`);
        };

        if (encounter.instances.length === 0) {
            mainArea.createEl('p', { text: 'This encounter is empty. Add some enemies!' });
            return;
        }

        const table = mainArea.createEl('table', { cls: 'armory-table mythras-manager-table' });

        const tr = table.createEl('thead').createEl('tr');
        ['', 'Instance Name', 'Template', 'HP', 'Actions'].forEach(h => {
            const th = tr.createEl('th', { text: h, cls: 'mythras-manager-th' });
            if (h === '') th.style.width = '40px';
        });

        const tbody = table.createEl('tbody');

        for (const inst of encounter.instances) {
            const row = tbody.createEl('tr', { cls: 'mythras-manager-tr' });

            const chkTd = row.createEl('td', { cls: 'mythras-manager-td' });
            const chk = chkTd.createEl('input', { type: 'checkbox' });
            chk.checked = this.selectedInstancePaths.has(inst.file.path);
            chk.onclick = (e) => {
                e.stopPropagation();
                if (e.shiftKey && this.lastSelectedInstancePath) {
                    const idx1 = encounter.instances.findIndex(i => i.file.path === this.lastSelectedInstancePath);
                    const idx2 = encounter.instances.findIndex(i => i.file.path === inst.file.path);
                    if (idx1 !== -1 && idx2 !== -1) {
                        const start = Math.min(idx1, idx2);
                        const end = Math.max(idx1, idx2);
                        for (let i = start; i <= end; i++) {
                            this.selectedInstancePaths.add(encounter.instances[i].file.path);
                        }
                    }
                } else {
                    if (chk.checked) {
                        this.selectedInstancePaths.add(inst.file.path);
                    } else {
                        this.selectedInstancePaths.delete(inst.file.path);
                    }
                    this.lastSelectedInstancePath = inst.file.path;
                }
                this.display();
            };

            row.createEl('td', { text: inst.data.instanceName, cls: 'mythras-manager-td' });
            row.createEl('td', { text: inst.data.templateName, cls: 'mythras-manager-td' });
            
            const hpTd = row.createEl('td', { cls: 'mythras-manager-td' });
            if (inst.data.hitLocations && inst.data.hitLocations.length > 0) {
                const totalHp = inst.data.hitLocations.reduce((sum, h) => sum + h.currentHp, 0);
                const maxHp = inst.data.hitLocations.reduce((sum, h) => sum + h.hp, 0);
                hpTd.setText(`${totalHp} / ${maxHp}`);
            } else {
                hpTd.setText('-');
            }

            const actionsTd = row.createEl('td', { cls: 'mythras-manager-td' });
            actionsTd.style.display = 'flex';
            actionsTd.style.gap = '8px';

            const btnEdit = actionsTd.createEl('button', { text: 'Edit', cls: 'mythras-btn-secondary' });
            btnEdit.onclick = (e) => {
                e.stopPropagation();
                const copyData = JSON.parse(JSON.stringify(inst.data));
                this.selectedInstance = { file: inst.file, data: copyData };
                this.currentView = 'edit';
                this.editTab = 'general';
                this.display();
            };

            const btnCopy = actionsTd.createEl('button', { text: 'Copy ID', cls: 'mythras-btn-secondary' });
            btnCopy.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(`\`\`\`enemy\n${inst.data.id}\n\`\`\``);
                new Notice("Copied codeblock to clipboard!");
            };

            const btnDelete = actionsTd.createEl('button', { cls: 'clickable-icon mod-warning' });
            setIcon(btnDelete, 'trash-2');
            btnDelete.onclick = (e) => {
                e.stopPropagation();
                new ConfirmModal(this.app, `Do you really want to delete ${inst.data.instanceName}?`, async (result) => {
                    if (result) {
                        await this.app.vault.trash(inst.file, true);
                        new Notice(`Deleted ${inst.data.instanceName}`);
                        this.selectedInstancePaths.delete(inst.file.path);
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

        const topBar = container.createDiv('mythras-manager-header');

        topBar.createEl('h2', { text: `Edit: ${data.instanceName}` });

        const btnGroup = topBar.createDiv('mythras-manager-header-controls');

        const btnCancel = btnGroup.createEl('button', { text: 'Cancel / Back', cls: 'mythras-btn-secondary' });
        btnCancel.onclick = () => {
            this.selectedInstance = null;
            this.currentView = 'list';
            this.display();
        };

        const btnSave = btnGroup.createEl('button', { text: 'Save & Return', cls: 'mythras-btn-primary' });
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

        const tabsDiv = container.createDiv('armory-tabs mythras-manager-header-controls');
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

        const formArea = container.createDiv('mythras-manager-form');
        formArea.style.overflowY = 'auto';
        formArea.style.maxHeight = 'calc(100% - 150px)';
        formArea.style.paddingRight = '10px';

        const createTextField = (label: string, val: string, onChange: (v: string) => void) => {
            const wrap = formArea.createDiv('mythras-manager-form-group');
            wrap.createEl('label', { text: label });
            const inp = wrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
            inp.value = val;
            inp.oninput = (e) => onChange((e.target as HTMLInputElement).value);
        };

        if (this.editTab === 'general') {
            createTextField('Instance Name', data.instanceName, v => data.instanceName = v);
            createTextField('Scenario', data.scenario, v => data.scenario = v);
            createTextField('Encounter', data.encounter, v => data.encounter = v);
            
            const imgWrap = formArea.createDiv('mythras-manager-input-group');
            imgWrap.style.alignItems = 'flex-end';
            
            const fieldWrap = imgWrap.createDiv('mythras-manager-form-group');
            fieldWrap.style.flex = '1';
            fieldWrap.createEl('label', { text: 'Image' });
            
            const imgInp = fieldWrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
            imgInp.value = data.image || '';
            imgInp.placeholder = 'e.g. [[image.png]]';
            imgInp.oninput = (e) => data.image = (e.target as HTMLInputElement).value;
            
            const btnBrowse = imgWrap.createEl('button', { text: 'Search Vault...', cls: 'mythras-btn-secondary' });
            btnBrowse.onclick = () => {
                new ImageSuggestModal(this.app, (file) => {
                    const link = `[[${file.name}]]`;
                    imgInp.value = link;
                    data.image = link;
                }).open();
            };


            
            const notesWrap = formArea.createDiv();
            notesWrap.style.display = 'flex';
            notesWrap.style.flexDirection = 'column';
            notesWrap.createEl('label', { text: 'Notes' }).style.fontWeight = 'bold';
            const ta = notesWrap.createEl('textarea');
            ta.value = data.notes || '';
            ta.rows = 6;
            ta.oninput = (e) => data.notes = (e.target as HTMLTextAreaElement).value;

        } else if (this.editTab === 'hitlocations') {
            const table = formArea.createEl('table', { cls: 'mythras-manager-table' });
            table.style.width = '100%';
            const thead = table.createEl('thead').createEl('tr');
            ['Location', 'Range', 'AP', 'Current HP', 'Max HP'].forEach(h => {
                thead.createEl('th', { text: h, cls: 'mythras-manager-th' });
            });
            const tbody = table.createEl('tbody');

            data.hitLocations.forEach(hl => {
                const tr = tbody.createEl('tr', { cls: 'mythras-manager-tr' });
                tr.createEl('td', { text: hl.name, cls: 'mythras-manager-td' });
                tr.createEl('td', { text: hl.range, cls: 'mythras-manager-td' });
                
                const apTd = tr.createEl('td', { cls: 'mythras-manager-td' });
                const apInp = apTd.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                apInp.style.width = '60px';
                apInp.value = hl.ap;
                apInp.oninput = (e) => hl.ap = (e.target as HTMLInputElement).value;

                const currTd = tr.createEl('td', { cls: 'mythras-manager-td' });
                const currInp = currTd.createEl('input', { type: 'number', cls: 'mythras-manager-input' });
                currInp.style.width = '60px';
                currInp.value = hl.currentHp.toString();
                currInp.oninput = (e) => hl.currentHp = parseInt((e.target as HTMLInputElement).value) || 0;

                const maxTd = tr.createEl('td', { cls: 'mythras-manager-td' });
                const maxInp = maxTd.createEl('input', { type: 'number', cls: 'mythras-manager-input' });
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
                const wrap = formArea.createDiv('mythras-manager-form-group');
                wrap.createEl('h3', { text: label });
                const listDiv = wrap.createDiv('mythras-manager-list');

                const redraw = () => {
                    listDiv.empty();
                    Object.keys(obj).forEach(key => {
                        const row = listDiv.createDiv('mythras-manager-list-row');
                        const kInput = row.createEl('input', { type: 'text' });
                        kInput.value = key;
                        const vInput = row.createEl('input', { type: 'number', cls: 'mythras-manager-input' });
                        vInput.value = obj[key].toString();
                        
                        const btnDel = row.createEl('button', { text: 'X', cls: 'mythras-btn-icon mythras-btn-danger' });
                        btnDel.onclick = () => {
                            delete obj[key];
                            redraw();
                        };

                        const update = () => {
                            if (kInput.value !== key) {
                                delete obj[key];
                            }
                            if (kInput.value) {
                                obj[kInput.value] = parseInt(vInput.value) || 0;
                            }
                        };
                        kInput.onchange = update;
                        vInput.onchange = update;
                    });

                    const btnAdd = listDiv.createEl('button', { text: '+ Add', cls: 'mythras-btn-secondary' });
                    btnAdd.style.alignSelf = 'flex-start';
                    btnAdd.onclick = () => {
                        obj['New Skill'] = 0;
                        redraw();
                    };
                };
                redraw();
            };
            if (!data.magicSkills) data.magicSkills = {};
            if (!data.professionalSkills) data.professionalSkills = {};

            renderDict(data.standardSkills, 'Standard Skills');
            renderDict(data.magicSkills, 'Magic Skills');
            renderDict(data.professionalSkills, 'Professional Skills');
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

                const btnDel = wrap.createEl('button', { cls: 'clickable-icon mod-warning' });
                setIcon(btnDel, 'trash-2');
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
