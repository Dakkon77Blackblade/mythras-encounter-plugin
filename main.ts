import { Plugin, normalizePath, Menu, TFile, setIcon } from 'obsidian';
import { MythrasEncounterSettings, DEFAULT_SETTINGS, MythrasEncounterSettingTab } from './settings';
import { MythrasSearchModal } from './modal-search';
import { MythrasGenerateModal } from './modal-generate';
import { MYTHRAS_MANAGER_VIEW, MythrasManagerView } from './view-mythras-manager';
import { MythrasWeapon } from './mythras-api';
import { renderItemStatblock } from './item-formatter';
import { ItemSuggester } from './item-suggester';
import { buildItemLivePreviewPlugin } from './live-preview';
import { formatInstanceAsMarkdown, renderEnemyStatblock } from './statblock-formatter';
import { MythrasInstance } from './mythras-api';
import { MarkdownRenderer } from 'obsidian';
import { CombatLogService, CombatLogView, COMBAT_LOG_VIEW } from './combat-log';

import { CombatTrackerService } from './combat-tracker';
import { CharacterService } from './character-service';

export default class MythrasEncounterPlugin extends Plugin {
    settings: MythrasEncounterSettings;
    armoryCache: MythrasWeapon[] = [];
    combatLogService: CombatLogService = new CombatLogService();
    combatTrackerService: CombatTrackerService = new CombatTrackerService(this);
    characterService: CharacterService;

    async onload() {
        this.characterService = new CharacterService(this.app, this);
        await this.loadSettings();
        await this.combatTrackerService.loadSession();

        await this.initArmory();
        await this.refreshArmoryCache();

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new MythrasEncounterSettingTab(this.app, this));

        // Register the new Workspace Leaf View
        this.registerView(
            MYTHRAS_MANAGER_VIEW,
            (leaf) => new MythrasManagerView(leaf, this)
        );

        this.registerView(
            COMBAT_LOG_VIEW,
            (leaf) => new CombatLogView(leaf, this.combatLogService)
        );

        this.addCommand({
            id: 'open-mythras-combat-log',
            name: 'Open combat log',
            callback: () => this.activateCombatLogView()
        });

        this.addRibbonIcon('list', 'Open combat log', () => {
            this.activateCombatLogView();
        });

        const ribbonIcon = this.addRibbonIcon('swords', 'Open Mythras manager', (evt: MouseEvent) => {
            if (evt.button === 2) return; // Ignore right-clicks
            // If player mode, start on Characters tab. If GM mode, start on Roster tab.
            this.activateManagerView('tab', this.settings.pluginRole === 'Player' ? 'characters' : 'roster');
        });

        ribbonIcon.addEventListener('contextmenu', (evt: MouseEvent) => {
            evt.preventDefault();
            evt.stopPropagation();
            const menu = new Menu();
            menu.addItem((item) =>
                item
                    .setTitle('Open in new tab')
                    .setIcon('file-plus')
                    .onClick(() => this.activateManagerView('tab'))
            );
            menu.addItem((item) =>
                item
                    .setTitle('Open to the right')
                    .setIcon('split')
                    .onClick(() => this.activateManagerView('split-right'))
            );
            menu.addItem((item) =>
                item
                    .setTitle('Open below')
                    .setIcon('split')
                    .onClick(() => this.activateManagerView('split-down'))
            );
            menu.addItem((item) =>
                item
                    .setTitle('Open in current tab')
                    .setIcon('file')
                    .onClick(() => this.activateManagerView('current'))
            );
            menu.showAtMouseEvent(evt);
        });

        // Command to search and import templates
        this.addCommand({
            id: 'import-mythras-template',
            name: 'Import template from Mythras Encounter Generator',
            callback: () => {
                new MythrasSearchModal(this.app, this).open();
            }
        });

        // Command to generate enemies from a local template
        this.addCommand({
            id: 'generate-mythras-encounter',
            name: 'Generate Mythras encounter',
            callback: () => {
                new MythrasGenerateModal(this.app, this).open();
            }
        });

        // Register the autocomplete suggester for items
        this.registerEditorSuggest(new ItemSuggester(this.app, this));

