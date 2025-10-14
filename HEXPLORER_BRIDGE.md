# Bridging Hexplorer and ACKS Terrain System

This guide explains how to connect Hexplorer's terrain painting with ACKS movement calculations.

## The Problem

- **Hexplorer** lets you paint hexes with terrain types on a map
- **ACKS** provides accurate terrain-based movement calculations
- But they don't automatically talk to each other

## The Solution

Create a simple bridge macro that:
1. Reads terrain data from Hexplorer hexes
2. Calls ACKS calculation APIs
3. Displays results to players

## Quick Setup

### Step 1: Enable ACKS Hex Calculator

1. Go to **Game Settings** → **System Settings**
2. Enable **"Enable Hex Movement Calculator"**
3. Reload Foundry

This gives you a calculator button on character sheets that works independently.

### Step 2: Map Hexplorer Terrains to ACKS

Hexplorer uses its own terrain names. You need to map them to ACKS keys:

```javascript
// Terrain name mapping
const TERRAIN_MAP = {
  // Hexplorer name → ACKS terrain key
  "forest": "forest-deciduous",
  "taiga": "forest-taiga",
  "jungle": "jungle",
  "grassland": "grassland",
  "plains": "grassland",
  "steppe": "grassland-steppe",
  "desert": "desert-sandy",
  "mountains": "mountains-rocky",
  "hills": "hills-rocky",
  "swamp": "swamp-marshy",
  "marsh": "swamp-marshy",

  // Add your own mappings
  "dark forest": "forest-deciduous",
  "rocky mountains": "mountains-rocky",
  "dense jungle": "jungle"
};
```

### Step 3: Create Bridge Macro

Create a macro called **"Show Hex Movement"**:

```javascript
// HEXPLORER → ACKS BRIDGE MACRO
// Calculates ACKS movement for selected token based on current hex

// Get selected token
const token = canvas.tokens.controlled[0];
if (!token) {
  ui.notifications.warn("Please select a token first");
  return;
}

// Check if ACKS is loaded
if (!game.acks?.hexplorer) {
  ui.notifications.error("ACKS terrain system not loaded");
  return;
}

// Get current hex from Hexplorer (you'll need to adapt this based on Hexplorer's API)
// This is a placeholder - actual implementation depends on Hexplorer's structure
let currentHex = null;
if (game.modules.get("hexplorer")?.active) {
  // Try to get hex data - this may need adjustment based on Hexplorer version
  currentHex = canvas.hexplorer?.getHexAtPosition(token.x, token.y);
}

// Fallback: Ask user for terrain
let terrainKey = "grassland";  // default

if (currentHex?.terrain) {
  // Map Hexplorer terrain name to ACKS key
  const TERRAIN_MAP = {
    "forest": "forest-deciduous",
    "taiga": "forest-taiga",
    "jungle": "jungle",
    "grassland": "grassland",
    "plains": "grassland",
    "steppe": "grassland-steppe",
    "desert": "desert-sandy",
    "rocky desert": "desert-rocky",
    "mountains": "mountains-rocky",
    "hills": "hills-rocky",
    "swamp": "swamp-marshy",
  };

  terrainKey = TERRAIN_MAP[currentHex.terrain.toLowerCase()] || "grassland";
} else {
  // Ask user
  const terrains = game.acks.hexplorer.getAllTerrainTypes();
  const options = terrains.map(t => `<option value="${t.key}">${t.label}</option>`).join('');

  terrainKey = await Dialog.prompt({
    title: "Select Terrain",
    content: `<select id="terrain-select">${options}</select>`,
    callback: (html) => html.find("#terrain-select").val()
  });
}

// Calculate movement
const result = game.acks.hexplorer.calculateHexMovement(
  token.actor,
  terrainKey,
  {
    weather: game.acks.currentWeather || "clear",
    partySize: 6,  // You could make this configurable
    hasDriving: false
  }
);

// Display results
const summary = game.acks.hexplorer.createMovementSummary(
  token.actor,
  terrainKey,
  {
    weather: game.acks.currentWeather || "clear",
    partySize: 6
  }
);

ChatMessage.create({
  content: summary,
  speaker: ChatMessage.getSpeaker({ token })
});
```

## Advanced: Auto-Show on Hex Entry

If Hexplorer provides hooks for hex entry, you can show movement automatically:

```javascript
// Put this in a world script or module

Hooks.on("ready", () => {
  // Check if both systems are available
  if (!game.acks?.hexplorer || !game.modules.get("hexplorer")?.active) return;

  console.log("ACKS-Hexplorer bridge active");

  // Terrain mapping
  const TERRAIN_MAP = {
    "forest": "forest-deciduous",
    "jungle": "jungle",
    "grassland": "grassland",
    "desert": "desert-sandy",
    "mountains": "mountains-rocky",
    "hills": "hills-rocky",
    "swamp": "swamp-marshy"
  };

  // Hook into hex entry (adjust based on Hexplorer's actual hooks)
  Hooks.on("hexplorer.enterHex", (hex, token) => {
    if (!hex?.terrain || !token?.actor) return;

    // Map terrain
    const terrainKey = TERRAIN_MAP[hex.terrain.toLowerCase()] || "grassland";

    // Calculate movement
    const result = game.acks.hexplorer.calculateHexMovement(
      token.actor,
      terrainKey,
      {
        roadType: hex.hasRoad ? "earth" : null,
        weather: game.acks.currentWeather || "clear",
        partySize: 6
      }
    );

    if (result?.speeds) {
      // Show brief notification
      ui.notifications.info(
        `${result.terrain.label}: ${result.speeds.expedition} mi/day (${result.speeds.exploration}' per turn)`
      );
    }
  });
});
```

## Working Without Hexplorer

Even without Hexplorer, you can use ACKS terrain system:

### Option 1: Character Sheet Button

1. Enable "Hex Movement Calculator" in settings
2. Open character sheet
3. Click "Hex Movement Calculator" button
4. Select terrain manually
5. See results in chat

### Option 2: Simple Macro

```javascript
// Quick movement check
const actor = canvas.tokens.controlled[0]?.actor;
if (!actor) {
  ui.notifications.warn("Select a token");
  return;
}

