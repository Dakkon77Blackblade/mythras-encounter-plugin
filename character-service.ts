import { App, normalizePath } from 'obsidian';
import { MythrasCharacter } from './mythras-api';
import MythrasEncounterPlugin from './main';

export class CharacterService {
    constructor(private app: App, private plugin: MythrasEncounterPlugin) {}
    
    recalculateCharacter(char: MythrasCharacter): void {
        const chars = char.characteristics;
        const STR = chars.str.current;
        const CON = chars.con.current;
        const SIZ = chars.siz.current;
        const DEX = chars.dex.current;
        const INT = chars.int.current;
        const POW = chars.pow.current;
        const CHA = chars.cha.current;

        char.derivedAttributes.actionPoints = Math.ceil((INT + DEX) / 12);
        char.derivedAttributes.initiativeBase = Math.ceil((INT + DEX) / 2);
        char.derivedAttributes.healingRate = Math.ceil(CON / 6);
        char.derivedAttributes.luckPointsMax = Math.ceil(POW / 6);
        char.derivedAttributes.magicPointsMax = POW;
        char.derivedAttributes.experienceModifier = Math.ceil(CHA / 6) - 2;

        const strSiz = STR + SIZ;
        let dm = "+0";
        if (strSiz <= 5) dm = "-1d8";
        else if (strSiz <= 10) dm = "-1d4";
        else if (strSiz <= 15) dm = "-1d2";
        else if (strSiz <= 20) dm = "+0";
        else if (strSiz <= 25) dm = "+1d2";
        else if (strSiz <= 30) dm = "+1d4";
        else if (strSiz <= 35) dm = "+1d6";
        else if (strSiz <= 40) dm = "+1d8";
        else if (strSiz <= 45) dm = "+1d10";
        else if (strSiz <= 50) dm = "+1d12";
        else if (strSiz <= 60) dm = "+2d6";
        else if (strSiz <= 70) dm = "+2d8";
        else if (strSiz <= 80) dm = "+2d10";
        else if (strSiz <= 90) dm = "+2d12";
        else dm = "+2d12"; // Cap or extend as needed
        char.derivedAttributes.damageModifier = dm;

        // Re-evaluate characteristic-based formulas
        const evaluateFormula = (formula: string): number => {
            if (!formula) return 0;
            let val = 0;
            const terms = formula.split('+');
            for (const term of terms) {
                const t = term.trim().toUpperCase();
                let mult = 1;
                let stat = t;
                const match = t.match(/^([A-Z]+)X(\d+)$/);
                if (match) {
                    stat = match[1];
                    mult = parseInt(match[2]);
                }
                const charStat = (char.characteristics as any)[stat.toLowerCase()];
                if (charStat) {
                    val += charStat.current * mult;
                } else if (!isNaN(parseInt(stat))) {
                    val += parseInt(stat) * mult;
                }
            }
            return val;
        };

        const updateSkill = (skill: any) => {
            if (skill.baseFormula) {
                skill.baseValue = evaluateFormula(skill.baseFormula);
            }
            skill.totalValue = skill.baseValue + (skill.culturePoints || 0) + (skill.careerPoints || 0) + (skill.bonusPoints || 0) + (skill.experienceIncreases || 0);
        };

        // Standard Skills
        if (char.skills?.standard) {
            Object.values(char.skills.standard).forEach(updateSkill);
        }
        // Resistances
        if (char.skills?.resistances) {
            Object.values(char.skills.resistances).forEach(updateSkill);
        }
        // Languages
        if (char.skills?.languages) {
            Object.values(char.skills.languages).forEach(updateSkill);
        }
        // Magical Skills
        if (char.skills?.magical) {
            Object.values(char.skills.magical).forEach(updateSkill);
        }
        // Professional Skills
        if (char.skills?.professional) {
            Object.values(char.skills.professional).forEach(updateSkill);
        }
        // Combat Styles
        if (char.skills?.combatStyles) {
            Object.values(char.skills.combatStyles).forEach(updateSkill);
        }
        // Passions
        if (char.passions) {
            char.passions.forEach(p => {
                if (p.baseFormula) {
                    p.value = evaluateFormula(p.baseFormula) + (p.value - evaluateFormula(p.baseFormula)); // wait, passions just have a value. Let's just not touch passion value if it's already set, or we need to track base vs total for passions. Actually passion interface has `value` and `baseFormula`. Let's just set value if it's 0.
                }
            });
        }
    }
    
    async ensureCharactersFolder(): Promise<void> {
        const folderPath = normalizePath(`${this.plugin.settings.baseFolder}/Characters`);
        const abstractFile = this.app.vault.getAbstractFileByPath(folderPath);
        if (!abstractFile) {
            await this.app.vault.createFolder(folderPath);
        }
    }
    
