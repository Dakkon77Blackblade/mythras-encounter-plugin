import { App, Notice, TFile, FuzzySuggestModal, setIcon, normalizePath } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasTemplate, MythrasWeapon } from './mythras-api';
import { renderUnifiedEditor, EditorTab } from './editor-shared';

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
        const armoryPath = normalizePath(`${this.plugin.settings.baseFolder}/Armory/armory.json`);
        const file = this.app.vault.getAbstractFileByPath(armoryPath);
        if (file instanceof TFile) {
            try {
                const content = await this.app.vault.read(file);
                this.armoryWeapons = JSON.parse(content) as MythrasWeapon[];
            } catch (e) {}
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
                } catch (e) {}
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
        const container = this.containerEl.createDiv('bestiary-list-container mythras-manager-container');
        
        // Header / Controls
        const headerDiv = container.createDiv('bestiary-header-controls mythras-manager-header');

        const filterInput = headerDiv.createEl('input', { type: 'text', placeholder: 'Filter by tags...', cls: 'mythras-manager-input' });
        filterInput.value = this.tagFilter;
        filterInput.oninput = (e) => {
            this.tagFilter = (e.target as HTMLInputElement).value.toLowerCase();
            this.renderView();
        };

        // Table
        const table = container.createEl('table', { cls: 'bestiary-table mythras-manager-table' });

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
            const th = tr.createEl('th', { text: h.label, cls: 'mythras-manager-th' });
            if (h.sortable) {
                th.addClass('sortable');
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
            const row = tbody.createEl('tr', { cls: 'mythras-manager-tr' });
            row.onclick = () => {
                this.selectedEntry = entry;
                this.currentView = 'detail';
                this.renderView();
            };

            const tdImage = row.createEl('td', { cls: 'mythras-manager-td' });
        const resolvedUrl = entry.template.image ? this.resolveImagePath(entry.template.image) : null;
        if (resolvedUrl) {
            const img = tdImage.createEl('img', { cls: 'mythras-manager-avatar' });
            img.src = resolvedUrl;
        } else {
            const dummy = tdImage.createDiv('mythras-manager-avatar dummy');
            setIcon(dummy, 'image');
        }

            row.createEl('td', { text: entry.template.name, cls: 'mythras-manager-td' });
            row.createEl('td', { text: entry.template.author || '-', cls: 'mythras-manager-td' });
            row.createEl('td', { text: entry.template.rank || '-', cls: 'mythras-manager-td' });
            
            const mtime = new Date(entry.file.stat.mtime);
            row.createEl('td', { text: mtime.toLocaleString(), cls: 'mythras-manager-td' });
        }
    }

    renderDetailView() {
        if (!this.selectedEntry) return;
        const entry = this.selectedEntry.template;

        const container = this.containerEl.createDiv('bestiary-detail-container mythras-manager-container');
        
        const buttonDiv = container.createDiv('bestiary-detail-buttons mythras-manager-actions');

        const btnBack = buttonDiv.createEl('button', { text: 'Back to List', cls: 'mythras-btn-secondary' });
        btnBack.onclick = () => {
            this.currentView = 'list';
            this.renderView();
        };

        const btnEdit = buttonDiv.createEl('button', { text: 'Edit Template', cls: 'mythras-btn-primary' });
        btnEdit.onclick = () => {
            this.currentView = 'edit';
            this.renderView();
        };

        const header = container.createDiv('bestiary-detail-header mythras-detail-header');

        const resolvedUrl = entry.image ? this.resolveImagePath(entry.image) : null;
        if (resolvedUrl) {
            const img = header.createEl('img', { cls: 'mythras-detail-avatar' });
            img.src = resolvedUrl;
        } else {
            const dummy = header.createDiv('mythras-detail-avatar dummy');
            setIcon(dummy, 'image');
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

        const grid = container.createDiv('mythras-manager-grid');

        const createCard = (title: string, data: { [key: string]: string }, isSkills: boolean = false) => {
            if (!data || Object.keys(data).length === 0) return;
            const card = grid.createDiv('mythras-manager-card');
            card.createEl('h4', { text: title });
            const list = card.createDiv(isSkills ? 'mythras-manager-list mythras-skills-pills' : 'mythras-detail-list');
            Object.entries(data).forEach(([k, v]) => {
                if (isSkills) {
                    list.createEl('span', { text: `${k} ${v}`, cls: 'mythras-rollable-pill' });
                } else {
                    list.createEl('div', { text: `${k}: ${v}` });
                }
            });
        };

        createCard('Stats', entry.stats || {});
        createCard('Attributes', entry.attributes || {});
        createCard('Standard Skills', entry.standardSkills || {}, true);
        createCard('Professional Skills', entry.professionalSkills || {}, true);
        createCard('Magic Skills', entry.magicSkills || {}, true);
        createCard('Custom Skills', entry.customSkills || {}, true);
        createCard('Combat Styles', entry.combatStyles || {}, true);

        const weaponsCard = container.createDiv('mythras-manager-card mythras-mt-15');
        weaponsCard.createEl('h4', { text: 'Weapons' });
        if (entry.weapons && entry.weapons.length > 0) {
            const ul = weaponsCard.createEl('ul');
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
            weaponsCard.createEl('p', { text: 'No weapons' });
        }
    }

    editTemplate: MythrasTemplate | null = null;
    editTab: EditorTab = 'general';

    renderEditView() {
        if (!this.selectedEntry) return;
        
        if (!this.editTemplate) {
            this.editTemplate = JSON.parse(JSON.stringify(this.selectedEntry.template));
        }
        
        const entry = this.editTemplate!;
        const container = this.containerEl.createDiv('bestiary-edit-container');

        const buttonDiv = container.createDiv('bestiary-edit-buttons mythras-manager-actions');

        const btnCancel = buttonDiv.createEl('button', { text: 'Cancel', cls: 'mythras-btn-secondary' });
        btnCancel.onclick = () => {
            this.editTemplate = null; 
            this.currentView = 'detail';
            this.renderView();
        };

        const btnSave = buttonDiv.createEl('button', { text: 'Save', cls: 'mythras-btn-primary' });
        btnSave.onclick = async () => {
            await this.saveEditedTemplate();
        };

        const form = container.createDiv('bestiary-form mythras-manager-form mythras-manager-form-scrollable');

        renderUnifiedEditor(form, 'template', entry, {
            app: this.app,
            plugin: this.plugin,
            activeTab: this.editTab,
            onTabChange: (tab) => { this.editTab = tab; this.renderView(); },
            armoryWeapons: this.armoryWeapons
        });
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
        sanitizeObj(tpl.magicSkills);
        sanitizeObj(tpl.professionalSkills);
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

        const folderPath = normalizePath(`${this.plugin.settings.baseFolder}/Bestiary`);
        const safeName = this.editTemplate.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${safeName}_by_local.json`;
        const newFilePath = normalizePath(`${folderPath}/${fileName}`);
        const oldFilePath = this.selectedEntry.file.path;

        const content = JSON.stringify(this.editTemplate, null, 4);

        try {
            const oldFile = this.app.vault.getAbstractFileByPath(oldFilePath);
            if (oldFilePath !== newFilePath && oldFile instanceof TFile) {
                await this.app.vault.trash(this.selectedEntry.file, true);
            }

            const existingFile = this.app.vault.getAbstractFileByPath(newFilePath);
            if (existingFile instanceof TFile) {
                await this.app.vault.modify(existingFile, content);
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
            new Notice('Failed to save template.');
        }
    }
}
