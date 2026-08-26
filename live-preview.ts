import { WidgetType, Decoration, DecorationSet, ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { MythrasWeapon } from './mythras-api';
import { renderItemStatblock } from './item-formatter';
import MythrasEncounterPlugin from './main';

class ItemWidget extends WidgetType {
    weapon: MythrasWeapon;

    constructor(weapon: MythrasWeapon) {
        super();
        this.weapon = weapon;
    }

    eq(other: ItemWidget) {
        return other.weapon.name === this.weapon.name;
    }

    toDOM() {
        const linkSpan = document.createElement('span');
        linkSpan.addClass('mythras-item-link');
        linkSpan.setText(this.weapon.name);
        
        const popover = renderItemStatblock(this.weapon, true);
        popover.addClass('mythras-item-popover');
        linkSpan.appendChild(popover);
        
        return linkSpan;
    }
}

export const buildItemLivePreviewPlugin = (plugin: MythrasEncounterPlugin) => {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged || update.selectionSet) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }

            buildDecorations(view: EditorView): DecorationSet {
                const builder = new RangeSetBuilder<Decoration>();
                const selection = view.state.selection.main;
                const text = view.state.doc.toString();
                
                const regex = /`item:\s*([^`]+)`/g;
                let match;
                while ((match = regex.exec(text)) !== null) {
                    const start = match.index;
                    const end = start + match[0].length;
                    
                    // Check if cursor is inside or adjacent to this match
                    const isCursorInside = (selection.from <= end && selection.to >= start);
                    
                    if (!isCursorInside) {
                        const itemName = match[1].trim().toLowerCase();
                        const weapon = plugin.armoryCache.find(w => w.name.toLowerCase() === itemName);
                        if (weapon) {
                            builder.add(start, end, Decoration.replace({
                                widget: new ItemWidget(weapon)
                            }));
                        }
                    }
                }
                return builder.finish();
            }
        },
        {
            decorations: v => v.decorations
        }
    );
};
