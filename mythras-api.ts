import { requestUrl } from 'obsidian';

export interface MythrasSearchResult {
    name: string;
    race: string;
    rank: number;
    owner: string;
    tags: string[];
    id: number;
    starred: boolean;
}

export interface MythrasWeapon {
    name: string;
    isOptional: boolean;
    category?: string;       // For optional weapons, e.g. "1-handed weapons"
    amountFormula?: string;  // e.g. "1", "1d3", "0"
    probability?: number;    // e.g. 1
    type?: string;           // e.g. "1h-melee", "ranged", "shield"
    damage?: string;         // e.g. "1d10"
    damageModifier?: boolean;// Should STR+SIZ damage modifier apply?
    size?: string;
    reach?: string;
    range?: string;          // e.g. "100m"
    load?: string;           // e.g. "1 Turn"
    impSize?: string;        // e.g. "S", "M"
    ap?: string;
    hp?: string;
    specialFx?: string;
    traits?: string;
    cost?: string;
    notes?: string;
}

export interface MythrasTemplate {
    id: number;
    name: string;
    author: string;
    image?: string;
    tags: string[];
    race: string;
    rank: string;
    cultRank: string;
    notes: string;
    stats: { [key: string]: string };
    attributes: { [key: string]: string };
    hitLocations: { range: string; name: string; armor: string; hpBonus?: number }[];
    features: { name: string; description: string }[];
    standardSkills: { [key: string]: string };
    magicSkills: { [key: string]: string };
    professionalSkills: { [key: string]: string };
    customSkills: { [key: string]: string };
    combatStyles: { [key: string]: string };
    weapons: MythrasWeapon[];
}

export interface HitLocationInstance {
    range: string;
    name: string;
    ap: string;
    currentAp?: number | string;
    hp: number;
    currentHp: number;
}

export interface MythrasInstance {
    id: string;
    templateName: string;
    instanceName: string;
    image?: string;
    scenario: string;
    encounter: string;
    encounterId?: string;
    lastModified: number;
    
    stats: { [key: string]: number };
    attributes: { [key: string]: string | number };
    hitLocations: HitLocationInstance[];
    
    standardSkills: { [key: string]: number };
    magicSkills: { [key: string]: number };
    professionalSkills: { [key: string]: number };
    customSkills: { [key: string]: number };
    combatStyles: { [key: string]: number };
    
    weapons: MythrasWeapon[];
    features: { name: string; description: string }[];
    notes: string;
}

// ---- Player Character Data Model ----

export interface CharacteristicValue {
    base: number;
    current: number;
}

export interface CharacterIdentity {
    characterName: string;
    playerName: string;
    campaign: string;
    concept: string;
    species: string;
    culture: string;
    homeland: string;
    socialClass: string;
    career: string;
    currentSocialRank: string;
    age: number;
    gender: string;
    height: string;
    weight: string;
    handedness: 'Right' | 'Left' | 'Ambidextrous';
    distinctiveFeatures: string;
    lineageAndFamily: string;
    alliesAndContacts: string[];
    rivalsAndEnemies: string[];
    backstoryNotes: string;
}

export interface Passion {
    id: string;
    type: string;
    target: string;
    baseFormula: string;
    value: number;
    experienceTick: boolean;
    notes: string;
}

export interface SkillEntry {
    name: string;
    baseFormula: string;
    baseValue: number;
    culturePoints: number;
    careerPoints: number;
    bonusPoints: number;
    experienceIncreases: number;
    totalValue: number;
    experienceTick: boolean;
    hasArmorPenalty: boolean;
}

export interface CombatStyleEntry extends SkillEntry {
    weaponsCovered: string[];
    combatTraits: string[];
}

export interface CharacterHitLocation {
    locationId: string;
    range: string;
    name: string;
    maxHp: number;
    currentHp: number;
    naturalArmorAp: number;
    equippedArmorAp: number;
    totalAp: number;
    wornArmorType: string;
    wornArmorEnc: number;
    status: 'Normal' | 'Minor' | 'Serious' | 'Major' | 'Severed/Crippled';
    notes: string;
}