        // Auto-inject encounter-id for mythras-encounter files and refresh UI
        this.registerEvent(
            this.app.metadataCache.on('changed', async (file, data, cache) => {
                const fm = cache.frontmatter;
                if (fm && fm.type === 'mythras-encounter') {
                    if (!fm['encounter-id']) {
                        try {
                            await this.app.fileManager.processFrontMatter(file as TFile, (frontmatter) => {
                                if (!frontmatter['encounter-id']) {
                                    frontmatter['encounter-id'] = window.crypto.randomUUID();
                                }
                            });
                        } catch (e) {}
                    }
                    
                    // Notify any open Roster UI to refresh
                    const leaves = this.app.workspace.getLeavesOfType(MYTHRAS_MANAGER_VIEW);
                    for (const leaf of leaves) {
                        const view = leaf.view as any;
                        if (view && view.rosterUI) {
                            view.rosterUI.loadInstances().then(() => view.rosterUI.display());
                        }
                    }
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('rename', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    const cache = this.app.metadataCache.getFileCache(file);
                    if (cache?.frontmatter?.type === 'mythras-encounter') {
                        const leaves = this.app.workspace.getLeavesOfType(MYTHRAS_MANAGER_VIEW);
                        for (const leaf of leaves) {
                            const view = leaf.view as any;
                            if (view && view.rosterUI) {
                                view.rosterUI.loadInstances().then(() => view.rosterUI.display());
                            }
                        }
                    }
                }
            })
        );

        // Run legacy migration on startup
        this.app.workspace.onLayoutReady(() => {
            this.migrateLegacyEncounters();
        });

        // Register the CodeMirror 6 plugin for Live Preview inline items
        this.registerEditorExtension(buildItemLivePreviewPlugin(this));

        // Inline code post processor for item: Weapon Name
        this.registerMarkdownPostProcessor((element, context) => {
            const codeElements = element.findAll('code');
            codeElements.forEach((codeEl) => {
                const text = codeEl.innerText.trim();
                if (text.startsWith('item:')) {
                    const itemName = text.replace('item:', '').trim().toLowerCase();
                    const weapon = this.armoryCache.find(w => w.name.toLowerCase() === itemName);
                    
                    if (weapon) {
                        const linkSpan = document.createElement('span');
                        linkSpan.addClass('mythras-item-link');
                        linkSpan.setText(weapon.name);
                        
                        // Create the popover
                        const popover = renderItemStatblock(weapon, true);
                        popover.addClass('mythras-item-popover');
                        linkSpan.appendChild(popover);
                        
                        codeEl.replaceWith(linkSpan);
                    }
                }
            });
        });

        // Block-level processor for ```item ... ```
        this.registerMarkdownCodeBlockProcessor('item', (source, el, ctx) => {
            const itemName = source.trim().toLowerCase();
            const weapon = this.armoryCache.find(w => w.name.toLowerCase() === itemName);
            
            if (weapon) {
                const block = renderItemStatblock(weapon, false);
                block.addClass('mythras-item-block');
                el.appendChild(block);
            } else {
                el.createEl('div', { text: `Item not found in Armory: ${source.trim()}` });
            }
        });

        // Block-level processor for ```enemy <ID> ```
        this.registerMarkdownCodeBlockProcessor('enemy', async (source, el, ctx) => {
            const rawText = source.trim();
            if (!rawText) return;

            const isLong = /\blong\b/i.test(rawText);
            const enemyId = rawText.replace(/\blong\b/ig, '').trim();

            if (!enemyId) return;

            const rosterPath = `${this.settings.baseFolder}/Roster`;
            const folder = this.app.vault.getAbstractFileByPath(rosterPath);
            if (!folder) {
                el.createEl('div', { text: `Roster folder not found. Cannot load enemy ${enemyId}` });
                return;
            }

            // Find the JSON file that contains this ID in its name (we saved it as <ID>_<Name>.json)
            const findJsonFile = (f: any): TFile | null => {
                if (f && 'children' in f) {
                    for (const child of f.children) {
                        const found = findJsonFile(child);
                        if (found) return found;
                    }
                } else if (f instanceof TFile && f.extension === 'json' && f.name.startsWith(enemyId)) {
                    return f;
                }
                return null;
            };

            const file = findJsonFile(folder);
            if (!file) {
                el.createEl('div', { text: `Enemy instance not found in Roster: ${enemyId}` });
                return;
            }

            try {
                const content = await this.app.vault.read(file);
                const instance: MythrasInstance = JSON.parse(content);
                    const statblock = await this.renderEnemyWithImages(instance, isLong, ctx.sourcePath, async () => {
                        const leaf = this.app.workspace.getLeaf(false);
                        await leaf.setViewState({ type: MYTHRAS_MANAGER_VIEW, active: true });
                        const view = leaf.view as any;
                        if (view && view.rosterUI) {
                            view.currentTab = 'roster';
                            view.rosterUI.openEditView(instance.id);
                        }
                    });
                    el.appendChild(statblock);
            } catch (e) {
                el.createEl('div', { text: `Failed to load enemy: ${e}` });
            }
        });

        // Block-level processor for ```mythras-encounter ... ```
        this.registerMarkdownCodeBlockProcessor('mythras-encounter', async (source, el, ctx) => {
            const rawText = source.trim();
            
            let encounterId = '';
            let scenario = '';
            let displayTitle = '';
            let targetFile: TFile | null = null;
            let targetCache: any = null;

            const idMatch = rawText.match(/id:\s*([a-zA-Z0-9-]+)/i);
            if (idMatch) {
                const searchId = idMatch[1].trim();
                const allFiles = this.app.vault.getMarkdownFiles();
                
                // 1. Check Metadata Cache
                for (const file of allFiles) {
                    const c = this.app.metadataCache.getFileCache(file);
                    if (c?.frontmatter?.['encounter-id'] === searchId || file.basename === searchId) {
                        targetFile = file;
                        targetCache = c;
                        break;
                    }
                }
                
                // 2. Direct Vault Read Fallback if Cache hasn't indexed yet
                if (!targetFile) {
                    for (const file of allFiles) {
                        try {
                            const fileContent = await this.app.vault.read(file);
                            if (fileContent.includes(searchId)) {
                                targetFile = file;
                                targetCache = this.app.metadataCache.getFileCache(file);
                                break;
                            }
                        } catch (e) {}
                    }
                }
                
                if (!targetFile) {
                    el.createEl('div', { text: `Encounter mit ID '${searchId}' nicht gefunden.`, cls: 'mythras-encounter-warning' });
                    return;
                }
            } else {
                targetFile = this.app.vault.getAbstractFileByPath(ctx.sourcePath) as TFile;
                if (!targetFile) return;
                targetCache = this.app.metadataCache.getFileCache(targetFile);
                if (!targetCache?.frontmatter || targetCache.frontmatter.type !== 'mythras-encounter') {
                    el.createEl('div', { text: `Achtung: Die Datei '${targetFile.name}' ist nicht als Encounter markiert. Bitte füge 'type: mythras-encounter' im Frontmatter hinzu, oder gib 'id: <encounter-id>' im Codeblock an.`, cls: 'mythras-encounter-warning' });
                    return;
                }
            }

            encounterId = targetCache?.frontmatter?.['encounter-id'] || idMatch?.[1]?.trim() || '';
            scenario = targetCache?.frontmatter?.['scenario'] || 'General';
            displayTitle = targetFile ? targetFile.basename : 'Encounter';

            const wrapper = el.createDiv('mythras-encounter-wrapper');

            const headerWrap = wrapper.createDiv('mythras-encounter-header');
            headerWrap.createEl('h2', { text: displayTitle });
            
            const editBtn = headerWrap.createDiv('mythras-encounter-edit-btn');
            setIcon(editBtn, 'pencil');

            editBtn.onclick = async () => {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.setViewState({ type: MYTHRAS_MANAGER_VIEW, active: true });
                const view = leaf.view as any;
                if (view && view.rosterUI && encounterId) {
                    view.currentTab = 'roster';
                    view.rosterUI.openEncounterView(encounterId);
                }
            };
            
            // Read description from markdown body
            let description = '';
            try {
                if (targetFile) {
                    const fileContent = await this.app.vault.read(targetFile);
                    const frontmatterMatch = fileContent.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
                    if (frontmatterMatch) {
                        let mdText = fileContent.substring(frontmatterMatch[0].length).trim();
                        // Remove the mythras-encounter codeblock itself from the description!
                        mdText = mdText.replace(/```mythras-encounter[\s\S]*?```/g, '').trim();
                        if (mdText) {
                            description = mdText;
                        }
                    }
                }
            } catch (e) {}

            if (description) {
                const descDiv = wrapper.createDiv('mythras-encounter-desc');
                MarkdownRenderer.renderMarkdown(description, descDiv, ctx.sourcePath, this);
            }

            const gridWrapper = wrapper.createDiv('mythras-encounter-grid');
            
            if (!encounterId) {
                gridWrapper.createEl('div', { text: `Waiting for encounter-id to be generated...` });
                return;
            }

            const rosterPath = `${this.settings.baseFolder}/Roster`;
            const folder = this.app.vault.getAbstractFileByPath(rosterPath);
            if (!folder) return;

            const matchingFiles: TFile[] = [];
            const findJsonFiles = (f: any) => {
                if (f && 'children' in f) {
                    for (const child of f.children) {
                        findJsonFiles(child);
                    }
                } else if (f instanceof TFile && f.extension === 'json') {
                    matchingFiles.push(f);
                }
            };
            findJsonFiles(folder);

            const matchingInstances: any[] = [];

            for (const file of matchingFiles) {
                try {
                    const content = await this.app.vault.read(file);
                    const instance = JSON.parse(content);
                    
                    if (instance.encounterId === encounterId || (instance.encounter && instance.encounter.trim().toLowerCase() === displayTitle.toLowerCase())) {
                        matchingInstances.push(instance);
                    }
                } catch (e) {}
            }

            if (matchingInstances.length === 0) {
                wrapper.createEl('div', { text: `No enemies found for encounter: ${displayTitle}` });
                return;
            }

            // Sort by templateName, then by instanceName
            matchingInstances.sort((a, b) => {
                const cmpTpl = (a.templateName || '').localeCompare(b.templateName || '');
                if (cmpTpl !== 0) return cmpTpl;
                return (a.instanceName || '').localeCompare(b.instanceName || '');
            });

            const isLong = source.toLowerCase().includes('format: long');

            for (const instance of matchingInstances) {
                try {
                    const statblock = await this.renderEnemyWithImages(instance, isLong, ctx.sourcePath, async () => {
                        const leaf = this.app.workspace.getLeaf(false);
                        await leaf.setViewState({ type: MYTHRAS_MANAGER_VIEW, active: true });
                        const view = leaf.view as any;
                        if (view && view.rosterUI) {
                            view.currentTab = 'roster';
                            view.rosterUI.openEditView(instance.id);
                        }
                    });
                    gridWrapper.appendChild(statblock);
                } catch (e) {
                    gridWrapper.createEl('div', { text: `Error rendering instance ${instance.instanceName}: ${e}`, cls: 'mythras-error' });
                }
            }
        });
    }

