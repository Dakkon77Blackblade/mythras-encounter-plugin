import { App, Notice, TFile, FuzzySuggestModal } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasTemplate, MythrasWeapon } from './mythras-api';

export interface BestiaryEntry {
    template: MythrasTemplate;
    file: TFile;
}

export class ImageSuggestModal extends FuzzySuggestModal<TFile> {
    onChooseCallback: (file: TFile) => void;

    constructor(app: App, onChooseCallback: (file: TFile) => void) {
        super(app);
        this.onChooseCallback = onChooseCallback;
        this.setPlaceholder("Search for an image in your vault...");
    }

    getItems(): TFile[] {
        return this.app.vault.getFiles().filter(f => 
            ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(f.extension.toLowerCase())
        );
    }

    getItemText(item: TFile): string {
        return item.path;
    }

    onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onChooseCallback(item);
    }
}

export class BestiaryManagerUI {
    app: App;
    plugin: MythrasEncounterPlugin;
    containerEl: HTMLElement;
    entries: BestiaryEntry[] = [];
    armoryWeapons: MythrasWeapon[] = [];
    currentView: 'list' | 'detail' | 'edit' = 'list';
    selectedEntry: BestiaryEntry | null = null;
    sortField: 'name' | 'author' | 'rank' | 'mtime' = 'name';
    sortAscending: boolean = true;
    tagFilter: string = '';

