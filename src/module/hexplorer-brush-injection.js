/**
 * Hexplorer Brush Injection for ACKS
 *
 * This module injects ACKS terrain types into Hexplorer's brush list
 * when Hexplorer is active. Does nothing if Hexplorer is not installed.
 */

import { TERRAIN_CONFIG } from "./terrain-config.js";

export class HexplorerBrushInjection {

  /**
   * Initialize the brush injection
   * Called during setup phase
   */
  static init() {
    // Hook into Hexplorer setup if it exists
    // Try multiple timing strategies to ensure Hexplorer is loaded

    // First attempt: standard ready hook
    Hooks.once("ready", () => {
      this.injectBrushes();
    });

    // Second attempt: Hexplorer-specific ready hook (if it exists)
    Hooks.on("hexplorer.ready", () => {
      console.log("ACKS | Hexplorer ready hook fired - attempting injection");
      this.injectBrushes();
    });

    // Third attempt: Canvas ready (Hexplorer might init with canvas)
    Hooks.on("canvasReady", () => {
      // Only try once on first canvas ready
      if (!this._canvasReadyTriggered) {
        this._canvasReadyTriggered = true;
        console.log("ACKS | Canvas ready - checking Hexplorer again");
        if (this.isHexplorerActive() && !this._injected) {
          this.injectBrushes();
        }
      }
    });
  }

  /**
   * Check if Hexplorer is active
   * @returns {boolean}
   */
  static isHexplorerActive() {
    return game.modules.get("hexplorer")?.active || false;
  }

  /**
   * Inject ACKS terrain types as brushes into Hexplorer
   * Only runs if Hexplorer is active
   */
  static injectBrushes() {
    if (!this.isHexplorerActive()) {
      console.log("ACKS | Hexplorer not active - skipping brush injection");
      return;
    }

    // Prevent multiple injections
    if (this._injected) {
      console.log("ACKS | Brushes already injected - skipping");
      return;
    }

    console.log("ACKS | Hexplorer detected - injecting ACKS terrain brushes");

    // Log Hexplorer module structure for debugging
    const hexplorerModule = game.modules.get("hexplorer");
    console.log("ACKS | Hexplorer module:", hexplorerModule);
    console.log("ACKS | Hexplorer API:", hexplorerModule?.api);
    console.log("ACKS | Hexplorer exposed object (game.hexplorer):", game.hexplorer);
    console.log("ACKS | Hexplorer CONFIG:", CONFIG.Hexplorer);
    console.log("ACKS | Hexplorer in window:", window.Hexplorer);

    try {
      // Access Hexplorer's brush configuration
      // Different Hexplorer versions may have different APIs
      this._injectViaBrushAPI();
      this._injected = true;
    } catch (error) {
      console.warn("ACKS | Could not inject brushes into Hexplorer:", error);
      console.warn("ACKS | Error stack:", error.stack);
    }
  }

  /**
   * Inject brushes via Hexplorer's brush API
   * @private
   */
  static _injectViaBrushAPI() {
    console.log("ACKS | Attempting to inject brushes into Hexplorer scenes");

    // Hexplorer stores brushes per-scene, not globally
    // So we add them to the current scene when Hexplorer app opens
    this._injectIntoScenes();

    // Also register a hook for when new scenes are created
    Hooks.on("renderHexplorerApp", (app, html, data) => {
      console.log("ACKS | Hexplorer app rendered, checking for ACKS brushes");
      this._ensureAcksBrushesInScene(app.scene);
    });

    console.log("ACKS | Brush injection setup complete");
  }

  /**
   * Inject ACKS brushes into all existing scenes
   * @private
   */
  static async _injectIntoScenes() {
    if (!game.scenes) {
      console.warn("ACKS | Scenes not available yet");
      return;
    }

    // Inject into current scene if one exists
    if (canvas.scene) {
      await this._ensureAcksBrushesInScene(canvas.scene);
    }
  }

  /**
   * Ensure ACKS brushes exist in a specific scene
   * @param {Scene} scene - The scene to add brushes to
   * @private
   */
  static async _ensureAcksBrushesInScene(scene) {
    if (!scene) return;

    const MODULE_ID = "hexplorer";
    const existingBrushes = scene.getFlag(MODULE_ID, "brushes") || {};

    // Check if ACKS brushes are already added
    const hasAcksBrushes = Object.keys(existingBrushes).some(key => key.startsWith("acks-"));
    if (hasAcksBrushes) {
      console.log(`ACKS | Scene "${scene.name}" already has ACKS brushes`);
      return;
    }

    console.log(`ACKS | Adding ACKS brushes to scene "${scene.name}"`);

    // Convert ACKS terrains to Hexplorer brush format
    const acksBrushes = this._convertToHexplorerBrushes();

    // Merge with existing brushes
    const updatedBrushes = { ...existingBrushes, ...acksBrushes };

    // Update the scene flag
    await scene.setFlag(MODULE_ID, "brushes", updatedBrushes);

    console.log(`ACKS | Successfully added ${Object.keys(acksBrushes).length} ACKS brushes to scene "${scene.name}"`);
  }

