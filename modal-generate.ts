import { App, Modal, Setting, Notice, TFile, normalizePath } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasTemplate } from './mythras-api';
import { instantiateEnemy } from './instantiator';

export class MythrasGenerateModal extends Modal {
    plugin: MythrasEncounterPlugin;
    templates: TFile[] = [];
    
    selectedTemplatePath: string = '';
    amount: number = 1;
    scenario: string = 'General';
    encounter: string = 'Random Encounter';

    constructor(app: App, plugin: MythrasEncounterPlugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Generate Mythras Encounter" });

        // Load templates from Bestiary
        const bestiaryPath = `${this.plugin.settings.baseFolder}/Bestiary`;
        const folder = this.app.vault.getAbstractFileByPath(bestiaryPath);
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
            .setName("Scenario")
            .setDesc("Group for this encounter (e.g., 'Act 1' or 'Forest Adventure')")
            .addText(text => {
                text.setValue(this.scenario);
                text.onChange(value => this.scenario = value || 'General');
            });

        new Setting(contentEl)
            .setName("Encounter")
            .setDesc("Specific encounter name (e.g., 'Bridge Ambush')")
            .addText(text => {
                text.setValue(this.encounter);
                text.onChange(value => this.encounter = value || 'Random Encounter');
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
            // Removed the early return if no editor exists, as we still want to save to the Roster!

            // Ensure folder structure exists
            const safeScenario = this.scenario.replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'General';
            const safeEncounter = this.encounter.replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'Random Encounter';
            const folderPath = normalizePath(`${this.plugin.settings.baseFolder}/Roster/${safeScenario}/${safeEncounter}`);
            
            await this.ensureFolderExists(folderPath);

            let output = `\n## Encounter: ${template.name}\n\n`;
            const armoryPath = `${this.plugin.settings.baseFolder}/Armory/armory.json`;
            
            for (let i = 0; i < this.amount; i++) {
                const instanceName = `${template.name} ${i + 1}`;
                const instance = await instantiateEnemy(this.app, armoryPath, template, instanceName, safeScenario, safeEncounter);
                
                const filePath = normalizePath(`${folderPath}/${instance.id}_${template.name.replace(/[^a-zA-Z0-9]/g, '')}.json`);
                await this.app.vault.create(filePath, JSON.stringify(instance, null, 2));
                
                output += `\`\`\`enemy\n${instance.id}\n\`\`\`\n\n`;
            }

            if (activeView && activeView.editor) {
                const cursor = activeView.editor.getCursor();
                activeView.editor.replaceRange(output, cursor);
                new Notice(`Generated ${this.amount}x ${template.name} in Roster and inserted into note!`);
            } else {
                new Notice(`Generated ${this.amount}x ${template.name} in Roster! (No active note to insert into)`);
            }

        } catch (e) {
            new Notice(`Failed to generate enemies: ${e}`);
            console.error(e);
        }
    }

    private async ensureFolderExists(folderPath: string) {
        const parts = folderPath.split('/');
        let currentPath = '';
        for (const part of parts) {
            if (part === '') continue;
            currentPath = currentPath === '' ? part : `${currentPath}/${part}`;
            if (!await this.app.vault.adapter.exists(currentPath)) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }
}
