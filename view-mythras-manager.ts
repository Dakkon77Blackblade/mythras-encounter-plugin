import { ItemView, WorkspaceLeaf } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { RosterManagerUI } from './ui-roster';
import { ArmoryManagerUI } from './ui-armory';
import { BestiaryManagerUI } from './ui-bestiary';
import { CombatTrackerUI } from './ui-combat';

export const MYTHRAS_MANAGER_VIEW = "mythras-manager-view";

export class MythrasManagerView extends ItemView {
    navigation = true;
    plugin: MythrasEncounterPlugin;
    currentTab: 'roster' | 'armory' | 'bestiary' | 'combat' = 'roster';

    rosterUI: RosterManagerUI;
    armoryUI: ArmoryManagerUI;
    bestiaryUI: BestiaryManagerUI;
    combatUI: CombatTrackerUI;

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
        const layout = container.createDiv();
        layout.style.display = 'flex';
        layout.style.flexDirection = 'column';
        layout.style.height = '100%';
        layout.style.padding = '10px';

        // Top Navigation
        this.navContainer = layout.createDiv('mythras-manager-nav');
        this.navContainer.style.display = 'flex';
        this.navContainer.style.gap = '15px';
        this.navContainer.style.borderBottom = '1px solid var(--background-modifier-border)';
        this.navContainer.style.paddingBottom = '10px';
        this.navContainer.style.marginBottom = '20px';

        // Content Area
        this.mainContainer = layout.createDiv('mythras-manager-content');
        this.mainContainer.style.flex = '1';
        this.mainContainer.style.overflow = 'hidden'; // Inner UIs handle their own scrolling

        this.rosterUI = new RosterManagerUI(this.app, this.plugin, this.mainContainer);
        this.armoryUI = new ArmoryManagerUI(this.app, this.plugin, this.mainContainer);
        this.bestiaryUI = new BestiaryManagerUI(this.app, this.plugin, this.mainContainer);
        this.combatUI = new CombatTrackerUI(this.app, this.plugin, this.mainContainer, this.plugin.combatTrackerService);

        this.renderNav();
        await this.renderCurrentTab();
    }

    renderNav() {
        this.navContainer.empty();

        const createTab = (id: 'roster' | 'armory' | 'bestiary' | 'combat', label: string) => {
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

        createTab('roster', 'Roster Manager');
        createTab('armory', 'Armory');
        createTab('bestiary', 'Bestiary');
        createTab('combat', '⚔️ Combat Tracker');
    }

    async renderCurrentTab() {
        this.mainContainer.empty();

        if (this.currentTab === 'roster') {
            await this.rosterUI.render();
        } else if (this.currentTab === 'armory') {
            await this.armoryUI.render();
        } else if (this.currentTab === 'bestiary') {
            await this.bestiaryUI.render();
        } else if (this.currentTab === 'combat') {
            this.combatUI.render();
        }
    }

    async onClose() {
        // Cleanup if necessary
    }
}
