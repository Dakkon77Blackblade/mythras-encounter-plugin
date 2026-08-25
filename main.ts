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
