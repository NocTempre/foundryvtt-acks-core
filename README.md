# ACKS II Core System for FoundryVTT (NocTempre Fork)

**Status:** Alpha - Experimental Features. Test in a fresh world and keep backups.

This is an experimental fork of the official ACKS II system, adding hexcrawl/travel management features while tracking upstream development. **Do not** open issues for experimental features on Autarch's official repository.

---

## What's New in This Fork

This fork extends the official ACKS II system with comprehensive travel and hexploration features:

### 🗺️ Hexplorer Integration
Complete terrain-based movement system with optional Hexplorer module support:
- **17 terrain types** with accurate ACKS II movement multipliers, navigation throws, and encounter distances
- **Multi-layer support**: Ground, water, and air travel with appropriate vessels/mounts
- **Weather system**: 6 weather conditions affecting movement and navigation
- **Road types**: Earth, gravel, and paved roads with speed bonuses and driving proficiency support
- **Standalone or integrated**: Works without Hexplorer, but integrates seamlessly when installed

**Documentation**: See [Changelog.md](Changelog.md) for upstream ACKS II updates

### 🛤️ Edge-Based Road System
Roads are painted on hex edges (connections between hexes) rather than in hexes:
- **Directional roads**: Connect specific hex pairs, not entire hexes
- **Speed bonuses**: 1.5x base speed (2x with Driving proficiency)
- **Weather effects**: Rain makes earth roads ineffective, snow affects all roads
- **Visual representation**: Colored lines on hex edges (brown/gray/dark gray)

### 🎒 Travel Party System
New "Travel Party" actor type for managing overland expeditions:
- **Party composition**: Add characters, henchmen, and pack animals to travel groups
- **Vehicle/mount management**: Assign drivers, passengers, and cargo
- **Automatic calculations**: Speed based on slowest member, terrain, roads, and weather
- **Encumbrance tracking**: Real-time weight distribution across party members and animals
- **Item transfer system**: Lend gear to pack animals and retrieve it later
- **Container support**: Bags, chests, and magical containers (bag of holding with weight reduction)
- **Split groups**: Manage multiple sub-parties with separate tracking

### 📦 Advanced Encumbrance System
Sophisticated item ownership and transfer mechanics:
- **Item lending**: Transfer items between party members with retrieval restrictions
- **Delegated items**: Track who has your gear and retrieve it when needed
- **Container system**: Nested items with capacity and weight reduction
- **Vehicle cargo**: Automatic calculation of passenger weight + crew + items
- **Overload warnings**: Visual indicators for overencumbered members and vehicles
- **Mount equipment**: Data structures ready for saddles, harnesses, and barding (future)

### 🔮 Framework V2 Architecture
Long-term architectural improvements for maintainability:
- Migration to Foundry v12+ DataModel
- Modular system design with clear extension points
- App v2 interface migration (ongoing)
- Separation of core mechanics from content

---

## Installation

### Method 1: As Additional System (Recommended for Testing)
1. Download or clone this repository
2. Place in `Data/systems/acks-fork` (or similar name)
3. Create a new world using this system
4. Your official ACKS II system remains unchanged

### Method 2: Replace Official System (Not Recommended)
Only if you want to use experimental features in existing worlds:
1. **Backup your world first!**
2. Replace the official ACKS system files
3. Data migrations are not guaranteed

### Optional Module Integrations
Install these modules for enhanced functionality:
- **Hexplorer** - Hex-based map painting and exploration tools
- **Simple Calendar** / **Small Time** - Weather and time tracking
- **Weather Control** - Weather effects integration

Enable integrations in: **Game Settings** → **System Settings** → **ACKS Settings**

---

## Quick Start Guide

### Using Terrain Movement Calculations
Works even without Hexplorer installed:

1. Open a character sheet
2. Access movement calculator via console or macro:
```javascript
const actor = game.actors.getName("Character Name");
const result = game.acks.hexplorer.calculateHexMovement(
  actor,
  "forest-deciduous",
  {
    roadType: "earth",
    weather: "clear",
    partySize: 6,
    hasDriving: false
  }
);
```