export interface CharacterWeapon {
    id: string;
    name: string;
    combatStyle: string;
    type: string;
    damage: string;
    damageModifier: boolean;
    size: string;
    reach: string;
    range: string;
    load: string;
    ap: number;
    maxHp: number;
    currentHp: number;
    enc: number;
    specialFx: string[];
    traits: string[];
    isEquipped: boolean;
    notes: string;
}

export interface InventoryItem {
    id: string;
    name: string;
    category: string;
    quantity: number;
    unitEnc: number;
    totalEnc: number;
    locationCarried: string;
    description: string;
}

export interface Coinage {
    copper: number;
    silver: number;
    gold: number;
    otherValuablesTotalSp: number;
    bankedWealthSp: number;
    lifestyle: string;
}

export interface FolkMagicSpell {
    id: string;
    name: string;
    mpCost: number;
    range: string;
    duration: string;
    magnitude: number;
    description: string;
}

export interface FolkMagicTradition {
    skillName: string;
    skillValue: number;
    experienceTick: boolean;
    spells: FolkMagicSpell[];
}

export interface TheismMiracle {
    id: string;
    name: string;
    magnitude: number;
    mpCost: number;
    castingTime: string;
    range: string;
    duration: string;
    description: string;
}

export interface TheismTradition {
    cultName: string;
    deity: string;
    cultRank: string;
    devotionSkillValue: number;
    devotionExperienceTick: boolean;
    exhortSkillValue: number;
    exhortExperienceTick: boolean;
    miracles: TheismMiracle[];
    geasesAndTaboos: string[];
    divineGifts: string[];
}

export interface SorcerySpell {
    name: string;
    baseMpCost: number;
    baseRange: string;
    baseDuration: string;
    baseArea: string;
    description: string;
}

export interface SorceryGrimoire {
    id: string;
    name: string;
    lore: string;
    spells: SorcerySpell[];
}

export interface SorceryTradition {
    invocationSkillValue: number;
    invocationExperienceTick: boolean;
    shapingSkillValue: number;
    shapingExperienceTick: boolean;
    maxShapingComponents: number;
    grimoires: SorceryGrimoire[];
}

export interface BoundSpirit {
    id: string;
    name: string;
    spiritType: string;
    int: number;
    pow: number;
    cha: number;
    mp: number;
    spiritPowers: string[];
    fetishItem: string;
    bindingStatus: string;
}

export interface AnimismTradition {
    tranceSkillValue: number;
    tranceExperienceTick: boolean;
    bindingSkillValue: number;
    bindingExperienceTick: boolean;
    spiritCombatDamage: string;
    spirits: BoundSpirit[];
}

export interface MysticismTalent {
    name: string;
    intensity: number;
    mpCost: number;
    duration: string;
    effectDescription: string;
}

export interface MysticismTradition {
    schoolOrPath: string;
    mysticismSkillValue: number;
    mysticismExperienceTick: boolean;
    meditationSkillValue: number;
    meditationExperienceTick: boolean;
    talents: MysticismTalent[];
}

export interface CharacterMagic {
    folkMagic?: FolkMagicTradition;
    theism?: TheismTradition;
    sorcery?: SorceryTradition;
    animism?: AnimismTradition;
    mysticism?: MysticismTradition;
}

export interface OrganizationMembership {
    id: string;
    name: string;
    type: string;
    rank: string;
    socialStatus: string;
    obligations: string;
    benefitsAndPrivileges: string;
    geasesAndCodes: string[];
    standingReputation: number;
}

export interface TrainingEntry {
    trainerName: string;
    skillOrCharacteristic: string;
    timeInvestedDays: number;
    requiredDays: number;
    silverCostPaid: number;
    status: string;
}