    constructor(app: App, plugin: MythrasEncounterPlugin, containerEl: HTMLElement) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = containerEl;
    }

    async render() {
        await this.loadEntries();
        await this.loadArmory();
        this.renderView();
    }

    async loadArmory() {
        const armoryPath = `${this.plugin.settings.baseFolder}/Armory/armory.json`;
        if (await this.app.vault.adapter.exists(armoryPath)) {
            const file = this.app.vault.getAbstractFileByPath(armoryPath);
            if (file instanceof TFile) {
                try {
                    const content = await this.app.vault.read(file);
                    this.armoryWeapons = JSON.parse(content) as MythrasWeapon[];
                } catch (e) {
                    console.error("Failed to parse armory.json", e);
                }
            }
        }
    }

    async loadEntries() {
        const folderPath = `${this.plugin.settings.baseFolder}/Bestiary`;
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        this.entries = [];

        if (folder && 'children' in folder) {
            // @ts-ignore
            const files = folder.children.filter(f => f instanceof TFile && f.extension === 'json') as TFile[];
            for (const file of files) {
                try {
                    const content = await this.app.vault.read(file);
                    const template: MythrasTemplate = JSON.parse(content);
                    this.entries.push({ template, file });
                } catch (e) {
                    console.error(`Failed to parse bestiary file ${file.path}`, e);
                }
            }
        }
    }

    resolveImagePath(imgPath: string): string {
        if (!imgPath) return '';
        if (imgPath.startsWith('http') || imgPath.startsWith('data:')) return imgPath;
        const file = this.app.metadataCache.getFirstLinkpathDest(imgPath, '');
        if (file) {
            return this.app.vault.getResourcePath(file);
        }
        return ''; // If cannot resolve
    }

    renderView() {
        this.containerEl.empty();
        if (this.currentView === 'list') {
            this.renderListView();
        } else if (this.currentView === 'detail' && this.selectedEntry) {
            this.renderDetailView();
        } else if (this.currentView === 'edit' && this.selectedEntry) {
            this.renderEditView();
        }
    }

    renderListView() {
        const container = this.containerEl.createDiv('bestiary-list-container');
        
        // Header / Controls
        const headerDiv = container.createDiv('bestiary-header-controls');
        headerDiv.style.display = 'flex';
        headerDiv.style.justifyContent = 'space-between';
        headerDiv.style.alignItems = 'center';
        headerDiv.style.marginBottom = '15px';

        const filterInput = headerDiv.createEl('input', { type: 'text', placeholder: 'Filter by tags...' });
        filterInput.value = this.tagFilter;
        filterInput.oninput = (e) => {
            this.tagFilter = (e.target as HTMLInputElement).value.toLowerCase();
            this.renderView();
        };

        // Table
        const table = container.createEl('table', { cls: 'bestiary-table' });
        table.style.width = '100%';
        table.style.textAlign = 'left';
        table.style.borderCollapse = 'collapse';

        const thead = table.createEl('thead');
        const tr = thead.createEl('tr');
        
        const headers = [
            { id: 'image', label: 'Image', sortable: false },
            { id: 'name', label: 'Name', sortable: true },
            { id: 'author', label: 'Author', sortable: true },
            { id: 'rank', label: 'Rank', sortable: true },
            { id: 'mtime', label: 'Last Modified', sortable: true },
        ];

        headers.forEach(h => {
            const th = tr.createEl('th', { text: h.label });
            th.style.padding = '8px';
            th.style.borderBottom = '1px solid var(--background-modifier-border)';
            if (h.sortable) {
                th.style.cursor = 'pointer';
                if (this.sortField === h.id) {
                    th.setText(`${h.label} ${this.sortAscending ? '▲' : '▼'}`);
                }
                th.onclick = () => {
                    if (this.sortField === h.id) {
                        this.sortAscending = !this.sortAscending;
                    } else {
                        this.sortField = h.id as any;
                        this.sortAscending = true;
                    }
                    this.renderView();
                };
            }
        });

        const tbody = table.createEl('tbody');

        const tagsToFilter = this.tagFilter.split(',').map(t => t.trim()).filter(t => t.length > 0);
        let displayEntries = this.entries.filter(e => {
            if (tagsToFilter.length === 0) return true;
            return tagsToFilter.every(tag => e.template.tags.some(t => t.toLowerCase().includes(tag)));
        });

        displayEntries.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            if (this.sortField === 'name') {
                valA = a.template.name.toLowerCase();
                valB = b.template.name.toLowerCase();
            } else if (this.sortField === 'author') {
                valA = (a.template.author || '').toLowerCase();
                valB = (b.template.author || '').toLowerCase();
            } else if (this.sortField === 'rank') {
                valA = (a.template.rank || '').toLowerCase();
                valB = (b.template.rank || '').toLowerCase();
            } else if (this.sortField === 'mtime') {
                valA = a.file.stat.mtime;
                valB = b.file.stat.mtime;
            }

            if (valA < valB) return this.sortAscending ? -1 : 1;
            if (valA > valB) return this.sortAscending ? 1 : -1;
            return 0;
        });

        for (const entry of displayEntries) {
            const row = tbody.createEl('tr');
            row.style.cursor = 'pointer';
            row.style.borderBottom = '1px solid var(--background-modifier-border-alt)';
            row.onmouseenter = () => row.style.backgroundColor = 'var(--background-modifier-hover)';
            row.onmouseleave = () => row.style.backgroundColor = 'transparent';
            row.onclick = () => {
                this.selectedEntry = entry;
                this.currentView = 'detail';
                this.renderView();
            };

            const tdImage = row.createEl('td');
            tdImage.style.padding = '8px';
            if (entry.template.image) {
                const resolvedUrl = this.resolveImagePath(entry.template.image);
                if (resolvedUrl) {
                    const img = tdImage.createEl('img');
                    img.src = resolvedUrl;
                    img.style.maxWidth = '40px';
                    img.style.maxHeight = '40px';
                    img.style.borderRadius = '4px';
                    img.style.objectFit = 'cover';
                }
            }

            row.createEl('td', { text: entry.template.name }).style.padding = '8px';
            row.createEl('td', { text: entry.template.author || '-' }).style.padding = '8px';
            row.createEl('td', { text: entry.template.rank || '-' }).style.padding = '8px';
            
            const mtime = new Date(entry.file.stat.mtime);
            row.createEl('td', { text: mtime.toLocaleString() }).style.padding = '8px';
        }
    }

    renderDetailView() {
        if (!this.selectedEntry) return;
        const entry = this.selectedEntry.template;

        const container = this.containerEl.createDiv('bestiary-detail-container');
        
        const buttonDiv = container.createDiv('bestiary-detail-buttons');
        buttonDiv.style.display = 'flex';
        buttonDiv.style.gap = '10px';
        buttonDiv.style.marginBottom = '20px';

        const btnBack = buttonDiv.createEl('button', { text: 'Back to List' });
        btnBack.onclick = () => {
            this.currentView = 'list';
            this.renderView();
        };

        const btnEdit = buttonDiv.createEl('button', { text: 'Edit', cls: 'mod-cta' });
        btnEdit.onclick = () => {
            this.currentView = 'edit';
            this.renderView();
        };

        const header = container.createDiv('bestiary-detail-header');
        header.style.display = 'flex';
        header.style.gap = '20px';
        header.style.marginBottom = '20px';

        if (entry.image) {
            const resolvedUrl = this.resolveImagePath(entry.image);
            if (resolvedUrl) {
                const img = header.createEl('img');
                img.src = resolvedUrl;
                img.style.maxWidth = '150px';
                img.style.maxHeight = '150px';
                img.style.borderRadius = '8px';
                img.style.objectFit = 'cover';
            }
        }

        const infoDiv = header.createDiv();
        infoDiv.createEl('h2', { text: entry.name, cls: 'mythras-title' });
        infoDiv.createEl('p', { text: `Rank: ${entry.rank || '-'} | Race: ${entry.race || '-'} | Author: ${entry.author || '-'}` });
        if (entry.tags && entry.tags.length > 0) {
            infoDiv.createEl('p', { text: `Tags: ${entry.tags.join(', ')}` });
        }
        if (entry.notes) {
            infoDiv.createEl('p', { text: `Notes: ${entry.notes}` });
        }

        const grid = container.createDiv();
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gap = '20px';

        const statsDiv = grid.createDiv();
        statsDiv.createEl('h3', { text: 'Stats & Attributes' });
        const statsStr = Object.entries(entry.stats || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
        const attrsStr = Object.entries(entry.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
        statsDiv.createEl('p', { text: `Stats: ${statsStr}` });
        statsDiv.createEl('p', { text: `Attributes: ${attrsStr}` });

        const skillsDiv = grid.createDiv();
        skillsDiv.createEl('h3', { text: 'Skills' });
        const stdSkills = Object.entries(entry.standardSkills || {}).map(([k, v]) => `${k} ${v}`).join(', ');
        const cstSkills = Object.entries(entry.customSkills || {}).map(([k, v]) => `${k} ${v}`).join(', ');
        const cbtStyles = Object.entries(entry.combatStyles || {}).map(([k, v]) => `${k} ${v}`).join(', ');
        skillsDiv.createEl('p', { text: `Standard: ${stdSkills}` });
        skillsDiv.createEl('p', { text: `Custom: ${cstSkills}` });
        skillsDiv.createEl('p', { text: `Combat: ${cbtStyles}` });

        const weaponsDiv = container.createDiv();
        weaponsDiv.style.marginTop = '20px';
        weaponsDiv.createEl('h3', { text: 'Weapons' });
        if (entry.weapons && entry.weapons.length > 0) {
            const ul = weaponsDiv.createEl('ul');
            entry.weapons.forEach(w => {
                const parts = [
                    w.damage ? `Damage ${w.damage}` : null,
                    w.size ? `Size ${w.size}` : null,
                    w.reach ? `Reach ${w.reach}` : null,
                    w.range ? `Range ${w.range}` : null,
                    w.specialFx ? `Special ${w.specialFx}` : null
                ].filter(Boolean).join(', ');
                ul.createEl('li', { text: `${w.name} (${w.type || '-'}) - ${parts}` });
            });
        } else {
            weaponsDiv.createEl('p', { text: 'No weapons' });
        }
    }

    editTemplate: MythrasTemplate | null = null;

    renderEditView() {
        if (!this.selectedEntry) return;
        
        if (!this.editTemplate) {
            this.editTemplate = JSON.parse(JSON.stringify(this.selectedEntry.template));
        }
        
        const entry = this.editTemplate!;
        const container = this.containerEl.createDiv('bestiary-edit-container');

        const buttonDiv = container.createDiv('bestiary-edit-buttons');
        buttonDiv.style.display = 'flex';
        buttonDiv.style.gap = '10px';
        buttonDiv.style.marginBottom = '20px';

        const btnCancel = buttonDiv.createEl('button', { text: 'Cancel' });
        btnCancel.onclick = () => {
            this.editTemplate = null; 
            this.currentView = 'detail';
            this.renderView();
        };

        const btnSave = buttonDiv.createEl('button', { text: 'Save', cls: 'mod-cta' });
        btnSave.onclick = async () => {
            await this.saveEditedTemplate();
        };

        const form = container.createDiv('bestiary-form');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';

        const createTextField = (label: string, value: string, onChange: (v: string) => void) => {
            const wrap = form.createDiv();
            wrap.createEl('label', { text: label }).style.display = 'block';
            const input = wrap.createEl('input', { type: 'text' });
            input.value = value || '';
            input.style.width = '100%';
            input.onchange = (e) => onChange((e.target as HTMLInputElement).value);
        };

        createTextField('Name', entry.name, v => entry.name = v);
        
        const imgWrap = form.createDiv();
        imgWrap.createEl('label', { text: 'Image URL or Vault Path' }).style.display = 'block';
        const imgInputContainer = imgWrap.createDiv();
        imgInputContainer.style.display = 'flex';
        imgInputContainer.style.gap = '10px';
        const imgInput = imgInputContainer.createEl('input', { type: 'text' });
        imgInput.value = entry.image || '';
        imgInput.style.flexGrow = '1';
        imgInput.onchange = (e) => entry.image = (e.target as HTMLInputElement).value;
        const btnBrowse = imgInputContainer.createEl('button', { text: 'Browse' });
        btnBrowse.onclick = () => {
            new ImageSuggestModal(this.app, (file: TFile) => {
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

        const notesWrap = form.createDiv();
        notesWrap.createEl('label', { text: 'Notes' }).style.display = 'block';
        const notesInput = notesWrap.createEl('textarea');
        notesInput.value = entry.notes || '';
        notesInput.style.width = '100%';
        notesInput.rows = 4;
        notesInput.onchange = (e) => entry.notes = (e.target as HTMLTextAreaElement).value;

        this.renderDictionaryEditor(form, 'Stats', entry.stats, true);
        this.renderDictionaryEditor(form, 'Attributes', entry.attributes, true);
        this.renderDictionaryEditor(form, 'Standard Skills', entry.standardSkills, false);
        this.renderDictionaryEditor(form, 'Custom Skills', entry.customSkills, false);
        this.renderDictionaryEditor(form, 'Combat Styles', entry.combatStyles, false);

        this.renderHitLocationsEditor(form, entry.hitLocations);
        this.renderFeaturesEditor(form, entry.features);
        this.renderWeaponsEditor(form, entry.weapons);
    }

    renderDictionaryEditor(container: HTMLElement, title: string, dict: { [key: string]: string }, readonlyKeys: boolean = false) {
        const wrap = container.createDiv();
        wrap.createEl('h3', { text: title });
        const listDiv = wrap.createDiv();
        listDiv.style.display = 'flex';
        listDiv.style.flexDirection = 'column';
        listDiv.style.gap = '5px';

        const redraw = () => {
            listDiv.empty();
            Object.keys(dict).forEach(key => {
                const row = listDiv.createDiv();
                row.style.display = 'flex';
                row.style.gap = '10px';
                row.style.alignItems = 'center';

                let kInput: HTMLInputElement | null = null;
                
                if (readonlyKeys) {
                    const kLabel = row.createEl('span', { text: key });
                    kLabel.style.width = '100px';
                    kLabel.style.fontWeight = 'bold';
                } else {
                    kInput = row.createEl('input', { type: 'text' });
                    kInput.value = key;
                }
                
                const vInput = row.createEl('input', { type: 'text' });
                vInput.value = dict[key];

                if (!readonlyKeys) {
                    const btnDel = row.createEl('button', { text: 'X' });
                    btnDel.onclick = () => {
                        delete dict[key];
                        redraw();
                    };
                }

                const update = () => {
                    if (!readonlyKeys && kInput && kInput.value !== key) {
                        delete dict[key];
                    }
                    if (readonlyKeys) {
                        dict[key] = vInput.value;
                    } else if (kInput && kInput.value) {
                        dict[kInput.value] = vInput.value;
                    }
                };
                
                if (kInput) kInput.onchange = update;
                vInput.onchange = update;
            });

            if (!readonlyKeys) {
                const btnAdd = listDiv.createEl('button', { text: '+ Add' });
                btnAdd.style.alignSelf = 'flex-start';
                btnAdd.onclick = () => {
                    dict['NewKey'] = '0';
                    redraw();
                };
            }
        };
        redraw();
    }

    renderHitLocationsEditor(container: HTMLElement, list: any[]) {
        const wrap = container.createDiv();
        wrap.createEl('h3', { text: 'Hit Locations' });
        const listDiv = wrap.createDiv();
        
        const redraw = () => {
            listDiv.empty();
            list.forEach((hl, i) => {
                const row = listDiv.createDiv();
                row.style.display = 'flex';
                row.style.gap = '5px';
                row.style.marginBottom = '5px';

                const iRange = row.createEl('input', { type: 'text', placeholder: 'D20' }); iRange.value = hl.range || '';
                const iName = row.createEl('input', { type: 'text', placeholder: 'Name' }); iName.value = hl.name || '';
                const iArmor = row.createEl('input', { type: 'text', placeholder: 'AP' }); iArmor.value = hl.armor || '';

                const btnDel = row.createEl('button', { text: 'X' });
                btnDel.onclick = () => { list.splice(i, 1); redraw(); };

                const update = () => { hl.range = iRange.value; hl.name = iName.value; hl.armor = iArmor.value; };
                iRange.onchange = update; iName.onchange = update; iArmor.onchange = update;
            });
            const btnAdd = listDiv.createEl('button', { text: '+ Add' });
            btnAdd.onclick = () => { list.push({ range: '1-3', name: 'Right Leg', armor: '0' }); redraw(); };
        };
        redraw();
    }

    renderFeaturesEditor(container: HTMLElement, list: any[]) {
        const wrap = container.createDiv();
        wrap.createEl('h3', { text: 'Features' });
        const listDiv = wrap.createDiv();
        
        const redraw = () => {
            listDiv.empty();
            list.forEach((feat, i) => {
                const row = listDiv.createDiv();
                row.style.display = 'flex';
                row.style.gap = '5px';
                row.style.marginBottom = '5px';

                const iName = row.createEl('input', { type: 'text', placeholder: 'Name' }); iName.value = feat.name || '';
                const iDesc = row.createEl('input', { type: 'text', placeholder: 'Description' }); iDesc.value = feat.description || '';

                const btnDel = row.createEl('button', { text: 'X' });
                btnDel.onclick = () => { list.splice(i, 1); redraw(); };

                const update = () => { feat.name = iName.value; feat.description = iDesc.value; };
                iName.onchange = update; iDesc.onchange = update;
            });
            const btnAdd = listDiv.createEl('button', { text: '+ Add' });
            btnAdd.onclick = () => { list.push({ name: 'New Feature', description: '' }); redraw(); };
        };
        redraw();
    }

    renderWeaponsEditor(container: HTMLElement, list: any[]) {
        const wrap = container.createDiv();
        wrap.createEl('h3', { text: 'Weapons' });
        const listDiv = wrap.createDiv();
        
        const redraw = () => {
            listDiv.empty();
            list.forEach((w, i) => {
                const row = listDiv.createDiv();
                row.style.display = 'flex';
                row.style.flexDirection = 'column';
                row.style.gap = '5px';
                row.style.marginBottom = '15px';
                row.style.border = '1px solid var(--background-modifier-border)';
                row.style.padding = '10px';
                row.style.borderRadius = '4px';

                const topBar = row.createDiv();
                topBar.style.display = 'flex';
                topBar.style.justifyContent = 'space-between';
                
                const modeDiv = topBar.createDiv();
                modeDiv.createEl('span', { text: 'Source: ' });
                const modeSelect = modeDiv.createEl('select');
                modeSelect.createEl('option', { value: 'natural', text: 'Natural (Custom)' });
                modeSelect.createEl('option', { value: 'armory', text: 'Armory' });
                
                const isArmory = this.armoryWeapons.some(aw => aw.name === w.name);
                let currentMode = isArmory ? 'armory' : 'natural';
                modeSelect.value = currentMode;

                const btnDel = topBar.createEl('button', { text: 'X' });
                btnDel.onclick = () => { list.splice(i, 1); redraw(); };

                const grid = row.createDiv();
                grid.style.display = 'flex';
                grid.style.flexWrap = 'wrap';
                grid.style.gap = '10px';
                grid.style.marginTop = '10px';

                const createField = (label: string, renderInput: (wrapper: HTMLElement) => void) => {
                    const fieldWrap = grid.createDiv();
                    fieldWrap.style.display = 'flex';
                    fieldWrap.style.flexDirection = 'column';
                    fieldWrap.style.width = '120px';
                    const lbl = fieldWrap.createEl('label', { text: label });
                    lbl.style.fontSize = '0.8em';
                    lbl.style.color = 'var(--text-muted)';
                    renderInput(fieldWrap);
                };

                const renderFields = () => {
                    grid.empty();

                    if (currentMode === 'armory') {
                        createField('Weapon', wrap => {
                            const sel = wrap.createEl('select');
                            sel.style.width = '100%';
                            this.armoryWeapons.forEach(aw => {
                                const opt = sel.createEl('option', { value: aw.name, text: aw.name });
                                if (aw.name === w.name) opt.selected = true;
                            });
                            sel.onchange = (e) => {
                                w.name = (e.target as HTMLSelectElement).value;
                                w.damage = undefined; w.size = undefined; w.reach = undefined; w.range = undefined;
                            };
                            if (!this.armoryWeapons.some(aw => aw.name === w.name) && this.armoryWeapons.length > 0) {
                                w.name = this.armoryWeapons[0].name;
                                sel.value = w.name;
                            }
                        });
                    } else {
                        createField('Name', wrap => {
                            const inp = wrap.createEl('input', { type: 'text' });
                            inp.value = w.name || '';
                            inp.style.width = '100%';
                            inp.onchange = (e) => w.name = (e.target as HTMLInputElement).value;
                        });
                        createField('Type', wrap => {
                            const inp = wrap.createEl('input', { type: 'text' });
                            inp.value = w.type || '';
                            inp.style.width = '100%';
                            inp.onchange = (e) => w.type = (e.target as HTMLInputElement).value;
                        });
                        createField('Damage', wrap => {
                            const inp = wrap.createEl('input', { type: 'text' });
                            inp.value = w.damage || '';
                            inp.style.width = '100%';
                            inp.onchange = (e) => w.damage = (e.target as HTMLInputElement).value;
                        });
                        createField('Size', wrap => {
                            const inp = wrap.createEl('input', { type: 'text' });
                            inp.value = w.size || '';
                            inp.style.width = '100%';
                            inp.onchange = (e) => w.size = (e.target as HTMLInputElement).value;
                        });
                        createField('Reach/Range', wrap => {
                            const inp = wrap.createEl('input', { type: 'text' });
                            inp.value = w.reach || w.range || '';
                            inp.style.width = '100%';
                            inp.onchange = (e) => {
                                const val = (e.target as HTMLInputElement).value;
                                w.reach = val; w.range = val;
                            };
                        });
                    }

                    createField('Probability', wrap => {
                        const inp = wrap.createEl('input', { type: 'number', cls: 'prob-input' });
                        inp.value = w.probability !== undefined ? w.probability.toString() : '';
                        inp.style.width = '100%';
                        inp.onchange = (e) => w.probability = parseFloat((e.target as HTMLInputElement).value);
                    });
                    createField('Amount', wrap => {
                        const inp = wrap.createEl('input', { type: 'text', placeholder: 'e.g. 1d3' });
                        inp.value = w.amountFormula || '';
                        inp.style.width = '100%';
                        inp.onchange = (e) => w.amountFormula = (e.target as HTMLInputElement).value;
                    });
                };

                modeSelect.onchange = (e) => {
                    currentMode = (e.target as HTMLSelectElement).value;
                    renderFields();
                };

                renderFields();
            });
            const btnAdd = listDiv.createEl('button', { text: '+ Add Weapon' });
            btnAdd.onclick = () => { list.push({ name: 'New Weapon' }); redraw(); };
        };
        redraw();
    }

    sanitizeString(str: string): string {
        if (!str) return str;
        return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    sanitizeTemplate(tpl: MythrasTemplate) {
        tpl.name = this.sanitizeString(tpl.name);
        tpl.author = this.sanitizeString(tpl.author);
        tpl.race = this.sanitizeString(tpl.race);
        tpl.rank = this.sanitizeString(tpl.rank);
        tpl.cultRank = this.sanitizeString(tpl.cultRank);
        tpl.notes = this.sanitizeString(tpl.notes);
        tpl.image = this.sanitizeString(tpl.image);
        if (tpl.tags) tpl.tags = tpl.tags.map(t => this.sanitizeString(t));
        
        const sanitizeObj = (obj: any) => {
            if (obj) {
                Object.keys(obj).forEach(k => {
                    const newK = this.sanitizeString(k);
                    const v = this.sanitizeString(obj[k]);
                    if (newK !== k) {
                        delete obj[k];
                    }
                    obj[newK] = v;
                });
            }
        };
        sanitizeObj(tpl.stats);
        sanitizeObj(tpl.attributes);
        sanitizeObj(tpl.standardSkills);
        sanitizeObj(tpl.customSkills);
        sanitizeObj(tpl.combatStyles);

        if (tpl.hitLocations) {
            tpl.hitLocations.forEach(hl => {
                hl.name = this.sanitizeString(hl.name);
                hl.range = this.sanitizeString(hl.range);
                hl.armor = this.sanitizeString(hl.armor);
            });
        }
        if (tpl.features) {
            tpl.features.forEach(f => {
                f.name = this.sanitizeString(f.name);
                f.description = this.sanitizeString(f.description);
            });
        }
        if (tpl.weapons) {
            tpl.weapons.forEach(w => {
                w.name = this.sanitizeString(w.name);
                w.damage = this.sanitizeString(w.damage!);
                w.type = this.sanitizeString(w.type!);
                w.size = this.sanitizeString(w.size!);
                w.reach = this.sanitizeString(w.reach!);
                w.range = this.sanitizeString(w.range!);
                w.specialFx = this.sanitizeString(w.specialFx!);
                if (w.amountFormula) w.amountFormula = this.sanitizeString(w.amountFormula);
            });
        }
    }

    async saveEditedTemplate() {
        if (!this.editTemplate || !this.selectedEntry) return;

        this.editTemplate.author = 'local';
        this.sanitizeTemplate(this.editTemplate);

        const folderPath = `${this.plugin.settings.baseFolder}/Bestiary`;
        const safeName = this.editTemplate.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${safeName}_by_local.json`;
        const newFilePath = `${folderPath}/${fileName}`;
        const oldFilePath = this.selectedEntry.file.path;

        const content = JSON.stringify(this.editTemplate, null, 4);

        try {
            if (oldFilePath !== newFilePath && await this.app.vault.adapter.exists(oldFilePath)) {
                await this.app.vault.trash(this.selectedEntry.file, true);
            }

            if (await this.app.vault.adapter.exists(newFilePath)) {
                const f = this.app.vault.getAbstractFileByPath(newFilePath);
                if (f instanceof TFile) await this.app.vault.modify(f, content);
            } else {
                await this.app.vault.create(newFilePath, content);
            }

            new Notice(`Saved ${this.editTemplate.name} successfully!`);
            
            this.editTemplate = null;
            await this.loadEntries();
            
            this.selectedEntry = this.entries.find(e => e.file.path === newFilePath) || null;
            this.currentView = 'detail';
            this.renderView();

        } catch (e) {
            console.error('Failed to save template', e);
            new Notice('Failed to save template.');
        }
    }
}