### Creating a Travel Party
1. Create a new "Travel Party" actor
2. Drag characters and pack animals onto the party sheet
3. Assign animals as draft animals (set `draftAnimal.enabled` and `normalLoad`)
4. Transfer gear from characters to pack animals (right-click items)
5. Monitor encumbrance and speed on the party sheet

### Transferring Items to Pack Animals
1. Right-click any weapon, armor, or equipment item on a character sheet
2. Select **"Transfer to Party Member"**
3. Choose the recipient (mule, wagon, etc.)
4. Set retrieval restriction (default: same-party)
5. Item is removed from character and added to animal
6. Encumbrance updates automatically

### Retrieving Delegated Items
1. Open the character sheet
2. Click **"Retrieve Delegated Items"** button
3. Select items to retrieve (grayed if outside retrieval range)
4. Items return to your character

---

## Feature Documentation

### Core System Features
For official ACKS II features and updates, see:
- **[Changelog.md](Changelog.md)** - Complete release history of official ACKS II system
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development guidelines and code standards

### Experimental Features (This Fork)

#### Terrain & Movement
- **Terrain types**: 17 ground terrains, 3 water types, 1 air layer
- **Movement multipliers**: Grassland (1x), Forest/Hills (0.67x), Jungle/Swamp (0.5x)
- **Navigation throws**: Target numbers for getting lost (6+ to 14+)
- **Encounter distances**: Varied by terrain (5d4×3' in jungle to 6d20×30' in steppe)
- **Party size modifiers**: Small (1-6) to Huge (61+) affect evasion

**Terrain Key Reference**:
| Key | Terrain | Movement | Navigation |
|-----|---------|----------|------------|
| `grassland` | Grassland | ×1 | 6+ |
| `forest-deciduous` | Deciduous Forest | ×2/3 | 8+ |
| `jungle` | Jungle | ×1/2 | 14+ |
| `mountains-rocky` | Rocky Mountains | ×1/2 | 6+ |
| `desert-sandy` | Sandy Desert | ×2/3 | 6+ |
| `swamp-marshy` | Marshy Swamp | ×1/2 | 10+ |
| `water-calm` | Calm Water | ×1 | 6+ (requires vessel) |

Full list: 17 ground + 3 water + 1 air terrain

#### Roads & Infrastructure
- **Road types**: Earth, gravel, paved
- **Speed bonuses**: All roads provide ×1.5 speed (×2 with Driving proficiency)
- **Weather effects**:
  - Earth roads: Ineffective in rain, mud, or snow
  - Gravel roads: Ineffective in mud or snow
  - Paved roads: Ineffective in snow only
- **Edge-based storage**: Roads stored as connections between hexes (`"5-10:5-11": "paved"`)

#### Travel Party Features
- **Automatic speed calculation**: Based on slowest member after modifiers
- **Encumbrance rollup**: Shows total party capacity and current load
- **Vehicle management**: Assign draft animals, drivers (with proficiency check), passengers
- **Split groups**: Create scout parties or separated groups
- **Time tracking**: Hours traveled per day, encounter roll history

#### Item Transfer & Containers
- **Ownership tracking**: Items remember original owner and current carrier
- **Transfer restrictions**: Control when items can be retrieved
  - `same-party`: Must be in same Travel Party (default)
  - `same-hex`: Must be in same hex
  - `same-scene`: Must be in same scene
  - `always`: No restrictions
  - `gm-approval`: GM only
- **Container system**: Bags, chests, saddlebags with capacity limits
- **Weight reduction**: Bag of Holding (90% reduction), other magical containers
- **Vehicle cargo**: Automatic calculation including passenger body weight

#### Weather & Time Integration
When optional modules are installed and enabled:
- **Weather changes** automatically update movement calculations
- **Time advancement** can trigger encounter checks (future)
- **Calendar integration** for day/night cycles and seasonal effects

---

## System Architecture