    async listCharacters(): Promise<MythrasCharacter[]> {
        await this.ensureCharactersFolder();
        const folderPath = normalizePath(`${this.plugin.settings.baseFolder}/Characters`);
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        const characters: MythrasCharacter[] = [];
        
        if (folder && 'children' in folder) {
            for (const file of (folder as any).children) {
                if (file.name.endsWith('.json')) {
                    try {
                        const content = await this.app.vault.read(file as any);
                        characters.push(JSON.parse(content));
                    } catch (e) {
                        console.error(`Failed to read character file ${file.name}`, e);
                    }
                }
            }
        }
        return characters;
    }
    
    async loadCharacter(id: string): Promise<MythrasCharacter | null> {
        const characters = await this.listCharacters();
        return characters.find(c => c.id === id) || null;
    }
    
    async saveCharacter(character: MythrasCharacter): Promise<void> {
        await this.ensureCharactersFolder();
        character.lastModified = Date.now();
        
        const safeName = (character.identity.characterName || 'Unnamed').replace(/[^a-z0-9_-]/gi, '_');
        const newFileName = `${character.id}_${safeName}.json`;
        const newFilePath = normalizePath(`${this.plugin.settings.baseFolder}/Characters/${newFileName}`);
        
        const folderPath = normalizePath(`${this.plugin.settings.baseFolder}/Characters`);
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        
        const oldFiles: any[] = [];
        if (folder && 'children' in folder) {
            for (const file of (folder as any).children) {
                if (file.name.startsWith(character.id + '_') && file.name.endsWith('.json')) {
                    oldFiles.push(file);
                }
            }
        }
        
        const content = this.exportToJson(character);
        
        if (oldFiles.length > 0) {
            // Take the first file as the one to rename
            const primaryFile = oldFiles[0];
            
            // Delete all other duplicates
            for (let i = 1; i < oldFiles.length; i++) {
                try {
                    await this.app.vault.trash(oldFiles[i], false);
                } catch (e) {
                    console.error("Failed to delete duplicate character file", e);
                }
            }
            
            if (primaryFile.path !== newFilePath) {
                try {
                    // Check if newFilePath already exists (it shouldn't because we deleted duplicates, but just in case)
                    const existingTarget = this.app.vault.getAbstractFileByPath(newFilePath);
                    if (existingTarget && existingTarget !== primaryFile) {
                        await this.app.vault.trash(existingTarget, false);
                    }
                    await this.app.fileManager.renameFile(primaryFile, newFilePath);
                } catch (e) {
                    console.error("Failed to rename character file", e);
                }
                await this.app.vault.modify(primaryFile, content);
            } else {
                await this.app.vault.modify(primaryFile, content);
            }
        } else {
            await this.app.vault.create(newFilePath, content);
        }
    }
    