    async activateManagerView(mode: 'tab' | 'split-right' | 'split-down' | 'current' = 'tab', startTab?: 'roster' | 'armory' | 'bestiary' | 'combat' | 'characters') {
        const { workspace } = this.app;
        const leaves = workspace.getLeavesOfType(MYTHRAS_MANAGER_VIEW);

        if (leaves.length > 0) {
            if (mode === 'tab') {
                const leaf = leaves[0];
                workspace.revealLeaf(leaf);
                if (startTab) {
                    const view = leaf.view as any;
                    if (view && view.currentTab !== undefined) {
                        view.currentTab = startTab;
                        view.renderNav();
                        view.renderCurrentTab();
                    }
                }
                return;
            }
            // If they explicitly requested a layout via context menu, close old instances
            leaves.forEach(l => l.detach());
        }

        let leaf: any = null;
        if (mode === 'split-right') {
            leaf = workspace.getLeaf('split', 'vertical');
        } else if (mode === 'split-down') {
            leaf = workspace.getLeaf('split', 'horizontal');
        } else if (mode === 'current') {
            leaf = workspace.getLeaf(false);
        } else {
            leaf = workspace.getLeaf('tab');
        }
        
        await leaf.setViewState({ type: MYTHRAS_MANAGER_VIEW, active: true });
        
        if (startTab) {
            const view = leaf.view as any;
            if (view && view.currentTab !== undefined) {
                view.currentTab = startTab;
                view.renderNav();
                view.renderCurrentTab();
            }
        }
        workspace.revealLeaf(leaf);
    }

