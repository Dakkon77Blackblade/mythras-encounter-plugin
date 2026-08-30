import { App, setIcon, Notice, Modal } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { CharacterService } from './character-service';
import { MythrasCharacter } from './mythras-api';

export type CharacterEditorTab = 'identity' | 'skills' | 'combat' | 'gear' | 'magic' | 'growth';

export class CharacterManagerUI {
    app: App;
    plugin: MythrasEncounterPlugin;
    container: HTMLElement;
    characterService: CharacterService;
    
    characters: MythrasCharacter[] | null = null;
    selectedCharacterId: string | null = null;
    editingCharacter: MythrasCharacter | null = null;
    activeTab: CharacterEditorTab = 'identity';
    
    constructor(app: App, plugin: MythrasEncounterPlugin, container: HTMLElement) {
        this.app = app;
        this.plugin = plugin;
        this.container = container;
        this.characterService = plugin.characterService;
    }
    
    async render(): Promise<void> {
        this.container.empty();
        await this.loadCharacters();
        
        const wrapper = this.container.createDiv('mythras-manager-layout');
        
        const sidebar = wrapper.createDiv('mythras-manager-sidebar');
        this.renderCharacterList(sidebar);
        
        const content = wrapper.createDiv('mythras-manager-content');
        if (this.selectedCharacterId && this.editingCharacter) {
            this.renderCharacterEditor(content, this.editingCharacter);
        } else {
            const emptyState = content.createDiv('mythras-empty-state');
            const emptyContent = emptyState.createDiv('mythras-empty-state-content');
            setIcon(emptyContent.createDiv('mythras-empty-icon'), 'users');
            emptyContent.createEl('h3', { text: 'No Character Selected' });
            emptyContent.createEl('p', { text: 'Select a character from the sidebar or create a new one to get started.' });
        }
    }
    
    async loadCharacters(forceReload = false): Promise<void> {
        if (forceReload || this.characters === null) {
            this.characters = await this.characterService.listCharacters();
        }
        
        if (this.selectedCharacterId) {
            this.editingCharacter = this.characters.find(c => c.id === this.selectedCharacterId) || null;
            if (!this.editingCharacter) {
                this.selectedCharacterId = null;
            } else {
                this.characterService.recalculateCharacter(this.editingCharacter);
            }
        }
    }
    
    renderCharacterList(sidebar: HTMLElement): void {
        const header = sidebar.createDiv('mythras-manager-sidebar-header');
        header.createEl('h3', { text: 'Characters' });
        
        const createBtn = header.createEl('button', { cls: 'mythras-btn mythras-btn-primary' });
        setIcon(createBtn, 'plus');
        createBtn.onclick = async () => {
            const char = await this.characterService.createCharacter('New Character');
            if (this.characters === null) this.characters = [];
            this.characters.push(char);
            this.selectedCharacterId = char.id;
            this.editingCharacter = char;
            await this.render();
        };
        
        const list = sidebar.createDiv('mythras-manager-sidebar-list');
        if (this.characters) {
            for (const char of this.characters) {
            const item = list.createDiv('mythras-manager-sidebar-item');
            if (this.selectedCharacterId === char.id) {
                item.addClass('active');
            }
            
            item.createSpan({ text: char.identity.characterName || 'Unnamed' });
            
            const deleteBtn = item.createDiv('mythras-manager-sidebar-item-delete');
            setIcon(deleteBtn, 'trash');
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`Delete ${char.identity.characterName}?`)) {
                    await this.characterService.deleteCharacter(char.id);
                    if (this.characters) {
                        this.characters = this.characters.filter(c => c.id !== char.id);
                    }
                    if (this.selectedCharacterId === char.id) {
                        this.selectedCharacterId = null;
                        this.editingCharacter = null;
                    }
                    await this.render();
                }
            };
            
