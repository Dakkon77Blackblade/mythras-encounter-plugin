import { Plugin, normalizePath } from 'obsidian';
import { MythrasEncounterSettings, DEFAULT_SETTINGS, MythrasEncounterSettingTab } from './settings';
import { MythrasSearchModal } from './modal-search';
import { MythrasGenerateModal } from './modal-generate';
import { MythrasWeapon } from './mythras-api';
import { renderItemStatblock } from './item-formatter';
import { ItemSuggester } from './item-suggester';
import { buildItemLivePreviewPlugin } from './live-preview';

export default class MythrasEncounterPlugin extends Plugin {
    settings: MythrasEncounterSettings;
    armoryCache: MythrasWeapon[] = [];

    async onload() {
        await this.loadSettings();

        await this.initArmory();
        await this.refreshArmoryCache();

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new MythrasEncounterSettingTab(this.app, this));

        // Command to search and import templates
        this.addCommand({
            id: 'import-mythras-template',
            name: 'Import Template from Mythras Encounter Generator',
            callback: () => {
                new MythrasSearchModal(this.app, this).open();
            }
        });

        // Command to generate enemies from a local template
        this.addCommand({
            id: 'generate-mythras-encounter',
            name: 'Generate Mythras Encounter',
            callback: () => {
                new MythrasGenerateModal(this.app, this).open();
            }
        });

        // Register the autocomplete suggester for items
        this.registerEditorSuggest(new ItemSuggester(this.app, this));

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
        if (await this.app.vault.adapter.exists(armoryPath)) {
            try {
                const content = await this.app.vault.adapter.read(armoryPath);
                this.armoryCache = JSON.parse(content) as MythrasWeapon[];
            } catch (e) {
                console.error("Failed to parse armory.json", e);
            }
        }
    }

    async initArmory() {
        const baseFolder = normalizePath(this.settings.baseFolder);
        const bestiaryPath = normalizePath(`${baseFolder}/Bestiary`);
        const armoryFolderPath = normalizePath(`${baseFolder}/Armory`);
        const armoryPath = normalizePath(`${armoryFolderPath}/armory.json`);

        // Ensure Base, Bestiary and Armory folders exist
        if (!(await this.app.vault.adapter.exists(baseFolder))) {
            await this.app.vault.adapter.mkdir(baseFolder);
        }
        if (!(await this.app.vault.adapter.exists(bestiaryPath))) {
            await this.app.vault.adapter.mkdir(bestiaryPath);
        }
        if (!(await this.app.vault.adapter.exists(armoryFolderPath))) {
            await this.app.vault.adapter.mkdir(armoryFolderPath);
        }

        const exists = await this.app.vault.adapter.exists(armoryPath);
        if (!exists) {
            const defaultArmory = [
                { name: "Hatchet", type: "1h-melee", damage: "1d6+1", size: "S", reach: "S", ap: "4", hp: "6", specialFx: "None" },
                { name: "Shortspear", type: "1h-melee", damage: "1d8+1", size: "M", reach: "L", ap: "4", hp: "5", specialFx: "Impale" },
                { name: "Shortsword", type: "1h-melee", damage: "1d6", size: "S", reach: "S", ap: "6", hp: "8", specialFx: "Impale, Bleed" },
                { name: "Military flail", type: "2h-melee", damage: "1d10+1", size: "M", reach: "M", ap: "3", hp: "8", specialFx: "Entangle" },
                { name: "Viking Shield", type: "shield", damage: "1d4", size: "L", ap: "4", hp: "12", specialFx: "Bash" },
                { name: "Longbow", type: "ranged", damage: "1d8", size: "L", range: "150m", ap: "4", hp: "4", damageModifier: true, specialFx: "Impale" },
                { name: "Heavy Crossbow", type: "ranged", damage: "2d6", size: "M", range: "250m", ap: "4", hp: "6", damageModifier: false, specialFx: "Impale" }
            ];
            
            await this.app.vault.adapter.write(armoryPath, JSON.stringify(defaultArmory, null, 2));
        }
    }
}