export interface CharacterProgression {
    improvementRollsAvailable: number;
    improvementRollsSpentTotal: number;
    experienceModifier: number;
    trainingLog: TrainingEntry[];
    advancementHistory: {
        date: string;
        sessionNumber: number;
        action: string;
        rollsSpent: number;
    }[];
}

export interface MythrasCharacter {
    id: string;
    schemaVersion: string;
    lastModified: number;
    image: string;
    identity: CharacterIdentity;
    characteristics: {
        str: CharacteristicValue;
        con: CharacteristicValue;
        siz: CharacteristicValue;
        dex: CharacteristicValue;
        int: CharacteristicValue;
        pow: CharacteristicValue;
        cha: CharacteristicValue;
    };
    derivedAttributes: {
        actionPoints: number;
        damageModifier: string;
        initiativeBase: number;
        initiativeCurrent: number;
        movementRate: number;
        maxEncumbrance: number;
        healingRate: number;
        magicPointsMax: number;
        magicPointsCurrent: number;
        dedicatedMagicPoints: number;
        luckPointsMax: number;
        luckPointsCurrent: number;
        experienceModifier: number;
        tenacity: string;
    };
    passions: Passion[];
    skills: {
        standard: Record<string, SkillEntry>;
        resistances: Record<string, SkillEntry>;
        languages: Record<string, SkillEntry>;
        professional: Record<string, SkillEntry>;
        magical: Record<string, SkillEntry>;
        combatStyles: Record<string, CombatStyleEntry>;
    };
    hitLocations: CharacterHitLocation[];
    weapons: CharacterWeapon[];
    condition: {
        carriedEnc: number;
        maxEnc: number;
        encumbranceLevel: string;
        totalArmorEnc: number;
        armorSkillPenalty: number;
        armorStrikeRankPenalty: number;
        fatigueLevel: string;
    };
    wealth: Coinage;
    inventory: InventoryItem[];
    magic: CharacterMagic;
    organizations: OrganizationMembership[];
    progression: CharacterProgression;
    notes: string;
}

export class MythrasApi {
    private static BASE_URL = 'https://mythras.skoll.xyz';

    static async search(query: string): Promise<MythrasSearchResult[]> {
        const url = `${this.BASE_URL}/rest/search/?string=${encodeURIComponent(query)}`;
        const response = await requestUrl({ url, method: 'GET' });
        if (response.status !== 200) {
            throw new Error(`Failed to search Mythras API: ${response.status}`);
        }
        return response.json.results || [];
    }

    static async fetchTemplate(id: number): Promise<MythrasTemplate> {
        const url = `${this.BASE_URL}/enemy_template/${id}/`;
        const response = await requestUrl({ url, method: 'GET' });
        if (response.status !== 200) {
            throw new Error(`Failed to fetch template HTML: ${response.status}`);
        }
        
        return this.parseTemplateHtml(id, response.text);
    }