    async activateCombatLogView() {
        const { workspace } = this.app;
        
        let leaf: any = null;
        const leaves = workspace.getLeavesOfType(COMBAT_LOG_VIEW);
        
        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: COMBAT_LOG_VIEW, active: true });
            }
        }
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    async migrateLegacyEncounters() {
        const rosterPath = `${this.settings.baseFolder}/Roster`;
        const rosterFolder = this.app.vault.getAbstractFileByPath(rosterPath);
        if (!rosterFolder || !('children' in rosterFolder)) return;

        // Any folder directly under Roster is a Scenario, except maybe some loose JSONs
        for (const scenarioNode of rosterFolder.children) {
            if (scenarioNode.name === 'Uncategorized') continue;
            
            if ('children' in scenarioNode) {
                const scenarioName = scenarioNode.name;
                for (const encounterNode of scenarioNode.children) {
                    if ('children' in encounterNode) {
                        const encounterName = encounterNode.name;
                        
                        // Check if it already has a folder note
                        const mdFile = this.app.vault.getAbstractFileByPath(`${encounterNode.path}/${encounterName}.md`);
                        
                        let encounterId = '';
                        if (!mdFile) {
                            encounterId = window.crypto.randomUUID();
                            const content = `---\ntype: mythras-encounter\nscenario: "${scenarioName}"\nencounter-id: ${encounterId}\n---\n\n`;
                            await this.app.vault.create(`${encounterNode.path}/${encounterName}.md`, content);
                        } else {
                            // If md exists but maybe not frontmatter loaded? Just let the metadata cache hook do it later.
                            // But for migrating JSONs, we need to extract the ID.
                            const file = mdFile as TFile;
                            await this.app.fileManager.processFrontMatter(file, (fm) => {
                                if (fm.type !== 'mythras-encounter') fm.type = 'mythras-encounter';
                                if (!fm['encounter-id']) fm['encounter-id'] = window.crypto.randomUUID();
                                encounterId = fm['encounter-id'];
                            });
                        }
                        
                        // Wait a bit to ensure encounterId is populated
                        if (!encounterId) {
                            const cache = this.app.metadataCache.getCache(encounterNode.path + '/' + encounterName + '.md');
                            if (cache?.frontmatter) encounterId = cache.frontmatter['encounter-id'];
                        }

                        if (encounterId) {
                            // Migrate all JSON files in this folder
                            for (const jsonNode of encounterNode.children) {
                                if (jsonNode.name.endsWith('.json')) {
                                    try {
                                        const file = jsonNode as TFile;
                                        const content = await this.app.vault.read(file);
                                        const data = JSON.parse(content);
                                        if (!data.encounterId) {
                                            data.encounterId = encounterId;
                                            await this.app.vault.modify(file, JSON.stringify(data, null, 2));
                                        }
                                    } catch (e) {}
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    onunload() {
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async refreshArmoryCache() {
        const baseFolder = normalizePath(this.settings.baseFolder);
        const armoryPath = normalizePath(`${baseFolder}/Armory/armory.json`);
        const file = this.app.vault.getAbstractFileByPath(armoryPath);
        if (file instanceof TFile) {
            try {
                const content = await this.app.vault.read(file);
                this.armoryCache = JSON.parse(content) as MythrasWeapon[];
            } catch (e) {}
        }
    }

    async initArmory() {
        const baseFolder = normalizePath(this.settings.baseFolder);
        const bestiaryPath = normalizePath(`${baseFolder}/Bestiary`);
        const armoryFolderPath = normalizePath(`${baseFolder}/Armory`);
        const armoryPath = normalizePath(`${armoryFolderPath}/armory.json`);

        // Ensure Base, Bestiary and Armory folders exist
        try {
            if (!this.app.vault.getAbstractFileByPath(baseFolder)) {
                await this.app.vault.createFolder(baseFolder);
            }
        } catch (e) {
            // Ignore if folder already exists
        }
        try {
            if (!this.app.vault.getAbstractFileByPath(bestiaryPath)) {
                await this.app.vault.createFolder(bestiaryPath);
            }
        } catch (e) {
            // Ignore if folder already exists
        }
        try {
            if (!this.app.vault.getAbstractFileByPath(armoryFolderPath)) {
                await this.app.vault.createFolder(armoryFolderPath);
            }
        } catch (e) {
            // Ignore if folder already exists
        }

        const armoryFile = this.app.vault.getAbstractFileByPath(armoryPath);
        if (!armoryFile) {
            const defaultArmory = [
                { name: "Hatchet", type: "1h-melee", damage: "1d6+1", size: "S", reach: "S", ap: "4", hp: "6", specialFx: "None" },
                { name: "Shortspear", type: "1h-melee", damage: "1d8+1", size: "M", reach: "L", ap: "4", hp: "5", specialFx: "Impale" },
                { name: "Shortsword", type: "1h-melee", damage: "1d6", size: "S", reach: "S", ap: "6", hp: "8", specialFx: "Impale, Bleed" },
                { name: "Military flail", type: "2h-melee", damage: "1d10+1", size: "M", reach: "M", ap: "3", hp: "8", specialFx: "Entangle" },
                { name: "Viking Shield", type: "shield", damage: "1d4", size: "L", ap: "4", hp: "12", specialFx: "Bash" },
                { name: "Longbow", type: "ranged", damage: "1d8", size: "L", range: "150m", ap: "4", hp: "4", damageModifier: true, specialFx: "Impale" },
                { name: "Heavy Crossbow", type: "ranged", damage: "2d6", size: "M", range: "250m", ap: "4", hp: "6", damageModifier: false, specialFx: "Impale" }
            ];
            
            await this.app.vault.create(armoryPath, JSON.stringify(defaultArmory, null, 2));
        }
    }

    async renderEnemyWithImages(instance: MythrasInstance, isLong: boolean, sourcePath: string, onEdit?: () => Promise<void>): Promise<HTMLElement> {
        const onUpdate = async (updatedInstance: MythrasInstance) => {
            const rosterPath = normalizePath(`${this.settings.baseFolder}/Roster`);
            const folder = this.app.vault.getAbstractFileByPath(rosterPath);
            if (folder && 'children' in folder) {
                const file = (folder as any).children.find((f: any) => f.extension === 'json' && f.name.startsWith(updatedInstance.id));
                if (file && file instanceof TFile) {
                    await this.app.vault.modify(file, JSON.stringify(updatedInstance, null, 2));
                    
                    await this.combatTrackerService.refreshParticipantInstances();

                    const leaves = this.app.workspace.getLeavesOfType(MYTHRAS_MANAGER_VIEW);
                    for (const leaf of leaves) {
                        const view = leaf.view as any;
                        if (view) {
                            if (view.combatUI) {
                                view.combatUI.render();
                            }
                            if (view.rosterUI) {
                                await view.rosterUI.loadInstances();
                            }
                        }
                    }

                    // Update all matching instances in the DOM
                    const domInstances = document.querySelectorAll(`.mythras-enemy-short[data-mythras-instance-id="${updatedInstance.id}"], .mythras-enemy-long[data-mythras-instance-id="${updatedInstance.id}"]`);
                    domInstances.forEach(async (el) => {
                        const elIsLong = (el as HTMLElement).dataset.mythrasIsLong === 'true';
                        const elSourcePath = (el as HTMLElement).dataset.mythrasSourcePath || '';
                        // Render a fresh statblock to replace this one
                        const newStatblock = await this.renderEnemyWithImages(updatedInstance, elIsLong, elSourcePath, onEdit);
                        el.replaceWith(newStatblock);
                    });
                }
            }
        };

        const statblock = renderEnemyStatblock(this.app, instance, isLong ? 'long' : 'short', onEdit, onUpdate, this);
        
        statblock.dataset.mythrasInstanceId = instance.id;
        statblock.dataset.mythrasIsLong = isLong ? 'true' : 'false';
        statblock.dataset.mythrasSourcePath = sourcePath;

        const imgDiv = statblock.querySelector('.mythras-enemy-image') as HTMLElement;
        if (imgDiv && imgDiv.dataset.imageLink) {
            let link = imgDiv.dataset.imageLink.trim();
            link = link.replace(/^!*\[\[(.*?)\]\]$/, '$1'); 
            
            if (link.startsWith('http') || link.startsWith('data:')) {
                imgDiv.createEl('img', { attr: { src: link } });
            } else {
                const imgFile = this.app.metadataCache.getFirstLinkpathDest(link, sourcePath);
                if (imgFile) {
                    const src = this.app.vault.getResourcePath(imgFile);
                    imgDiv.createEl('img', { attr: { src } });
                } else {
                    // @ts-ignore
                    if (typeof MarkdownRenderer !== 'undefined') {
                        // @ts-ignore
                        await MarkdownRenderer.renderMarkdown(`![[${link}]]`, imgDiv, sourcePath, this);
                    }
                }
            }
        }

        return statblock;
    }
}
