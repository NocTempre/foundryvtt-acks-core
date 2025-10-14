# Hexplorer Integration for ACKS

This document describes the terrain-based movement system and optional module integrations for ACKS.

## Overview

The ACKS system now includes comprehensive support for hexploration with:
- 17 different terrain types with movement multipliers
- Road types with speed bonuses and weather effects
- Weather conditions affecting movement
- Water and air travel with vessels
- Party size-based evasion modifiers
- Navigation throws and encounter distances
- Support for multiple hex layers (ground/water/air)

## Setup

### Basic Setup (No Modules Required)

The terrain configuration is available even without any modules installed. You can access it via:

```javascript
game.acks.terrain
```

### Optional Module Integration

To enable integration with Hexplorer and other modules:

1. **Install Optional Modules**:
   - Hexplorer (for hex-based travel)
   - Weather Control or similar (for weather effects)
   - Simple Calendar, Small Time, or Simple Timekeeping (for time tracking)

2. **Enable Integration in ACKS Settings**:
   - Go to **Game Settings** → **Configure Settings** → **System Settings**
   - Enable the integrations you want:
     - ☑ Enable Hexplorer Integration
     - ☑ Enable Weather Module Integration
     - ☑ Enable Timekeeping Integration

3. **Reload Foundry** after enabling settings

## Terrain Types

### Ground Terrains

| Terrain Type | Movement Multiplier | Navigation Throw | Encounter Distance | Layer |
|-------------|-------------------|------------------|-------------------|-------|
| Barrens | x2/3 | 6+ | 4d6×30' (420') | ground |
| Desert (Rocky) | x2/3 | 6+ | 6d20×30' (1890') | ground |
| Desert (Sandy) | x2/3 | 6+ | 4d6×30' (420') | ground |
| Forest (Deciduous) | x2/3 | 8+ | 5d8×3' (68') | ground |
| Forest (Taiga) | x2/3 | 8+ | 3d6×15' (157') | ground |
| Grassland | x1 | 6+ | 4d6×30' (420') | ground |
| Grassland (Steppe) | x1 | 6+ | 6d20×30' (1890') | ground |
| Hills (Forested) | x2/3 | 8+ | 5d8×3' (68') | ground |
| Hills (Rocky) | x2/3 | 8+ | 4d6×30' (420') | ground |
| Jungle | x1/2 | 14+ | 5d4×3' (38') | ground |
| Mountains (Forested) | x1/2 | 6+ | 5d8×3' (68') | ground |
| Mountains (Rocky) | x1/2 | 6+ | 4d6×30' (420') | ground |
| Scrubland (Sparse) | x1 | 6+ | 4d6×30' (420') | ground |
| Scrubland (Dense) | x1 | 8+ | 3d6×15' (157') | ground |
| Swamp (Marshy) | x1/2 | 10+ | 3d6×15' (157') | ground |
| Swamp (Scrubby) | x1/2 | 10+ | 5d8×3' (68') | ground |
| Swamp (Forested) | x1/2 | 14+ | 5d4×3' (38') | ground |

### Water Terrains

| Terrain Type | Movement Multiplier | Navigation Throw | Layer |
|-------------|-------------------|------------------|-------|
| Water (Calm) | x1 | 6+ | water |
| Water (Rough) | x2/3 | 8+ | water |
| Water (River) | x1 | 6+ | water |

**Note**: Water terrains require a vessel (see Vessels section)

### Air Layer

| Terrain Type | Movement Multiplier | Navigation Throw | Layer |
|-------------|-------------------|------------------|-------|
| Air | x1 | 6+ | air |

**Note**: Air travel requires a flying mount or vessel

## Roads

Roads provide speed bonuses when traveling through ground terrain:

| Road Type | Speed Multiplier | With Driving Proficiency | Max Vehicle Speed | Ineffective If... |
|-----------|-----------------|-------------------------|------------------|------------------|
| Earth | x3/2 | x2 | 60' (12 miles/day) | Rain, Muddy, Snowy |
| Gravel | x3/2 | x2 | 90' (18 miles/day) | Muddy, Snowy |
| Paved | x3/2 | x2 | No maximum | Snowy |

