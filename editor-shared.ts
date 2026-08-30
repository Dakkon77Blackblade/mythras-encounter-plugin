import { App, setIcon } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasTemplate, MythrasWeapon, MythrasInstance } from './mythras-api';
import { ImageSuggestModal } from './modal-image-search';

export type EditorMode = 'template' | 'instance';
export type EditorTab = 'general' | 'stats' | 'hitlocations' | 'skills' | 'weapons' | 'features';

export function renderUnifiedEditor(
    container: HTMLElement,
    mode: EditorMode,
    data: any, // MythrasTemplate or MythrasInstance
    options: {
        app: App,
        plugin: MythrasEncounterPlugin,
        activeTab: EditorTab,
        onTabChange: (tab: EditorTab) => void,
        armoryWeapons: MythrasWeapon[]
    }
): void {
    container.empty();

    // Create tab bar
    const tabsDiv = container.createDiv('mythras-manager-tabs');
    const createTab = (id: EditorTab, label: string) => {
        if (id === 'features' && mode !== 'template') return;
        const btn = tabsDiv.createEl('button', { text: label });
        if (options.activeTab === id) btn.addClass('mod-cta');
        btn.onclick = () => {
            options.onTabChange(id);
        };
    };

    createTab('general', 'General');
    createTab('stats', 'Stats & Attributes');
    createTab('hitlocations', 'Hit Locations');
    createTab('skills', 'Skills');
    createTab('weapons', 'Weapons');
    createTab('features', 'Features');

    const formArea = container.createDiv('mythras-manager-form mythras-manager-form-scrollable');

    const createTextField = (label: string, value: string, onChange: (v: string) => void) => {
        const wrap = formArea.createDiv('mythras-manager-form-group');
        wrap.createEl('label', { text: label });
        const input = wrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
        input.value = value || '';
        input.onchange = (e) => onChange((e.target as HTMLInputElement).value);
    };

    if (options.activeTab === 'general') {
        const grid = formArea.createDiv('mythras-grid-200'); // responsive grid
        if (mode === 'template') {
            const entry = data as MythrasTemplate;
            createTextField('Name', entry.name, v => entry.name = v);
            
            const imgWrap = formArea.createDiv('mythras-manager-form-group');
            imgWrap.createEl('label', { text: 'Image URL or Vault Path' });
            const imgInputContainer = imgWrap.createDiv('mythras-manager-input-group');
            const imgInput = imgInputContainer.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
            imgInput.value = entry.image || '';
            imgInput.onchange = (e) => entry.image = (e.target as HTMLInputElement).value;
            const btnBrowse = imgInputContainer.createEl('button', { text: 'Browse', cls: 'mythras-btn-secondary' });
            btnBrowse.onclick = () => {
                new ImageSuggestModal(options.app, (file) => {
                    entry.image = file.path;
                    imgInput.value = file.path;
                }).open();
            };

            createTextField('Race', entry.race, v => entry.race = v);
            createTextField('Rank', entry.rank, v => entry.rank = v);
            createTextField('Cult Rank', entry.cultRank, v => entry.cultRank = v);
            createTextField('Tags (comma separated)', (entry.tags || []).join(', '), v => {
                entry.tags = v.split(',').map(t => t.trim()).filter(t => t.length > 0);
            });

            const notesWrap = formArea.createDiv('mythras-manager-form-group mythras-span-full');
            notesWrap.createEl('label', { text: 'Notes' });
            const notesInput = notesWrap.createEl('textarea', { cls: 'mythras-manager-input' });
            notesInput.value = entry.notes || '';
            notesInput.rows = 4;
            notesInput.onchange = (e) => entry.notes = (e.target as HTMLTextAreaElement).value;
        } else {
            const entry = data as MythrasInstance;
            createTextField('Instance Name', entry.instanceName, v => entry.instanceName = v);
            createTextField('Scenario', entry.scenario, v => entry.scenario = v);
            createTextField('Encounter', entry.encounter, v => entry.encounter = v);

            const imgWrap = formArea.createDiv('mythras-manager-form-group');
            imgWrap.createEl('label', { text: 'Image URL or Vault Path' });
            const imgInputContainer = imgWrap.createDiv('mythras-manager-input-group');
            const imgInput = imgInputContainer.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
            imgInput.value = entry.image || '';
            imgInput.placeholder = 'e.g. [[image.png]]';
            imgInput.onchange = (e) => entry.image = (e.target as HTMLInputElement).value;
            const btnBrowse = imgInputContainer.createEl('button', { text: 'Browse', cls: 'mythras-btn-secondary' });
            btnBrowse.onclick = () => {
                new ImageSuggestModal(options.app, (file) => {
                    const link = `[[${file.name}]]`;
                    imgInput.value = link;
                    entry.image = link;
                }).open();
            };

            const notesWrap = formArea.createDiv('mythras-manager-form-group mythras-span-full');
            notesWrap.createEl('label', { text: 'Notes' });
            const ta = notesWrap.createEl('textarea', { cls: 'mythras-manager-input mythras-w-full' });
            ta.value = entry.notes || '';
            ta.rows = 6;
            ta.onchange = (e) => entry.notes = (e.target as HTMLTextAreaElement).value;
        }
    } else if (options.activeTab === 'stats') {
        const renderDictionaryEditor = (container: HTMLElement, title: string, dict: { [key: string]: any }, readonlyKeys: boolean = false, type: 'text' | 'number' = 'text', isAttribute: boolean = false) => {
            if (!dict) return;
            const wrap = container.createDiv('mythras-manager-form-group');
            wrap.createEl('h3', { text: title });
            const listDiv = wrap.createDiv(mode === 'instance' ? 'mythras-grid-150' : 'mythras-manager-list');

            const redraw = () => {
                listDiv.empty();
                Object.keys(dict).forEach(key => {
                    const row = listDiv.createDiv(mode === 'instance' ? 'mythras-manager-form-group' : 'mythras-manager-list-row');

                    let kInput: HTMLInputElement | null = null;
                    
                    if (readonlyKeys) {
                        row.createEl(mode === 'instance' ? 'label' : 'span', { text: key, cls: mode === 'instance' ? '' : 'mythras-manager-label-fixed' });
                    } else {
                        kInput = row.createEl('input', { type: 'text' });
                        kInput.value = key;
                    }
                    
                    const vInput = row.createEl('input', { type: type, cls: 'mythras-manager-input' });
                    vInput.value = dict[key] !== undefined ? dict[key].toString() : '';

                    if (!readonlyKeys) {
                        const btnDel = row.createEl('button', { text: 'X', cls: 'mythras-btn-icon mythras-btn-danger' });
                        btnDel.onclick = () => {
                            delete dict[key];
                            redraw();
                        };
                    }

                    const update = () => {
                        if (!readonlyKeys && kInput && kInput.value !== key) {
                            delete dict[key];
                        }
                        const val = type === 'number' ? (parseInt(vInput.value) || 0) : vInput.value;

                        if (readonlyKeys) {
                            dict[key] = val;
                        } else if (kInput && kInput.value) {
                            dict[kInput.value] = val;
                        }

                        // Special recalculation for Damage Mod in instance mode
                        if (mode === 'instance' && key === 'Damage Mod') {
                            data.weapons.forEach((w: any) => {
                                const aw = options.armoryWeapons.find(a => a.name.toLowerCase() === w.name.toLowerCase());
                                if (aw && aw.damageModifier !== false) {
                                    let baseDmg = aw.damage;
                                    if (val && val !== '+0' && val !== '0') {
                                        const mod = (val as string).toString().startsWith('+') || (val as string).toString().startsWith('-') ? val : '+' + val;
                                        baseDmg += mod;
                                    }
                                    w.damage = baseDmg;
                                }
                            });
                        }
                    };
                    
                    if (kInput) kInput.onchange = update;
                    vInput.onchange = update;
                });

                if (!readonlyKeys) {
                    const btnAdd = listDiv.createEl('button', { text: '+ Add', cls: 'mythras-self-start' });
                    btnAdd.onclick = () => {
                        dict['NewKey'] = type === 'number' ? 0 : '0';
                        redraw();
                    };
                }
            };
            redraw();
        };

        if (mode === 'template') {
            renderDictionaryEditor(formArea, 'Core characteristics', data.stats, true, 'text');
            renderDictionaryEditor(formArea, 'Derived attributes', data.attributes, true, 'text');
        } else {
            const grid = formArea.createDiv('mythras-grid-180');
            renderDictionaryEditor(grid, 'Core characteristics', data.stats, true, 'number');
            renderDictionaryEditor(grid, 'Derived attributes', data.attributes, true, 'text', true);
        }
    } else if (options.activeTab === 'hitlocations') {
        if (mode === 'template') {
            const wrap = formArea.createDiv('mythras-manager-form-group');
            wrap.createEl('h3', { text: 'Hit locations' });
            const listDiv = wrap.createDiv('mythras-manager-list');
            
            const redraw = () => {
                listDiv.empty();
                data.hitLocations.forEach((hl: any, i: number) => {
                    const row = listDiv.createDiv('mythras-manager-list-row');

                    const iRange = row.createEl('input', { type: 'text', placeholder: 'D20', cls: 'mythras-manager-input' }); iRange.value = hl.range || '';
                    const iName = row.createEl('input', { type: 'text', placeholder: 'Name', cls: 'mythras-manager-input' }); iName.value = hl.name || '';
                    const iArmor = row.createEl('input', { type: 'text', placeholder: 'AP', cls: 'mythras-manager-input' }); iArmor.value = hl.armor || '';

                    const btnDel = row.createEl('button', { text: 'X', cls: 'mythras-btn-icon mythras-btn-danger' });
                    btnDel.onclick = () => { data.hitLocations.splice(i, 1); redraw(); };

                    const update = () => { hl.range = iRange.value; hl.name = iName.value; hl.armor = iArmor.value; };
                    iRange.onchange = update; iName.onchange = update; iArmor.onchange = update;
                });
                const btnAdd = listDiv.createEl('button', { text: '+ Add', cls: 'mythras-btn-secondary' });
                btnAdd.onclick = () => { data.hitLocations.push({ range: '1-3', name: 'Right Leg', armor: '0' }); redraw(); };
            };
            redraw();
        } else {
            const table = formArea.createEl('table', { cls: 'mythras-manager-table' });
            const thead = table.createEl('thead').createEl('tr');
            ['Location', 'Range', 'AP', 'Current HP', 'Max HP'].forEach(h => {
                thead.createEl('th', { text: h, cls: 'mythras-manager-th' });
            });
            const tbody = table.createEl('tbody');

            data.hitLocations.forEach((hl: any) => {
                const tr = tbody.createEl('tr', { cls: 'mythras-manager-tr' });
                tr.createEl('td', { text: hl.name, cls: 'mythras-manager-td' });
                tr.createEl('td', { text: hl.range, cls: 'mythras-manager-td' });
                
                const apTd = tr.createEl('td', { cls: 'mythras-manager-td' });
                const apInp = apTd.createEl('input', { type: 'text', cls: 'mythras-manager-input mythras-input-w60' });
                apInp.value = hl.ap;
                apInp.onchange = (e) => hl.ap = (e.target as HTMLInputElement).value;

                const currTd = tr.createEl('td', { cls: 'mythras-manager-td' });
                const currInp = currTd.createEl('input', { type: 'number', cls: 'mythras-manager-input mythras-input-w60' });
                currInp.value = hl.currentHp !== undefined ? hl.currentHp.toString() : '';
                currInp.onchange = (e) => hl.currentHp = parseInt((e.target as HTMLInputElement).value) || 0;

                const maxTd = tr.createEl('td', { cls: 'mythras-manager-td' });
                const maxInp = maxTd.createEl('input', { type: 'number', cls: 'mythras-manager-input mythras-input-w60' });
                maxInp.value = hl.hp !== undefined ? hl.hp.toString() : '';
                maxInp.onchange = (e) => hl.hp = parseInt((e.target as HTMLInputElement).value) || 0;
            });
        }
    } else if (options.activeTab === 'skills') {
        const inputType = mode === 'template' ? 'text' : 'number';

        const renderDict = (obj: any, label: string) => {
            if (!obj) return;
            const wrap = formArea.createDiv('mythras-manager-form-group');
            wrap.createEl('h3', { text: label });
            const listDiv = wrap.createDiv('mythras-manager-list');

            const redraw = () => {
                listDiv.empty();
                Object.keys(obj).forEach(key => {
                    const row = listDiv.createDiv('mythras-manager-list-row');
                    const kInput = row.createEl('input', { type: 'text' });
                    kInput.value = key;
                    const vInput = row.createEl('input', { type: inputType, cls: 'mythras-manager-input' });
                    vInput.value = obj[key] !== undefined ? obj[key].toString() : '';
                    
                    const btnDel = row.createEl('button', { text: 'X', cls: 'mythras-btn-icon mythras-btn-danger' });
                    btnDel.onclick = () => {
                        delete obj[key];
                        redraw();
                    };

                    const update = () => {
                        if (kInput.value !== key) {
                            delete obj[key];
                        }
                        if (kInput.value) {
                            obj[kInput.value] = inputType === 'number' ? (parseInt(vInput.value) || 0) : vInput.value;
                        }
                    };
                    kInput.onchange = update;
                    vInput.onchange = update;
                });

                const btnAdd = listDiv.createEl('button', { text: '+ Add', cls: 'mythras-btn-secondary mythras-self-start' });
                btnAdd.onclick = () => {
                    obj['New Skill'] = inputType === 'number' ? 0 : '0';
                    redraw();
                };
            };
            redraw();
        };

        if (!data.magicSkills) data.magicSkills = {};
        if (!data.professionalSkills) data.professionalSkills = {};

        renderDict(data.combatStyles, 'Combat Styles');
        renderDict(data.standardSkills, 'Standard Skills');
        renderDict(data.professionalSkills, 'Professional Skills');
        renderDict(data.magicSkills, 'Magic Skills');
        renderDict(data.customSkills, 'Custom Skills');

    } else if (options.activeTab === 'weapons') {
        const wrap = formArea.createDiv('mythras-manager-form-group');
        
        const listDiv = wrap.createDiv('mythras-manager-list');
        
        const redraw = () => {
            listDiv.empty();
            if (!data.weapons) data.weapons = [];
            data.weapons.forEach((w: any, i: number) => {
                const row = listDiv.createDiv('mythras-manager-list-item mythras-manager-card');

                const topBar = row.createDiv('mythras-manager-card-header');
                
                const modeDiv = topBar.createDiv('mythras-manager-header-controls');
                modeDiv.createEl('span', { text: 'Source: ' });
                const modeSelect = modeDiv.createEl('select', { cls: 'mythras-manager-input' });
                modeSelect.createEl('option', { value: 'natural', text: 'Natural (Custom)' });
                modeSelect.createEl('option', { value: 'armory', text: 'Armory' });
                
                const isArmory = options.armoryWeapons.some(aw => aw.name === w.name);
                let currentMode = isArmory ? 'armory' : 'natural';
                modeSelect.value = currentMode;

                const btnDel = topBar.createEl('button', { text: 'X', cls: 'mythras-btn-icon mythras-btn-danger' });
                btnDel.onclick = () => { data.weapons.splice(i, 1); redraw(); };

                const grid = row.createDiv('mythras-grid-200-gap10');

                const createField = (label: string, renderInput: (wrapper: HTMLElement) => void) => {
                    const fieldWrap = grid.createDiv('mythras-manager-field mythras-manager-form-group');
                    const lbl = fieldWrap.createEl('label', { text: label });
                    renderInput(fieldWrap);
                };

                const renderFields = () => {
                    grid.empty();

                    if (currentMode === 'armory') {
                        createField('Weapon', wrap => {
                            const sel = wrap.createEl('select', { cls: 'mythras-manager-input' });
                            let found = false;
                            options.armoryWeapons.forEach(aw => {
                                const opt = sel.createEl('option', { value: aw.name, text: aw.name });
                                if (aw.name === w.name) {
                                    opt.selected = true;
                                    found = true;
                                }
                            });
                            if (!found && !isArmory) {
                                sel.createEl('option', { value: w.name, text: `${w.name} (Custom)` }).selected = true;
                            }
                            sel.onchange = (e) => {
                                const selectedName = (e.target as HTMLSelectElement).value;
                                const armoryWeapon = options.armoryWeapons.find(aw => aw.name === selectedName);
                                if (armoryWeapon) {
                                    Object.assign(w, armoryWeapon);
                                    
                                    if (mode === 'instance') {
                                        let newDamage = armoryWeapon.damage;
                                        const damageMod = data.attributes['Damage Mod'] as string;
                                        if (newDamage && armoryWeapon.damageModifier !== false && damageMod && damageMod !== '+0' && damageMod !== '0') {
                                            const mod = damageMod.toString().startsWith('+') || damageMod.toString().startsWith('-') ? damageMod : '+' + damageMod;
                                            newDamage += mod;
                                        }
                                        w.damage = newDamage;
                                    } else {
                                        w.damage = undefined; w.size = undefined; w.reach = undefined; w.range = undefined;
                                    }
                                } else {
                                    w.name = selectedName;
                                    w.damage = undefined; w.size = undefined; w.reach = undefined; w.range = undefined;
                                }
                                redraw();
                            };
                            if (!options.armoryWeapons.some(aw => aw.name === w.name) && options.armoryWeapons.length > 0 && isArmory) {
                                w.name = options.armoryWeapons[0].name;
                                sel.value = w.name;
                            }
                        });
                    } else {
                        createField('Name', wrap => {
                            const inp = wrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                            inp.value = w.name || '';
                            inp.onchange = (e) => w.name = (e.target as HTMLInputElement).value;
                        });
                        createField('Type', wrap => {
                            const inp = wrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                            inp.value = w.type || '';
                            inp.onchange = (e) => w.type = (e.target as HTMLInputElement).value;
                        });
                        createField('Damage', wrap => {
                            const inp = wrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                            inp.value = w.damage || '';
                            inp.onchange = (e) => w.damage = (e.target as HTMLInputElement).value;
                        });
                        createField('Size', wrap => {
                            const inp = wrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                            inp.value = w.size || '';
                            inp.onchange = (e) => w.size = (e.target as HTMLInputElement).value;
                        });
                        createField('Reach/Range', wrap => {
                            const inp = wrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                            inp.value = w.reach || w.range || '';
                            inp.onchange = (e) => {
                                const val = (e.target as HTMLInputElement).value;
                                w.reach = val; w.range = val;
                            };
                        });
                    }

                    if (mode === 'template') {
                        createField('Probability', wrap => {
                            const inp = wrap.createEl('input', { type: 'number', cls: 'mythras-manager-input' });
                            inp.value = w.probability !== undefined ? w.probability.toString() : '';
                            inp.onchange = (e) => w.probability = parseFloat((e.target as HTMLInputElement).value);
                        });
                        createField('Amount', wrap => {
                            const inp = wrap.createEl('input', { type: 'text', placeholder: 'e.g. 1d3', cls: 'mythras-manager-input' });
                            inp.value = w.amountFormula || '';
                            inp.onchange = (e) => w.amountFormula = (e.target as HTMLInputElement).value;
                        });
                    } else {
                        createField('AP', wrap => {
                            const inp = wrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                            inp.value = (w.ap as string) || '';
                            inp.onchange = (e) => w.ap = (e.target as HTMLInputElement).value;
                        });
                        createField('HP', wrap => {
                            const inp = wrap.createEl('input', { type: 'text', cls: 'mythras-manager-input' });
                            inp.value = (w.hp as string) || '';
                            inp.onchange = (e) => w.hp = (e.target as HTMLInputElement).value;
                        });
                    }
                };

                modeSelect.onchange = (e) => {
                    currentMode = (e.target as HTMLSelectElement).value;
                    renderFields();
                };

                renderFields();
                
                if (mode === 'instance') {
                    const readWrap = row.createDiv('mythras-weapon-summary-text mythras-mt-10');
                    readWrap.setText(`Damage: ${w.damage || '-'} | Type: ${w.type || '-'} | Size/Force: ${w.size || '-'} | Reach/Range: ${w.reach || w.range || '-'} | Special: ${w.specialFx || 'None'}`);
                }
            });
            const btnAdd = listDiv.createEl('button', { text: '+ Add Weapon', cls: 'mod-cta mythras-btn-w200' });
            btnAdd.onclick = () => { 
                if (mode === 'instance') {
                    const defaultWeapon = options.armoryWeapons.length > 0 ? options.armoryWeapons[0] : { name: 'New Weapon' };
                    const newWeapon = JSON.parse(JSON.stringify(defaultWeapon));
                    newWeapon.isOptional = false;
                    data.weapons.push(newWeapon);
                } else {
                    data.weapons.push({ name: 'New Weapon' }); 
                }
                redraw(); 
            };
        };
        redraw();
    } else if (options.activeTab === 'features' && mode === 'template') {
        const wrap = formArea.createDiv('mythras-manager-form-group');
        wrap.createEl('h3', { text: 'Features' });
        const listDiv = wrap.createDiv('mythras-manager-list');
        
        const redraw = () => {
            listDiv.empty();
            if (!data.features) data.features = [];
            data.features.forEach((feat: any, i: number) => {
                const row = listDiv.createDiv('mythras-manager-list-row');

                const iName = row.createEl('input', { type: 'text', placeholder: 'Name', cls: 'mythras-manager-input' }); iName.value = feat.name || '';
                const iDesc = row.createEl('input', { type: 'text', placeholder: 'Description', cls: 'mythras-manager-input' }); iDesc.value = feat.description || '';

                const btnDel = row.createEl('button', { text: 'X', cls: 'mythras-btn-icon mythras-btn-danger' });
                btnDel.onclick = () => { data.features.splice(i, 1); redraw(); };

                const update = () => { feat.name = iName.value; feat.description = iDesc.value; };
                iName.onchange = update; iDesc.onchange = update;
            });
            const btnAdd = listDiv.createEl('button', { text: '+ Add', cls: 'mythras-btn-secondary' });
            btnAdd.onclick = () => { data.features.push({ name: 'New Feature', description: '' }); redraw(); };
        };
        redraw();
    }
}
