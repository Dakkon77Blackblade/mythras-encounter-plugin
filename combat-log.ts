import { ItemView, WorkspaceLeaf } from 'obsidian';

export interface CombatLogEntry {
    id: string;
    timestamp: number;
    actor: string;
    action: string;
    roll: number;
    target?: number;
    successLevel?: string;
    type?: 'skill' | 'damage';
    damageTotal?: number;
    specialFx?: string;
    rollBreakdown?: any[];
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
            const typeClass = entry.type === 'damage' ? 'combat-log-damage' : '';
            const el = logContainer.createDiv(`combat-log-entry ${levelClass} ${typeClass}`.trim());
            const timeStr = new Date(entry.timestamp).toLocaleTimeString();
            
            const headerEl = el.createDiv('combat-log-entry-header');
            
            if (entry.type === 'damage') {
                headerEl.createDiv({ text: `[${timeStr}] ${entry.actor} attacked with ${entry.action}`, cls: 'combat-log-action-text' });
                
                const resultEl = el.createDiv('combat-log-result');
                const dmgLabel = resultEl.createSpan({ text: 'Damage: ', cls: 'combat-log-damage-label' });
                
                if (entry.rollBreakdown && entry.rollBreakdown.length > 0) {
                    const breakdownEl = resultEl.createSpan('combat-log-breakdown');
                    entry.rollBreakdown.forEach((node, index) => {
                        const isFirst = index === 0;
                        if (!isFirst || node.sign === '-') {
                            breakdownEl.createSpan({ text: ` ${node.sign} `, cls: 'combat-log-sign' });
                        }
                        
                        const nodeEl = breakdownEl.createSpan('combat-log-node');
                        if (node.rolls) {
                            nodeEl.createSpan({ text: node.label, cls: 'combat-log-dice-label' });
                            nodeEl.createSpan({ text: ` [${node.rolls.join('+')}]`, cls: 'combat-log-dice-rolls' });
                        } else {
                            nodeEl.createSpan({ text: node.label, cls: 'combat-log-constant' });
                        }
                    });
                    
                    breakdownEl.createSpan({ text: ' = ', cls: 'combat-log-equals' });
                    breakdownEl.createSpan({ text: `${entry.damageTotal}`, cls: 'combat-log-damage-total' });
                } else {
                    resultEl.createSpan({ text: `${entry.damageTotal} (Rolled: ${entry.roll})`, cls: 'combat-log-damage-info' });
                }
                
                if (entry.specialFx) {
                    el.createDiv({ text: `Effects: ${entry.specialFx}`, cls: 'combat-log-fx' });
                }
            } else {
                headerEl.createDiv({ text: entry.actor, cls: 'combat-log-actor' });
                headerEl.createDiv({ text: `[${timeStr}]`, cls: 'combat-log-time' });

                const resultEl = el.createDiv('combat-log-result');
                resultEl.createSpan({ text: `${entry.action} (${entry.target}%)`, cls: 'combat-log-action' });
                resultEl.createSpan({ text: ` → Roll: ${entry.roll} → `, cls: 'combat-log-roll-info' });
                resultEl.createSpan({ 
                    text: entry.successLevel || '', 
                    cls: `combat-log-badge combat-log-badge-${(entry.successLevel || '').toLowerCase()}` 
                });
            }
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
