import { MythrasTemplate, MythrasWeapon } from './mythras-api';
import { DiceRoller } from './dice-roller';

export function generateStatblock(template: MythrasTemplate, index: number): string {
    // 1. Roll Core Stats
    const rolledStats: Record<string, number> = {};
    for (const [stat, formula] of Object.entries(template.stats)) {
        rolledStats[stat] = DiceRoller.rollExpression(formula);
    }

    // Default missing core stats if any
    const STR = rolledStats['STR'] || 10;
    const CON = rolledStats['CON'] || 10;
    const SIZ = rolledStats['SIZ'] || 10;
    const DEX = rolledStats['DEX'] || 10;
    const INT = rolledStats['INT'] || 10;
    const POW = rolledStats['POW'] || 10;
    const CHA = rolledStats['CHA'] || 10;

    // 2. Derived Attributes
    const actionPoints = DiceRoller.calculateActionPoints(INT, DEX);
    const damageModifier = DiceRoller.calculateDamageModifier(STR, SIZ);
    const strikeRank = DiceRoller.calculateStrikeRank(INT, DEX);
    const magicPoints = POW;
    const movement = template.attributes['Movement'] || "6m";

    // 3. Roll Hit Locations
    const baseHp = Math.ceil((CON + SIZ) / 5);
    const rolledHitLocations = template.hitLocations.map(hl => {
        let hpBonus = 0;
        const nameLower = hl.name.toLowerCase();
        if (nameLower.includes('abdomen') || nameLower.includes('hindquarter')) hpBonus = 1;
        else if (nameLower.includes('chest') || nameLower.includes('thorax') || nameLower.includes('forequarter')) hpBonus = 2;
        else if (nameLower.includes('arm') || nameLower.includes('wing') || nameLower.includes('foreleg') || nameLower.includes('tentacle')) hpBonus = -1;
        
        return {
            range: hl.range,
            name: hl.name,
            ap: hl.armor, // Assume static or simple format for now
            hp: baseHp + hpBonus
        };
    });

    // 4. Roll Skills
    const rolledStandardSkills: string[] = [];
    for (const [skill, formula] of Object.entries(template.standardSkills || {})) {
        const val = DiceRoller.rollExpression(formula, rolledStats);
        rolledStandardSkills.push(`**${skill}:** ${val}%`);
    }

    const rolledCustomSkills: string[] = [];
    for (const [skill, formula] of Object.entries(template.customSkills || {})) {
        const val = DiceRoller.rollExpression(formula, rolledStats);
        rolledCustomSkills.push(`**${skill}:** ${val}%`);
    }

    // 5. Roll Combat Styles
    const rolledStyles: string[] = [];
    for (const [style, formula] of Object.entries(template.combatStyles || {})) {
        const val = DiceRoller.rollExpression(formula, rolledStats);
        rolledStyles.push(`**${style}:** ${val}%`);
    }

    // 6. Resolve Weapons
    const activeWeapons: MythrasWeapon[] = [];
    
    // Add all non-optional weapons
    activeWeapons.push(...(template.weapons || []).filter(w => !w.isOptional));

    // Randomly select optional weapons
    const optionalWeapons = (template.weapons || []).filter(w => w.isOptional);
    const optByCategory: Record<string, MythrasWeapon[]> = {};
    optionalWeapons.forEach(w => {
        const cat = w.category || 'Unknown';
        if (!optByCategory[cat]) optByCategory[cat] = [];
        optByCategory[cat].push(w);
    });

    for (const cat of Object.keys(optByCategory)) {
        const options = optByCategory[cat];
        // All options in this category should share the same amountToChoose, just grab the first
        const amount = options[0].amountToChoose || 1;
        
        // Shuffle and pick `amount`
        const shuffled = options.sort(() => 0.5 - Math.random());
        activeWeapons.push(...shuffled.slice(0, amount));
    }

    // 7. Format Markdown
    let md = `### ${template.name} #${index}\n`;
    
    // Core Stats Table
    md += `| STR | CON | SIZ | DEX | INT | POW | CHA |\n`;
    md += `|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n`;
    md += `| ${STR} | ${CON} | ${SIZ} | ${DEX} | ${INT} | ${POW} | ${CHA} |\n\n`;

    // Attributes Table
    md += `| Action Points | Damage Mod | Magic Points | Strike Rank | Movement |\n`;
    md += `|:---:|:---:|:---:|:---:|:---:|\n`;
    md += `| ${actionPoints} | ${damageModifier} | ${magicPoints} | ${strikeRank} | ${movement} |\n\n`;

    // Hit Locations Table
    if (rolledHitLocations.length > 0) {
        md += `| D20 | Hit Location | AP | HP |\n`;
        md += `|:---:|:---|:---:|:---:|\n`;
        for (const hl of rolledHitLocations) {
            md += `| ${hl.range} | ${hl.name} | ${hl.ap} | ${hl.hp} |\n`;
        }
        md += `\n`;
    }

    // Weapons
    if (activeWeapons.length > 0) {
        md += `**Weapons:**\n`;
        activeWeapons.forEach(w => {
            if (w.isOptional) {
                // We only have the name for optional weapons
                md += `- ${w.name}\n`;
            } else {
                // We have full stats for custom/natural weapons
                md += `- **${w.name}** (${w.type || '-'}): Damage ${w.damage || '-'}, Size ${w.size || '-'}, Reach ${w.reach || '-'}, Special: ${w.specialFx || 'None'}\n`;
            }
        });
        md += `\n`;
    }

    // Features
    if (template.features && template.features.length > 0) {
        md += `**Features:**\n`;
        template.features.forEach(f => {
            md += `- **${f.name}:** ${f.description}\n`;
        });
        md += `\n`;
    }

    // Combat Styles
    if (rolledStyles.length > 0) {
        md += `**Combat Styles:** ${rolledStyles.join(' | ')}\n\n`;
    }

    // Skills
    if (rolledStandardSkills.length > 0) {
        md += `**Standard Skills:** ${rolledStandardSkills.join(' | ')}\n\n`;
    }
    if (rolledCustomSkills.length > 0) {
        md += `**Custom Skills:** ${rolledCustomSkills.join(' | ')}\n\n`;
    }

    // Notes
    if (template.notes) {
        md += `> **Notes:**\n> ${template.notes.replace(/\n/g, '\n> ')}\n`;
    }

    return md;
}
