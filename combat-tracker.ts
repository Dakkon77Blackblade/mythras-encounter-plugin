import { normalizePath, TFile } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasInstance } from './mythras-api';
import { DiceRoller } from './dice-roller';
import { MYTHRAS_MANAGER_VIEW } from './view-mythras-manager';

export interface CombatParticipant {
    id: string; // Unique session ID
    instanceId: string; // Original instance ID
    instance: MythrasInstance;
    initiative: number;
    initiativeBonus: number;
    initiativeRoll: number;
    currentAp: number;
    maxAp: number;
    isDone: boolean;
}

export interface CombatSession {
    scenario: string;
    encounter: string;
    round: number;
    cycle: number;
    participants: CombatParticipant[];
    selectedParticipantId?: string;
}

export class CombatTrackerService {
    plugin: MythrasEncounterPlugin;
    session: CombatSession = {
        scenario: '',
        encounter: '',
        round: 1,
        cycle: 1,
        participants: []
    };

    private onUpdateCallbacks: Array<() => void> = [];

    constructor(plugin: MythrasEncounterPlugin) {
        this.plugin = plugin;
    }

    subscribe(callback: () => void) {
        this.onUpdateCallbacks.push(callback);
    }

    unsubscribe(callback: () => void) {
        this.onUpdateCallbacks = this.onUpdateCallbacks.filter(cb => cb !== callback);
    }

    private notify() {
        this.saveSession();
        this.onUpdateCallbacks.forEach(cb => cb());
    }