### Driving Proficiency

Characters with the **Driving** proficiency get a x2 multiplier instead of x3/2 when traveling on roads.

## Weather Conditions

Weather affects movement speed and navigation:

| Weather | Movement Modifier | Navigation Modifier | Notes |
|---------|------------------|--------------------|----- |
| Clear | 0 | 0 | Normal conditions |
| Rain | -1/3 | +2 | Makes earth roads ineffective |
| Muddy | -1/3 | 0 | Makes earth and gravel roads ineffective |
| Snowy | -1/2 | +4 | Makes all roads ineffective |
| Storm | -1/2 | +4 | Affects water travel |
| Fog | -1/4 | +4 | Reduces encounter distance by half |

## Vessels

### Water Vessels

| Vessel | Base Speed | Expedition Speed | Weather Dependent |
|--------|-----------|-----------------|-------------------|
| Raft | 30' | 6 miles/day | No |
| Rowboat | 60' | 12 miles/day | No |
| Sailboat | 90' | 18 miles/day | Yes |
| Small Ship | 120' | 24 miles/day | Yes |
| Large Ship | 90' | 18 miles/day | Yes |
| Galley | 150' | 30 miles/day | No (uses oars) |

### Air Vessels/Mounts

| Vessel | Base Speed | Expedition Speed | Weather Dependent |
|--------|-----------|-----------------|-------------------|
| Pegasus | 240' | 48 miles/day | Yes |
| Hippogriff | 180' | 36 miles/day | Yes |
| Griffin | 180' | 36 miles/day | Yes |
| Dragon | 240' | 48 miles/day | No |
| Airship | 180' | 36 miles/day | Yes |
| Flying Carpet | 120' | 24 miles/day | No |

## Evasion Throws

Evasion throws vary by terrain and party size:

| Party Size | Category |
|-----------|----------|
| 1-6 | Small |
| 7-14 | Medium |
| 15-30 | Large |
| 31-60 | Very Large |
| 61+ | Huge |

Each terrain has different evasion throws for each party size category.

## Using the Hex Movement Calculator

### From Character Sheet

1. Open a character sheet
2. Look for the **"Hex Movement"** button (added automatically when Hexplorer integration is enabled)
3. Click the button to open the movement calculator
4. Select:
   - Terrain type
   - Road type (if applicable)
   - Vessel (if applicable)
   - Weather condition
   - Party size
   - Whether the party has Driving proficiency
5. Click **Calculate** to see movement information in chat

### Programmatically

You can calculate movement from macros or scripts:

```javascript
// Get the actor
const actor = game.actors.getName("Character Name");

// Calculate movement for forest terrain
const result = game.acks.hexplorer.calculateHexMovement(
  actor,
  "forest-deciduous",
  {
    roadType: null,           // or "earth", "gravel", "paved"
    weather: "clear",         // or "rain", "snowy", etc.
    vessel: null,             // or "rowboat", "pegasus", etc.
    partySize: 6,
    hasDriving: false
  }
);

console.log(result);
// Shows: speeds, navigation, encounter info, etc.
```

### Display Movement Summary in Chat

```javascript
const actor = game.actors.getName("Character Name");

const summary = game.acks.hexplorer.createMovementSummary(
  actor,
  "mountains-rocky",
  {
    weather: "snowy",
    partySize: 8
  }
);

ChatMessage.create({
  content: summary,
  speaker: ChatMessage.getSpeaker({ actor })
});
```

## Accessing Terrain Data

### Get All Terrain Types

```javascript
const terrains = game.acks.hexplorer.getAllTerrainTypes();
// Returns array of all terrain types with labels
```

### Get Terrains by Layer

```javascript
const groundTerrains = game.acks.hexplorer.getTerrainsByLayer("ground");
const waterTerrains = game.acks.hexplorer.getTerrainsByLayer("water");
const airTerrains = game.acks.hexplorer.getTerrainsByLayer("air");
```

### Roll Encounter Distance

```javascript
game.acks.hexplorer.rollEncounterDistance("forest-deciduous");
// Rolls 5d8*3 and displays in chat
```

