import { ItemView, WorkspaceLeaf } from 'obsidian';

export interface CombatLogEntry {
    id: string;
    timestamp: number;
    actor: string;
    action: string;
    roll: number;
    target: number;
    successLevel: string;
}

export const COMBAT_LOG_VIEW = "mythras-combat-log-view";

export class CombatLogView extends ItemView {
    service: CombatLogService;

    constructor(leaf: WorkspaceLeaf, service: CombatLogService) {
        super(leaf);
        this.service = service;
    }

    getViewType() {
        return COMBAT_LOG_VIEW;
    }

    getDisplayText() {
        return "Combat Log";
    }

    getIcon() {
        return "list";
    }

    async onOpen() {
        this.render();
        // Subscribe to changes
        this.service.onUpdate = () => this.render();
    }

    async onClose() {
        if (this.service.onUpdate === this.render) {
            this.service.onUpdate = null;
        }
    }

    render() {
        const container = this.containerEl.children[1];
        container.empty();

        const header = container.createEl('h3', { text: 'Combat Log' });
        
        const clearBtn = container.createEl('button', { text: 'Clear' });
        clearBtn.onclick = () => {
            this.service.clear();
        };

        const logContainer = container.createDiv('combat-log-container');
        
        const entries = this.service.getEntries();
        for (const entry of entries) {
            const el = logContainer.createDiv('combat-log-entry');
            const timeStr = new Date(entry.timestamp).toLocaleTimeString();
            el.createDiv({ text: `[${timeStr}] ${entry.actor}`, cls: 'combat-log-actor' });
            el.createDiv({ text: `Rolled on "${entry.action} (${entry.target}%)" --> ${entry.roll} --> ${entry.successLevel}`, cls: 'combat-log-result' });
        }
    }
}

export class CombatLogService {
    private entries: CombatLogEntry[] = [];
    public onUpdate: (() => void) | null = null;

    addEntry(entry: Omit<CombatLogEntry, 'id' | 'timestamp'>) {
        this.entries.unshift({
            ...entry,
            id: window.crypto.randomUUID(),
            timestamp: Date.now()
        });
        if (this.onUpdate) {
            this.onUpdate();
        }
    }

    getEntries() {
        return this.entries;
    }

    clear() {
        this.entries = [];
        if (this.onUpdate) {
            this.onUpdate();
        }
    }
}
