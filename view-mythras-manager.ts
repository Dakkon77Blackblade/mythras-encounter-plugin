import { ItemView, WorkspaceLeaf } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { RosterManagerUI } from './ui-roster';
import { ArmoryManagerUI } from './ui-armory';
import { BestiaryManagerUI } from './ui-bestiary';
import { CombatTrackerUI } from './ui-combat';
import { CharacterManagerUI } from './ui-character';

export const MYTHRAS_MANAGER_VIEW = "mythras-manager-view";

export class MythrasManagerView extends ItemView {
    navigation = true;
    plugin: MythrasEncounterPlugin;
    currentTab: 'roster' | 'armory' | 'bestiary' | 'combat' | 'characters' = 'roster';

    rosterUI: RosterManagerUI;
    armoryUI: ArmoryManagerUI;
    bestiaryUI: BestiaryManagerUI;
    combatUI: CombatTrackerUI;
    characterUI: CharacterManagerUI;

    mainContainer: HTMLElement;
    navContainer: HTMLElement;

    constructor(leaf: WorkspaceLeaf, plugin: MythrasEncounterPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return MYTHRAS_MANAGER_VIEW;
    }

    getDisplayText() {
        return "Mythras Manager";
    }

    getIcon() {
        return "swords"; // A standard lucide icon available in Obsidian
    }

    async onOpen() {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('mythras-manager-view');

        // Main layout
        const layout = container.createDiv('mythras-manager-root-layout');

        // Top Navigation
        this.navContainer = layout.createDiv('mythras-manager-nav');

        // Content Area
        this.mainContainer = layout.createDiv('mythras-manager-content'); // Inner UIs handle their own scrolling

        this.rosterUI = new RosterManagerUI(this.app, this.plugin, this.mainContainer);
        this.armoryUI = new ArmoryManagerUI(this.app, this.plugin, this.mainContainer);
        this.bestiaryUI = new BestiaryManagerUI(this.app, this.plugin, this.mainContainer);
        this.combatUI = new CombatTrackerUI(this.app, this.plugin, this.mainContainer, this.plugin.combatTrackerService);
        this.characterUI = new CharacterManagerUI(this.app, this.plugin, this.mainContainer);

        this.renderNav();
        await this.renderCurrentTab();
    }

    renderNav() {
        this.navContainer.empty();

        const createTab = (id: 'roster' | 'armory' | 'bestiary' | 'combat' | 'characters', label: string) => {
            const btn = this.navContainer.createEl('button', { text: label });
            if (this.currentTab === id) {
                btn.addClass('mod-cta');
            }
            btn.onclick = async () => {
                this.currentTab = id;
                this.renderNav();
                await this.renderCurrentTab();
            };
        };

        if (this.plugin.settings.pluginRole === 'GM') {
            createTab('roster', 'Roster Manager');
        }
        
        createTab('characters', '📋 Characters');
        createTab('armory', 'Armory');
        
        if (this.plugin.settings.pluginRole === 'GM') {
            createTab('bestiary', 'Bestiary');
            createTab('combat', '⚔️ Combat Tracker');
        }
    }

    async renderCurrentTab() {
        this.mainContainer.empty();

        if (this.currentTab === 'roster') {
            await this.rosterUI.render();
        } else if (this.currentTab === 'characters') {
            await this.characterUI.render();
        } else if (this.currentTab === 'armory') {
            await this.armoryUI.render();
        } else if (this.currentTab === 'bestiary') {
            await this.bestiaryUI.render();
        } else if (this.currentTab === 'combat') {
            await this.plugin.combatTrackerService.refreshParticipantInstances();
            this.combatUI.render();
        }
    }

    async onClose() {
        // Cleanup if necessary
    }
}
