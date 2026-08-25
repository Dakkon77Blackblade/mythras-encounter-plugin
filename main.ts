import { Plugin, normalizePath } from 'obsidian';
import { MythrasEncounterSettings, DEFAULT_SETTINGS, MythrasEncounterSettingTab } from './settings';
import { MythrasSearchModal } from './modal-search';
import { MythrasGenerateModal } from './modal-generate';

export default class MythrasEncounterPlugin extends Plugin {
    settings: MythrasEncounterSettings;

    async onload() {
        await this.loadSettings();

        await this.initArmory();

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
            name: 'Generate Encounter from Bestiary',
            editorCallback: (editor, view) => {
                new MythrasGenerateModal(this.app, this).open();
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

    async initArmory() {
        const armoryPath = normalizePath(this.settings.armoryFile);
        const exists = await this.app.vault.adapter.exists(armoryPath);
        if (!exists) {
            const defaultArmory = [
                { name: "Hatchet", type: "1h-melee", damage: "1d6+1", size: "S", reach: "S", specialFx: "None" },
                { name: "Shortspear", type: "1h-melee", damage: "1d8+1", size: "M", reach: "L", specialFx: "Impale" },
                { name: "Shortsword", type: "1h-melee", damage: "1d6", size: "S", reach: "S", specialFx: "Impale, Bleed" },
                { name: "Military flail", type: "2h-melee", damage: "1d10+1", size: "M", reach: "M", specialFx: "Entangle" },
                { name: "Viking Shield", type: "shield", damage: "1d4", size: "L", reach: "S", specialFx: "Bash" },
                { name: "Longbow", type: "ranged", damage: "1d8", size: "L", reach: "-", specialFx: "Impale" }
            ];
            
            // Ensure folder exists
            const folderPath = armoryPath.substring(0, armoryPath.lastIndexOf('/'));
            if (folderPath && !(await this.app.vault.adapter.exists(folderPath))) {
                await this.app.vault.adapter.mkdir(folderPath);
            }
            
            await this.app.vault.adapter.write(armoryPath, JSON.stringify(defaultArmory, null, 2));
        }
    }
}
