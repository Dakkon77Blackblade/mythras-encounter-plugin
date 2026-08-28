import { App, Notice, SuggestModal } from 'obsidian';
import { MythrasApi, MythrasSearchResult, MythrasTemplate } from './mythras-api';
import MythrasEncounterPlugin from './main';

export class MythrasSearchModal extends SuggestModal<MythrasSearchResult> {
    plugin: MythrasEncounterPlugin;

    constructor(app: App, plugin: MythrasEncounterPlugin) {
        super(app);
        this.plugin = plugin;
        this.setPlaceholder("Search Mythras Encounter Generator (e.g. 'Orc')...");
        
        // Make it trigger search on enter if we want to avoid spamming the API
        // But for now, we'll let getSuggestions do it with basic debounce.
    }

    async getSuggestions(query: string): Promise<MythrasSearchResult[]> {
        if (query.length < 3) return [];
        try {
            return await MythrasApi.search(query);
        } catch (e) {
            new Notice("Error searching Mythras API.");
            return [];
        }
    }

    renderSuggestion(item: MythrasSearchResult, el: HTMLElement) {
        el.createEl("div", { text: item.name, cls: "mythras-title" });
        const tags = item.tags && item.tags.length > 0 ? ` | Tags: ${item.tags.join(', ')}` : '';
        el.createEl("small", { text: `Rank: ${item.rank} | Race: ${item.race} | Creator: ${item.owner}${tags}` });
    }

    async onChooseSuggestion(item: MythrasSearchResult, evt: MouseEvent | KeyboardEvent) {
        new Notice(`Downloading template: ${item.name}...`);
        try {
            const template = await MythrasApi.fetchTemplate(item.id);
            await this.saveTemplateToBestiary(template);
            new Notice(`Template '${item.name}' saved to Bestiary!`);
        } catch (e) {
            new Notice(`Failed to download template: ${e}`);
        }
    }

    async saveTemplateToBestiary(template: MythrasTemplate) {
        const folderPath = `${this.plugin.settings.baseFolder}/Bestiary`;

        if (!(await this.app.vault.adapter.exists(folderPath))) {
            await this.app.vault.adapter.mkdir(folderPath);
        }

        const safeName = template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const safeAuthor = (template.author || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${safeName}_by_${safeAuthor}`;
        const filePath = `${folderPath}/${fileName}.json`;
        
        const content = JSON.stringify(template, null, 4);

        if (await this.app.vault.adapter.exists(filePath)) {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                // @ts-ignore
                await this.app.vault.modify(file, content);
            }
        } else {
            await this.app.vault.create(filePath, content);
        }
    }
}
