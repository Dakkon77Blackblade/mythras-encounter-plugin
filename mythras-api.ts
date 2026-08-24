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

export interface MythrasTemplate {
    id: number;
    name: string;
    race: string;
    rank: string;
    notes: string;
    stats: Record<string, string>; // e.g. "STR": "3d6"
    attributes: Record<string, string>; // e.g. "Movement": "6m"
    hitLocations: Array<{ range: string, name: string, armor: string }>;
    skills: Record<string, string>; // e.g. "Athletics": "STR+DEX"
    combatStyles: Record<string, string>; // e.g. "Sword and Shield": "STR+DEX+10"
    weapons: string[];
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
            race: '',
            rank: '',
            notes: '',
            stats: {},
            attributes: {},
            hitLocations: [],
            skills: {},
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
                const td = row.querySelector('td')?.textContent?.trim();
                if (th === 'Rank') template.rank = td || '';
                if (th === 'Race') template.race = td || '';
                if (th === 'Notes') template.notes = td || '';
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
        const parseSkills = (headerText: string) => {
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
                                    template.skills[key] = val;
                                }
                                i++;
                            }
                        });
                    }
                    node = node.nextElementSibling;
                }
            });
        };

        parseSkills('Standard skills');
        parseSkills('Custom skills');
        parseSkills('Combat styles');

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
        const parseWeapons = (headerText: string) => {
            const h4s = Array.from(doc.querySelectorAll('h4')).filter(h => h.textContent?.includes(headerText));
            h4s.forEach(h4 => {
                const table = h4.parentElement?.querySelector('table');
                if (table) {
                    table.querySelectorAll('tr').forEach(row => {
                        const td = row.querySelector('td')?.textContent?.trim();
                        if (td) template.weapons.push(td);
                    });
                }
            });
        };
        parseWeapons('1-handed weapons');
        parseWeapons('2-handed weapons');
        parseWeapons('Ranged weapons');
        parseWeapons('Shields');

        return template;
    }
}
