import { App, Notice, Modal, FuzzySuggestModal, setIcon, TFile, normalizePath } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { CombatTrackerService, CombatParticipant } from './combat-tracker';
import { MythrasInstance } from './mythras-api';
import { renderEnemyStatblock, resolveImagePath } from './statblock-formatter';
import { EnemyInstanceEditModal } from './modal-edit-instance';

export class AddEncounterModal extends Modal {
    plugin: MythrasEncounterPlugin;
    onSelect: (scenario: string, encounter: string, instances: MythrasInstance[]) => void;

    constructor(app: App, plugin: MythrasEncounterPlugin, onSelect: (scenario: string, encounter: string, instances: MythrasInstance[]) => void) {
        super(app);
        this.plugin = plugin;
        this.onSelect = onSelect;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Add encounter to combat' });

        const folder = this.plugin.settings.baseFolder || 'Mythras-Helper';
        const rosterPath = normalizePath(`${folder}/Roster`);
        const files = this.app.vault.getFiles().filter(f => f.path.startsWith(rosterPath) && f.extension === 'json' && !f.name.startsWith('.'));

        const encountersMap: Map<string, { scenario: string; encounter: string; instances: MythrasInstance[] }> = new Map();

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                const inst: MythrasInstance = JSON.parse(content);
                const key = `${inst.scenario || 'Default'} - ${inst.encounter || 'Default'}`;
                if (!encountersMap.has(key)) {
                    encountersMap.set(key, { scenario: inst.scenario || 'Default', encounter: inst.encounter || 'Default', instances: [] });
                }
                encountersMap.get(key)!.instances.push(inst);
            } catch (e) {
                // Ignore parse errors
            }
        }

        if (encountersMap.size === 0) {
            contentEl.createEl('p', { text: 'No encounters found in Roster.' });
            return;
        }

        const listDiv = contentEl.createDiv('mythras-manager-list');
        listDiv.style.maxHeight = '400px';
        listDiv.style.overflowY = 'auto';

        for (const [key, data] of encountersMap.entries()) {
            const row = listDiv.createDiv('mythras-manager-list-row');
            row.style.cursor = 'pointer';
            row.style.padding = '8px 12px';
            
            const title = row.createDiv();
            title.createEl('strong', { text: data.encounter });
            title.createEl('span', { text: ` (${data.scenario}) - ${data.instances.length} enemies`, cls: 'mythras-text-muted' });
            title.style.fontSize = '0.95em';

            const btnAdd = row.createEl('button', { text: '+ Add', cls: 'mythras-btn-primary' });
            btnAdd.onclick = () => {
                this.onSelect(data.scenario, data.encounter, data.instances);
                this.close();
            };
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class AddSingleEnemyModal extends FuzzySuggestModal<MythrasInstance> {
    plugin: MythrasEncounterPlugin;
    instances: MythrasInstance[] = [];
    onSelectInstance: (inst: MythrasInstance) => void;

    constructor(app: App, plugin: MythrasEncounterPlugin, onSelectInstance: (inst: MythrasInstance) => void) {
        super(app);
        this.plugin = plugin;
        this.onSelectInstance = onSelectInstance;
        this.setPlaceholder("Search enemy instance in Roster...");
    }

    async getItems(): Promise<MythrasInstance[]> {
        const folder = this.plugin.settings.baseFolder || 'Mythras-Helper';
        const rosterPath = normalizePath(`${folder}/Roster`);
        const files = this.app.vault.getFiles().filter(f => f.path.startsWith(rosterPath) && f.extension === 'json' && !f.name.startsWith('.'));

        const list: MythrasInstance[] = [];
        for (const f of files) {
            try {
                const raw = await this.app.vault.read(f);
                list.push(JSON.parse(raw));
            } catch (e) {}
        }
        this.instances = list;
        return list;
    }

    getItemText(item: MythrasInstance): string {
        return `${item.instanceName} (${item.templateName}) - ${item.encounter || 'No Encounter'}`;
    }

    onChooseItem(item: MythrasInstance): void {
        this.onSelectInstance(item);
    }
}

export class CombatTrackerUI {
    app: App;
    plugin: MythrasEncounterPlugin;
    container: HTMLElement;
    service: CombatTrackerService;

    constructor(app: App, plugin: MythrasEncounterPlugin, container: HTMLElement, service: CombatTrackerService) {
        this.app = app;
        this.plugin = plugin;
        this.container = container;
        this.service = service;

        this.service.subscribe(() => this.render());
    }

    render() {
        this.container.empty();
        this.container.addClass('mythras-combat-container');

        // Header Toolbar
        const header = this.container.createDiv('mythras-combat-header');
        
        const titleArea = header.createDiv('mythras-combat-title-area');
        titleArea.createEl('h2', { text: 'Combat tracker', cls: 'mythras-combat-title' });
        
        if (this.service.session.encounter) {
            titleArea.createSpan({ text: `${this.service.session.encounter} (${this.service.session.scenario})`, cls: 'mythras-badge' });
        }
        
        const cycleBadge = titleArea.createDiv('mythras-combat-cycle-badge');
        cycleBadge.createSpan({ text: `Round: `, cls: 'mythras-text-muted' });
        cycleBadge.createEl('strong', { text: `${this.service.session ? this.service.session.round : 1}` });
        cycleBadge.createSpan({ text: ` | Cycle: `, cls: 'mythras-text-muted' });
        cycleBadge.createEl('strong', { text: `${this.service.session ? this.service.session.cycle : 1}` });

        const controls = header.createDiv('mythras-combat-controls');
        
        const btnAddEnc = controls.createEl('button', { text: '+ Add Encounter', cls: 'mythras-btn-primary' });
        btnAddEnc.onclick = () => {
            new AddEncounterModal(this.app, this.plugin, (scen, enc, insts) => {
                this.service.addInstances(insts, scen, enc);
            }).open();
        };

        const btnAddEnemy = controls.createEl('button', { text: '+ Add Enemy', cls: 'mythras-btn-secondary' });
        btnAddEnemy.onclick = () => {
            new AddSingleEnemyModal(this.app, this.plugin, (inst) => {
                this.service.addInstances([inst]);
            }).open();
        };

        const btnRollAll = controls.createEl('button', { text: '🎲 Roll Init All', cls: 'mythras-btn-secondary' });
        btnRollAll.onclick = () => this.service.rollInitiativeAll();

        const btnClear = controls.createEl('button', { text: 'Clear', cls: 'mythras-btn-danger' });
        btnClear.onclick = () => {
            if (confirm('Clear the current combat session?')) {
                this.service.clearSession();
            }
        };

        // Main 2-Column Area
        const mainArea = this.container.createDiv('mythras-combat-main-area');

        // Left Column: Initiative Queue
        const leftCol = mainArea.createDiv('mythras-combat-left-col');
        this.renderInitiativeQueue(leftCol);

        // Right Column: Full Statblock Inspector
        const rightCol = mainArea.createDiv('mythras-combat-right-col');
        this.renderFullStatblockInspector(rightCol);
    }

    renderInitiativeQueue(container: HTMLElement) {
        container.empty();

        const header = container.createDiv('mythras-queue-header');
        
        const titleGroup = header.createDiv('mythras-queue-title-group');
        titleGroup.createEl('h3', { text: 'Initiative order' });
        titleGroup.createSpan({ text: ` (${this.service.session.participants.length})`, cls: 'mythras-text-muted' });

        const queueControls = header.createDiv('mythras-queue-controls');
        
        const btnNextCycle = queueControls.createEl('button', { text: '⏭ Next Cycle', cls: 'mythras-btn-secondary' });
        btnNextCycle.title = 'Advance to next turn pass within the round (AP stays unchanged)';
        btnNextCycle.onclick = () => this.service.nextCycle();

        const btnNextRound = queueControls.createEl('button', { text: '🔄 Next Round', cls: 'mythras-btn-cta' });
        btnNextRound.title = 'Start new round (resets AP to max for everyone)';
        btnNextRound.onclick = () => this.service.nextRound();

        if (this.service.session.participants.length === 0) {
            const empty = container.createDiv('mythras-empty-state');
            empty.createEl('p', { text: 'No combatants in active session.' });
            empty.createEl('p', { text: 'Click "+ Add Encounter" or "+ Add Enemy" to begin.', cls: 'mythras-text-muted' });
            return;
        }

        const scrollArea = container.createDiv('mythras-queue-scroll');

        const activeList = this.service.session.participants.filter(p => !p.isDone);
        const cycleDoneList = this.service.session.participants.filter(p => p.isDone && p.currentAp > 0);
        const roundDoneList = this.service.session.participants.filter(p => p.isDone && p.currentAp === 0);

        // Render Active Participants
        if (activeList.length > 0) {
            const activeHeader = scrollArea.createDiv('mythras-queue-section-title');
            activeHeader.createEl('span', { text: 'Active Turns' });

            activeList.forEach((p, idx) => {
                const isCurrentTurn = idx === 0;
                this.renderParticipantCard(scrollArea, p, isCurrentTurn);
            });
        }

        // Render Done in Cycle Participants
        if (cycleDoneList.length > 0) {
            const doneHeader = scrollArea.createDiv('mythras-queue-section-title mythras-done-section');
            doneHeader.createEl('span', { text: `Turn Done in Cycle (${cycleDoneList.length})` });

            cycleDoneList.forEach(p => {
                this.renderParticipantCard(scrollArea, p, false);
            });
        }

        // Render 0 AP & Turn Done Participants
        if (roundDoneList.length > 0) {
            const noApHeader = scrollArea.createDiv('mythras-queue-section-title mythras-done-section');
            noApHeader.createEl('span', { text: `0 AP & Turn Done (${roundDoneList.length})` });

            roundDoneList.forEach(p => {
                this.renderParticipantCard(scrollArea, p, false);
            });
        }
    }

    renderParticipantCard(container: HTMLElement, p: CombatParticipant, isCurrentTurn: boolean) {
        const isSelected = this.service.session.selectedParticipantId === p.id;
        
        const card = container.createDiv('mythras-combat-card-mini');
        if (isCurrentTurn && !p.isDone) card.addClass('mythras-combat-active-turn');
        if (isSelected) card.addClass('is-selected');
        if (p.isDone) card.addClass('is-done');

        card.onclick = () => {
            this.service.selectParticipant(p.id);
        };

        // Main Header Container: 52px Portrait Avatar on Left + Info on Right
        const headerWrap = card.createDiv('mythras-card-header-wrap');
        
        // 52px Avatar Container
        const avatarContainer = headerWrap.createDiv('mythras-card-avatar-container');
        const avatarUrl = p.instance.image ? resolveImagePath(this.app, p.instance.image) : '';
        if (avatarUrl) {
            const avatarImg = avatarContainer.createEl('img', { cls: 'mythras-card-avatar' });
            avatarImg.src = avatarUrl;
            avatarImg.alt = p.instance.instanceName;
        } else {
            const dummy = avatarContainer.createDiv('mythras-card-avatar dummy');
            setIcon(dummy, 'user');
        }

        // Header Content: Title Row + AP Row
        const headerContent = headerWrap.createDiv('mythras-card-header-content');
        
        // Title Row: Name, Template, Init Badge
        const titleRow = headerContent.createDiv('mythras-card-title-row');
        const nameGroup = titleRow.createDiv('mythras-card-name-group');
        if (isCurrentTurn && !p.isDone) {
            nameGroup.createSpan({ text: '⚔️ ', cls: 'mythras-turn-icon' });
        }
        nameGroup.createEl('strong', { text: p.instance.instanceName, cls: 'mythras-card-name' });
        nameGroup.createSpan({ text: ` (${p.instance.templateName})`, cls: 'mythras-card-template' });

        const initBadge = titleRow.createDiv('mythras-card-init-badge');
        initBadge.title = `Strike Rank: ${p.initiativeBonus} + Roll: 🎲${p.initiativeRoll}`;
        initBadge.createSpan({ text: 'Init ', cls: 'mythras-init-label' });
        initBadge.createEl('strong', { text: `${p.initiative}` });

        // AP Row: Dots + AP Controls
        const apRow = headerContent.createDiv('mythras-card-ap-row');
        apRow.createSpan({ text: 'AP: ', cls: 'mythras-ap-label' });

        const dotsContainer = apRow.createDiv('mythras-ap-dots');
        for (let i = 1; i <= p.maxAp; i++) {
            const dot = dotsContainer.createDiv('mythras-ap-dot');
            if (i <= p.currentAp) {
                dot.addClass('filled');
            } else {
                dot.addClass('empty');
            }
            dot.onclick = (e) => {
                e.stopPropagation();
                this.service.setAp(p.id, i === p.currentAp ? i - 1 : i);
            };
        }

        const apActions = apRow.createDiv('mythras-ap-actions');
        const btnMinusAp = apActions.createEl('button', { text: '-1 AP', cls: 'mythras-btn-xs' });
        btnMinusAp.onclick = (e) => {
            e.stopPropagation();
            this.service.adjustAp(p.id, -1);
        };

        // Hit Locations Summary Row (Miniature)
        const hlRow = card.createDiv('mythras-card-hl-row');
        p.instance.hitLocations.forEach(hl => {
            const currentHp = hl.currentHp !== undefined ? hl.currentHp : hl.hp;
            const currentAp = hl.currentAp !== undefined ? hl.currentAp : hl.ap;
            
            const hlBadge = hlRow.createDiv('mythras-mini-hl-badge');
            if (currentHp <= 0) hlBadge.addClass('is-severed');
            else if (currentHp < hl.hp) hlBadge.addClass('is-wounded');

            hlBadge.createSpan({ text: `${hl.name}: `, cls: 'mythras-hl-mini-name' });
            
            // AP Stat (Shield)
            const apStat = hlBadge.createSpan({ cls: 'mythras-hl-mini-stat' });
            const shieldIcon = apStat.createSpan({ cls: 'mythras-hl-icon mythras-hl-icon-shield' });
            setIcon(shieldIcon, 'shield');
            apStat.createSpan({ text: `${currentAp}` });
            if (String(currentAp) !== String(hl.ap)) apStat.addClass('is-modified');

            // HP Stat (Droplet)
            const hpStat = hlBadge.createSpan({ cls: 'mythras-hl-mini-stat' });
            const hpIcon = hpStat.createSpan({ cls: 'mythras-hl-icon mythras-hl-icon-droplet' });
            setIcon(hpIcon, 'droplet');
            hpStat.createSpan({ text: `${currentHp}` });
            if (Number(currentHp) !== Number(hl.hp)) hpStat.addClass('is-modified');

            // Quick -1 / +1 HP click on badge
            const btnHpMinus = hlBadge.createSpan({ text: ' -', cls: 'mythras-mini-hp-btn' });
            btnHpMinus.onclick = (e) => {
                e.stopPropagation();
                this.service.adjustHp(p.id, hl.name, -1);
            };
            const btnHpPlus = hlBadge.createSpan({ text: '+', cls: 'mythras-mini-hp-btn' });
            btnHpPlus.onclick = (e) => {
                e.stopPropagation();
                this.service.adjustHp(p.id, hl.name, 1);
            };
        });

        // Bottom Action Bar: Turn Done & Delete
        const bottomBar = card.createDiv('mythras-card-bottom-bar');
        
        const btnTurnDone = bottomBar.createEl('button', { 
            text: p.isDone ? '↩ Reactivate' : '✓ Turn Done', 
            cls: p.isDone ? 'mythras-btn-secondary mythras-btn-xs' : 'mythras-btn-primary mythras-btn-xs' 
        });
        btnTurnDone.onclick = (e) => {
            e.stopPropagation();
            this.service.toggleTurnDone(p.id);
        };

        const btnRemove = bottomBar.createEl('button', { text: 'X', cls: 'mythras-btn-danger mythras-btn-xs' });
        btnRemove.title = 'Remove from combat';
        btnRemove.onclick = (e) => {
            e.stopPropagation();
            this.service.removeParticipant(p.id);
        };
    }

    renderFullStatblockInspector(container: HTMLElement) {
        container.empty();

        const selectedId = this.service.session.selectedParticipantId;
        const participant = this.service.session.participants.find(p => p.id === selectedId);

        if (!participant) {
            const empty = container.createDiv('mythras-empty-state');
            empty.createEl('h3', { text: 'Combat inspector' });
            empty.createEl('p', { text: 'Select a participant from the left queue to view their full statblock.', cls: 'mythras-text-muted' });
            return;
        }

        const inspectorWrap = container.createDiv('mythras-combat-inspector-wrap');
        inspectorWrap.style.overflowY = 'auto';
        inspectorWrap.style.height = '100%';
        inspectorWrap.style.paddingRight = '10px';

        // Render full interactive statblock!
        const element = renderEnemyStatblock(
            this.app,
            participant.instance,
            'long',
            () => {
                new EnemyInstanceEditModal(this.app, this.plugin, participant.instance, async (updatedInstance) => {
                    await this.service.syncInstanceToDisk(updatedInstance);
                    await this.service.refreshParticipantInstances();
                    this.service.saveSession();
                    this.render();
                }).open();
            },
            async (updatedInstance) => {
                await this.service.syncInstanceToDisk(updatedInstance);
                this.service.saveSession();
                this.render();
            },
            this.plugin
        );
        inspectorWrap.appendChild(element);
    }
}