### File Structure (Experimental Features)
```
src/module/
├── terrain-config.js              # Terrain definitions and movement rules
├── hexplorer-integration.js       # Movement calculation API
├── hexplorer-brush-injection.js   # Hexplorer brush integration (optional)
├── module-integrations.js         # Optional module detection and hooks
├── road-painter.js                # Edge-based road system
├── item-transfer.js               # Item ownership and transfer utility
├── container-manager.js           # Container and nested item system
└── dialog/
    └── item-transfer-dialog.js    # Transfer UI dialogs

src/module/actor/
├── travel-party-sheet.js          # Travel Party actor sheet
└── entity.js                      # Enhanced encumbrance calculations

src/templates/actors/
├── travel-party-sheet.html        # Travel Party UI
└── partials/travel-party-*.html   # Tab templates
```

### Data Models

#### Travel Party Actor
```javascript
system: {
  members: [{ actorId, role, mount, vehicle, vehicleSlot }],
  movement: { slowestSpeed, terrainMultiplier, roadMultiplier, finalSpeed },
  travel: { active, hoursToday, currentTerrain, currentRoad },
  encounters: { rollsToday, history },
  splitGroups: [{ name, memberIds, active }]
}
```

#### Item Ownership
```javascript
system.ownership: {
  originalOwner: "actor-id",
  currentCarrier: "actor-id",
  transferredAt: timestamp,
  isLent: boolean,
  retrievalRestriction: "same-party" | "same-hex" | "always" | "gm-approval"
}
```

#### Container Items
```javascript
system.container: {
  isContainer: boolean,
  capacityStone: number,
  capacityReduction: number,    // 0.9 = 90% reduction (bag of holding)
  requiresMount: boolean,        // Saddlebags need mount
  containedItems: [],
  currentWeight: number
}
```

---

## API Reference

### Terrain & Movement
```javascript
// Calculate hex movement
game.acks.hexplorer.calculateHexMovement(actor, terrainKey, options)

// Get terrain types
game.acks.hexplorer.getAllTerrainTypes()
game.acks.hexplorer.getTerrainsByLayer("ground" | "water" | "air")

// Roll encounter distance
game.acks.hexplorer.rollEncounterDistance(terrainKey)

// Display movement summary in chat
game.acks.hexplorer.createMovementSummary(actor, terrainKey, options)
```

### Road System
```javascript
// Set a road between two hexes
await RoadPainter.setRoad(cell1, cell2, "paved" | "gravel" | "earth" | null)

// Get road type
const roadType = RoadPainter.getRoadBetween(cell1, cell2)

// Get all roads in scene
const roads = RoadPainter.getRoads()
```

### Item Transfer
```javascript
// Transfer item
await game.acks.ItemTransfer.transferItem(item, fromActor, toActor, { restriction })

// Retrieve item
await game.acks.ItemTransfer.retrieveItem(itemUuid, originalOwner)

// Get encumbrance breakdown
const enc = await game.acks.ItemTransfer.getEffectiveEncumbrance(actor)
// Returns: { base, delegated, received, effective }
```

### Container Management
```javascript
// Create container
await game.acks.ContainerManager.createContainer(actor, {
  name, capacity, capacityReduction, requiresMount, baseWeight
})

// Add/remove items
await game.acks.ContainerManager.addToContainer(item, container, carrier)
await game.acks.ContainerManager.removeFromContainer(itemId, container, carrier)

// Show container contents
await game.acks.ContainerManager.showContainerDialog(container, carrier)
```

---

## Known Issues & Limitations

### Experimental Features
- **Breaking changes likely**: Data structures may change between versions
- **No migration guarantees**: Backup before updating
- **Limited testing**: Use in test worlds first
- **Module conflicts possible**: Disable integrations if issues occur

### Specific Limitations
- **Road painting UI**: Manual API calls required (UI tool planned)
- **Mount equipment**: Data structures ready but not implemented
- **Encounter automation**: Time-based rolls not yet automated
- **Pathfinding**: No automatic route calculation yet
- **Lair placement**: Manual only

