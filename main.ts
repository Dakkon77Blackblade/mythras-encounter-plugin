import { Plugin } from 'obsidian';
import { MythrasEncounterSettings, DEFAULT_SETTINGS, MythrasEncounterSettingTab } from './settings';
import { MythrasSearchModal } from './modal-search';
import { MythrasGenerateModal } from './modal-generate';

export default class MythrasEncounterPlugin extends Plugin {
    settings: MythrasEncounterSettings;

    async onload() {
        await this.loadSettings();

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
}
