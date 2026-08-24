import { MythrasTemplate } from './mythras-api';
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
    const rolledSkills: string[] = [];
    for (const [skill, formula] of Object.entries(template.skills)) {
        const val = DiceRoller.rollExpression(formula, rolledStats);
        rolledSkills.push(`**${skill}:** ${val}%`);
    }

    // 5. Roll Combat Styles
    const rolledStyles: string[] = [];
    for (const [style, formula] of Object.entries(template.combatStyles)) {
        const val = DiceRoller.rollExpression(formula, rolledStats);
        rolledStyles.push(`**${style}:** ${val}%`);
    }

    // 6. Format Markdown
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
    if (template.weapons && template.weapons.length > 0) {
        md += `**Weapons:**\n`;
        template.weapons.forEach(w => md += `- ${w}\n`);
        md += `\n`;
    }

    // Combat Styles
    if (rolledStyles.length > 0) {
        md += `**Combat Styles:** ${rolledStyles.join(' | ')}\n\n`;
    }

    // Skills
    if (rolledSkills.length > 0) {
        md += `**Skills:** ${rolledSkills.join(' | ')}\n\n`;
    }

    // Notes
    if (template.notes) {
        md += `> **Notes:**\n> ${template.notes.replace(/\n/g, '\n> ')}\n`;
    }

    return md;
}
