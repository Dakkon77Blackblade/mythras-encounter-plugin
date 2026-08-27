# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- **Interactive Weapon Damage Rolls & Dice Breakdown:**
  - Weapon damage values in encounter and enemy statblocks are now interactive "Click-to-Roll" pills (`mythras-rollable-pill`).
  - Automatically incorporates the combatant's Damage Modifier (e.g., `+1d2`, `-1d4`) into the roll expression based on official Mythras rules.
  - Automatically floors total damage results to a minimum of 0 (preventing negative net damage from penalties).
  - Generates an itemized visual dice breakdown in the GM Combat Log view (`combat-log-breakdown`), displaying individual dice rolls (e.g., `1d8 [5]`), operators, constants, and highlighted total damage badges.
  - Automatically focuses and scrolls to the GM Combat Log sidebar when a damage roll is triggered.


## [0.8.0] - 2026-08-27
### Added
- **Native GM Combat Log & Dice Roller (Issue #27):**
  - Integrated an authentic Mythras d100 dice roller into live statblocks.
  - Interactive "Click-to-Roll" pills for Combat Styles, Standard Skills, Magic Skills, Professional Skills, and Custom Skills.
  - Automatic Mythras Success Level determination: Critical ($\le \lceil \text{Target}/10 \rceil$), Success ($\le \text{Target}$), Failure ($> \text{Target}$), and Fumble ($\ge 99$).
  - Dedicated GM Combat Log view in Obsidian's right sidebar (`mythras-combat-log-view`) with actor names, timestamps, rolled values, target percentages, and color-coded status badges.
  - Added "Clear Log" button, ribbon icon (`list`), and command palette action (`Mythras: Open Combat Log`).
- **Interactive Click-to-Edit Hit Locations:**
  - Direct click-to-edit on any Hit Location badge (`is-clickable`) in rendered enemy statblocks.
  - Quick Edit modal to adjust Current AP and Current HP during live combat.
  - Instant persistence to Roster instance JSON files with real-time DOM synchronization across all open views in Obsidian.
  - Visual damage indicator (`is-modified`) highlighting wounded locations in bold red.
- **Modernized Statblock & Encounter UI:**
  - Redesigned short and long statblock layouts with responsive column grids, derived attribute cards, and weapon breakdown lines.
  - Added quick-jump pencil edit buttons on statblocks and `mythras-encounter` headers to jump directly into the Roster Manager.
  - Enhanced Combat Log entries with subtle colored backgrounds, accent borders, and hover effects for instant readability.

## [0.7.0] - 2026-08-26
### Added
- **Roster Manager & Encounter Workflows:**
  - Full desktop-class Roster Manager UI featuring a two-pane layout, Scenario tree navigation, Encounter Tag-Cloud filtering, and deep-editing.
  - Dynamic ````mythras-encounter```` codeblocks auto-rendered based on frontmatter `type: mythras-encounter` and `encounter-id`.
  - Native rendering of ````enemy <ID> [long]```` codeblocks directly inside Obsidian notes.
  - Support for multi-instance encounter generation and automatic insertion into active markdown notes.
- **Inline Item References & Armory:**
  - Live Preview and reading mode support for inline weapon tooltips (`` `item: Weapon Name` ``) with SVG stat popovers.
  - Static equipment statblock cards via ````item```` codeblocks.
  - Editor suggester for auto-completing armory weapon names.
  - Centralized `Armory` catalog pre-seeded with 60+ weapons from the Classic Fantasy Imperative SRD.
- **Bestiary & Scraping Engine:**
  - Direct import from the online Mythras Encounter Generator (`mythras.skoll.xyz`) with author namespacing.
  - Support for weighted random weapon pools without replacement and dice formula evaluation.

## [0.1.0] - 2026-08-24
### Added
- **API Integration**: Connects to the Mythras Encounter Generator (`mythras.skoll.xyz`).
- **Template Scraper**: Fetches and parses HTML pages to extract Mythras rules and dice formulas for templates.
- **Bestiary**: Local JSON storage mechanism for templates inside the Obsidian Vault.
- **Search Modal**: In-app UI (`SuggestModal`) to search the remote Mythras database by name, showing race, rank, creator, and tags.
- **Dice Roller**: Parses Mythras-specific dice formulas (e.g., `2d6+6`, `STR+DEX+30`) and computes derived values like Action Points and Damage Modifiers.
- **Hit Location Engine**: Computes Hit Points per hit location based on base HP and standard modifiers (legs, chest, abdomen, arms).
- **Encounter Generator**: Selects a downloaded template and generates one or more instances as simple Markdown statblocks at the cursor's location.