### Roll Lairs per Hex

```javascript
game.acks.hexplorer.rollLairsPerHex("jungle");
// Rolls 2d8 and displays in chat
```

## Hexplorer Module Integration

When Hexplorer is installed and the integration is enabled, ACKS will automatically:

1. **Provide terrain configuration** to Hexplorer
2. **Calculate movement speeds** based on terrain when characters move
3. **Display movement info** when hexes are clicked
4. **Add hex layer support** for water and air travel

### Hexplorer Hooks

ACKS responds to and provides these hooks:

```javascript
// Hook into movement calculation
Hooks.on("hexplorer.calculateMovement", (actor, hex, options) => {
  // ACKS automatically calculates movement
});

// Provide terrain config to Hexplorer
Hooks.on("hexplorer.getTerrainConfig", () => {
  return game.acks.terrain;
});

// Display movement info when hex is clicked
Hooks.on("hexplorer.hexClicked", (hex, actor) => {
  // ACKS displays movement summary in chat
});
```

## Weather Module Integration

When a weather module is active and integration is enabled:

1. **Weather changes** are automatically detected
2. **Movement calculations** include weather effects
3. **Road effectiveness** is adjusted based on conditions
4. **Current weather** is stored in `game.acks.currentWeather`

### Manually Set Weather

```javascript
game.acks.hexplorer.onWeatherChanged("snowy");
```

## Timekeeping Module Integration

When a timekeeping module is active and integration is enabled:

1. **Time advancement** triggers encounter checks (future feature)
2. **Expedition tracking** is synchronized
3. **Day/night cycles** can affect encounters

### Hooks

```javascript
Hooks.on("acks.timeAdvanced", (timeData) => {
  // Respond to time advancement
});

Hooks.on("acks.weatherChanged", (weatherCondition) => {
  // Respond to weather changes
});
```

## Examples

### Example 1: Party on a Road in Rain

```javascript
const result = game.acks.hexplorer.calculateHexMovement(
  actor,
  "grassland",
  {
    roadType: "earth",
    weather: "rain",
    partySize: 6,
    hasDriving: true
  }
);
// Result: Earth road is ineffective due to rain
// Movement: Base speed × grassland (x1) only
```

### Example 2: Sailing Ship in Storm

```javascript
const result = game.acks.hexplorer.calculateHexMovement(
  actor,
  "water-rough",
  {
    vessel: "sailboat",
    weather: "storm",
    partySize: 20
  }
);
// Result: Sailboat (18 miles/day) × rough water (x2/3) × storm (-1/2)
// Large party (15-30) evasion modifier applied
```

### Example 3: Flying Mount over Mountains

```javascript
const result = game.acks.hexplorer.calculateHexMovement(
  actor,
  "air",
  {
    vessel: "pegasus",
    weather: "clear",
    partySize: 2
  }
);
// Result: Pegasus speed (48 miles/day) × air (x1)
// Ignores mountain terrain below
```

## Troubleshooting

### Integration Not Working

1. Check that the module is installed and active
2. Check that integration is enabled in ACKS settings
3. Reload Foundry after changing settings
4. Check browser console for errors

### Movement Button Not Showing

1. Ensure Hexplorer integration is enabled
2. Check that you're looking at a character sheet (not monster)
3. Try re-rendering the sheet (close and reopen)

### Weather Not Applying

1. Ensure weather integration is enabled
2. Check that `game.acks.currentWeather` has a value
3. Manually set weather if needed: `game.acks.hexplorer.onWeatherChanged("rain")`

## Future Enhancements

Planned features for future releases:

- [ ] Automatic encounter rolls based on time
- [ ] Hex exploration tracking
- [ ] Lair placement tools
- [ ] Foraging and getting lost mechanics
- [ ] Party marching order and scouts
- [ ] Integration with ACKS encounter tables

## API Reference

See the JSDoc comments in the source files for detailed API documentation:

- [terrain-config.js](src/module/terrain-config.js) - Terrain definitions
- [hexplorer-integration.js](src/module/hexplorer-integration.js) - Movement calculation API
- [module-integrations.js](src/module/module-integrations.js) - Module detection and hooks
