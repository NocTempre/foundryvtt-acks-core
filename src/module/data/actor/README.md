# ACKS II Actor Data Models

This directory contains TypeDataModel definitions for all ACKS II actor types.

## Architecture

The system uses **Option 3: Hybrid with Shared Base** architecture:
- Shared schema modules in `../schema/`
- Type-specific data models in this directory
- Document classes in `../../actor/`

## Actor Types

### Implemented

1. **Adventurer** (`adventurer-data.mjs`)
   - Classed characters (PCs and Henchmen)
   - Full attributes, combat, movement, proficiencies, XP
   - Uses: `fullAttributesSchema`, `fullCombatSchema`, `fullMovementSchema`

### Stubs (To Be Implemented)

2. **Monster** (`monster-data.mjs`)
   - Full stat block creatures
   - Uses: `fullAttributesSchema`, `fullCombatSchema`, `simpleMovementSchema`
   - TODO: Treasure, special abilities, lairs

3. **Animal** (`animal-data.mjs`)
   - Draft animals, mounts, working beasts
   - Uses: `minimalAttributesSchema`, `minimalCombatSchema`, `animalMovementSchema`
   - TODO: Saddle/harness slots, pulling capacity

### Future Types (Not Yet Created)

4. **Mercenary** - Combat-focused NPCs
5. **Follower** - Simple NPCs with minimal stats
6. **Troop** - Military units for mass combat
7. **Expert** - Skill-focused NPCs (craftsmen, sages, etc.)
8. **Peasant** - Minimal stats for population

## Shared Schemas

Located in `../schema/`:

- `actor-attributes-schema.mjs`
  - `fullAttributesSchema()` - All 6 attributes (STR-CHA)
  - `minimalAttributesSchema()` - Just STR

- `actor-combat-schema.mjs`
  - `fullCombatSchema()` - HP, AC, saves, attacks, initiative
  - `minimalCombatSchema()` - Just HP, AC, basic attack
  - `troopCombatSchema()` - Unit-based combat

- `actor-movement-schema.mjs`
  - `fullMovementSchema()` - All movement modes + encumbrance
  - `simpleMovementSchema()` - Basic movement only
  - `animalMovementSchema()` - Movement + carrying capacity

## Adding New Actor Types

1. Create new data model in this directory
2. Import appropriate shared schemas
3. Add type-specific fields
4. Implement `prepareDerivedData()` if needed
5. Create corresponding document class in `../../actor/`
6. Register in system initialization
7. Add to `template.json`
