import { App, PluginSettingTab, Setting } from 'obsidian';
import MythrasEncounterPlugin from './main';

export interface MythrasEncounterSettings {
    baseFolder: string;
    pluginRole: 'GM' | 'Player';
}

export const DEFAULT_SETTINGS: MythrasEncounterSettings = {
    baseFolder: 'Mythras-Helper',
    pluginRole: 'GM',
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
            .setName('Base folder')
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
            .setName('Role')
            .setDesc('Are you a GM or a Player? Players only see their Character Sheets and the Armory.')
            .addDropdown(dropdown => {
                dropdown.addOption('GM', 'Game Master');
                dropdown.addOption('Player', 'Player');
                dropdown.setValue(this.plugin.settings.pluginRole);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.pluginRole = value as 'GM' | 'Player';
                    await this.plugin.saveSettings();
                    // Require reload to apply UI changes cleanly
                    new Notice('Please reload the plugin or Obsidian to apply role changes.');
                });
            });

        new Setting(containerEl)
            .setName('Mythras manager')
            .setDesc('Open the integrated workspace view for Bestiary, Armory, and Roster management.')
            .addButton((btn) =>
                btn
                    .setButtonText('Open manager')
                    .setCta()
                    .onClick(() => {
                        this.plugin.activateManagerView();
                    })
            );
    }
}
