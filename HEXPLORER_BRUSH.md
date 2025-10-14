# Hexplorer Brush Injection

This document describes the automatic integration of ACKS terrain types into Hexplorer's brush system.

## Overview

When the Hexplorer module is installed and active, ACKS automatically injects all of its terrain types as brushes into Hexplorer's UI. This allows you to paint ACKS terrain types directly onto hex maps.

If Hexplorer is not installed or active, this integration does nothing and has no effect on the system.

## Features

- **Automatic Detection**: Detects if Hexplorer is installed and active
- **Zero Configuration**: No setup required - works automatically
- **Terrain Brushes**: All 21 ACKS terrain types become available as brushes
- **Visual Identification**: Each terrain has an appropriate icon and color
- **Layer Support**: Terrains are organized by layer (ground, water, air)
- **Complete Data**: Each brush includes movement multipliers, navigation throws, and encounter data

## How It Works

Hexplorer stores brushes per-scene (not globally), so ACKS integrates by:

1. Detecting when Hexplorer is active
2. Registering a hook that fires when the Hexplorer app is opened (`renderHexplorerApp`)
3. When the app opens, ACKS checks if the scene already has ACKS brushes
4. If not, it adds all 21 ACKS terrain brushes to that scene's brush list
5. The brushes then appear in Hexplorer's UI for that scene

**Important**: Brushes are added per-scene, so they will be automatically added the first time you open the Hexplorer app in any scene. If you want to manually add them to the current scene, use:

```javascript
game.acks.brushes.addToCurrentScene()
```

## Terrain Brushes

All ACKS terrains are injected with the prefix "ACKS:" to distinguish them from other brushes:

### Ground Terrains
- ACKS: Barrens
- ACKS: Desert (Rocky)
- ACKS: Desert (Sandy)
- ACKS: Forest (Deciduous)
- ACKS: Forest (Taiga)
- ACKS: Grassland
- ACKS: Grassland (Steppe)
- ACKS: Hills (Forested)
- ACKS: Hills (Rocky/Terraced)
- ACKS: Jungle
- ACKS: Mountains (Forested)
- ACKS: Mountains (Rocky/Terraced)
- ACKS: Scrubland (Low, Sparse)
- ACKS: Scrubland (High, Dense)
- ACKS: Swamp (Marshy)
- ACKS: Swamp (Scrubby)
- ACKS: Swamp (Forested)

### Water Terrains
- ACKS: Water (Calm)
- ACKS: Water (Rough)
- ACKS: Water (River)

### Air Layer
- ACKS: Air

## Brush Data

Each brush includes the following data:

```javascript
{
  id: "acks-forest-deciduous",           // Unique identifier
  name: "ACKS: Forest (Deciduous)",      // Display name
  category: "ACKS (ground)",             // Category for organization
  layer: "ground",                       // Layer type
  icon: "fa-tree",                       // Font Awesome icon
  color: "#228B22",                      // Hex color
  data: {
    terrainType: "forest-deciduous",     // ACKS terrain key
    movementMultiplier: 0.667,           // Movement multiplier
    navigationThrow: 8,                  // Navigation difficulty
    encounterDistance: "5d8*3",          // Encounter distance formula
    lairsPerHex: "2d4",                  // Lairs per hex formula
    system: "acks"                       // System identifier
  }
}
```

## Color Coding

Terrains are color-coded for easy visual identification:

| Terrain Type | Color | Hex Code |
|-------------|-------|----------|
| Barrens | Brown/Tan | #8B7355 |
| Desert | Sandy/Rocky | #EDC9AF / #B8956A |
| Forest | Green | #228B22 / #2F4F2F |
| Grassland | Light Green | #90EE90 / #BDB76B |
| Hills | Brown/Green | #556B2F / #A0826D |
| Jungle | Dark Green | #006400 |
| Mountains | Gray/Green | #4F7942 / #808080 |
| Scrubland | Olive/Tan | #9ACD32 / #6B8E23 |
| Swamp | Dark Green/Blue | #8FBC8F / #2E8B57 / #014421 |
| Water | Blue | #4682B4 / #1E90FF / #5F9EA0 |
| Air | Light Blue | #87CEEB |

