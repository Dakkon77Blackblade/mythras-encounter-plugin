# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Templates saved to the Bestiary now include the author's name in the filename to prevent overwriting templates with the same name from different authors (Fixes #1).
- Complete data model overhaul for Bestiary templates. The scraper now extracts `attributes`, `features`, `standardSkills`, `customSkills`, `combatStyles`, and detailed `weapons` profiles (Fixes #4).
- The Encounter Generator now randomly selects optional weapons from the scraped weapon lists (e.g., 1-handed weapons) and fully renders Custom Weapons with damage, size, reach, and special effects.

## [0.1.0] - 2026-08-24
### Added
- **API Integration**: Connects to the Mythras Encounter Generator (`mythras.skoll.xyz`).
- **Template Scraper**: Fetches and parses HTML pages to extract Mythras rules and dice formulas for templates.
- **Bestiary**: Local JSON storage mechanism for templates inside the Obsidian Vault.
- **Search Modal**: In-app UI (`SuggestModal`) to search the remote Mythras database by name, showing race, rank, creator, and tags.
- **Dice Roller**: Parses Mythras-specific dice formulas (e.g. `2d6+6`, `STR+DEX+30`) and computes derived values like Action Points and Damage Modifiers.
- **Hit Location Engine**: Computes Hit Points per hit location based on base HP and standard modifiers (legs, chest, abdomen, arms).
- **Encounter Generator**: Selects a downloaded template and generates one or more instances as simple Markdown statblocks at the cursor's location.
