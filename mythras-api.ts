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
