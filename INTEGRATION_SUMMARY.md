# Hexplorer Integration - Implementation Summary

## Files Created

### Core Configuration
1. **[src/module/terrain-config.js](src/module/terrain-config.js)**
   - 17 terrain types (ground/water/air layers)
   - Road types with speed multipliers
   - Weather conditions and effects
   - Vessel types (water and air)
   - All movement modifiers from ACKS rules

### Integration Layer
2. **[src/module/hexplorer-integration.js](src/module/hexplorer-integration.js)**
   - `calculateHexMovement()` - Main calculation API
   - `createMovementSummary()` - Display formatted movement info
   - `rollEncounterDistance()` - Roll encounter distances
   - `rollLairsPerHex()` - Roll number of lairs
   - Helper methods for UI and data access

3. **[src/module/module-integrations.js](src/module/module-integrations.js)**
   - Detects optional modules (Hexplorer, Weather, Timekeeping)
   - Sets up hooks for module communication
   - Adds "Hex Movement" button to character sheets
   - Provides movement calculator dialog
   - Handles weather display and time tracking

### System Updates
4. **[src/module/settings.js](src/module/settings.js)** - Updated
   - Added `hexplorerIntegration` toggle
   - Added `weatherIntegration` toggle
   - Added `timekeepingIntegration` toggle

5. **[src/module/config.js](src/module/config.js)** - Updated
   - Imported and exposed `TERRAIN_CONFIG`
   - Available at `CONFIG.ACKS.terrain`

6. **[src/acks.js](src/acks.js)** - Updated
   - Imported integration modules
   - Initialized on system startup
   - Exposed at `game.acks.hexplorer` and `game.acks.terrain`

### Documentation
7. **[HEXPLORER_INTEGRATION.md](HEXPLORER_INTEGRATION.md)**
   - Complete user guide
   - API reference
   - Examples and troubleshooting

## Key Features

### ✅ Terrain-Based Movement
- 17 terrain types with accurate ACKS II multipliers
- Navigation throws and encounter distances per terrain
- Party size-based evasion modifiers

### ✅ Road Travel
- 3 road types (earth, gravel, paved)
- Driving proficiency support (x2 instead of x3/2)
- Weather effects on road effectiveness

### ✅ Weather System
- 6 weather conditions
- Movement and navigation modifiers
- Road and water travel effects

### ✅ Multi-Layer Support
- **Ground layer** - Standard terrain travel
- **Water layer** - Ships and boats (6 vessel types)
- **Air layer** - Flying mounts and airships (6 vessel types)

### ✅ Optional Integration
- Works standalone without any modules
- Optionally integrates with Hexplorer
- Optionally integrates with Weather modules
- Optionally integrates with Timekeeping modules
- All integrations toggle-able in settings

### ✅ User Interface
- "Hex Movement" button on character sheets
- Movement calculator dialog
- Chat message output with formatting
- Weather display (when enabled)

## How It Works

```
┌─────────────────────┐
│   Character Sheet   │
│  [Hex Movement]     │ ← Button added when integration enabled
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Movement Dialog    │
│  - Terrain: Forest  │
│  - Road: Earth      │
│  - Weather: Rain    │
│  - Party Size: 6    │
│  [Calculate]        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ HexplorerIntegration│
│ .calculateHexMovement()
│  - Base Speed       │
│  × Terrain Mult     │
│  × Road Mult        │
│  + Weather Effects  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Chat Message      │
│ Forest (Deciduous)  │
│ Speed: 16 mi/day    │
│ Navigation: 8+      │
│ Encounter: 5d8×3'   │
│ Evasion: 2+         │
└─────────────────────┘
```

## Testing Checklist

### Basic Functionality
- [ ] Terrain config loads without errors
- [ ] Integration initializes on system start
- [ ] Settings appear in Game Settings
- [ ] `game.acks.terrain` is accessible
- [ ] `game.acks.hexplorer` is accessible

### Without Modules
- [ ] Can call `calculateHexMovement()` directly
- [ ] Returns correct movement calculations
- [ ] Weather effects apply correctly
- [ ] Road bonuses calculate correctly
- [ ] Vessel speeds work for water/air

### With Hexplorer Module
- [ ] Module is detected when active
- [ ] Integration setting enables features
- [ ] "Hex Movement" button appears on character sheet
- [ ] Calculator dialog opens and works
- [ ] Chat messages display correctly
- [ ] Hex clicks show movement info (if Hexplorer supports)

### With Weather Module
- [ ] Weather changes are detected
- [ ] Movement calculations update with weather
- [ ] Road effectiveness changes with weather
- [ ] Weather display shows (if implemented)

### With Timekeeping Module
- [ ] Time advancement is detected
- [ ] Hooks fire correctly
- [ ] Future encounter system can hook in

## API Examples

### Basic Movement Calculation
```javascript
const actor = game.actors.getName("Thorin");
const result = game.acks.hexplorer.calculateHexMovement(
  actor,
  "mountains-rocky",
  { partySize: 8 }
);
console.log(result.speeds.expedition); // miles per day
```

### With All Options
```javascript
const result = game.acks.hexplorer.calculateHexMovement(
  actor,
  "grassland",
  {
    roadType: "paved",
    weather: "rain",
    vessel: null,
    partySize: 12,
    hasDriving: true
  }
);
```

### Display in Chat
```javascript
const summary = game.acks.hexplorer.createMovementSummary(
  actor,
  "forest-deciduous",
  { weather: "clear", partySize: 6 }
);

ChatMessage.create({ content: summary });
```

### Get Terrain Lists
```javascript
// All terrains
game.acks.hexplorer.getAllTerrainTypes();

// By layer
game.acks.hexplorer.getTerrainsByLayer("water");

// Direct access
game.acks.terrain.terrainTypes["jungle"];
```

## Next Steps for Hexplorer Module

When implementing actual Hexplorer integration, you may need to:

1. **Check Hexplorer's actual hooks** - The hook names I used are proposed. Check Hexplorer's documentation for actual hook names.

2. **Hex Data Format** - Verify how Hexplorer stores terrain and road data on hexes.

3. **UI Integration** - Determine where/how to display movement info in Hexplorer's interface.

4. **Scene Integration** - Test with actual Hexplorer scenes and hex grids.

## Compatibility

- **Foundry VTT**: v12+ (v13 compatible)
- **ACKS System**: Current version
- **Hexplorer**: Any version (hooks are proposed, may need adjustment)
- **Weather Modules**: Weather Control and similar
- **Timekeeping Modules**: Simple Calendar, Small Time, Simple Timekeeping

## Future Enhancements

Consider implementing:
1. Automatic encounter checks based on time and terrain
2. Hex exploration/discovery tracking
3. Lair generation and placement
4. Getting lost mechanics
5. Foraging and resource gathering
6. Party formation and marching order
7. Scout mechanics and surprise modifiers
8. Integration with ACKS encounter tables

## Support

For questions or issues:
1. Check [HEXPLORER_INTEGRATION.md](HEXPLORER_INTEGRATION.md) for usage guide
2. Review JSDoc comments in source files
3. Check browser console for errors
4. Verify settings are enabled and modules are active
