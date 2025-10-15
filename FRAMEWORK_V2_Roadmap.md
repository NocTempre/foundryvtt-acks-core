# ACKS FoundryVTT Development Roadmap

Based on the Judge's Screen content, here's a structured development path:

## Phase 1: Data Model Migration & Core Foundation

### 1.1 Migrate to Foundry v2 Data Framework
- Update `template.json` to use new v2 data model structure
- Convert all data schemas to use `DataModel` classes
- Update item types (weapons, armor, equipment, vehicles, vessels)
- Update actor types (characters, monsters, henchmen, armies, domains)
- Create base classes for shared functionality

### 1.2 Core Combat System
**Priority: HIGH** (most frequently used)
- Combat round sequence automation
- Initiative system with declaration phase
- Attack throws by level/HD (page 4 tables)
- Saving throws by class (page 4)
- Morale system (page 3)
- Special maneuvers (page 6)
- Mortal wounds table with results (page 6)

### 1.3 Character/Monster Data
- Attack throw progression
- Saving throw progression  
- Movement speeds (combat/running/exploration)
- Encumbrance tracking
- XP calculation (page 6)

## Phase 2: Exploration & Travel Systems

### 2.1 Dungeon Delving
- Exploration speed tracking
- Turn-based time tracking
- Searching & listening mechanics
- Door interaction system
- Trap detection/disabling
- Climbing, swimming, squeezing rules
- Rest & recuperation tracking

### 2.2 Wilderness Travel (Integration with Hexplorer)
- Movement speed by terrain
- Hex-based travel tracking
- Encounter frequency by terrain/territory
- Navigation system
- Weather system (could integrate with Simple Calendar)
- Foraging & hunting
- Evasion mechanics
- Visibility ranges

### 2.3 Time Management (Integration with Simple Calendar)
- Turn tracking (10 minutes)
- Exploration turns
- Combat rounds
- Rest periods
- Weather changes
- Random encounters

## Phase 3: Vehicles & Mounts

### 3.1 Animal/Mount System
- Animal stats and abilities (page 2)
- Mount/rider mechanics
- Mounted combat attack tables
- Proficiency requirements

### 3.2 Land Vehicles
- Cart/wagon/chariot stats
- Vehicle combat
- Cargo capacity tracking

### 3.3 Naval Vessels
- Ship types and stats (page 12)
- Sailing mechanics (wind direction/speed)
- Naval combat and ramming
- Sea encounters
- Crew management

## Phase 4: Settlement & Commerce

### 4.1 Settlement System
- Market class definitions
- Equipment availability tables (page 17)
- Hireling availability by market class (page 17)
- Encounter frequency in settlements
- Movement within settlements

### 4.2 Mercantile System
- Cargo/passenger management
- Supply & demand assessment
- Price negotiation mechanics
- Trade route tracking
- Arbitrage trading

### 4.3 Magical Commerce
- Magic item availability by market class (page 20)
- Spell availability and costs
- Tower of Knowledge services
- Item identification mechanics

### 4.4 Henchmen System
- Recruitment mechanics (page 18)
- Loyalty system
- Morale tracking
- Obedience checks
- Level advancement

## Phase 5: Domain Management

### 5.1 Domain Rules
- Domain morale system (page 19)
- Garrison tracking
- Tax/tithe collection
- Territory classification
- Monthly domain events

### 5.2 NPC Reactions
- Reaction roll system (page 19)
- Diplomacy/intimidation/seduction modifiers
- Attitude tracking

## Phase 6: Warfare System

### 6.1 Army Management
- Unit creation and tracking
- Brigade organization
- Supply lines and costs
- Movement of large armies
- Reconnaissance system (page 15)

### 6.2 Battle System
- Battlefield setup
- Unit attack mechanics
- Unit morale
- Pursuit rules
- Battle types (pitched, meeting engagement, etc.)

### 6.3 Siege System
- Blockade mechanics
- Artillery bombardment
- Siege duration calculation
- Pillaging results

## Implementation Recommendations

### Module Integration Strategy

**Simple Calendar Integration:**
- Use for weather tracking
- Time-based encounter rolls
- Rest period tracking
- Domain monthly events
- Keep as optional dependency

**Hexplorer Integration:**
- Use for wilderness movement
- Terrain-based movement modifiers
- Hex-based encounter distances
- Territory classification
- Keep as optional dependency

### Technical Approach

1. **Create Abstract Base Classes:**
```javascript
// Example structure
class ACKSDataModel extends foundry.abstract.DataModel {
  // Shared ACKS functionality
}

class ACKSActor extends Actor {
  // ACKS-specific actor methods
}

class ACKSItem extends Item {
  // ACKS-specific item methods
}
```

2. **Modular Systems:**
- Create separate modules for each major system (combat, travel, commerce, warfare)
- Use event-driven architecture for inter-system communication
- Allow systems to be toggled on/off in settings

3. **Data Structure:**
```javascript
// Example v2 data model
class CharacterData extends ACKSDataModel {
  static defineSchema() {
    return {
      level: new fields.NumberField({required: true, initial: 1}),
      experience: new fields.NumberField({required: true, initial: 0}),
      attackThrow: new fields.NumberField({required: true, initial: 10}),
      savingThrows: new fields.SchemaField({
        paralysis: new fields.NumberField({required: true}),
        death: new fields.NumberField({required: true}),
        blast: new fields.NumberField({required: true}),
        implements: new fields.NumberField({required: true}),
        spells: new fields.NumberField({required: true})
      }),
      // ... other fields
    }
  }
}
```

### Priority Order

**Immediate (v0.1-0.3):**
1. Data model migration
2. Basic combat system
3. Character/monster statistics

**Short-term (v0.4-0.6):**
4. Dungeon exploration
5. Basic travel system
6. Simple settlement interactions

**Mid-term (v0.7-0.9):**
7. Full wilderness system
8. Commerce systems
9. Henchmen management

**Long-term (v1.0+):**
10. Domain management
11. Warfare system
12. Naval combat

### Testing Strategy

- Create test campaigns for each major system
- Provide sample content (pre-made characters, monsters, items)
- Create automated tests for calculation-heavy systems (combat, trade, warfare)

Would you like me to detail any specific phase or system in more depth?