# Mythras Encounter Generator (Obsidian Plugin)

Ein Plugin für Obsidian, das als Brücke zum offiziellen [Mythras Encounter Generator](https://mythras.skoll.xyz/) fungiert.

## Ziel des Projekts
Ziel dieses Plugins ist es, Spielleitern (Game Mastern) des Pen & Paper Rollenspiels "Mythras" die Vorbereitung und Durchführung von Kämpfen direkt in Obsidian zu erleichtern. 

Anstatt während der Spielsitzung ständig auf externe Webseiten zugreifen zu müssen, ermöglicht das Plugin:
1. Das **Suchen und Importieren** von vorgefertigten Gegner-Templates aus der Datenbank des offiziellen Encounter Generators.
2. Das **Speichern** dieser Templates als strukturierte Daten (JSON) in einem lokalen Bestiarium im eigenen Obsidian-Vault.
3. Das **Offline-Generieren** von Feinden. Das Plugin verfügt über einen eigenen Dice-Roller, der die im Template hinterlegten Regeln (z.B. `STR+DEX+30`) lokal auswürfelt und individuelle Gegner als Markdown-Statblocks direkt in die eigenen Vorbereitungs-Notizen einfügt.

## Features des Plugins
- **Intelligenter Scraper**: Parst sämtliche relevanten Daten aus der Website, einschließlich Hit Locations, Sonderfertigkeiten (Features), Standard/Custom Skills, Combat Styles und detaillierte Waffenprofile.
- **Lokaler Bestiary Manager**: Ein komfortables Interface in den Obsidian-Einstellungen, mit dem du alle lokal gespeicherten Kreaturen durchsuchen, filtern und editieren kannst. Du kannst eigene Bilder verlinken, Stats anpassen und eigene Waffen hinzufügen.
- **Lokaler Armory Manager**: Ein dediziertes UI für die Verwaltung von Nahkampfwaffen, Fernkampfwaffen und Schilden. Die Basisdaten (inklusive 1H/2H-Varianten und Ranged-Sonderregeln) stammen direkt aus der *Classic Fantasy Imperative SRD* und sind als Rohdaten statisch im Code unter `default-armory.ts` abgelegt. Über den Manager kannst du jederzeit dein lokales `armory.json` Backup überschreiben (Repopulate) und aus über 60 Standardwaffen neue Kopien erzeugen.
- **Zufalls-Waffen**: Wenn ein Template "Weapon options" enthält (z.B. 1 von 3 verschiedenen Schwertern), wählt das Plugin beim Generieren automatisch die angegebene Anzahl an Waffen zufällig aus.
- **Mythras Dice Roller**: Echte Regel-Abbildungen wie `Math.ceil((CON + SIZ) / 5)` für die Basis-HP je Hit Location, plus die modifizierten Trefferzonen-HP. Auch Action Points und Strike Rank werden nach Core-Rules abgeleitet.

*(Eine detaillierte Dokumentation der Nutzung und Konfiguration folgt separat in zukünftigen Releases).*
