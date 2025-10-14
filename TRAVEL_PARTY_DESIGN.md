# Travel Party Actor Type - Design Document

## Overview
A new actor type for managing overland travel, including party composition, vehicles/mounts, automated encounter rolls, and integration with Hexplorer terrain + ACKS roads + Calendar weather.

## Core Architecture

### Actor Type: `travel-party`
New actor type alongside `character` and `monster`, representing a traveling group.

### Data Model

```javascript
system: {
  // Party Composition
  members: [
    {
      actorId: "actor-uuid",
      role: "member" | "driver",
      mount: "mount-item-id" | null,
      vehicle: "vehicle-item-id" | null,
      vehicleSlot: "driver" | "rider" | "passenger"
    }
  ],

  // Movement Calculation (derived)
  movement: {
    slowestSpeed: 24,          // Base expedition speed of slowest member
    terrainMultiplier: 1,      // From Hexplorer hex or manual selection
    roadMultiplier: 1,         // From Hexplorer hex or manual selection
    weatherMultiplier: 1,      // From calendar module
    finalSpeed: 24,            // Calculated result
    hoursPerDay: 8,            // Configurable
    milesPerDay: 24            // finalSpeed
  },

  // Travel State
  travel: {
    active: false,
    hoursToday: 0,
    daysTotal: 0,
    currentTerrain: "grassland",
    currentRoad: null,
    currentWeather: "clear"
  },

  // Encounter Tracking
  encounters: {
    rollsToday: [],           // [{hour: 1, roll: 15, success: false}, ...]
    history: []               // Past encounters
  },

  // Split Groups
  splitGroups: [
    {
      name: "Main Party",
      memberIds: ["actor-1", "actor-2"],
      active: true
    }
  ]
}
```

### Vehicle/Mount Items

Extend existing item types or create new ones:

```javascript
// New item type: "vehicle" or extend "item"
system: {
  type: "mount" | "wagon" | "cart" | "boat" | "ship",
  expeditionSpeed: 48,        // Base speed
  capacity: {
    driver: {
      slots: 1,
      occupied: [],           // actorIds
      requiresProficiency: true,
      proficiency: "Driving"
    },
    rider: {
      slots: 2,
      occupied: []
    },
    passenger: {
      slots: 0,
      occupied: []
    },
    cargo: {
      weight: 500,            // stones
      current: 200
    }
  }
}
```

## UI Design

### Travel Party Sheet (reuse henchman patterns)

**Tabs:**
1. **Party Members** (similar to henchman tab)
   - List of party members with their speeds
   - Add/remove members
   - Assign to vehicles/mounts
   - Shows slowest member

2. **Vehicles & Mounts**
   - List of vehicles/mounts (items)
   - Capacity display (slots filled/total)
   - Assign driver (check for proficiency)
   - Drag actors to assign

3. **Travel**
   - Current terrain (from Hexplorer or manual select)
   - Current road type (from Hexplorer or manual select)
   - Current weather (from Calendar or manual)
   - Movement speed calculation display
   - Start/Stop travel button
   - Hours traveled today
   - Encounter roll history

4. **Split Groups**
   - Manage multiple sub-parties
   - Each tracks separately

### Integration Points

#### Hexplorer Integration
- Read terrain from painted hex when token moves
- Read road type from hex flags
- Button to manually select if not using Hexplorer

#### Road Type System (Edge-Based Painting)
**Design Philosophy:** Roads connect hexes, so paint them on edges (not in hexes)

- Roads are painted on **hex edges** (connections between adjacent hexes)
- Storage: `scene.flags.acks.roads = { "5-10:5-11": "paved", "5-11:6-11": "earth" }`
- Edge key format: `"i1-j1:i2-j2"` (normalized/sorted for consistency)
- Visual: Draw colored lines along hex edges (brown=earth, gray=gravel, dark-gray=paved)
- UI: Click/hover between two hexes to paint road on that edge
- When Travel Party moves from hex A to hex B:
  - Check if edge A:B has a road (`RoadPainter.getRoadBetween(A, B)`)
  - Apply road multiplier if found
  - No road = travel over terrain only

**Implementation:** See `src/module/road-painter.js`

#### Calendar/Weather Integration
- Hook into Simple Calendar or similar
- Read current weather condition
- Map to ACKS weather types
- Apply movement modifiers

## Implementation Steps

### Phase 1: Data Model & Basic Actor
1. Create travel-party data template
2. Register travel-party actor type
3. Create basic travel-party sheet class
4. Add to actor creation dialog

### Phase 2: Party Member Management
5. Implement add/remove party members
6. Calculate slowest speed
7. Display party roster with speeds
8. Reuse henchman tab patterns

### Phase 3: Vehicle/Mount System
9. Create vehicle item type or extend existing
10. Implement capacity/slot system
11. Driver assignment and proficiency check
12. Drag-and-drop actor assignment

### Phase 4: Movement Calculation
13. Implement base speed calculation (slowest member)
14. Hexplorer terrain reading
15. Road type reading
16. Weather integration
17. Final speed calculation display

### Phase 5: Travel Tracking
18. Start/stop travel functionality
19. Hour tracking
20. Automated encounter rolls (1d20 per hour)
21. Encounter history display

### Phase 6: Hexplorer Road Injection
22. Add road brushes to Hexplorer
23. Store road type in hex flags
24. Read road type from hex when on it

### Phase 7: Split Groups
25. UI for creating sub-groups
26. Track multiple groups separately
27. Calculate speeds for each

## Technical Decisions

### Why Travel Party Actor Type?
- Keeps travel data separate from character sheets
- Allows multiple parties (split groups)
- Cleaner data model than extending character
- Can be saved/loaded for different expeditions

### Why Not Extend Character?
- Characters shouldn't track party-level data
- Avoids bloating character sheets
- Multiple characters could be in different parties
- Travel party can exist without specific characters

### Vehicle as Items
- Reuses existing item system
- Can be traded/sold
- Shows in inventory
- Extensible with effects

## Example Workflow

1. GM creates "Expedition to Borderlands" travel party actor
2. Adds 4 PC actors and 2 henchmen to party
3. Adds "War Horse" and "Wagon" items to party
4. Assigns driver to wagon (checks for Driving proficiency)
5. Places remaining members on horses or in wagon
6. System calculates slowest is wagon (12 miles/day)
7. GM starts travel
8. Each hour, system rolls 1d20 for encounters
9. As party moves on hex map, terrain/road auto-detected
10. Weather changes via calendar, speeds recalculate
11. GM can split party for scouting sub-group

## Files to Create/Modify

### New Files
- `src/module/actor/travel-party-sheet.js` - Sheet class
- `src/module/data/actor/travel-party-data.mjs` - Data model
- `src/templates/actors/travel-party-sheet.html` - Main template
- `src/templates/actors/partials/travel-party-*.html` - Tab partials
- `src/module/travel/*.js` - Travel calculation utilities

### Modified Files
- `src/module/actor/entity.js` - Add travel-party type handling
- `src/acks.js` - Register travel-party sheet
- `src/system.json` - Add travel-party to actor types
- `src/module/hexplorer-brush-injection.js` - Add road brushes
- `src/module/hexplorer-integration.js` - Road reading logic

## Next Steps

1. Review and approve design
2. Start with Phase 1 (data model)
3. Iterate through phases
4. Test at each phase
