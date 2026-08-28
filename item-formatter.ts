import { MythrasWeapon } from './mythras-api';
import { setIcon } from 'obsidian';

export function renderItemStatblock(weapon: MythrasWeapon, compact: boolean = false): HTMLElement {
    const container = document.createElement('div');
    container.addClass('mythras-item-statblock');

    if (compact) {
        // Line 1: Name, Type
        const line1 = container.createDiv('mythras-item-line1');
        line1.createSpan('mythras-item-name').setText(weapon.name);
        if (weapon.type) {
            line1.createSpan('mythras-item-type').setText(weapon.type.toUpperCase());
        }

        // Line 2: Core Stats (smaller, with icons)
        const line2 = container.createDiv('mythras-item-line2');

        const addIconStat = (iconName: string, value: string) => {
            const statSpan = line2.createSpan('mythras-item-stat-inline');
            const iconSpan = statSpan.createSpan('mythras-item-icon');
            setIcon(iconSpan, iconName);
            statSpan.createSpan('mythras-item-val').setText(value);
        };

        if (weapon.damage) addIconStat('sword', weapon.damage);
        if (weapon.size) addIconStat('box', weapon.size);
        
        if (weapon.type === 'ranged') {
            if (weapon.range) addIconStat('target', weapon.range);
            if (weapon.load) addIconStat('hourglass', weapon.load);
        } else {
            if (weapon.reach) addIconStat('ruler', weapon.reach);
        }
        
        if (weapon.ap || weapon.hp) {
            addIconStat('shield', `${weapon.ap || '-'}/${weapon.hp || '-'}`);
        }

        // Line 3: Effects & Traits (even smaller, with icons)
        if (weapon.specialFx || weapon.traits) {
            const line3 = container.createDiv('mythras-item-line3');
            
            const addDetailIcon = (iconName: string, value: string) => {
                const statSpan = line3.createSpan('mythras-item-stat-inline');
                const iconSpan = statSpan.createSpan('mythras-item-icon');
                setIcon(iconSpan, iconName);
                statSpan.createSpan('mythras-item-val').setText(value);
            };

            if (weapon.specialFx) addDetailIcon('sparkles', weapon.specialFx);
            if (weapon.traits) addDetailIcon('tags', weapon.traits);
        }

        // Line 4: Notes
        if (weapon.notes) {
            const line4 = container.createDiv('mythras-item-line4 mythras-item-notes-compact');
            line4.setText(weapon.notes);
        }
    } else {
        // FULL BLOCK FORMAT (Grid)
        const header = container.createDiv('mythras-item-header');
        header.createSpan('mythras-item-name-grid').setText(weapon.name);
        if (weapon.type) {
            header.createSpan('mythras-item-type-grid').setText(weapon.type.toUpperCase());
        }

        const grid = container.createDiv('mythras-item-grid');
        const addStat = (label: string, value: string | undefined) => {
            if (!value) return;
            const stat = grid.createDiv('mythras-item-stat');
            stat.createDiv('mythras-item-stat-label').setText(label);
            stat.createDiv('mythras-item-stat-value').setText(value);
        };

        addStat('Damage', weapon.damage);
        addStat('Size', weapon.size);
        if (weapon.type === 'ranged') {
            addStat('Range', weapon.range);
            addStat('Load', weapon.load);
        } else {
            addStat('Reach', weapon.reach);
        }
        
        if (weapon.ap || weapon.hp) {
            addStat('AP/HP', `${weapon.ap || '-'}/${weapon.hp || '-'}`);
        }

        const details = container.createDiv('mythras-item-details');
        const addDetail = (label: string, value: string | undefined) => {
            if (!value) return;
            const detailRow = details.createDiv('mythras-item-detail-row');
            detailRow.createSpan('mythras-item-detail-label').setText(label + ': ');
            detailRow.createSpan('mythras-item-detail-value').setText(value);
        };

        addDetail('Combat Effects', weapon.specialFx);
        addDetail('Traits', weapon.traits);
        addDetail('Cost', weapon.cost);
        
        if (weapon.notes) {
            const notesRow = details.createDiv('mythras-item-notes-grid');
            notesRow.setText(weapon.notes);
        }
    }

    return container;
}