### Compatibility
- **Foundry VTT**: v12+ (v13 compatible)
- **ACKS II System**: Tracks official upstream releases
- **Hexplorer**: Optional, any version (hooks may need adjustment)
- **Conflicts**: None known, but integrations are optional

---

## Troubleshooting

### Integration Not Working
1. Check module is installed and active
2. Enable integration in **Game Settings** → **System Settings** → **ACKS Settings**
3. Reload Foundry
4. Check browser console for errors

### Items Won't Transfer
1. Verify both actors are in a Travel Party
2. Check item type (spells, abilities, languages, money cannot transfer)
3. Look for console errors

### Can't Retrieve Items
1. Check retrieval restriction setting
2. Verify actors meet restriction criteria (same party/hex/scene)
3. Ensure item still exists on carrier

### Encumbrance Not Updating
1. Force recalculation: `actor.computeEncumbrance()`
2. Check item `weight6` property is set
3. Verify character vs monster encumbrance type

### Roads Not Applying
1. Check road exists between hexes: `RoadPainter.getRoadBetween(cell1, cell2)`
2. Verify road type in scene flags
3. Check weather hasn't made road ineffective

---

## Development Roadmap

### Completed Features ✅
- ✅ Terrain configuration (17 types, 3 layers)
- ✅ Movement calculation engine
- ✅ Weather system integration
- ✅ Road type definitions
- ✅ Edge-based road data model
- ✅ Travel Party actor type
- ✅ Item transfer system
- ✅ Container system
- ✅ Encumbrance tracking
- ✅ Vehicle cargo management

### In Progress 🚧
- 🚧 Road painting UI tool
- 🚧 Hexplorer brush injection
- 🚧 Calendar/time integration hooks
- 🚧 Framework V2 migration

### Planned Features 📋
- Mount equipment (saddles, harnesses, barding)
- Automated encounter checks
- Hex exploration tracking
- Lair generation tools
- Getting lost mechanics
- Foraging and resource gathering
- Party marching order
- Scout mechanics
- Domain management integration

---

## Contributing

### For This Fork
Open issues **on this repository** with:
- Clear reproduction steps
- Feature tag (`hexplorer-bridge`, `party-travel`, `roads`, etc.)
- Screenshots/console errors if applicable

Do **not** file experimental feature bugs on Autarch's official repository.

### For Official ACKS II Features
See **[CONTRIBUTING.md](CONTRIBUTING.md)** for:
- Code style guidelines
- Development workflow
- Testing procedures
- Pull request process

### Development Setup
See [docs/dev-setup.md](docs/dev-setup.md) and [docs/dev-workflow.md](docs/dev-workflow.md)

---

## Credits & Attribution

### System Development
- **Original ACKS System**: U~Man (Old School Essentials base, GNUv3)
- **ACKS II Official System**: Autarch LLC development team
- **Experimental Fork**: NocTempre (travel/hexcrawl features)

### Content & Rules
- **Adventurer Conqueror King System**: Designed by Alexander Macris, published by Autarch LLC
- **ACKS II**: © 2024 Autarch LLC

### Artwork & Icons
- Game-icons.net icons (various contributors)
- Flaticon.com icons (licensed content)
- See individual files for specific attributions

## License
### System

This system is offered and may be used under the terms of
the [<span class="underline">Simulationist Adventure Game Authorization (SAGA) License v1.0</span>](saga-license.md),
the [<span class="underline">Autarch Compatibility License</span>](autarch-compatibility-license.md), and
the [<span class="underline">Autarch Community Use Guidelines</span>](autarch-community-use-guidelines.md).

This code is modified from a fork of the v1.0 code of the Old School Essentials System written by U~Man, and released under the GNUv3 license. The software source of this system is also distributed under the GNUv3 license and is considered open source.

Autarch, Adventurer Conqueror King, Adventurer Conqueror King System,
ACKS, ACKS II, and Imperial Imprint are trademarks of Autarch LLC.
You may find further information about the system
at [<span class="underline">autarch.co</span>](https://autarch.co/).
Auran Empire is trademark Alexander Macris.