    private static parseTemplateHtml(id: number, html: string): MythrasTemplate {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const template: MythrasTemplate = {
            id,
            name: '',
            author: '',
            tags: [],
            race: '',
            rank: '',
            cultRank: '',
            notes: '',
            stats: {},
            attributes: {},
            hitLocations: [],
            features: [],
            standardSkills: {},
            magicSkills: {},
            professionalSkills: {},
            customSkills: {},
            combatStyles: {},
            weapons: []
        };

        const nameEl = doc.querySelector('h3');
        if (nameEl) {
            template.name = nameEl.textContent?.replace(/\(Generated.*?\)/, '').replace('Log in to Star favorites', '').trim() || 'Unknown';
        }

        // Base Info table
        const topTable = doc.querySelector('table');
        if (topTable) {
            const rows = topTable.querySelectorAll('tr');
            rows.forEach(row => {
                const th = row.querySelector('th')?.textContent?.trim();
                const td = row.querySelector('td');
                if (!td) return;
                
                if (th === 'Rank') template.rank = td.textContent?.trim() || '';
                if (th === 'Race') template.race = td.textContent?.trim() || '';
                if (th === 'Cult rank') template.cultRank = td.textContent?.trim() || '';
                if (th === 'Notes') template.notes = td.textContent?.trim() || '';
                if (th === 'Creator') template.author = td.textContent?.trim() || '';
                if (th === 'Tags') {
                    const tagDivs = td.querySelectorAll('.tag');
                    tagDivs.forEach(tagEl => {
                        if (tagEl.textContent) template.tags.push(tagEl.textContent.trim());
                    });
                }
            });
        }

        // Stats
        const statsHeaders = Array.from(doc.querySelectorAll('th')).filter(th => th.textContent === 'Stats');
        if (statsHeaders.length > 0) {
            const statsTable = statsHeaders[0].closest('table');
            if (statsTable) {
                statsTable.querySelectorAll('tr').forEach(row => {
                    const tds = row.querySelectorAll('td');
                    if (tds.length === 2) {
                        const statName = tds[0].textContent?.trim();
                        const statValue = tds[1].textContent?.trim();
                        if (statName && statValue) {
                            template.stats[statName] = statValue;
                        }
                    }
                });
            }
        }

        // Hit Locations
        const hlHeaders = Array.from(doc.querySelectorAll('th')).filter(th => th.textContent === 'Hit location');
        if (hlHeaders.length > 0) {
            const hlTable = hlHeaders[0].closest('table');
            if (hlTable) {
                hlTable.querySelectorAll('tr').forEach(row => {
                    const tds = row.querySelectorAll('td');
                    if (tds.length === 3) {
                        template.hitLocations.push({
                            range: tds[0].textContent?.trim() || '',
                            name: tds[1].textContent?.trim() || '',
                            armor: tds[2].textContent?.trim() || ''
                        });
                    }
                });
            }
        }

        // Features
        const featuresH3 = Array.from(doc.querySelectorAll('h3')).filter(h => h.textContent === 'Non-random features' || h.textContent === 'Additional Features');
        featuresH3.forEach(h3 => {
            const table = h3.nextElementSibling;
            if (table && table.tagName === 'TABLE') {
                table.querySelectorAll('tr').forEach(row => {
                    const tds = row.querySelectorAll('td');
                    if (tds.length === 2) {
                        template.features.push({
                            name: tds[0].textContent?.trim() || '',
                            description: tds[1].textContent?.trim() || ''
                        });
                    }
                });
            }
        });
        
        // Attributes
        const attrHeaders = Array.from(doc.querySelectorAll('th')).filter(th => th.textContent === 'Attributes');
        if (attrHeaders.length > 0) {
            const attrTable = attrHeaders[0].closest('table');
            if (attrTable) {
                attrTable.querySelectorAll('tr').forEach(row => {
                    const tds = row.querySelectorAll('td');
                    if (tds.length === 2) {
                        const attrName = tds[0].textContent?.trim();
                        const attrVal = tds[1].textContent?.trim();
                        if (attrName && attrVal) {
                            template.attributes[attrName] = attrVal;
                        }
                    }
                });
            }
        }

        // Skills (Standard and Custom)
        const parseSkills = (headerText: string, targetObj: { [key: string]: string }) => {
            const h3s = Array.from(doc.querySelectorAll('h3')).filter(h => h.textContent?.includes(headerText));
            h3s.forEach(h3 => {
                let node = h3.nextElementSibling;
                while (node && node.tagName !== 'H3' && node.tagName !== 'H4') {
                    if (node.tagName === 'TABLE') {
                        node.querySelectorAll('tr').forEach(row => {
                            const cells = row.children;
                            let i = 0;
                            while (i < cells.length - 1) {
                                const key = cells[i].textContent?.trim();
                                const val = cells[i+1].textContent?.trim();
                                if (cells[i].tagName === 'TH' && cells[i+1].tagName === 'TD' && key && val) {
                                    targetObj[key] = val;
                                }
                                i++;
                            }
                        });
                    }
                    node = node.nextElementSibling;
                }
            });
        };

        parseSkills('Standard skills', template.standardSkills);
        parseSkills('Magic skills', template.magicSkills);
        parseSkills('Professional skills', template.professionalSkills);
        parseSkills('Custom skills', template.customSkills);

        // Combat styles
        const csH3 = Array.from(doc.querySelectorAll('h3')).filter(h => h.textContent?.includes('Combat styles'));
        if(csH3.length > 0) {
            const csTable = csH3[0].nextElementSibling;
            if(csTable && csTable.tagName === 'TABLE') {
                csTable.querySelectorAll('tr').forEach(row => {
                    const th = row.querySelector('th')?.textContent?.trim();
                    const td = row.querySelector('td')?.textContent?.trim();
                    if(th && td) {
                        template.combatStyles[th] = td;
                    }
                });
            }
        }

        // Weapon options
        const weaponCategories = ['1-handed weapons', '2-handed weapons', 'Ranged weapons', 'Shields'];
        weaponCategories.forEach(cat => {
            const h4 = Array.from(doc.querySelectorAll('h4')).find(h => h.textContent?.includes(cat));
            if (h4) {
                let amountFormula = "1";
                let nextNode = h4.nextElementSibling;
                if (nextNode && nextNode.tagName === 'B' && nextNode.textContent?.includes('Amount:')) {
                    amountFormula = nextNode.textContent.replace('Amount:', '').trim();
                    nextNode = nextNode.nextElementSibling;
                }
                
                if (nextNode && nextNode.tagName === 'TABLE') {
                    nextNode.querySelectorAll('tr').forEach(row => {
                        let td = row.querySelector('td')?.textContent?.trim();
                        if (td) {
                            let probability = 1;
                            const probMatch = td.match(/(.*?)\s*\((\d+)\)$/);
                            if (probMatch) {
                                td = probMatch[1].trim();
                                probability = parseInt(probMatch[2]);
                            }

                            template.weapons.push({
                                name: td,
                                isOptional: true,
                                category: cat,
                                amountFormula,
                                probability
                            });
                        }
                    });
                }
            }
        });

        // Custom Weapons (or Natural weapons)
        doc.querySelectorAll('table').forEach(table => {
            const firstRow = table.querySelector('tr');
            if (firstRow && firstRow.textContent?.includes('Damage') && (firstRow.textContent?.includes('Reach') || firstRow.textContent?.includes('Range'))) {
                const headers = Array.from(firstRow.querySelectorAll('th')).map(th => th.textContent?.trim().toLowerCase() || '');
                const rows = Array.from(table.querySelectorAll('tr'));
                rows.slice(1).forEach(row => {
                    const tds = Array.from(row.querySelectorAll('td'));
                    if (tds.length > 0) {
                        const weapon: MythrasWeapon = { name: '', isOptional: false };
                        headers.forEach((header, i) => {
                            if (i >= tds.length) return;
                            const val = tds[i].textContent?.trim() || '';
                            if (header === 'weapon') weapon.name = val;
                            else if (header === 'type') weapon.type = val;
                            else if (header === 'damage') weapon.damage = val;
                            else if (header === 'size') weapon.size = val;
                            else if (header === 'reach') weapon.reach = val;
                            else if (header === 'range') weapon.range = val;
                            else if (header === 'combat effects') weapon.specialFx = val;
                            else if (header === 'ap') weapon.ap = val;
                            else if (header === 'hp') weapon.hp = val;
                            // the generator sometimes has damage modifier column
                            else if (header === 'dmg mod') weapon.damageModifier = (val !== 'N');
                        });
                        
                        if (weapon.name) {
                            template.weapons.push(weapon);
                        }
                    }
                });
            }
        });

        return template;
    }
}
