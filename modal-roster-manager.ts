import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasInstance } from './mythras-api';
import { ConfirmModal } from './modal-armory-manager';

export class RosterManagerModal extends Modal {
    plugin: MythrasEncounterPlugin;
    instances: { file: TFile, data: MythrasInstance }[] = [];
    
    // UI State
    selectedScenario: string | null = null;
    selectedEncounter: string | null = null;

    constructor(app: App, plugin: MythrasEncounterPlugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        this.titleEl.setText('Roster Manager (Active Enemies)');
        this.modalEl.addClass('mythras-bestiary-modal');
        this.modalEl.style.width = '80vw';
        this.modalEl.style.maxWidth = '1200px';
        this.modalEl.style.height = '80vh';

        await this.loadInstances();
        
        // Auto-select first scenario if none selected
        if (!this.selectedScenario && this.instances.length > 0) {
            const scenarios = Array.from(new Set(this.instances.map(i => i.data.scenario || 'General'))).sort();
            if (scenarios.length > 0) {
                this.selectedScenario = scenarios[0];
            }
        }

        this.display();
    }

    async loadInstances() {
        this.instances = [];
        const rosterPath = `${this.plugin.settings.baseFolder}/Roster`;
        const folder = this.app.vault.getAbstractFileByPath(rosterPath);
        
        if (!folder) return;

        // Recursively find JSON files
        const findJsonFiles = (f: any): TFile[] => {
            let files: TFile[] = [];
            if (f && 'children' in f) {
                for (const child of f.children) {
                    files = files.concat(findJsonFiles(child));
                }
            } else if (f instanceof TFile && f.extension === 'json') {
                files.push(f);
            }
            return files;
        };

        const jsonFiles = findJsonFiles(folder);
        for (const file of jsonFiles) {
            try {
                const content = await this.app.vault.read(file);
                const data: MythrasInstance = JSON.parse(content);
                this.instances.push({ file, data });
            } catch (e) {
                console.error(`Failed to parse instance file ${file.path}`, e);
            }
        }

        // Sort by lastModified descending
        this.instances.sort((a, b) => b.data.lastModified - a.data.lastModified);
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        
        if (this.instances.length === 0) {
            contentEl.createEl("p", { text: "No active enemies found. Generate some first!" });
            return;
        }

        const layout = contentEl.createDiv('roster-layout');
        
        const sidebar = layout.createDiv('roster-sidebar');
        const mainArea = layout.createDiv('roster-main');

        this.renderSidebar(sidebar);
        this.renderMainArea(mainArea);
    }

    renderSidebar(sidebar: HTMLElement) {
        sidebar.createEl('h3', { text: 'Scenarios' });
        
        const scenarios = Array.from(new Set(this.instances.map(i => i.data.scenario || 'General'))).sort();
        
        for (const sc of scenarios) {
            const item = sidebar.createDiv('roster-scenario-item');
            if (this.selectedScenario === sc) {
                item.addClass('is-active');
            }
            
            const count = this.instances.filter(i => (i.data.scenario || 'General') === sc).length;
            item.setText(`${sc} (${count})`);
            
            item.onclick = () => {
                this.selectedScenario = sc;
                this.selectedEncounter = null; // Reset encounter filter when changing scenario
                this.display();
            };
        }
    }

