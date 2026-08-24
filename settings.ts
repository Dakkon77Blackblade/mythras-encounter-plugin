import { App, PluginSettingTab, Setting } from 'obsidian';
import MythrasEncounterPlugin from './main';

export interface MythrasEncounterSettings {
    bestiaryFolder: string;
}

export const DEFAULT_SETTINGS: MythrasEncounterSettings = {
    bestiaryFolder: 'Bestiary/Mythras',
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
            .setName('Bestiary Folder')
            .setDesc('Folder where Mythras JSON templates will be saved (e.g. Bestiary/Mythras)')
            .addText((text) =>
                text
                    .setPlaceholder('Bestiary/Mythras')
                    .setValue(this.plugin.settings.bestiaryFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.bestiaryFolder = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
