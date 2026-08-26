import { Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile, App } from 'obsidian';
import MythrasEncounterPlugin from './main';
import { MythrasWeapon } from './mythras-api';

export class ItemSuggester extends EditorSuggest<MythrasWeapon> {
    plugin: MythrasEncounterPlugin;

    constructor(app: App, plugin: MythrasEncounterPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
        const line = editor.getLine(cursor.line);
        const textBeforeCursor = line.substring(0, cursor.ch);

        // Check for inline syntax: `item: 
        const inlineMatch = textBeforeCursor.match(/`item:\s*(.*)$/i);
        if (inlineMatch) {
            return {
                start: { line: cursor.line, ch: textBeforeCursor.lastIndexOf(inlineMatch[1]) },
                end: cursor,
                query: inlineMatch[1]
            };
        }

        // Check for block syntax. We need to look back a few lines to see if we are inside a ```item block.
        // For simplicity, just checking if the line is not starting with ``` and we are inside a block.
        let inItemBlock = false;
        for (let i = cursor.line; i >= 0; i--) {
            const l = editor.getLine(i);
            if (l.startsWith('```item')) {
                inItemBlock = true;
                break;
            } else if (l.startsWith('```') && i !== cursor.line) {
                // Another block started/ended, so we are not in an item block
                break;
            }
        }

        if (inItemBlock) {
            return {
                start: { line: cursor.line, ch: 0 },
                end: cursor,
                query: textBeforeCursor
            };
        }

        return null;
    }

    getSuggestions(context: EditorSuggestContext): MythrasWeapon[] {
        const query = context.query.toLowerCase();
        return this.plugin.armoryCache.filter(weapon => weapon.name.toLowerCase().includes(query));
    }

    renderSuggestion(weapon: MythrasWeapon, el: HTMLElement): void {
        el.createDiv({ text: weapon.name });
        if (weapon.type) {
            el.createEl('small', { text: weapon.type, cls: 'mythras-suggester-type' });
        }
    }

    selectSuggestion(weapon: MythrasWeapon, evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;
        
        const editor = this.context.editor;
        // For inline, we might want to auto-close the backtick if it's not there, 
        // but it's safer to just insert the name.
        
        let replacement = weapon.name;
        // Check if we need to close the backtick for inline
        const line = editor.getLine(this.context.start.line);
        const textBeforeStart = line.substring(0, this.context.start.ch);
        
        if (textBeforeStart.includes('`item:')) {
            const textAfterCursor = line.substring(this.context.end.ch);
            if (!textAfterCursor.startsWith('`')) {
                replacement += '`';
            }
        }

        editor.replaceRange(replacement, this.context.start, this.context.end);
    }
}
