import { App, Modal, Notice } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasInstance } from './mythras-api';
import { renderUnifiedEditor, EditorTab } from './editor-shared';

export class EnemyInstanceEditModal extends Modal {
    plugin: MythrasEncounterPlugin;
    instance: MythrasInstance;
    onSave: (updated: MythrasInstance) => Promise<void>;
    editTab: EditorTab = 'general';

    constructor(app: App, plugin: MythrasEncounterPlugin, instance: MythrasInstance, onSave: (updated: MythrasInstance) => Promise<void>) {
        super(app);
        this.plugin = plugin;
        // Clone instance so changes can be cancelled
        this.instance = JSON.parse(JSON.stringify(instance));
        this.onSave = onSave;
    }

    onOpen() {
        this.display();
    }

    onClose() {
        this.contentEl.empty();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mythras-manager-container');

        const topBar = contentEl.createDiv('mythras-manager-header');
        topBar.createEl('h2', { text: `Edit: ${this.instance.instanceName || this.instance.templateName}` });

        const btnGroup = topBar.createDiv('mythras-manager-header-controls');
        
        const btnCancel = btnGroup.createEl('button', { text: 'Cancel', cls: 'mythras-btn-secondary' });
        btnCancel.onclick = () => this.close();

        const btnSave = btnGroup.createEl('button', { text: 'Save Changes', cls: 'mythras-btn-primary' });
        btnSave.onclick = async () => {
            await this.saveChanges();
        };

        const formArea = contentEl.createDiv('mythras-manager-form mythras-modal-form-scroll');

        renderUnifiedEditor(formArea, 'instance', this.instance, {
            app: this.app,
            plugin: this.plugin,
            activeTab: this.editTab,
            onTabChange: (tab) => { this.editTab = tab; this.display(); },
            armoryWeapons: this.plugin.armoryCache
        });
    }

    async saveChanges() {
        try {
            const folder = this.plugin.settings.baseFolder || 'Mythras-Helper';
            const rosterFolder = `${folder}/Roster`;
            
            // Recalculate weapon damage modifiers if damage mod attribute changed
            const dmgMod = this.instance.attributes['Damage Mod'] as string;
            if (this.instance.weapons) {
                this.instance.weapons.forEach(w => {
                    const aw = this.plugin.armoryCache?.find(a => a.name.toLowerCase() === w.name.toLowerCase());
                    if (aw && aw.damageModifier !== false) {
                        let baseDmg = aw.damage;
                        if (dmgMod && dmgMod !== '+0' && dmgMod !== '0') {
                            const mod = dmgMod.startsWith('+') || dmgMod.startsWith('-') ? dmgMod : '+' + dmgMod;
                            baseDmg += mod;
                        }
                        w.damage = baseDmg;
                    }
                });
            }

            // Find JSON file on disk by instance id
            const files = this.app.vault.getFiles().filter(f => f.path.startsWith(rosterFolder) && f.extension === 'json');
            let targetFile = null;
            for (const f of files) {
                try {
                    const content = await this.app.vault.read(f);
                    const parsed = JSON.parse(content);
                    if (parsed && parsed.id === this.instance.id) {
                        targetFile = f;
                        break;
                    }
                } catch (e) {}
            }

            const dataStr = JSON.stringify(this.instance, null, 2);
            if (targetFile) {
                await this.app.vault.modify(targetFile, dataStr);
            } else {
                const safeName = `${this.instance.scenario}_${this.instance.encounter}_${this.instance.instanceName}_${this.instance.id}.json`.replace(/[^a-zA-Z0-9._-]/g, '_');
                await this.app.vault.create(`${rosterFolder}/${safeName}`, dataStr);
            }

            await this.onSave(this.instance);
            this.close();
            new Notice(`Saved edits for "${this.instance.instanceName}".`);
        } catch (e) {
            new Notice("Error saving changes.");
        }
    }
}