  /**
   * Convert ACKS terrain types to Hexplorer brush format (per-scene structure)
   * @returns {Object} Object with brush IDs as keys
   * @private
   */
  static _convertToHexplorerBrushes() {
    const brushes = {};

    for (const [key, terrain] of Object.entries(TERRAIN_CONFIG.terrainTypes)) {
      const brushId = `acks-${key}`;
      brushes[brushId] = {
        name: `ACKS: ${terrain.label}`,
        data: {
          color: this._getTerrainColor(key),
          region: terrain.label,
          speedMultiplier: terrain.movementMultiplier,
          tooltip: "",
          journalEntry: "",
          // Store ACKS-specific data for reference
          acksTerrainType: key,
          acksNavigationThrow: terrain.navigationThrow,
          acksEncounterDistance: terrain.encounterDistance,
          acksLairsPerHex: terrain.lairsPerHex,
        }
      };
    }

    return brushes;
  }

  /**
   * Inject brushes via Hexplorer hooks
   * Fallback method if direct API is not available
   * @private
   */
  static _injectViaHooks() {
    console.log("ACKS | Attempting hook-based injection");

    // Try to find Hexplorer's terrain/brush storage
    const possibleLocations = [
      { path: "CONFIG.Hexplorer.terrains", obj: CONFIG.Hexplorer?.terrains },
      { path: "CONFIG.Hexplorer.brushes", obj: CONFIG.Hexplorer?.brushes },
      { path: "game.hexplorer.terrains", obj: game.hexplorer?.terrains },
      { path: "game.hexplorer.brushes", obj: game.hexplorer?.brushes },
      { path: "game.hexplorer.config.terrains", obj: game.hexplorer?.config?.terrains },
      { path: "ui.hexplorer?.brushes", obj: ui.hexplorer?.brushes },
    ];

    for (const location of possibleLocations) {
      if (location.obj) {
        console.log(`ACKS | Found possible brush storage at ${location.path}:`, location.obj);

        // Try to directly add our terrains
        if (Array.isArray(location.obj)) {
          console.log(`ACKS | ${location.path} is an array, attempting to push terrains`);
          const brushes = this._convertTerrainsToBrushes();
          location.obj.push(...brushes);
          console.log(`ACKS | Added ${brushes.length} brushes to ${location.path}`);
        } else if (typeof location.obj === "object") {
          console.log(`ACKS | ${location.path} is an object, attempting to merge terrains`);
          const brushes = this._convertTerrainsToBrushes();
          for (const brush of brushes) {
            location.obj[brush.id] = brush;
          }
          console.log(`ACKS | Added ${brushes.length} brushes to ${location.path}`);
        }
      }
    }

    // Hook into Hexplorer's brush registration (various possible hook names)
    const hookNames = [
      "hexplorer.getBrushes",
      "hexplorer.getTerrainConfig",
      "hexplorer.getTerrainTypes",
      "hexplorer:getBrushes",
      "hexplorer:getTerrains",
    ];

    for (const hookName of hookNames) {
      Hooks.on(hookName, () => {
        console.log(`ACKS | Hook ${hookName} called, returning terrain data`);
        return this._convertTerrainsToBrushes();
      });
    }

    console.log("ACKS | Registered Hexplorer hooks for terrain integration");
  }

  /**
   * Convert ACKS terrain types to Hexplorer brush format
   * @returns {Array} Array of brush definitions
   * @private
   */
  static _convertTerrainsToBrushes() {
    const brushes = [];

    for (const [key, terrain] of Object.entries(TERRAIN_CONFIG.terrainTypes)) {
      brushes.push({
        id: `acks-${key}`,
        name: `ACKS: ${terrain.label}`,
        category: `ACKS (${terrain.layer})`,
        layer: terrain.layer,
        icon: this._getTerrainIcon(key),
        color: this._getTerrainColor(key),
        data: {
          terrainType: key,
          movementMultiplier: terrain.movementMultiplier,
          navigationThrow: terrain.navigationThrow,
          encounterDistance: terrain.encounterDistance,
          lairsPerHex: terrain.lairsPerHex,
          system: "acks"
        }
      });
    }

    return brushes;
  }

