# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- **Roster UI Overhaul:** Redesigned the Roster Manager interface to feature a two-pane layout with a scrollable Scenario sidebar and an Encounter Tag-Cloud for filtering active enemies.
- Templates saved to the Bestiary now include the author's name in the filename to prevent overwriting templates with the same name from different authors (Fixes #1).
- Complete data model overhaul for Bestiary templates. The scraper now extracts `attributes`, `features`, `standardSkills`, `customSkills`, `combatStyles`, and detailed `weapons` profiles (Fixes #4).
- The Encounter Generator now randomly selects optional weapons from the scraped weapon lists (e.g., 1-handed weapons) and fully renders Custom Weapons with damage, size, reach, and special effects.
- Added a local `armory.json` feature for populating standard weapon stats (Damage, Size, Reach/Range, AP/HP, SpecialFx) automatically during encounter generation.
- Accurately replicated the Mythras Encounter Generator's weighted random selection logic (probability weights without replacement) and support for dice formulas in weapon amounts (Fixes #6).
- Overhauled Markdown weapon formatting to distinctly render Melee, Ranged, and Shield weapon types with their correct specific stats (e.g. Range instead of Reach for Bows).
- Restructured the plugin's file layout to use a single configurable `baseFolder` that automatically houses `Bestiary` and `Armory` subdirectories to prevent clutter (Fixes #7).
- Introduced the **Local Bestiary Manager**, a full UI available from the plugin settings to list, view, and edit local templates.
- Features dynamic editing views with Obsidian Vault image selection, custom vs. armory weapon handling, and automatic author tagging for manually customized creatures (Fixes #9).
- Introduced **Inline Item Statblocks** via Obsidian's Live Preview mode. Typing \`item: Weapon Name\` automatically resolves into an interactive hover-link that displays a compact SVG-icon-based statblock popover (Fixes #13).
- Added support for static block-level item statblocks using \`\`\`item\`\`\` codeblocks with a comprehensive grid layout.
- Added an Editor Suggester for auto-completing weapon names while typing in the editor.

## [0.1.0] - 2026-08-24
### Added
- **API Integration**: Connects to the Mythras Encounter Generator (`mythras.skoll.xyz`).
- **Template Scraper**: Fetches and parses HTML pages to extract Mythras rules and dice formulas for templates.
- **Bestiary**: Local JSON storage mechanism for templates inside the Obsidian Vault.
- **Search Modal**: In-app UI (`SuggestModal`) to search the remote Mythras database by name, showing race, rank, creator, and tags.
- **Dice Roller**: Parses Mythras-specific dice formulas (e.g. `2d6+6`, `STR+DEX+30`) and computes derived values like Action Points and Damage Modifiers.
- **Hit Location Engine**: Computes Hit Points per hit location based on base HP and standard modifiers (legs, chest, abdomen, arms).
- **Encounter Generator**: Selects a downloaded template and generates one or more instances as simple Markdown statblocks at the cursor's location.