    async createCharacter(name: string): Promise<MythrasCharacter> {
        const id = window.crypto.randomUUID();
        const character: MythrasCharacter = {
            id,
            schemaVersion: '1.0',
            lastModified: Date.now(),
            image: '',
            identity: {
                characterName: name,
                playerName: '',
                campaign: '',
                concept: '',
                species: 'Human',
                culture: '',
                homeland: '',
                socialClass: '',
                career: '',
                currentSocialRank: '',
                age: 20,
                gender: '',
                height: '',
                weight: '',
                handedness: 'Right',
                distinctiveFeatures: '',
                lineageAndFamily: '',
                alliesAndContacts: [],
                rivalsAndEnemies: [],
                backstoryNotes: ''
            },
            characteristics: {
                str: { base: 10, current: 10 },
                con: { base: 10, current: 10 },
                siz: { base: 10, current: 10 },
                dex: { base: 10, current: 10 },
                int: { base: 10, current: 10 },
                pow: { base: 10, current: 10 },
                cha: { base: 10, current: 10 }
            },
            derivedAttributes: {
                actionPoints: 2,
                damageModifier: '+0',
                initiativeBase: 10,
                initiativeCurrent: 10,
                movementRate: 6,
                maxEncumbrance: 20,
                healingRate: 2,
                magicPointsMax: 10,
                magicPointsCurrent: 10,
                dedicatedMagicPoints: 0,
                luckPointsMax: 2,
                luckPointsCurrent: 2,
                experienceModifier: 0,
                tenacity: ''
            },
            passions: [],
            skills: {
                standard: {
                    "Athletics": { name: "Athletics", baseFormula: "STR+DEX", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: true },
                    "Boating": { name: "Boating", baseFormula: "STR+CON", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: true },
                    "Conceal": { name: "Conceal", baseFormula: "DEX+POW", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "Customs": { name: "Customs", baseFormula: "INTx2", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "Dance": { name: "Dance", baseFormula: "DEX+CHA", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: true },
                    "Deceit": { name: "Deceit", baseFormula: "INT+CHA", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "Drive": { name: "Drive", baseFormula: "DEX+POW", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "First Aid": { name: "First Aid", baseFormula: "INT+DEX", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "Influence": { name: "Influence", baseFormula: "CHAx2", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "Insight": { name: "Insight", baseFormula: "INT+POW", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "Locale": { name: "Locale", baseFormula: "INTx2", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "Perception": { name: "Perception", baseFormula: "INT+POW", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "Ride": { name: "Ride", baseFormula: "DEX+POW", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "Sing": { name: "Sing", baseFormula: "CHA+POW", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "Stealth": { name: "Stealth", baseFormula: "DEX+INT", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: true },
                    "Swim": { name: "Swim", baseFormula: "STR+CON", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: true },
                    "Unarmed": { name: "Unarmed", baseFormula: "STR+DEX", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: true }
                },
                resistances: {
                    "Brawn": { name: "Brawn", baseFormula: "STR+SIZ", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: true },
                    "Endurance": { name: "Endurance", baseFormula: "CONx2", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false },
                    "Evade": { name: "Evade", baseFormula: "DEXx2", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: true },
                    "Willpower": { name: "Willpower", baseFormula: "POWx2", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false }
                },
                languages: {
                    "Native": { name: "Native", baseFormula: "INT+CHA", baseValue: 20, culturePoints: 0, careerPoints: 0, bonusPoints: 0, experienceIncreases: 0, totalValue: 20, experienceTick: false, hasArmorPenalty: false }
                },
                professional: {},
                magical: {},
                combatStyles: {}
            },
            hitLocations: [
                { locationId: 'right_leg', range: '1-3', name: 'Right Leg', maxHp: 5, currentHp: 5, naturalArmorAp: 0, equippedArmorAp: 0, totalAp: 0, wornArmorType: '', wornArmorEnc: 0, status: 'Normal', notes: '' },
                { locationId: 'left_leg', range: '4-6', name: 'Left Leg', maxHp: 5, currentHp: 5, naturalArmorAp: 0, equippedArmorAp: 0, totalAp: 0, wornArmorType: '', wornArmorEnc: 0, status: 'Normal', notes: '' },
                { locationId: 'abdomen', range: '7-9', name: 'Abdomen', maxHp: 6, currentHp: 6, naturalArmorAp: 0, equippedArmorAp: 0, totalAp: 0, wornArmorType: '', wornArmorEnc: 0, status: 'Normal', notes: '' },
                { locationId: 'chest', range: '10-12', name: 'Chest', maxHp: 7, currentHp: 7, naturalArmorAp: 0, equippedArmorAp: 0, totalAp: 0, wornArmorType: '', wornArmorEnc: 0, status: 'Normal', notes: '' },
                { locationId: 'right_arm', range: '13-15', name: 'Right Arm', maxHp: 4, currentHp: 4, naturalArmorAp: 0, equippedArmorAp: 0, totalAp: 0, wornArmorType: '', wornArmorEnc: 0, status: 'Normal', notes: '' },
                { locationId: 'left_arm', range: '16-18', name: 'Left Arm', maxHp: 4, currentHp: 4, naturalArmorAp: 0, equippedArmorAp: 0, totalAp: 0, wornArmorType: '', wornArmorEnc: 0, status: 'Normal', notes: '' },
                { locationId: 'head', range: '19-20', name: 'Head', maxHp: 5, currentHp: 5, naturalArmorAp: 0, equippedArmorAp: 0, totalAp: 0, wornArmorType: '', wornArmorEnc: 0, status: 'Normal', notes: '' }
            ],
            weapons: [],
            condition: {
                carriedEnc: 0,
                maxEnc: 20,
                encumbranceLevel: 'Standard',
                totalArmorEnc: 0,
                armorSkillPenalty: 0,
                armorStrikeRankPenalty: 0,
                fatigueLevel: 'Fresh'
            },
            wealth: {
                copper: 0,
                silver: 0,
                gold: 0,
                otherValuablesTotalSp: 0,
                bankedWealthSp: 0,
                lifestyle: 'Destitute'
            },
            inventory: [],
            magic: {},
            organizations: [],
            progression: {
                improvementRollsAvailable: 0,
                improvementRollsSpentTotal: 0,
                experienceModifier: 0,
                trainingLog: [],
                advancementHistory: []
            },
            notes: ''
        };
        this.recalculateCharacter(character);
        await this.saveCharacter(character);
        return character;
    }
    
    async deleteCharacter(id: string): Promise<void> {
        const folderPath = normalizePath(`${this.plugin.settings.baseFolder}/Characters`);
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        
        if (folder && 'children' in folder) {
            for (const file of (folder as any).children) {
                if (file.name.startsWith(id + '_') && file.name.endsWith('.json')) {
                    try {
                        await this.app.vault.trash(file as any, false);
                    } catch (e) {
                        console.error("Failed to delete character file", e);
                    }
                }
            }
        }
    }
    
    exportToJson(character: MythrasCharacter): string {
        return JSON.stringify(character, null, 4);
    }
}
