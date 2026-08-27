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

        const headerContainer = container.createDiv('combat-log-header');
        headerContainer.createEl('h3', { text: 'Combat Log' });
        
        const clearBtn = headerContainer.createEl('button', { text: 'Clear Log', cls: 'combat-log-clear-btn' });
        clearBtn.onclick = () => {
            this.service.clear();
        };

        const logContainer = container.createDiv('combat-log-container');
        
        const entries = this.service.getEntries();
        if (entries.length === 0) {
            logContainer.createDiv({ text: 'No combat actions logged yet.', cls: 'combat-log-empty' });
            return;
        }

        for (const entry of entries) {
            const levelClass = entry.successLevel ? `combat-log-${entry.successLevel.toLowerCase()}` : '';
            const el = logContainer.createDiv(`combat-log-entry ${levelClass}`.trim());
            const timeStr = new Date(entry.timestamp).toLocaleTimeString();
            
            const headerEl = el.createDiv('combat-log-entry-header');
            headerEl.createDiv({ text: entry.actor, cls: 'combat-log-actor' });
            headerEl.createDiv({ text: `[${timeStr}]`, cls: 'combat-log-time' });

            const resultEl = el.createDiv('combat-log-result');
            resultEl.createSpan({ text: `${entry.action} (${entry.target}%)`, cls: 'combat-log-action' });
            resultEl.createSpan({ text: ` → Roll: ${entry.roll} → `, cls: 'combat-log-roll-info' });
            resultEl.createSpan({ 
                text: entry.successLevel, 
                cls: `combat-log-badge combat-log-badge-${(entry.successLevel || '').toLowerCase()}` 
            });
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