    async loadSession() {
        try {
            const folder = this.plugin.settings.baseFolder || 'Mythras-Helper';
            const sessionPath = normalizePath(`${folder}/Roster/.combat_session.json`);
            const file = this.plugin.app.vault.getAbstractFileByPath(sessionPath);
            if (file instanceof TFile) {
                const raw = await this.plugin.app.vault.read(file);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (!parsed.round) parsed.round = 1;
                    if (!parsed.cycle) parsed.cycle = 1;
                    this.session = parsed;
                    await this.refreshParticipantInstances();
                }
            }
        } catch (e) {}
    }

    async refreshParticipantInstances() {
        try {
            const folder = this.plugin.settings.baseFolder || 'Mythras-Helper';
            const rosterPath = normalizePath(`${folder}/Roster`);
            const files = this.plugin.app.vault.getFiles().filter(f => 
                f.path.startsWith(rosterPath) && 
                f.extension === 'json' && 
                !f.name.startsWith('.')
            );

            const fileMap = new Map<string, MythrasInstance>();
            for (const f of files) {
                try {
                    const content = await this.plugin.app.vault.read(f);
                    const inst: MythrasInstance = JSON.parse(content);
                    if (inst && inst.id) {
                        fileMap.set(inst.id, inst);
                    }
                } catch (e) {}
            }

            let updated = false;
            for (const p of this.session.participants) {
                const fresh = fileMap.get(p.instanceId);
                if (fresh) {
                    p.instance = JSON.parse(JSON.stringify(fresh));
                    updated = true;
                }
            }

            if (updated) {
                await this.saveSession();
            }
        } catch (e) {}
    }

    private async ensureFolderExists(folderPath: string) {
        const parts = folderPath.split('/');
        let currentPath = '';
        for (const part of parts) {
            if (part === '') continue;
            currentPath = currentPath === '' ? part : `${currentPath}/${part}`;
            try {
                if (!this.plugin.app.vault.getAbstractFileByPath(currentPath)) {
                    await this.plugin.app.vault.createFolder(currentPath);
                }
            } catch (e) {
                // Ignore if folder already exists
            }
        }
    }

    async saveSession() {
        try {
            const folder = this.plugin.settings.baseFolder || 'Mythras-Helper';
            const sessionPath = normalizePath(`${folder}/Roster/.combat_session.json`);
            const content = JSON.stringify(this.session, null, 2);
            const file = this.plugin.app.vault.getAbstractFileByPath(sessionPath);
            if (file instanceof TFile) {
                await this.plugin.app.vault.modify(file, content);
            } else {
                const rosterFolder = normalizePath(`${folder}/Roster`);
                await this.ensureFolderExists(rosterFolder);
                await this.plugin.app.vault.create(sessionPath, content);
            }
        } catch (e) {}
    }

    calculateStrikeRank(instance: MythrasInstance): number {
        const initAttr = instance.attributes['Initiative'] || instance.attributes['Strike Rank'];
        if (typeof initAttr === 'number') return initAttr;
        if (typeof initAttr === 'string') {
            const parsed = parseInt(initAttr);
            if (!isNaN(parsed)) return parsed;
        }
        const intVal = instance.stats['INT'] || 10;
        const dexVal = instance.stats['DEX'] || 10;
        return DiceRoller.calculateInitiative(intVal, dexVal);
    }

    calculateMaxAp(instance: MythrasInstance): number {
        const apAttr = instance.attributes['Action Points'] || instance.attributes['AP'];
        if (typeof apAttr === 'number') return apAttr;
        if (typeof apAttr === 'string') {
            const parsed = parseInt(apAttr);
            if (!isNaN(parsed)) return parsed;
        }
        const intVal = instance.stats['INT'] || 10;
        const dexVal = instance.stats['DEX'] || 10;
        return DiceRoller.calculateActionPoints(intVal, dexVal);
    }

    addInstances(instances: MythrasInstance[], scenarioName?: string, encounterName?: string) {
        if (scenarioName) this.session.scenario = scenarioName;
        if (encounterName) this.session.encounter = encounterName;

        for (const inst of instances) {
            const sr = this.calculateStrikeRank(inst);
            const roll = Math.floor(Math.random() * 10) + 1;
            const maxAp = this.calculateMaxAp(inst);

            const participant: CombatParticipant = {
                id: `${inst.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                instanceId: inst.id,
                instance: JSON.parse(JSON.stringify(inst)),
                initiative: sr + roll,
                initiativeBonus: sr,
                initiativeRoll: roll,
                currentAp: maxAp,
                maxAp: maxAp,
                isDone: false
            };
            this.session.participants.push(participant);
        }

        this.sortParticipants();
        if (!this.session.selectedParticipantId && this.session.participants.length > 0) {
            this.session.selectedParticipantId = this.session.participants[0].id;
        }
        this.notify();
    }

    sortParticipants() {
        this.session.participants.sort((a, b) => {
            // Completely inactive participants (0 AP and Turn Done) go to the very bottom
            const aInactive = (a.isDone && a.currentAp === 0) ? 1 : 0;
            const bInactive = (b.isDone && b.currentAp === 0) ? 1 : 0;
            if (aInactive !== bInactive) {
                return aInactive - bInactive;
            }
            // Cycle done participants (Turn Done in this cycle) go below active participants
            const aCycleDone = (a.isDone && a.currentAp > 0) ? 1 : 0;
            const bCycleDone = (b.isDone && b.currentAp > 0) ? 1 : 0;
            if (aCycleDone !== bCycleDone) {
                return aCycleDone - bCycleDone;
            }
            // Primary ordering: Initiative descending
            return b.initiative - a.initiative;
        });
    }

    rollInitiativeAll() {
        for (const p of this.session.participants) {
            const roll = Math.floor(Math.random() * 10) + 1;
            p.initiativeRoll = roll;
            p.initiative = p.initiativeBonus + roll;
        }
        this.sortParticipants();
        this.notify();
    }

    rollInitiativeFor(participantId: string) {
        const p = this.session.participants.find(x => x.id === participantId);
        if (p) {
            const roll = Math.floor(Math.random() * 10) + 1;
            p.initiativeRoll = roll;
            p.initiative = p.initiativeBonus + roll;
            this.sortParticipants();
            this.notify();
        }
    }

    toggleTurnDone(participantId: string) {
        const p = this.session.participants.find(x => x.id === participantId);
        if (p) {
            p.isDone = !p.isDone;
            this.sortParticipants();
            
            // Auto-select the next active combatant at the top of the queue
            const nextActive = this.session.participants.find(x => x.currentAp > 0 && !x.isDone);
            if (nextActive) {
                this.session.selectedParticipantId = nextActive.id;
            }
            
            this.notify();
        }
    }

    adjustAp(participantId: string, delta: number) {
        const p = this.session.participants.find(x => x.id === participantId);
        if (p) {
            p.currentAp = Math.max(0, Math.min(p.maxAp, p.currentAp + delta));
            this.notify();
        }
    }

    setAp(participantId: string, value: number) {
        const p = this.session.participants.find(x => x.id === participantId);
        if (p) {
            p.currentAp = Math.max(0, Math.min(p.maxAp, value));
            this.notify();
        }
    }

    adjustHp(participantId: string, locationName: string, delta: number) {
        const p = this.session.participants.find(x => x.id === participantId);
        if (p) {
            const hl = p.instance.hitLocations.find(loc => loc.name.toLowerCase() === locationName.toLowerCase());
            if (hl) {
                hl.currentHp += delta;
                this.syncInstanceToDisk(p.instance);
                this.notify();
            }
        }
    }

    removeParticipant(participantId: string) {
        this.session.participants = this.session.participants.filter(x => x.id !== participantId);
        if (this.session.selectedParticipantId === participantId) {
            const nextActive = this.session.participants.find(x => x.currentAp > 0 && !x.isDone) || this.session.participants[0];
            this.session.selectedParticipantId = nextActive?.id;
        }
        this.notify();
    }

    selectParticipant(participantId: string) {
        this.session.selectedParticipantId = participantId;
        this.notify();
    }

    nextCycle() {
        this.session.cycle += 1;
        // Do NOT reset AP! Only reset isDone for participants who still have AP > 0
        for (const p of this.session.participants) {
            if (p.currentAp > 0) {
                p.isDone = false;
            }
        }
        this.sortParticipants();
        const nextActive = this.session.participants.find(x => x.currentAp > 0 && !x.isDone);
        if (nextActive) {
            this.session.selectedParticipantId = nextActive.id;
        }
        this.notify();
    }

    nextRound() {
        this.session.round += 1;
        this.session.cycle = 1;
        for (const p of this.session.participants) {
            p.isDone = false;
            p.currentAp = p.maxAp;
        }
        this.sortParticipants();
        const nextActive = this.session.participants.find(x => x.currentAp > 0 && !x.isDone);
        if (nextActive) {
            this.session.selectedParticipantId = nextActive.id;
        }
        this.notify();
    }

    clearSession() {
        this.session = {
            scenario: '',
            encounter: '',
            round: 1,
            cycle: 1,
            participants: []
        };
        this.notify();
    }

    async syncInstanceToDisk(instance: MythrasInstance) {
        try {
            instance.lastModified = Date.now();
            const folder = this.plugin.settings.baseFolder || 'Mythras-Helper';
            const rosterPath = normalizePath(`${folder}/Roster`);
            
            // Search vault for the existing instance file matching instance.id
            const files = this.plugin.app.vault.getFiles().filter(f => 
                f.path.startsWith(rosterPath) && 
                f.extension === 'json' && 
                !f.name.startsWith('.')
            );

            let targetFile: TFile | null = null;
            for (const f of files) {
                if (f.name.includes(instance.id)) {
                    targetFile = f;
                    break;
                }
            }

            if (!targetFile) {
                for (const f of files) {
                    try {
                        const content = await this.plugin.app.vault.read(f);
                        const parsed = JSON.parse(content);
                        if (parsed && parsed.id === instance.id) {
                            targetFile = f;
                            break;
                        }
                    } catch (e) {}
                }
            }

            const content = JSON.stringify(instance, null, 2);
            if (targetFile) {
                await this.plugin.app.vault.modify(targetFile, content);
            } else {
                const safeTemplate = (instance.templateName || 'Enemy').replace(/[^\p{L}\p{N}]/gu, '');
                const newFilePath = normalizePath(`${rosterPath}/${instance.id}_${safeTemplate}.json`);
                await this.plugin.app.vault.create(newFilePath, content);
            }

            // Update matching rendered DOM statblocks across active documents
            const selector = `.mythras-enemy-short[data-mythras-instance-id="${instance.id}"], .mythras-enemy-long[data-mythras-instance-id="${instance.id}"]`;
            const domInstances: HTMLElement[] = [];
            const docs = new Set<Document>();
            if (typeof document !== 'undefined') docs.add(document);
            if (typeof activeDocument !== 'undefined') docs.add(activeDocument);

            this.plugin.app.workspace.iterateAllLeaves((leaf) => {
                if (leaf.view?.containerEl?.ownerDocument) {
                    docs.add(leaf.view.containerEl.ownerDocument);
                }
            });

            for (const doc of docs) {
                doc.querySelectorAll(selector).forEach(el => {
                    if (!domInstances.includes(el as HTMLElement)) {
                        domInstances.push(el as HTMLElement);
                    }
                });
            }

            const onEdit = async () => {
                const leaf = this.plugin.app.workspace.getLeaf(false);
                await leaf.setViewState({ type: MYTHRAS_MANAGER_VIEW, active: true });
                const view = leaf.view as any;
                if (view && view.rosterUI) {
                    view.currentTab = 'roster';
                    view.rosterUI.openEditView(instance.id);
                }
            };

            for (const el of domInstances) {
                const elIsLong = el.dataset.mythrasIsLong === 'true';
                const elSourcePath = el.dataset.mythrasSourcePath || '';
                const newStatblock = await this.plugin.renderEnemyWithImages(instance, elIsLong, elSourcePath, onEdit);
                el.replaceWith(newStatblock);
            }
        } catch (e) {}
    }
}
