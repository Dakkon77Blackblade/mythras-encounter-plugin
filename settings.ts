import { App, PluginSettingTab, Setting } from 'obsidian';
import MythrasEncounterPlugin from './main';

export interface MythrasEncounterSettings {
    baseFolder: string;
}

export const DEFAULT_SETTINGS: MythrasEncounterSettings = {
    baseFolder: 'Mythras-Helper',
};

export class MythrasEncounterSettingTab extends PluginSettingTab {
    plugin: MythrasEncounterPlugin;

    constructor(app: App, plugin: MythrasEncounterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Base Folder')
            .setDesc('Folder where Bestiary and Armory subfolders will be created (e.g. Mythras-Helper)')
            .addText((text) =>
                text
                    .setPlaceholder('Mythras-Helper')
                    .setValue(this.plugin.settings.baseFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.baseFolder = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Mythras Manager')
            .setDesc('Open the integrated workspace view for Bestiary, Armory, and Roster management.')
            .addButton((btn) =>
                btn
                    .setButtonText('Open Manager')
                    .setCta()
                    .onClick(() => {
                        this.plugin.activateManagerView();
                    })
            );
    }
}
