import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasTemplate } from './mythras-api';
import { generateStatblock } from './statblock-formatter';

export class MythrasGenerateModal extends Modal {
    plugin: MythrasEncounterPlugin;
    templates: TFile[] = [];
    
    selectedTemplatePath: string = '';
    amount: number = 1;

    constructor(app: App, plugin: MythrasEncounterPlugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Generate Mythras Encounter" });

        // Load templates from Bestiary
        const folder = this.app.vault.getAbstractFileByPath(this.plugin.settings.bestiaryFolder);
        if (folder && 'children' in folder) {
            // @ts-ignore
            this.templates = folder.children.filter(f => f instanceof TFile && f.extension === 'json');
        }

        if (this.templates.length === 0) {
            contentEl.createEl("p", { text: "No templates found in Bestiary. Import some first!" });
            return;
        }

        this.selectedTemplatePath = this.templates[0].path;

        new Setting(contentEl)
            .setName("Template")
            .setDesc("Select a template from your Bestiary")
            .addDropdown(dropdown => {
                this.templates.forEach(file => {
                    dropdown.addOption(file.path, file.basename);
                });
                dropdown.setValue(this.selectedTemplatePath);
                dropdown.onChange(value => {
                    this.selectedTemplatePath = value;
                });
            });

        new Setting(contentEl)
            .setName("Amount")
            .setDesc("Number of enemies to generate")
            .addText(text => {
                text.setValue(this.amount.toString());
                text.onChange(value => {
                    const parsed = parseInt(value, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                        this.amount = parsed;
                    }
                });
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText("Generate")
                .setCta()
                .onClick(async () => {
                    await this.generateEnemies();
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    async generateEnemies() {
        const file = this.app.vault.getAbstractFileByPath(this.selectedTemplatePath);
        if (!(file instanceof TFile)) return;

        try {
            const content = await this.app.vault.read(file);
            const template: MythrasTemplate = JSON.parse(content);
            
            const activeView = this.app.workspace.activeEditor;
            if (!activeView || !activeView.editor) {
                new Notice("No active editor found to insert the encounter.");
                return;
            }

            let output = `\n## Encounter: ${template.name}\n\n`;
            for (let i = 0; i < this.amount; i++) {
                output += generateStatblock(template, i + 1) + '\n\n';
            }

            const cursor = activeView.editor.getCursor();
            activeView.editor.replaceRange(output, cursor);
            new Notice(`Generated ${this.amount}x ${template.name}!`);

        } catch (e) {
            new Notice(`Failed to generate enemies: ${e}`);
            console.error(e);
        }
    }
}
