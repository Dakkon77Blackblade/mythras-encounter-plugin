# Architecture Document: Mythras Encounter Plugin

This document outlines the architecture, data flow, and technical decisions behind the Mythras Encounter Obsidian Plugin.

## 1. System Overview
The plugin serves as a bridge between the [Mythras Encounter Generator](https://mythras.skoll.xyz/) and an Obsidian Vault. Since the official generator does not provide an API to export "unrolled" templates with dice formulas, the plugin utilizes a hybrid approach: searching via API and importing via HTML scraping.

## 2. Core Components
The codebase is structured into the following TypeScript modules:

- **`main.ts`**: The entry point. It registers the commands, settings tab, and binds everything to Obsidian's lifecycle methods (`onload`, `onunload`).
- **`settings.ts`**: Defines the user settings schema (e.g., the local `bestiaryFolder` path) and the settings UI tab.
- **`mythras-api.ts`**: Handles all external network communication. 
  - `search()`: Hits the JSON search endpoint.
  - `fetchTemplate()`: Fetches the template's HTML page and parses it using `DOMParser` to extract base stats, dice formulas, and metadata into a `MythrasTemplate` JSON object.
- **`dice-roller.ts`**: A dedicated engine for Mythras mechanics. It evaluates string formulas (e.g., `STR+DEX+30`, `1d8`) and calculates derived statistics such as Damage Modifier, Strike Rank, and base Hit Points.
- **`modal-search.ts`**: The UI for finding templates online. Uses Obsidian's `SuggestModal` for interactive search.
- **`modal-generate.ts`**: The UI for selecting a local template from the Bestiary and defining how many instances to generate.
- **`statblock-formatter.ts`**: Transforms the freshly rolled data into clean, readable Markdown tables to be inserted into the editor.

## 3. Data Flow
1. **Search & Import**: 
   - User types a query in the Search Modal. 
   - Plugin queries `/rest/search/?string=...`.
   - User selects a result. Plugin fetches `/enemy_template/<id>/`.
   - Plugin scrapes HTML, builds a `MythrasTemplate` object, and saves it to `<bestiaryFolder>/<template_name>.json`.
2. **Generation**:
   - User triggers "Generate Encounter".
   - Selects a local `.json` file.
   - `dice-roller.ts` rolls the core stats, derives secondary attributes, and calculates HP/AP for Hit Locations.
   - `statblock-formatter.ts` strings it together into Markdown.
   - Output is inserted at the user's cursor position.

## 4. Versioning Strategy
We use Semantic Versioning (`MAJOR.MINOR.PATCH`). 
Releases require bumping the version in both `manifest.json` and `package.json`, and updating `versions.json` to map the plugin version to the minimum required Obsidian API version.

## 5. Future Enhancements
- **Encounter Database**: A feature to save generated (rolled) instances as separate Markdown notes (or JSON) to track HP across multiple combat sessions, instead of just printing static text.
- **Formatting Engines**: Support for popular Obsidian TTRPG plugins like *Fantasy Statblocks* or *ITS Theme* callouts.
