import { App, normalizePath } from 'obsidian';
import { MythrasTemplate, MythrasWeapon, MythrasInstance } from './mythras-api';
import { DiceRoller } from './dice-roller';

export async function generateStatblock(app: App, armoryFile: string, template: MythrasTemplate, index: number): Promise<string> {
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
    const initiative = DiceRoller.calculateInitiative(INT, DEX);
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
    // Load armory
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
        const amountFormula = options[0].amountFormula || "1";
        const amountToChoose = DiceRoller.rollExpression(amountFormula);
        
        if (amountToChoose <= 0) continue;

        // Weighted random selection without replacement
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

    // Merge stats from Armory and apply damage modifier
    activeWeapons.forEach(w => {
        if (!w.damage) {
            // Find in armory
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
        }

        // Apply Damage Modifier if weapon has damage and damageModifier is not explicitly false
        if (w.damage && w.damageModifier !== false && damageModifier !== "+0" && damageModifier !== "0") {
            const mod = damageModifier.startsWith("+") || damageModifier.startsWith("-") ? damageModifier : "+" + damageModifier;
            w.damage += mod;
        }
    });

    // 7. Format Markdown
    let md = `### ${template.name} #${index}\n`;
    
    // Core Stats Table
    md += `| STR | CON | SIZ | DEX | INT | POW | CHA |\n`;
    md += `|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n`;
    md += `| ${STR} | ${CON} | ${SIZ} | ${DEX} | ${INT} | ${POW} | ${CHA} |\n\n`;

    // Attributes Table
    md += `| Action Points | Damage Mod | Initiative | Magic Points | Movement |
| :---: | :---: | :---: | :---: | :---: |
| ${actionPoints} | ${damageModifier} | ${initiative} | ${magicPoints} | ${movement} |
\n\n`;

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
            const typeLower = (w.type || '').toLowerCase();
            const apHpStr = w.ap && w.hp ? `AP/HP ${w.ap}/${w.hp}` : '';
            const specialFxStr = w.specialFx || 'None';
            const sizeStr = w.size ? `Size ${w.size}` : '';

            let weaponDesc = `- **${w.name}** (${w.type || '-'}): `;

            if (typeLower === 'ranged') {
                const dmgStr = w.damage ? `Damage ${w.damage}` : '';
                const rangeStr = w.range ? `Range ${w.range}` : '';
                weaponDesc += [dmgStr, rangeStr, sizeStr, apHpStr, `Special: ${specialFxStr}`].filter(Boolean).join(', ');
            } else if (typeLower === 'shield') {
                const dmgStr = w.damage ? `Damage ${w.damage} (bash)` : '';
                weaponDesc += [dmgStr, sizeStr, apHpStr, `Special: ${specialFxStr}`].filter(Boolean).join(', ');
            } else {
                // Default to Melee
                const dmgStr = w.damage ? `Damage ${w.damage}` : '';
                const reachStr = w.reach ? `Reach ${w.reach}` : '';
                weaponDesc += [dmgStr, sizeStr, reachStr, apHpStr, `Special: ${specialFxStr}`].filter(Boolean).join(', ');
            }
            
            md += `${weaponDesc}\n`;
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

export function formatInstanceAsMarkdown(instance: MythrasInstance): string {
    let md = `### ${instance.instanceName}\n`;
    
    // Core Stats Table
    md += `| STR | CON | SIZ | DEX | INT | POW | CHA |\n`;
    md += `|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n`;
    const STR = instance.stats['STR'] || 10;
    const CON = instance.stats['CON'] || 10;
    const SIZ = instance.stats['SIZ'] || 10;
    const DEX = instance.stats['DEX'] || 10;
    const INT = instance.stats['INT'] || 10;
    const POW = instance.stats['POW'] || 10;
    const CHA = instance.stats['CHA'] || 10;
    md += `| ${STR} | ${CON} | ${SIZ} | ${DEX} | ${INT} | ${POW} | ${CHA} |\n\n`;

    // Attributes Table
    md += `| Action Points | Damage Mod | Magic Points | Strike Rank | Movement |\n`;
    md += `|:---:|:---:|:---:|:---:|:---:|\n`;
    const ap = instance.attributes['Action Points'] || '-';
    const dm = instance.attributes['Damage Mod'] || '-';
    const mp = instance.attributes['Magic Points'] || '-';
    const sr = instance.attributes['Strike Rank'] || '-';
    const mov = instance.attributes['Movement'] || '6m';
    md += `| ${ap} | ${dm} | ${mp} | ${sr} | ${mov} |\n\n`;

    // Hit Locations Table
    if (instance.hitLocations && instance.hitLocations.length > 0) {
        md += `| D20 | Hit Location | AP | HP |\n`;
        md += `|:---:|:---|:---:|:---:|\n`;
        for (const hl of instance.hitLocations) {
            md += `| ${hl.range} | ${hl.name} | ${hl.ap} | ${hl.currentHp} / ${hl.hp} |\n`;
        }
        md += `\n`;
    }

    // Weapons
    if (instance.weapons && instance.weapons.length > 0) {
        md += `**Weapons:**\n`;
        instance.weapons.forEach(w => {
            const typeLower = (w.type || '').toLowerCase();
            const apHpStr = w.ap && w.hp ? `AP/HP ${w.ap}/${w.hp}` : '';
            const specialFxStr = w.specialFx || 'None';
            const sizeStr = w.size ? `Size ${w.size}` : '';

            let weaponDesc = `- **${w.name}** (${w.type || '-'}): `;

            if (typeLower === 'ranged') {
                const dmgStr = w.damage ? `Damage ${w.damage}` : '';
                const rangeStr = w.range ? `Range ${w.range}` : '';
                weaponDesc += [dmgStr, rangeStr, sizeStr, apHpStr, `Special: ${specialFxStr}`].filter(Boolean).join(', ');
            } else if (typeLower === 'shield') {
                const dmgStr = w.damage ? `Damage ${w.damage} (bash)` : '';
                weaponDesc += [dmgStr, sizeStr, apHpStr, `Special: ${specialFxStr}`].filter(Boolean).join(', ');
            } else {
                // Default to Melee
                const dmgStr = w.damage ? `Damage ${w.damage}` : '';
                const reachStr = w.reach ? `Reach ${w.reach}` : '';
                weaponDesc += [dmgStr, sizeStr, reachStr, apHpStr, `Special: ${specialFxStr}`].filter(Boolean).join(', ');
            }
            
            md += `${weaponDesc}\n`;
        });
        md += `\n`;
    }

    // Features
    if (instance.features && instance.features.length > 0) {
        md += `**Features:**\n`;
        instance.features.forEach(f => {
            md += `- **${f.name}:** ${f.description}\n`;
        });
        md += `\n`;
    }

    // Combat Styles
    if (instance.combatStyles && Object.keys(instance.combatStyles).length > 0) {
        const styles = Object.entries(instance.combatStyles).map(([k, v]) => `**${k}:** ${v}%`);
        md += `**Combat Styles:** ${styles.join(' | ')}\n\n`;
    }

    // Skills
    if (instance.standardSkills && Object.keys(instance.standardSkills).length > 0) {
        const standard = Object.entries(instance.standardSkills).map(([k, v]) => `**${k}:** ${v}%`);
        md += `**Standard Skills:** ${standard.join(' | ')}\n\n`;
    }
    if (instance.customSkills && Object.keys(instance.customSkills).length > 0) {
        const custom = Object.entries(instance.customSkills).map(([k, v]) => `**${k}:** ${v}%`);
        md += `**Custom Skills:** ${custom.join(' | ')}\n\n`;
    }

    // Notes
    if (instance.notes) {
        md += `> **Notes:**\n> ${instance.notes.replace(/\n/g, '\n> ')}\n`;
    }

    return md;
}

export function renderEnemyStatblock(instance: MythrasInstance, mode: 'short' | 'long'): HTMLElement {
    const container = document.createElement('div');
    container.addClass('mythras-enemy-short');

    if (instance.image) {
        const imgContainer = container.createDiv('mythras-enemy-image');
        imgContainer.dataset.imageLink = instance.image;
    }

    const header = container.createDiv('mythras-enemy-header');
    header.createEl('h3', { text: instance.instanceName, cls: 'mythras-enemy-name' });
    header.createEl('span', { text: `(${instance.templateName})`, cls: 'mythras-enemy-template' });

    const topWrap = container.createDiv('mythras-enemy-top-wrap');

    const charGrid = topWrap.createDiv('mythras-char-grid');
    const chars = ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'];
    chars.forEach(c => {
        const box = charGrid.createDiv('mythras-char-box');
        box.createDiv({ text: c, cls: 'mythras-char-label' });
        box.createDiv({ text: String(instance.stats[c] || '-'), cls: 'mythras-char-value' });
    });

    const derivedGrid = topWrap.createDiv('mythras-derived-grid');
    const derived = [
        { label: 'AP', val: instance.attributes['Action Points'] },
        { label: 'Dmg Mod', val: instance.attributes['Damage Mod'] },
        { label: 'Init', val: instance.attributes['Initiative'] || instance.attributes['Strike Rank'] },
        { label: 'Move', val: instance.attributes['Movement'] },
        { label: 'MP', val: instance.attributes['Magic Points'] }
    ];
    derived.forEach(d => {
        const box = derivedGrid.createDiv('mythras-derived-box');
        box.createDiv({ text: d.label, cls: 'mythras-derived-label' });
        box.createDiv({ text: String(d.val || '-'), cls: 'mythras-derived-value' });
    });

    const hlContainer = container.createDiv('mythras-hl-container');
    instance.hitLocations.forEach(hl => {
        const pill = hlContainer.createDiv('mythras-hl-compact');
        pill.createSpan({ text: hl.name, cls: 'mythras-hl-name' });
        pill.createSpan({ text: `(${hl.ap}/${hl.hp})`, cls: 'mythras-hl-vals' });
    });

    if (instance.combatStyles && Object.keys(instance.combatStyles).length > 0) {
        const csDiv = container.createDiv('mythras-enemy-cs');
        const styles = Object.entries(instance.combatStyles).map(([k, v]) => `${k} ${v}%`).join(', ');
        csDiv.createSpan({ text: 'Combat Styles: ', cls: 'mythras-label-bold' });
        csDiv.createSpan({ text: styles });
    }

    if (instance.weapons && instance.weapons.length > 0) {
        const weaponsDiv = container.createDiv('mythras-enemy-weapons');
        instance.weapons.forEach(w => {
            const wLine = weaponsDiv.createDiv('mythras-weapon-line');
            let reachRange = '';
            if (w.reach) reachRange = `, Reach ${w.reach}`;
            else if (w.range) reachRange = `, Range ${w.range}`;

            const allFx = [];
            if (w.specialFx && w.specialFx !== 'None' && w.specialFx !== '—') allFx.push(w.specialFx);
            if (w.traits) allFx.push(w.traits);

            wLine.createSpan({ text: `⚔️ ${w.name}: `, cls: 'mythras-label-bold' });
            wLine.createSpan({ text: `${w.damage || '-'}, Size ${w.size || '-'}${reachRange}` });
            if (allFx.length > 0) {
                wLine.createSpan({ text: `, ` });
                wLine.createSpan({ text: allFx.join(', '), cls: 'mythras-weapon-fx' });
            }
        });
    }

    return container;
}