## Using ACKS Brushes in Hexplorer

1. **Open Scene**: Navigate to a scene with a hex grid
2. **Open Hexplorer App**: Click the Hexplorer icon in the scene controls
3. **ACKS Brushes Added**: The first time you open Hexplorer in a scene, ACKS brushes are automatically added
4. **Select Brush**: Scroll through the brush list and look for brushes starting with "ACKS:"
5. **Paint Terrain**: Click on hexes to paint the selected terrain type
6. **View Data**: The painted hex will store terrain color, region name, speed multiplier, and ACKS-specific data

## Console Commands

You can manage ACKS brushes from the browser console:

```javascript
// Add ACKS brushes to the current scene manually
game.acks.brushes.addToCurrentScene()

// Check if Hexplorer is active
game.acks.brushes.isHexplorerActive()

// View debug information
game.acks.brushes.debugInfo()

// Get all ACKS brush data
game.acks.brushes.getRegisteredBrushes()
```

## How Brushes Are Stored

Each brush is stored in the scene's flags under `hexplorer.brushes` with this structure:

```javascript
{
  "acks-forest-deciduous": {
    name: "ACKS: Forest (Deciduous)",
    data: {
      color: "#228B22",
      region: "Forest (Deciduous)",
      speedMultiplier: 0.667,
      tooltip: "",
      journalEntry: "",
      acksTerrainType: "forest-deciduous",
      acksNavigationThrow: 8,
      acksEncounterDistance: "5d8*3",
      acksLairsPerHex: "2d4"
    }
  }
  // ... 20 more terrain brushes
}
```

## Troubleshooting

### Brushes Not Appearing

1. **Open the Hexplorer App**: Brushes are only added when you open the Hexplorer app interface
2. **Check Console**: Look for "ACKS | Successfully added 21 ACKS brushes to scene" in the console
3. **Manual Addition**: If automatic addition fails, run `game.acks.brushes.addToCurrentScene()` in the console
4. **Check Scene Flags**: Run `game.acks.brushes.debugInfo()` to see if brushes are in the scene

### Brushes Disappeared

Brushes are stored per-scene. If you don't see them:
- Make sure you're looking at the right scene
- Check if scene flags were reset
- Re-add them with `game.acks.brushes.addToCurrentScene()`

### Wrong Colors or Icons

The color and icon mappings are defined in [hexplorer-brush-injection.js](src/module/hexplorer-brush-injection.js). You can customize them by editing the `_getTerrainColor()` and `_getTerrainIcon()` methods.

## Technical Details

### File Structure

```
src/module/
├── hexplorer-brush-injection.js  ← Brush injection logic
├── hexplorer-integration.js      ← Movement calculation API
├── terrain-config.js             ← Terrain data definitions
└── module-integrations.js        ← UI integration
```

### Initialization Flow

1. `acks.js` imports `HexplorerBrushInjection`
2. During `init` hook, calls `HexplorerBrushInjection.init()`
3. On `ready` hook, checks if Hexplorer is active
4. If active, injects brushes via available API
5. If not active, logs message and does nothing

### No External Dependencies

The brush injection module has **no external dependencies** on Hexplorer. It simply checks if Hexplorer exists and injects data if it does. This means:

- ACKS works perfectly without Hexplorer installed
- No errors if Hexplorer is not present
- No performance impact if Hexplorer is not active
- Future-proof against Hexplorer API changes (graceful degradation)

## Future Enhancements

Potential improvements for future versions:

- [ ] Support for custom terrain types defined by users
- [ ] Brush presets for common terrain combinations
- [ ] Integration with Hexplorer's hex notes system
- [ ] Automatic encounter generation when painting
- [ ] Visual preview of movement costs in Hexplorer UI

## Related Documentation

- [HEXPLORER_INTEGRATION.md](HEXPLORER_INTEGRATION.md) - Full Hexplorer integration guide
- [terrain-config.js](src/module/terrain-config.js) - Terrain data definitions
- [hexplorer-integration.js](src/module/hexplorer-integration.js) - Movement calculation API
