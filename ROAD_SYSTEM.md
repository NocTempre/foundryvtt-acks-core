# Edge-Based Road System for ACKS Hexploration

## Overview

Roads in ACKS are painted on **hex edges** (the connections between adjacent hexes) rather than in hex cells. This matches the real-world concept that roads connect places and have directionality.

## Why Edge-Based?

**Traditional Problem:** If roads are painted in hex cells, you can't tell which direction the road goes through the hex. A hex might have a road, but does it go North-South? East-West? All directions?

**Edge-Based Solution:** Paint roads on the edges between hexes. This naturally represents:
- Roads have **direction** (they connect specific hexes)
- Roads connect **two places** (hex A to hex B)
- Travel bonuses only apply when **using that specific road**

## Data Storage

Roads are stored in scene flags using edge keys:

```javascript
scene.flags.acks.roads = {
  "5-10:5-11": "paved",      // Paved road between hex (5,10) and hex (5,11)
  "5-11:6-11": "earth",      // Earth road between hex (5,11) and hex (6,11)
  "6-11:6-10": "gravel"      // Gravel road between hex (6,11) and hex (6,10)
}
```

### Edge Key Format

**Format:** `"i1-j1:i2-j2"` where cells are sorted alphabetically
- First part: `i-j` coordinates of first hex
- Colon separator
- Second part: `i-j` coordinates of second hex
- Always sorted so `"5-10:5-11"` and `"5-11:5-10"` both become `"5-10:5-11"`

**Example:**
- Edge between hex (5,10) and (5,11) = `"5-10:5-11"`
- Edge between hex (7,8) and (6,8) = `"6-8:7-8"` (sorted)

## Visual Representation

Roads are drawn as colored lines on hex edges:

| Road Type | Color | Line Width |
|-----------|-------|------------|
| Earth | Brown (#8B4513) | 15% of hex width |
| Gravel | Gray (#808080) | 15% of hex width |
| Paved | Dark Gray (#404040) | 15% of hex width |

Lines are drawn from hex center to adjacent hex center, creating visible roads on the map.

## API Usage

### RoadPainter Class

Located in `src/module/road-painter.js`

```javascript
// Set a road between two hexes
await RoadPainter.setRoad(cell1, cell2, "paved");

// Get road type between two hexes
const roadType = RoadPainter.getRoadBetween(cell1, cell2);
// Returns: "paved" | "gravel" | "earth" | null

// Remove a road
await RoadPainter.setRoad(cell1, cell2, null);

// Get all roads in scene
const roads = RoadPainter.getRoads();
// Returns: { "5-10:5-11": "paved", ... }
```

### Helper Functions

```javascript
// Create edge key from two cells
const key = RoadPainter.getEdgeKey(cell1, cell2);
// Returns: "5-10:5-11"

// Parse edge key back to cells
const [cell1, cell2] = RoadPainter.parseEdgeKey("5-10:5-11");
// Returns: [{i:5, j:10}, {i:5, j:11}]

// Find edge near mouse position
const edge = RoadPainter.findEdgeAtPosition(mousePos);
// Returns: [cell1, cell2] or null
```

## Integration with Travel Party

When a Travel Party token moves from hex A to hex B:

```javascript
// In Travel Party movement handler
const currentCell = { i: 5, j: 10 };
const nextCell = { i: 5, j: 11 };

// Check for road
const roadType = RoadPainter.getRoadBetween(currentCell, nextCell);

if (roadType) {
  // Apply road bonus
  const roadConfig = TERRAIN_CONFIG.roadTypes[roadType];
  const roadMultiplier = partyHasDriver
    ? roadConfig.drivingMultiplier  // 2x
    : roadConfig.speedMultiplier;    // 1.5x

  finalSpeed = baseSpeed * terrainMultiplier * roadMultiplier;
} else {
  // No road - terrain only
  finalSpeed = baseSpeed * terrainMultiplier;
}
```

## UI Design (To Be Implemented)

### Road Painting Tool

1. **Activate Road Painter**
   - New scene control tool (like walls or lighting)
   - Select road type (earth, gravel, paved)

2. **Paint Roads**
   - Hover between two hexes
   - Edge highlight shows where road will be placed
   - Click to paint road on that edge
   - Right-click to remove road

3. **Visual Feedback**
   - Hovered edge shows preview
   - Painted roads visible as colored lines
   - Road type label on hover

### Road Palette

```
Road Types:
- Earth Road    (1.5x / 2x with Driving)
- Gravel Road   (1.5x / 2x with Driving)
- Paved Road    (1.5x / 2x with Driving)
- Remove Road
```

## Example: Building a Road Network

```javascript
// Create a road from town (5,10) to dungeon (8,10)
// Route: (5,10) -> (6,10) -> (7,10) -> (8,10)

await RoadPainter.setRoad({i:5, j:10}, {i:6, j:10}, "paved");
await RoadPainter.setRoad({i:6, j:10}, {i:7, j:10}, "paved");
await RoadPainter.setRoad({i:7, j:10}, {i:8, j:10}, "earth");

// Now when Travel Party moves along this route:
// - (5,10) to (6,10): Paved road bonus
// - (6,10) to (7,10): Paved road bonus
// - (7,10) to (8,10): Earth road bonus
// - (8,10) to (8,11): No road, terrain only
```

## Technical Details

### Canvas Layer

Roads are drawn on a custom PIXI.Container layer:
- `canvas.acksRoads` - Container for all road graphics
- Child of `canvas.controls` (above terrain, below tokens)
- Redrawn when scene loads or roads change

### Performance

- Roads stored as simple object in scene flags
- Efficient key lookups (O(1))
- Only visible roads are drawn
- Graphics refreshed on scene changes

### Compatibility

- **Hexplorer:** Works alongside Hexplorer terrain
- **Other modules:** Doesn't conflict with walls, lighting, etc.
- **Foundry VTT:** Uses standard grid API (`canvas.grid.getAdjacentOffsets`)

## Future Enhancements

### Phase 2 (Optional)
- Road quality/condition (damaged roads = slower)
- Seasonal effects (snow closes earth roads)
- Bridge markers for river crossings
- Toll booths / encounter points

### Phase 3 (Advanced)
- Pathfinding along roads
- Auto-calculate fastest route
- Road construction costs (for domain management)
- Random events on specific road segments

## Implementation Status

- [x] Data model design
- [x] Core `RoadPainter` class
- [x] Edge key system
- [x] Get/set/remove roads
- [x] Canvas rendering (basic)
- [ ] UI tool for painting
- [ ] Mouse edge detection
- [ ] Preview on hover
- [ ] Scene control integration
- [ ] Travel Party integration

## Files

- `src/module/road-painter.js` - Core road system
- `src/module/terrain-config.js` - Road type definitions
- `TRAVEL_PARTY_DESIGN.md` - Travel Party integration
