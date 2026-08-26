import { App, normalizePath } from 'obsidian';
import { MythrasTemplate, MythrasInstance, HitLocationInstance, MythrasWeapon } from './mythras-api';
import { DiceRoller } from './dice-roller';

export async function instantiateEnemy(
    app: App, 
    armoryFile: string, 
    template: MythrasTemplate, 
    instanceName: string, 
    scenario: string, 
    encounter: string
): Promise<MythrasInstance> {
    const id = Date.now().toString() + Math.floor(Math.random() * 1000).toString();

    // 1. Roll Core Stats
    const stats: Record<string, number> = {};
    for (const [stat, formula] of Object.entries(template.stats)) {
        stats[stat] = DiceRoller.rollExpression(formula);
    }

    const STR = stats['STR'] || 10;
    const CON = stats['CON'] || 10;
    const SIZ = stats['SIZ'] || 10;
    const DEX = stats['DEX'] || 10;
    const INT = stats['INT'] || 10;
    const POW = stats['POW'] || 10;
    const CHA = stats['CHA'] || 10;

    // 2. Derived Attributes
    const attributes: Record<string, string | number> = {};
    attributes['Action Points'] = DiceRoller.calculateActionPoints(INT, DEX);
    attributes['Damage Mod'] = DiceRoller.calculateDamageModifier(STR, SIZ);
    attributes['Strike Rank'] = DiceRoller.calculateStrikeRank(INT, DEX);
    attributes['Magic Points'] = POW;
    attributes['Movement'] = template.attributes['Movement'] || "6m";

    // 3. Hit Locations
    const baseHp = Math.ceil((CON + SIZ) / 5);
    const hitLocations: HitLocationInstance[] = template.hitLocations.map(hl => {
        let hpBonus = 0;
        const nameLower = hl.name.toLowerCase();
        if (nameLower.includes('abdomen') || nameLower.includes('hindquarter')) hpBonus = 1;
        else if (nameLower.includes('chest') || nameLower.includes('thorax') || nameLower.includes('forequarter')) hpBonus = 2;
        else if (nameLower.includes('arm') || nameLower.includes('wing') || nameLower.includes('foreleg') || nameLower.includes('tentacle')) hpBonus = -1;
        
        const hp = baseHp + hpBonus;
        return {
            range: hl.range,
            name: hl.name,
            ap: hl.armor,
            hp: hp,
            currentHp: hp
        };
    });

    // 4. Skills
    const standardSkills: Record<string, number> = {};
    for (const [skill, formula] of Object.entries(template.standardSkills || {})) {
        standardSkills[skill] = DiceRoller.rollExpression(formula, stats);
    }

    const customSkills: Record<string, number> = {};
    for (const [skill, formula] of Object.entries(template.customSkills || {})) {
        customSkills[skill] = DiceRoller.rollExpression(formula, stats);
    }

    // 5. Combat Styles
    const combatStyles: Record<string, number> = {};
    for (const [style, formula] of Object.entries(template.combatStyles || {})) {
        combatStyles[style] = DiceRoller.rollExpression(formula, stats);
    }

    // 6. Resolve Weapons
    let armory: MythrasWeapon[] = [];
    try {
        const armoryPath = normalizePath(armoryFile);
        if (await app.vault.adapter.exists(armoryPath)) {
            const content = await app.vault.adapter.read(armoryPath);
            armory = JSON.parse(content);
        }
    } catch (e) {
        console.error("Failed to load armory:", e);
    }

    const activeWeapons: MythrasWeapon[] = [];
    
    // Deep copy weapons to avoid mutating the template object
    const templateWeapons = JSON.parse(JSON.stringify(template.weapons || [])) as MythrasWeapon[];
    
    activeWeapons.push(...templateWeapons.filter(w => !w.isOptional));

    const optionalWeapons = templateWeapons.filter(w => w.isOptional);
    const optByCategory: Record<string, MythrasWeapon[]> = {};
    optionalWeapons.forEach(w => {
        const cat = w.category || 'Unknown';
        if (!optByCategory[cat]) optByCategory[cat] = [];
        optByCategory[cat].push(w);
    });

    for (const cat of Object.keys(optByCategory)) {
        const options = optByCategory[cat];
        const amountFormula = options[0].amountFormula || "1";
        const amountToChoose = DiceRoller.rollExpression(amountFormula);
        
        if (amountToChoose <= 0) continue;

        const availableOptions = [...options];
        for (let i = 0; i < amountToChoose && availableOptions.length > 0; i++) {
            const totalWeight = availableOptions.reduce((sum, w) => sum + (w.probability || 1), 0);
            let rand = Math.random() * totalWeight;
            
            let selectedIndex = 0;
            for (let j = 0; j < availableOptions.length; j++) {
                rand -= (availableOptions[j].probability || 1);
                if (rand <= 0) {
                    selectedIndex = j;
                    break;
                }
            }

            activeWeapons.push(availableOptions[selectedIndex]);
            availableOptions.splice(selectedIndex, 1);
        }
    }

    const damageModifier = attributes['Damage Mod'] as string;
    activeWeapons.forEach(w => {
        const armoryWeapon = armory.find(aw => aw.name.toLowerCase() === w.name.toLowerCase());
        if (armoryWeapon) {
            w.type = armoryWeapon.type;
            w.damage = armoryWeapon.damage;
            w.size = armoryWeapon.size;
            w.reach = armoryWeapon.reach;
            w.range = armoryWeapon.range;
            w.ap = armoryWeapon.ap;
            w.hp = armoryWeapon.hp;
            w.damageModifier = armoryWeapon.damageModifier;
            w.specialFx = armoryWeapon.specialFx;
        }

        if (w.damage && w.damageModifier !== false && damageModifier !== "+0" && damageModifier !== "0") {
            const mod = damageModifier.startsWith("+") || damageModifier.startsWith("-") ? damageModifier : "+" + damageModifier;
            w.damage += mod;
        }
    });

    return {
        id,
        templateName: template.name,
        instanceName,
        scenario,
        encounter,
        lastModified: Date.now(),
        stats,
        attributes,
        hitLocations,
        standardSkills,
        customSkills,
        combatStyles,
        weapons: activeWeapons,
        features: template.features,
        notes: template.notes
    };
}