            item.onclick = async () => {
                this.selectedCharacterId = char.id;
                this.editingCharacter = char;
                await this.render();
            };
        }
        }
    }
    
    renderCharacterEditor(content: HTMLElement, character: MythrasCharacter): void {
        const editor = content.createDiv('mythras-character-editor');
        this.renderHUD(editor, character);
        this.renderTabBar(editor);
        
        const tabContent = editor.createDiv('mythras-character-tab-content');
        
        switch (this.activeTab) {
            case 'identity': this.renderIdentityTab(tabContent, character); break;
            case 'skills': this.renderSkillsTab(tabContent, character); break;
            case 'combat': this.renderCombatTab(tabContent, character); break;
            case 'gear': this.renderGearTab(tabContent, character); break;
            case 'magic': this.renderMagicTab(tabContent, character); break;
            case 'growth': this.renderGrowthTab(tabContent, character); break;
        }
    }
    
    renderHUD(container: HTMLElement, character: MythrasCharacter): void {
        const hud = container.createDiv('mythras-character-hud');
        
        const avatarBox = hud.createDiv('mythras-hud-avatar-box');
        const avatar = avatarBox.createDiv('mythras-hud-avatar');
        if (character.image) {
            avatar.style.backgroundImage = `url('${character.image}')`;
        } else {
            setIcon(avatar, 'user');
        }
        
        const nameInput = avatarBox.createEl('input', { type: 'text', cls: 'mythras-input', value: character.identity.characterName });
        nameInput.onchange = async () => {
            character.identity.characterName = nameInput.value;
            await this.saveCurrentCharacter();
            this.render();
        };
        const preventGlobalKeys = (e: KeyboardEvent) => { e.stopPropagation(); };
        nameInput.addEventListener('keydown', preventGlobalKeys);
        nameInput.addEventListener('keyup', preventGlobalKeys);
        nameInput.addEventListener('keypress', preventGlobalKeys);

        const apStat = hud.createDiv('mythras-hud-stat');
        apStat.createSpan({ text: 'AP' });
        const apStepper = apStat.createDiv('mythras-hud-stepper');
        const apDec = apStepper.createEl('button', { text: '-' });
        const apVal = apStepper.createSpan({ text: character.derivedAttributes.actionPoints.toString() });
        const apInc = apStepper.createEl('button', { text: '+' });
        apDec.onclick = async () => { character.derivedAttributes.actionPoints = Math.max(0, character.derivedAttributes.actionPoints - 1); apVal.setText(character.derivedAttributes.actionPoints.toString()); await this.saveCurrentCharacter(); };
        apInc.onclick = async () => { character.derivedAttributes.actionPoints++; apVal.setText(character.derivedAttributes.actionPoints.toString()); await this.saveCurrentCharacter(); };

        const mpStat = hud.createDiv('mythras-hud-stat');
        mpStat.createSpan({ text: 'MP' });
        const mpStepper = mpStat.createDiv('mythras-hud-stepper');
        const mpDec = mpStepper.createEl('button', { text: '-' });
        const mpVal = mpStepper.createSpan({ text: `${character.derivedAttributes.magicPointsCurrent}/${character.derivedAttributes.magicPointsMax}` });
        const mpInc = mpStepper.createEl('button', { text: '+' });
        mpDec.onclick = async () => { character.derivedAttributes.magicPointsCurrent = Math.max(0, character.derivedAttributes.magicPointsCurrent - 1); mpVal.setText(`${character.derivedAttributes.magicPointsCurrent}/${character.derivedAttributes.magicPointsMax}`); await this.saveCurrentCharacter(); };
        mpInc.onclick = async () => { character.derivedAttributes.magicPointsCurrent = Math.min(character.derivedAttributes.magicPointsMax, character.derivedAttributes.magicPointsCurrent + 1); mpVal.setText(`${character.derivedAttributes.magicPointsCurrent}/${character.derivedAttributes.magicPointsMax}`); await this.saveCurrentCharacter(); };

        const luckStat = hud.createDiv('mythras-hud-stat');
        luckStat.createSpan({ text: 'Luck' });
        const luckStepper = luckStat.createDiv('mythras-hud-stepper');
        const luckDec = luckStepper.createEl('button', { text: '-' });
        const luckVal = luckStepper.createSpan({ text: `${character.derivedAttributes.luckPointsCurrent}/${character.derivedAttributes.luckPointsMax}` });
        const luckInc = luckStepper.createEl('button', { text: '+' });
        luckDec.onclick = async () => { character.derivedAttributes.luckPointsCurrent = Math.max(0, character.derivedAttributes.luckPointsCurrent - 1); luckVal.setText(`${character.derivedAttributes.luckPointsCurrent}/${character.derivedAttributes.luckPointsMax}`); await this.saveCurrentCharacter(); };
        luckInc.onclick = async () => { character.derivedAttributes.luckPointsCurrent = Math.min(character.derivedAttributes.luckPointsMax, character.derivedAttributes.luckPointsCurrent + 1); luckVal.setText(`${character.derivedAttributes.luckPointsCurrent}/${character.derivedAttributes.luckPointsMax}`); await this.saveCurrentCharacter(); };
        
        const fatigueStat = hud.createDiv('mythras-hud-stat');
        fatigueStat.createSpan({ text: 'Fatigue' });
        const fatigueSelect = fatigueStat.createEl('select', { cls: 'mythras-select' });
        const fatigueLevels = ['Fresh', 'Winded', 'Tired', 'Wearied', 'Exhausted', 'Debilitated', 'Incapacitated', 'Dead'];
        fatigueLevels.forEach(level => {
            const opt = fatigueSelect.createEl('option', { value: level, text: level });
            if (character.condition.fatigueLevel === level) opt.selected = true;
        });
        fatigueSelect.onchange = async () => {
            character.condition.fatigueLevel = fatigueSelect.value;
            await this.saveCurrentCharacter();
        };

        const initStat = hud.createDiv('mythras-hud-stat');
        initStat.createSpan({ text: 'Init' });
        initStat.createSpan({ text: character.derivedAttributes.initiativeCurrent.toString() });

        const woundBadge = hud.createDiv('mythras-wound-badge');
        let worstStatus = 'Normal';
        const statuses = ['Normal', 'Minor', 'Serious', 'Major', 'Severed/Crippled'];
        character.hitLocations.forEach(hl => {
            if (statuses.indexOf(hl.status) > statuses.indexOf(worstStatus)) {
                worstStatus = hl.status;
            }
        });
        woundBadge.setText(worstStatus);
        woundBadge.addClass(`status-${worstStatus.replace('/', '-').toLowerCase()}`);
    }
    
    renderTabBar(container: HTMLElement): void {
        const tabBar = container.createDiv('mythras-manager-tabs');
        
        const tabs: {id: CharacterEditorTab, label: string, icon: string}[] = [
            { id: 'identity', label: 'Identity', icon: 'user' },
            { id: 'skills', label: 'Skills', icon: 'book' },
            { id: 'combat', label: 'Combat', icon: 'swords' },
            { id: 'gear', label: 'Gear', icon: 'backpack' },
            { id: 'magic', label: 'Magic', icon: 'wand' },
            { id: 'growth', label: 'Growth', icon: 'arrow-up-circle' }
        ];
        
        for (const tab of tabs) {
            const btn = tabBar.createEl('button', { cls: `mythras-manager-tab ${this.activeTab === tab.id ? 'active' : ''}` });
            setIcon(btn, tab.icon);
            btn.createSpan({ text: ` ${tab.label}` });
            btn.onclick = () => {
                this.activeTab = tab.id;
                this.render();
            };
        }
    }
    
    renderIdentityTab(container: HTMLElement, character: MythrasCharacter): void {
        const grid = container.createDiv('mythras-grid-dashboard');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gap = '1rem';
        
        const leftCol = grid.createDiv('mythras-character-col');
        leftCol.createEl('h3', { text: 'Identity' });
        
        const identityFields = [
            { key: 'playerName', label: 'Player' },
            { key: 'culture', label: 'Culture' },
            { key: 'career', label: 'Career' }
        ];
        
        for (const field of identityFields) {
            const group = leftCol.createDiv('mythras-manager-form-group');
            group.createEl('label', { text: field.label });
            const input = group.createEl('input', { type: 'text', cls: 'mythras-input', value: (character.identity as any)[field.key] });
            input.onchange = async () => {
                (character.identity as any)[field.key] = input.value;
                await this.saveCurrentCharacter();
            };
        }
        
        const rightCol = grid.createDiv('mythras-character-col');
        rightCol.createEl('h3', { text: 'Characteristics' });
        
        const charTable = rightCol.createEl('table', { cls: 'mythras-table' });
        const thead = charTable.createEl('thead');
        const hrow = thead.createEl('tr');
        hrow.createEl('th', { text: 'Stat' });
        hrow.createEl('th', { text: 'Base' });
        hrow.createEl('th', { text: 'Curr' });
        
        const tbody = charTable.createEl('tbody');
        const stats = ['str', 'con', 'siz', 'dex', 'int', 'pow', 'cha'];
        
        for (const stat of stats) {
            const row = tbody.createEl('tr');
            row.createEl('td', { text: stat.toUpperCase(), cls: 'bold' });
            
            const statData = (character.characteristics as any)[stat];
            
            const baseTd = row.createEl('td');
            const baseInput = baseTd.createEl('input', { type: 'number', cls: 'mythras-input-small', value: statData.base.toString() });
            
            const currTd = row.createEl('td');
            const currInput = currTd.createEl('input', { type: 'number', cls: 'mythras-input-small', value: statData.current.toString() });
            
            baseInput.onchange = async () => { 
                statData.base = parseInt(baseInput.value) || 0; 
                statData.current = statData.base;
                this.characterService.recalculateCharacter(character);
                await this.saveCurrentCharacter();
                this.render(); 
            };
            currInput.onchange = async () => { 
                statData.current = parseInt(currInput.value) || 0; 
                this.characterService.recalculateCharacter(character);
                await this.saveCurrentCharacter();
                this.render(); 
            };
        }
        
        rightCol.createEl('h3', { text: 'Derived Attributes' });
        const derivedGrid = rightCol.createDiv('mythras-grid-dashboard');
        derivedGrid.style.display = 'grid';
        derivedGrid.style.gridTemplateColumns = '1fr 1fr';
        derivedGrid.style.gap = '0.5rem';

        const da = character.derivedAttributes;
        const derivedFields = [
            { label: 'Action Points', value: da.actionPoints },
            { label: 'Damage Modifier', value: da.damageModifier },
            { label: 'Initiative Base', value: da.initiativeBase },
            { label: 'Healing Rate', value: da.healingRate },
            { label: 'Luck Points', value: da.luckPointsMax },
            { label: 'Magic Points', value: da.magicPointsMax },
            { label: 'Exp Modifier', value: da.experienceModifier }
        ];

        for (const field of derivedFields) {
            const df = derivedGrid.createDiv();
            df.createEl('strong', { text: field.label + ': ' });
            df.createEl('span', { text: String(field.value) });
        }

        rightCol.createEl('h3', { text: 'Passions', style: 'margin-top: 20px;' });
        const passHeader = rightCol.createDiv();
        passHeader.style.display = 'flex';
        passHeader.style.justifyContent = 'flex-end';
        passHeader.style.marginBottom = '10px';
        const addPassBtn = passHeader.createEl('button', { text: '+ Add Passion' });
        addPassBtn.onclick = async () => {
            new GenericPromptModal(this.app, 'Add Passion', 'Passion Name (e.g. Loyalty (Town)):', async (name) => {
                character.passions.push({ id: window.crypto.randomUUID(), type: 'Passion', target: name, baseFormula: 'INT+POW', value: 0, experienceTick: false, notes: '' });
                this.characterService.recalculateCharacter(character);
                await this.saveCurrentCharacter();
                this.render();
            }).open();
        };
        
        for (let i = 0; i < character.passions.length; i++) {
            const p = character.passions[i];
            const prow = rightCol.createDiv('mythras-skill-row');
            
            const xpCheck = prow.createEl('input', { type: 'checkbox', cls: 'mythras-xp-tick' });
            xpCheck.checked = p.experienceTick;
            xpCheck.onchange = async () => { p.experienceTick = xpCheck.checked; await this.saveCurrentCharacter(); };
            
            prow.createSpan({ text: p.target });
            const valIn = prow.createEl('input', { type: 'number', cls: 'mythras-input-small', value: p.value.toString() });
            valIn.style.marginLeft = 'auto';
            valIn.onchange = async () => { p.value = parseInt(valIn.value) || 0; await this.saveCurrentCharacter(); };
            
            const delBtn = prow.createEl('button', { text: '✕', cls: 'mythras-btn' });
            delBtn.style.marginLeft = '5px';
            delBtn.onclick = async () => {
                character.passions.splice(i, 1);
                await this.saveCurrentCharacter();
                this.render();
            };
        }
    }
    
    renderSkillsTab(container: HTMLElement, character: MythrasCharacter): void {
        const topBar = container.createDiv('mythras-skill-filter');
        const searchInput = topBar.createEl('input', { type: 'text', cls: 'mythras-input', placeholder: 'Search skills...' });
        searchInput.oninput = () => {
            const term = searchInput.value.toLowerCase();
            grid.querySelectorAll('.mythras-skill-row').forEach(row => {
                const el = row as HTMLElement;
                const text = el.innerText.toLowerCase();
                el.style.display = text.includes(term) ? 'flex' : 'none';
            });
        };
        
        const grid = container.createDiv('mythras-grid-3col');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr 1fr 1fr';
        grid.style.gap = '1rem';
        
        const renderSkillBlock = (parent: HTMLElement, skillDict: Record<string, any>, title: string, canAdd: boolean) => {
            const wrapper = parent.createDiv('mythras-character-col');
            const header = wrapper.createDiv('mythras-skill-header');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.createEl('h3', { text: title });
            
            if (canAdd) {
                const addBtn = header.createEl('button', { text: '+', cls: 'mythras-btn' });
                addBtn.onclick = async () => {
                    if (title === 'Languages') {
                        new GenericPromptModal(this.app, 'Add Language', 'Language Name:', async (name) => {
                            if (!skillDict[name]) {
                                skillDict[name] = {
                                    name, baseFormula: 'INT+CHA', baseValue: 0, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 0, experienceTick: false, hasArmorPenalty: false
                                };
                                this.characterService.recalculateCharacter(character);
                                await this.saveCurrentCharacter();
                                this.render();
                            }
                        }).open();
                    } else {
                        new SkillCreateModal(this.app, title, async (name, formula) => {
                            if (!skillDict[name]) {
                                skillDict[name] = {
                                    name, baseFormula: formula, baseValue: 0, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 0, experienceTick: false, hasArmorPenalty: false
                                };
                                this.characterService.recalculateCharacter(character);
                                await this.saveCurrentCharacter();
                                this.render();
                            }
                        }).open();
                    }
                };
            }
            
                Object.entries(skillDict).forEach(([key, skill]) => {
                    const row = wrapper.createDiv('mythras-skill-row');
                    
                    const xpCheck = row.createEl('input', { type: 'checkbox', cls: 'mythras-xp-tick' });
                    xpCheck.checked = skill.experienceTick;
                    xpCheck.onchange = async () => { skill.experienceTick = xpCheck.checked; await this.saveCurrentCharacter(); };
                    
                    if (title === 'Languages' && key.startsWith('Native')) {
                        row.createSpan({ text: 'Native ', title: `Base: ${skill.baseFormula} (${skill.baseValue})` });
                        const langNameInput = row.createEl('input', { type: 'text', cls: 'mythras-input-small' });
                        langNameInput.value = skill.name === 'Native' ? '' : skill.name.replace('Native ', '').replace('(', '').replace(')', '').trim();
                        langNameInput.placeholder = 'Language';
                        langNameInput.style.marginRight = '5px';
                        langNameInput.onchange = async () => {
                            skill.name = langNameInput.value ? `Native (${langNameInput.value})` : 'Native';
                            await this.saveCurrentCharacter();
                        };
                        row.createSpan({ text: `(${skill.baseFormula})` });
                    } else {
                        let labelText = skill.name;
                        if (skill.baseFormula) {
                            labelText += ` (${skill.baseFormula})`;
                        }
                        row.createSpan({ text: labelText, title: `Base: ${skill.baseFormula} (${skill.baseValue})` });
                    }
                
                const baseSpan = row.createSpan({ text: skill.baseValue.toString(), cls: 'mythras-skill-base' });
                baseSpan.style.color = 'var(--text-muted)';
                baseSpan.style.marginLeft = '5px';
                baseSpan.style.fontSize = '0.85em';
                
                const ptsInput = row.createEl('input', { type: 'number', cls: 'mythras-input-small', value: ((skill.culturePoints||0) + (skill.careerPoints||0) + (skill.bonusPoints||0) + (skill.experienceIncreases||0)).toString() });
                ptsInput.style.marginLeft = 'auto';
                ptsInput.style.marginRight = '10px';
                ptsInput.title = "Added Skill Points (Culture + Career + Bonus + Exp)";
                ptsInput.onchange = async () => { 
                    skill.bonusPoints = parseInt(ptsInput.value) || 0;
                    skill.culturePoints = 0; skill.careerPoints = 0; skill.experienceIncreases = 0; 
                    this.characterService.recalculateCharacter(character);
                    await this.saveCurrentCharacter();
                    this.render();
                };
                
                row.createSpan({ text: `${skill.totalValue}%`, cls: 'mythras-skill-val' });
                
                if (canAdd) {
                    const delBtn = row.createEl('button', { text: '✕', cls: 'mythras-btn' });
                    delBtn.style.marginLeft = '5px';
                    delBtn.onclick = async () => {
                        delete skillDict[skill.name];
                        await this.saveCurrentCharacter();
                        this.render();
                    };
                }
            });
        };
        renderSkillBlock(grid, character.skills.standard || {}, 'Standard Skills', false);
        renderSkillBlock(grid, character.skills.resistances || {}, 'Resistances', false);
        renderSkillBlock(grid, character.skills.combatStyles || {}, 'Combat Styles', true);
        renderSkillBlock(grid, character.skills.languages || {}, 'Languages', true);
        renderSkillBlock(grid, character.skills.magical || {}, 'Magical Skills', true);
        renderSkillBlock(grid, character.skills.professional || {}, 'Professional Skills', true);
    }
    
    renderCombatTab(container: HTMLElement, character: MythrasCharacter): void {
        container.createEl('h3', { text: 'Hit Locations' });
        
        const hlTable = container.createEl('table', { cls: 'mythras-table' });
        const thead = hlTable.createEl('thead');
        const hrow = thead.createEl('tr');
        hrow.createEl('th', { text: 'D20' });
        hrow.createEl('th', { text: 'Location' });
        hrow.createEl('th', { text: 'AP' });
        hrow.createEl('th', { text: 'HP' });
        hrow.createEl('th', { text: 'Armor ENC' });
        hrow.createEl('th', { text: 'Status' });
        
        const tbody = hlTable.createEl('tbody');
        
        for (const hl of character.hitLocations) {
            const row = tbody.createEl('tr');
            row.createEl('td', { text: hl.range });
            row.createEl('td', { text: hl.name });
            row.createEl('td', { text: hl.totalAp.toString() });
            row.createEl('td', { text: `${hl.currentHp} / ${hl.maxHp}` });
            row.createEl('td', { text: hl.wornArmorEnc.toString() });
            row.createEl('td', { text: hl.status });
        }
        
        container.createEl('h3', { text: 'Fatigue Track' });
        const fatigueTrack = container.createDiv('mythras-fatigue-track');
        const fatigueLevels = ['Fresh', 'Winded', 'Tired', 'Wearied', 'Exhausted', 'Debilitated', 'Incapacitated', 'Dead'];
        fatigueLevels.forEach(level => {
            const step = fatigueTrack.createDiv('mythras-fatigue-step');
            if (character.condition.fatigueLevel === level) {
                step.addClass('active');
            }
            step.setText(level);
            step.onclick = async () => {
                character.condition.fatigueLevel = level;
                await this.saveCurrentCharacter();
                this.render();
            };
        });
    }
    
    renderGearTab(container: HTMLElement, character: MythrasCharacter): void {
        container.createEl('h3', { text: 'Weapons' });
        container.createEl('h3', { text: 'Wealth' });
        container.createEl('h3', { text: 'Inventory' });
        
        const encMeter = container.createDiv('mythras-enc-meter');
        const encText = encMeter.createSpan();
        encText.setText(`Encumbrance: ${character.condition.carriedEnc} / ${character.condition.maxEnc}`);
        const barWrap = encMeter.createDiv('mythras-enc-bar-wrap');
        const barInner = barWrap.createDiv('mythras-enc-bar-inner');
        const pct = Math.min(100, (character.condition.carriedEnc / character.condition.maxEnc) * 100);
        barInner.style.width = `${pct}%`;
    }
    
    renderMagicTab(container: HTMLElement, character: MythrasCharacter): void {
        const header = container.createDiv('mythras-skill-header');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.createEl('h3', { text: 'Magic / Spells' });
        const addBtn = header.createEl('button', { text: '+ Add Spell', cls: 'mythras-btn' });
        
        if (!character.magic) character.magic = {};
        if (!character.magic.folkMagic) {
            character.magic.folkMagic = { skillName: '', skillValue: 0, experienceTick: false, spells: [] };
        }
        
        addBtn.onclick = async () => {
            new GenericPromptModal(this.app, 'Add Spell', 'Spell Name:', async (name) => {
                character.magic.folkMagic!.spells.push({
                    id: window.crypto.randomUUID(),
                    name,
                    mpCost: 1,
                    range: 'Touch',
                    duration: 'Instant',
                    magnitude: 1,
                    description: ''
                });
                await this.saveCurrentCharacter();
                this.render();
            }).open();
        };
        
        for (let i = 0; i < character.magic.folkMagic!.spells.length; i++) {
            const spell = character.magic.folkMagic!.spells[i];
            const row = container.createDiv('mythras-skill-row');
            row.createSpan({ text: spell.name, cls: 'bold' });
            
            const delBtn = row.createEl('button', { text: '✕', cls: 'mythras-btn' });
            delBtn.style.marginLeft = 'auto';
            delBtn.onclick = async () => {
                character.magic.folkMagic!.spells.splice(i, 1);
                await this.saveCurrentCharacter();
                this.render();
            };
        }
    }
    
    renderGrowthTab(container: HTMLElement, character: MythrasCharacter): void {
        container.createEl('h3', { text: 'Organizations' });
        container.createEl('h3', { text: 'Improvement Rolls' });
    }
    
    async saveCurrentCharacter(): Promise<void> {
        if (this.editingCharacter) {
            await this.characterService.saveCharacter(this.editingCharacter);
        }
    }
}

