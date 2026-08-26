import { App, PluginSettingTab, Setting } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { BestiaryManagerModal } from './modal-bestiary-manager';
import { ArmoryManagerModal } from './modal-armory-manager';
import { RosterManagerModal } from './modal-roster-manager';

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
                        new BestiaryManagerModal(this.app, this.plugin).open();
                    })
            );

        new Setting(containerEl)
            .setName('Roster Manager')
            .setDesc('View and manage your instantiated enemies (Roster).')
            .addButton((btn) =>
                btn
                    .setButtonText('Open Roster')
                    .setCta()
                    .onClick(() => {
                        new RosterManagerModal(this.app, this.plugin).open();
                    })
            );

        new Setting(containerEl)
            .setName('Armory Manager')
            .setDesc('Manage your locally saved Mythras weapons and shields.')
            .addButton((btn) =>
                btn
                    .setButtonText('Open Armory')
                    .setCta()
                    .onClick(() => {
                        import('./modal-armory-manager').then((m) => {
                            new m.ArmoryManagerModal(this.app, this.plugin).open();
                        });
                    })
            );
    }
}