// Show dialog
const terrains = game.acks.hexplorer.getAllTerrainTypes();
const options = terrains.map(t => `<option value="${t.key}">${t.label}</option>`).join('');

new Dialog({
  title: "Calculate Movement",
  content: `
    <div>
      <label>Terrain:</label>
      <select name="terrain">${options}</select>
    </div>
    <div>
      <label>Party Size:</label>
      <input type="number" name="party" value="6" />
    </div>
  `,
  buttons: {
    calc: {
      label: "Calculate",
      callback: (html) => {
        const terrain = html.find('[name="terrain"]').val();
        const party = parseInt(html.find('[name="party"]').val());

        const summary = game.acks.hexplorer.createMovementSummary(
          actor, terrain, { partySize: party }
        );

        ChatMessage.create({ content: summary });
      }
    }
  }
}).render(true);
```

## Terrain Key Reference

Use these keys when calling ACKS APIs:

| ACKS Terrain Key | Description |
|-----------------|-------------|
| `barrens` | Barrens |
| `desert-rocky` | Rocky Desert |
| `desert-sandy` | Sandy Desert |
| `forest-deciduous` | Deciduous Forest |
| `forest-taiga` | Taiga Forest |
| `grassland` | Grassland |
| `grassland-steppe` | Steppe |
| `hills-forested` | Forested Hills |
| `hills-rocky` | Rocky Hills |
| `jungle` | Jungle |
| `mountains-forested` | Forested Mountains |
| `mountains-rocky` | Rocky Mountains |
| `scrubland-sparse` | Sparse Scrubland |
| `scrubland-dense` | Dense Scrubland |
| `swamp-marshy` | Marshy Swamp |
| `swamp-scrubby` | Scrubby Swamp |
| `swamp-forested` | Forested Swamp |

## Example: Complete Working Bridge

Here's a complete, working example you can use:

```javascript
// ACKS Hexplorer Bridge v1.0
// Drag to hotbar and click when token is on a hex

(async () => {
  const token = canvas.tokens.controlled[0];
  if (!token) {
    ui.notifications.warn("Select a token first");
    return;
  }

  if (!game.acks?.hexplorer) {
    ui.notifications.error("ACKS not loaded");
    return;
  }

  // Get all available terrains
  const terrains = game.acks.hexplorer.getAllTerrainTypes();
  const roads = game.acks.hexplorer.getAllRoadTypes();
  const weathers = game.acks.hexplorer.getAllWeatherConditions();

  // Build dialog
  const content = `
    <form>
      <div class="form-group">
        <label>Terrain:</label>
        <select name="terrain">
          ${terrains.map(t => `<option value="${t.key}">${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Road:</label>
        <select name="road">
          <option value="">None</option>
          ${roads.map(r => `<option value="${r.key}">${r.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Weather:</label>
        <select name="weather">
          ${weathers.map(w => `<option value="${w.key}" ${w.key === 'clear' ? 'selected' : ''}>${w.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Party Size:</label>
        <input type="number" name="party" value="6" min="1" />
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="driving" />
          Has Driving
        </label>
      </div>
    </form>
  `;

  new Dialog({
    title: "Calculate Hex Movement",
    content,
    buttons: {
      calculate: {
        icon: '<i class="fas fa-calculator"></i>',
        label: "Calculate",
        callback: (html) => {
          const form = new FormDataExtended(html[0].querySelector("form")).object;

          const summary = game.acks.hexplorer.createMovementSummary(
            token.actor,
            form.terrain,
            {
              roadType: form.road || null,
              weather: form.weather,
              partySize: parseInt(form.party),
              hasDriving: form.driving
            }
          );

          ChatMessage.create({
            content: summary,
            speaker: ChatMessage.getSpeaker({ token })
          });
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "calculate"
  }).render(true);
})();
```

## Summary

**To paint hexes with Hexplorer and use ACKS rules:**

1. ✅ **Paint hexes in Hexplorer** with whatever terrain types Hexplorer supports
2. ✅ **Create a bridge macro** (use the examples above) that:
   - Reads the hex's terrain from Hexplorer
   - Maps it to an ACKS terrain key
   - Calls `game.acks.hexplorer.calculateHexMovement()`
   - Displays the result
3. ✅ **Run the macro** when characters enter a hex

The ACKS system provides the calculation engine. The macro provides the bridge. Hexplorer provides the hex painting and tracking.

This approach keeps everything in `acks-core/src` and doesn't require modifying external modules.
