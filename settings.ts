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
            .setName('Bestiary Manager')
            .setDesc('Manage your locally saved Mythras templates (view, edit, delete).')
            .addButton((btn) =>
                btn
                    .setButtonText('Open Manager')
                    .setCta()
                    .onClick(() => {
                        import('./modal-bestiary-manager').then((m) => {
                            new m.BestiaryManagerModal(this.app, this.plugin).open();
                        });
                    })
            );
    }
}
