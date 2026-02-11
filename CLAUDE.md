# CLAUDE.md - AI Assistant Guide for foundryvtt-acks-core

## Project Overview

This is a **FoundryVTT game system** implementing the Adventurer Conqueror King System II (ACKS II). It is an experimental fork of the official ACKS II system with additional hexcrawl/travel management features.

- **System ID:** `acks-dev`
- **Foundry Compatibility:** v12 minimum, verified v13
- **Language:** JavaScript (ES Modules), no TypeScript compilation
- **No build step** - source files in `src/` are served directly by FoundryVTT via symlink
- **License:** GPL v3 + SAGA License + Autarch Compatibility License

## Commands

### Formatting (the only code quality tool configured)
```bash
npm run format:check   # Check all files with Prettier
npm run format:fix     # Auto-fix formatting issues
```

### Install dependencies
```bash
npm ci
```

### No tests
There is no test suite. `npm test` exits with an error by design.

## Architecture

### Directory Structure
```
src/                           # All runtime source (served directly to Foundry)
  acks.js                      # Main entry point - hooks, sheet registration, imports
  acks.css                     # Primary stylesheet (vanilla CSS, ~2000 lines)
  acks-v2-sheet.css            # ApplicationV2 sheet styles
  system.json                  # FoundryVTT system manifest
  template.json                # Legacy data model definitions
  module/                      # Core JavaScript modules (~66 files)
    config.js                  # System constants, paths, ACKS config object
    settings.js                # Game settings registration
    dice.js                    # Dice rolling and evaluation
    combat.js                  # Initiative, combat tracker
    actor/                     # Actor document classes and sheet classes
    item/                      # Item sheet classes
    documents/                 # Item document class (AcksItem)
    data/                      # TypeDataModel classes (Foundry v10+ data models)
      actor/                   # Actor data models (adventurer, monster, animal)
      item/                    # Item data models (weapon, armor, spell, etc.)
      schema/                  # Shared schema fragments (attributes, combat, movement)
    dialog/                    # Dialog classes (character creation, mortal wounds, etc.)
    apps/                      # Application classes (commands, table manager, polyglot)
    effect/                    # Active effect utilities
    types/                     # TypeScript type definitions (.d.ts)
    ruledata/                  # Static JSON lookup tables
  templates/                   # Handlebars HTML templates (~85 files)
    actors/                    # Actor sheet templates
      partials/                # V1 character sheet tab partials
      partials-v2/             # V2 character sheet components
    items/                     # Item sheet templates
      v2/                      # ApplicationV2 item templates
    chat/                      # Chat message templates
    apps/                      # Dialog/app templates
    token/                     # Token HUD templates
  assets/                      # Icons, images, UI graphics (~150+ files)
  packs/                       # Compendium packs (item/spell/NPC databases)
  lang/                        # Localization files (en.json primary)
docs/                          # Developer documentation
```

### Key Source Files

| File | Purpose |
|------|---------|
| `src/acks.js` | Main entry point. Registers all hooks, sheets, data models, integrations |
| `src/module/config.js` | System paths (`SYSTEM_PATH`, `TEMPLATE_PATH`, `ASSETS_PATH`), ACKS config constants |
| `src/module/actor/entity.js` | `AcksActor` base class (~2600 lines). Core actor logic, encumbrance, rolls |
| `src/module/actor/character-sheet.js` | V1 legacy character sheet |
| `src/module/actor/character-sheet-v2.js` | Official ACKS II layout character sheet |
| `src/module/actor/adventurer-sheet.mjs` | ACKS II Adventurer sheet (ApplicationV2) |
| `src/module/actor/monster-sheet.js` | Monster stat block sheet |
| `src/module/actor/travel-party-sheet.js` | Travel party management (~1700 lines, experimental) |
| `src/module/actor/location-sheet.js` | Settlement/location sheet |
| `src/module/documents/item.js` | `AcksItem` document class. Item rolls, chat cards, ownership |
| `src/module/dice.js` | `AcksDice` - roll evaluation (above/below/check/table) |
| `src/module/combat.js` | `AcksCombat` - initiative, turn order, group initiative |
| `src/module/terrain-config.js` | 17+ terrain type definitions with movement/navigation data |
| `src/module/hexplorer-integration.js` | Hex movement calculation, terrain throws |
| `src/module/item-transfer.js` | Item lending/delegation between actors |
| `src/module/container-manager.js` | Item containers with capacity/weight reduction |
| `src/module/settings.js` | Game settings registration (color schemes, initiative, roll modes) |