    renderMainArea(mainArea: HTMLElement) {
        if (!this.selectedScenario) {
            mainArea.createEl('p', { text: 'Select a Scenario from the sidebar.' });
            return;
        }

        // 1. Render Header & Tag Cloud
        const header = mainArea.createDiv('roster-header');
        header.createEl('h3', { text: `Scenario: ${this.selectedScenario}`, cls: 'mythras-item-name-grid' });
        
        const scenarioInstances = this.instances.filter(i => (i.data.scenario || 'General') === this.selectedScenario);
        const encounters = Array.from(new Set(scenarioInstances.map(i => i.data.encounter || 'Random Encounter'))).sort();

        const tagCloud = header.createDiv('roster-tag-cloud');
        
        const allTag = tagCloud.createDiv('roster-tag');
        allTag.setText(`All Encounters (${scenarioInstances.length})`);
        if (this.selectedEncounter === null) allTag.addClass('is-active');
        allTag.onclick = () => {
            this.selectedEncounter = null;
            this.display();
        };

        for (const enc of encounters) {
            const count = scenarioInstances.filter(i => (i.data.encounter || 'Random Encounter') === enc).length;
            const tag = tagCloud.createDiv('roster-tag');
            tag.setText(`${enc} (${count})`);
            if (this.selectedEncounter === enc) tag.addClass('is-active');
            tag.onclick = () => {
                this.selectedEncounter = enc;
                this.display();
            };
        }

        // 2. Render Table
        const displayInstances = this.selectedEncounter === null 
            ? scenarioInstances 
            : scenarioInstances.filter(i => (i.data.encounter || 'Random Encounter') === this.selectedEncounter);

        if (displayInstances.length === 0) {
            mainArea.createEl('p', { text: 'No enemies in this encounter.' });
            return;
        }

        const table = mainArea.createEl('table', { cls: 'armory-table' });
        table.style.width = '100%';
        table.style.textAlign = 'left';
        table.style.borderCollapse = 'collapse';
        table.style.marginTop = '15px';

        const thead = table.createEl('thead');
        const tr = thead.createEl('tr');
        
        const headers = ['Instance Name', 'Template', 'Encounter', 'HP', 'Actions'];
        headers.forEach(h => {
            const th = tr.createEl('th', { text: h });
            th.style.padding = '8px';
            th.style.borderBottom = '1px solid var(--background-modifier-border)';
        });

        const tbody = table.createEl('tbody');

        for (const inst of displayInstances) {
            const row = tbody.createEl('tr');
            row.style.borderBottom = '1px solid var(--background-modifier-border-alt)';
            row.onmouseenter = () => row.style.backgroundColor = 'var(--background-modifier-hover)';
            row.onmouseleave = () => row.style.backgroundColor = 'transparent';

            row.createEl('td', { text: inst.data.instanceName }).style.padding = '8px';
            row.createEl('td', { text: inst.data.templateName }).style.padding = '8px';
            row.createEl('td', { text: inst.data.encounter || 'Random Encounter' }).style.padding = '8px';
            
            // HP column
            const hpTd = row.createEl('td');
            hpTd.style.padding = '8px';
            if (inst.data.hitLocations && inst.data.hitLocations.length > 0) {
                const hl = inst.data.hitLocations[0]; // Take first hit location for simplicity, usually head or leg in Mythras, but we just want an indicator
                const totalHp = inst.data.hitLocations.reduce((sum, h) => sum + h.currentHp, 0);
                const maxHp = inst.data.hitLocations.reduce((sum, h) => sum + h.hp, 0);
                hpTd.setText(`${totalHp} / ${maxHp}`);
            } else {
                hpTd.setText('-');
            }

            // Actions
            const actionsTd = row.createEl('td');
            actionsTd.style.padding = '8px';
            actionsTd.style.display = 'flex';
            actionsTd.style.gap = '8px';

            const btnCopy = actionsTd.createEl('button', { text: 'Copy ID' });
            btnCopy.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(`\`\`\`enemy ${inst.data.id}\`\`\``);
                new Notice("Copied codeblock to clipboard!");
            };

            const btnDelete = actionsTd.createEl('button', { text: '🗑️', cls: 'mod-warning' });
            btnDelete.onclick = (e) => {
                e.stopPropagation();
                new ConfirmModal(this.app, `Do you really want to delete ${inst.data.instanceName}?`, async (result) => {
                    if (result) {
                        await this.app.vault.delete(inst.file);
                        new Notice(`Deleted ${inst.data.instanceName}`);
                        await this.loadInstances();
                        this.display();
                    }
                }).open();
            };
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