  /**
   * Get an appropriate icon for a terrain type
   * @param {string} terrainKey
   * @returns {string} Font Awesome icon class
   * @private
   */
  static _getTerrainIcon(terrainKey) {
    const iconMap = {
      "barrens": "fa-mountain",
      "desert-rocky": "fa-sun",
      "desert-sandy": "fa-sun",
      "forest-deciduous": "fa-tree",
      "forest-taiga": "fa-tree",
      "grassland": "fa-seedling",
      "grassland-steppe": "fa-seedling",
      "hills-forested": "fa-mountain",
      "hills-rocky": "fa-mountain",
      "jungle": "fa-leaf",
      "mountains-forested": "fa-mountain",
      "mountains-rocky": "fa-mountain",
      "scrubland-sparse": "fa-seedling",
      "scrubland-dense": "fa-seedling",
      "swamp-marshy": "fa-water",
      "swamp-scrubby": "fa-water",
      "swamp-forested": "fa-water",
      "water-calm": "fa-water",
      "water-rough": "fa-water",
      "water-river": "fa-water",
      "air": "fa-wind"
    };

    return iconMap[terrainKey] || "fa-map-marker";
  }

  /**
   * Get an appropriate color for a terrain type
   * @param {string} terrainKey
   * @returns {string} Hex color code
   * @private
   */
  static _getTerrainColor(terrainKey) {
    const colorMap = {
      // Barrens - brown/tan
      "barrens": "#8B7355",

      // Desert - sandy/rocky
      "desert-rocky": "#B8956A",
      "desert-sandy": "#EDC9AF",

      // Forest - green variations
      "forest-deciduous": "#228B22",
      "forest-taiga": "#2F4F2F",

      // Grassland - light green
      "grassland": "#90EE90",
      "grassland-steppe": "#BDB76B",

      // Hills - brown/green
      "hills-forested": "#556B2F",
      "hills-rocky": "#A0826D",

      // Jungle - dark green
      "jungle": "#006400",

      // Mountains - gray/green
      "mountains-forested": "#4F7942",
      "mountains-rocky": "#808080",

      // Scrubland - olive/tan
      "scrubland-sparse": "#9ACD32",
      "scrubland-dense": "#6B8E23",

      // Swamp - dark green/blue
      "swamp-marshy": "#8FBC8F",
      "swamp-scrubby": "#2E8B57",
      "swamp-forested": "#014421",

      // Water - blue variations
      "water-calm": "#4682B4",
      "water-rough": "#1E90FF",
      "water-river": "#5F9EA0",

      // Air - light blue
      "air": "#87CEEB"
    };

    return colorMap[terrainKey] || "#CCCCCC";
  }

  /**
   * Get all registered ACKS brushes
   * Useful for debugging or UI purposes
   * @returns {Array}
   */
  static getRegisteredBrushes() {
    return this._convertTerrainsToBrushes();
  }

  /**
   * Manual injection trigger for debugging
   * Call this from console: game.acks.brushes.manualInject()
   */
  static manualInject() {
    console.log("ACKS | Manual brush injection triggered");
    this.injectBrushes();
  }

  /**
   * Manually add ACKS brushes to the current scene
   * Call this from console: game.acks.brushes.addToCurrentScene()
   */
  static async addToCurrentScene() {
    if (!canvas.scene) {
      console.warn("ACKS | No active scene");
      return;
    }
    await this._ensureAcksBrushesInScene(canvas.scene);
    ui.notifications.info("ACKS terrain brushes added to current scene!");
  }

  /**
   * Debug information about Hexplorer integration
   * Call this from console: game.acks.brushes.debugInfo()
   */
  static debugInfo() {
    console.log("=== ACKS Hexplorer Integration Debug Info ===");
    console.log("Hexplorer active:", this.isHexplorerActive());
    console.log("Hexplorer module:", game.modules.get("hexplorer"));
    console.log("Current scene:", canvas.scene?.name);
    if (canvas.scene) {
      const MODULE_ID = "hexplorer";
      const brushes = canvas.scene.getFlag(MODULE_ID, "brushes") || {};
      console.log("Scene brushes:", brushes);
      console.log("ACKS brushes in scene:", Object.keys(brushes).filter(k => k.startsWith("acks-")));
    }
    console.log("ACKS terrain config:", TERRAIN_CONFIG);
    console.log("ACKS brushes (format):", this._convertToHexplorerBrushes());
    console.log("==============================================");
  }
}