### Actor Types
- `character` - Legacy ACKS character (V1 sheet)
- `acks-ii-adventurer` - ACKS II adventurer with TypeDataModel (V2 sheet)
- `acks-ii` - ACKS II base type
- `monster` - Monster/NPC stat blocks
- `travel-party` - Travel party management (experimental)
- `location` - Settlements and locations

### Item Types
- `weapon`, `armor`, `spell`, `ability` (proficiency), `item` (generic), `language`, `money`, `treasure`

### Sheet Architecture
The system has two parallel sheet implementations:
- **V1 (Legacy):** Classes extending `ActorSheet`/`ItemSheet` with Handlebars templates. Files use `.js` extension.
- **V2 (Modern):** Classes using Foundry's `ApplicationV2` framework. Files use `.mjs` extension. Located in `data/` subdirectories for data models.

### Initialization Flow
```
Hooks.once("init") -> Load class JSON files -> Register sheets -> Register data models
                   -> Preload Handlebars templates -> Initialize integrations
Hooks.once("setup") -> Localize config objects
Hooks.once("ready") -> Setup utilities, sockets, welcome message
```

## Code Conventions

### Formatting
- **Prettier** is the only code quality tool. No ESLint.
- Config: 120 char line width, 2-space indent, double quotes, trailing commas, semicolons required
- Run `npm run format:fix` before committing

### File Naming
- Legacy modules: `.js` extension
- New/modern modules (ApplicationV2, TypeDataModel): `.mjs` extension
- Templates: `.html` or `.hbs` (Handlebars)
- Data models in `src/module/data/` organized by `actor/`, `item/`, `schema/`

### Import Style
- ES module imports (`import`/`export`)
- Relative paths from the importing file
- Named exports preferred, default exports used for data model classes

### Foundry API Patterns
- Use `foundry.abstract.TypeDataModel` for new data models with `defineSchema()`
- Use `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels` for model registration
- Actor/Item sheets registered via `Actors.registerSheet()` / `Items.registerSheet()`
- System paths resolved dynamically via `import.meta.url` (see `config.js`)
- Localization keys follow pattern `ACKS.category.key` (e.g., `ACKS.scores.str.long`)
- Handlebars templates preloaded in `preloadTemplates.js`

### CSS
- Vanilla CSS only (no preprocessor)
- CSS custom properties for theming (`--acks-purple: #620630`)
- Three custom @font-face declarations (Oranienbaum, EB Garamond, Crimson Text)
- Sheet backgrounds use `.webp` images from `assets/ui/`

### Adding New Features
1. **New Actor Type:** Define in `template.json`, create sheet class, register in `acks.js`, add template in `templates/actors/`
2. **New Item Type:** Create data model in `data/item/`, register in `CONFIG.Item.dataModels` in `acks.js`, create template
3. **New Integration:** Create module file, initialize in `acks.js` after `Hooks.once("init")`

## Important Guidelines

### Compendium Packs
- **Do NOT modify or commit files in `src/packs/`** unless you intentionally changed compendium content
- Foundry auto-modifies pack database files when the system runs; these changes should not be committed
- Use `@foundryvtt/foundryvtt-cli` to unpack/repack compendia when working with pack data

### Prettier Ignore
Prettier is configured to skip: `src/assets/`, `src/packs/`, all `.md`, `.html`, `.hbs` files, and `docs/` directory (see `.prettierignore`).

### Git Ignore
- `claude_notes*`, `.claude/`, `.history/` are gitignored
- `node_modules/`, IDE files, `.env`, logs are ignored
- Pack database files (`*.ldb`, `CURRENT*`, `LOG*`) are ignored

### Development Setup
1. Clone the repo
2. Run `npm ci`
3. Create a symlink from `src/` to your Foundry data's `systems/` directory
4. Launch FoundryVTT pointing to that data directory
5. Hot reload is enabled for CSS, HTML, HBS, and JSON files

### Foundry Version Compatibility
- Code must work on Foundry v12 through v13
- Several API lookups have fallback chains for cross-version support (see `config.js` for examples like `TextEditorRef` and `FilePickerClass`)
- The `foundry.utils?.slugify` pattern is used for version-safe utility access