export class GenericPromptModal extends Modal {
    constructor(app: App, private titleText: string, private labelText: string, private onSubmit: (val: string) => void) {
        super(app);
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.createEl('h2', {text: this.titleText});
        
        const group = contentEl.createDiv('mythras-manager-form-group');
        group.createEl('label', {text: this.labelText});
        const input = group.createEl('input', {type: 'text', cls: 'mythras-input'});
        input.style.width = '100%';
        
        const btnGroup = contentEl.createDiv();
        btnGroup.style.display = 'flex';
        btnGroup.style.justifyContent = 'flex-end';
        btnGroup.style.marginTop = '15px';
        
        const btn = btnGroup.createEl('button', {text: 'Add', cls: 'mythras-btn mythras-btn-primary'});
        btn.onclick = () => {
            if (input.value.trim()) {
                this.onSubmit(input.value.trim());
                this.close();
            }
        };
    }
    
    onClose() {
        this.contentEl.empty();
    }
}

export class SkillCreateModal extends Modal {
    constructor(app: App, private titleText: string, private onSubmit: (name: string, formula: string) => void) {
        super(app);
    }
    
    onOpen() {
        const {contentEl} = this;
        contentEl.createEl('h2', {text: `Add ${this.titleText}`});
        
        const groupName = contentEl.createDiv('mythras-manager-form-group');
        groupName.createEl('label', {text: 'Skill Name'});
        const nameInput = groupName.createEl('input', {type: 'text', cls: 'mythras-input'});
        nameInput.style.width = '100%';
        
        const groupForm = contentEl.createDiv('mythras-manager-form-group');
        groupForm.style.marginTop = '10px';
        groupForm.createEl('label', {text: 'Base Formula (e.g. STR+DEX, INTx2)'});
        const formInput = groupForm.createEl('input', {type: 'text', cls: 'mythras-input'});
        formInput.style.width = '100%';
        
        const btnGroup = contentEl.createDiv();
        btnGroup.style.display = 'flex';
        btnGroup.style.justifyContent = 'flex-end';
        btnGroup.style.marginTop = '15px';
        
        const btn = btnGroup.createEl('button', {text: 'Add', cls: 'mythras-btn mythras-btn-primary'});
        btn.onclick = () => {
            if (nameInput.value.trim()) {
                this.onSubmit(nameInput.value.trim(), formInput.value.trim().toUpperCase());
                this.close();
            }
        };
    }
    
    onClose() {
        this.contentEl.empty();
    }
}

