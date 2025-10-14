/**
 * Road Painter for ACKS Hexploration
 *
 * Allows painting roads on hex edges (connections between adjacent hexes)
 * Roads are stored as edges between hex cells, providing directional travel bonuses
 */

import { TERRAIN_CONFIG } from "./terrain-config.js";
import { SYSTEM_ID } from "./config.js";

export class RoadPainter {
  static MODULE_ID = SYSTEM_ID;

  /**
   * Initialize the road painter system
   */
  static init() {
    // Register as a drawing tool when Hexplorer is active
    Hooks.once("ready", () => {
      if (!game.modules.get("hexplorer")?.active) {
        console.log("ACKS | Hexplorer not active - road painter disabled");
        return;
      }

      console.log("ACKS | Initializing road painter for hex edges");
      this.registerCanvasLayer();
      this.registerControls();
    });

    // Hook into canvas rendering
    Hooks.on("canvasReady", () => {
      if (this.isActive()) {
        this.renderRoads();
      }
    });
  }

  /**
   * Check if road painter is active (Hexplorer installed)
   */
  static isActive() {
    return game.modules.get("hexplorer")?.active && canvas.scene;
  }

  /**
   * Get edge key for two adjacent hex cells (normalized)
   * @param {Object} cell1 - First hex cell {i, j}
   * @param {Object} cell2 - Second hex cell {i, j}
   * @returns {string} Edge key like "5-10:5-11"
   */
  static getEdgeKey(cell1, cell2) {
    const key1 = `${cell1.i}-${cell1.j}`;
    const key2 = `${cell2.i}-${cell2.j}`;
    // Sort to ensure consistent key regardless of order
    return key1 < key2 ? `${key1}:${key2}` : `${key2}:${key1}`;
  }

  /**
   * Parse edge key back into two cells
   * @param {string} edgeKey - Edge key like "5-10:5-11"
   * @returns {Array} [cell1, cell2]
   */
  static parseEdgeKey(edgeKey) {
    const [key1, key2] = edgeKey.split(":");
    const [i1, j1] = key1.split("-").map(Number);
    const [i2, j2] = key2.split("-").map(Number);
    return [
      { i: i1, j: j1 },
      { i: i2, j: j2 }
    ];
  }

  /**
   * Get all roads from scene flags
   * @returns {Object} Road data { "edgeKey": "roadType", ... }
   */
  static getRoads() {
    return canvas.scene?.getFlag(this.MODULE_ID, "roads") || {};
  }

  /**
   * Set road type for an edge
   * @param {Object} cell1 - First hex cell
   * @param {Object} cell2 - Second hex cell
   * @param {string} roadType - Type of road (earth, gravel, paved) or null to remove
   */
  static async setRoad(cell1, cell2, roadType) {
    const edgeKey = this.getEdgeKey(cell1, cell2);
    const roads = this.getRoads();

    if (roadType === null || roadType === "none") {
      // Remove road
      delete roads[edgeKey];
    } else {
      // Add/update road
      roads[edgeKey] = roadType;
    }

    await canvas.scene.setFlag(this.MODULE_ID, "roads", roads);
    this.renderRoads();
  }

  /**
   * Get road type between two cells
   * @param {Object} cell1 - First hex cell
   * @param {Object} cell2 - Second hex cell
   * @returns {string|null} Road type or null if no road
   */
  static getRoadBetween(cell1, cell2) {
    const edgeKey = this.getEdgeKey(cell1, cell2);
    const roads = this.getRoads();
    return roads[edgeKey] || null;
  }

  /**
   * Register canvas layer for drawing roads
   */
  static registerCanvasLayer() {
    // Create a graphics layer for drawing roads
    if (!canvas.acksRoads) {
      canvas.acksRoads = canvas.controls.addChild(new PIXI.Container());
      canvas.acksRoads.name = "acksRoads";
    }
  }

  /**
   * Render all roads on the canvas
   */
  static renderRoads() {
    if (!canvas.acksRoads) return;

    // Clear existing graphics
    canvas.acksRoads.removeChildren();

    const roads = this.getRoads();
    const roadConfig = TERRAIN_CONFIG.roadTypes;

    for (const [edgeKey, roadType] of Object.entries(roads)) {
      const [cell1, cell2] = this.parseEdgeKey(edgeKey);
      const config = roadConfig[roadType];

      if (!config) continue;

      // Draw road line between hex centers
      this.drawRoadEdge(cell1, cell2, roadType, config);
    }
  }

  /**
   * Draw a road edge between two hex cells
   * @param {Object} cell1 - First hex cell
   * @param {Object} cell2 - Second hex cell
   * @param {string} roadType - Road type
   * @param {Object} config - Road configuration
   */
  static drawRoadEdge(cell1, cell2, roadType, config) {
    const graphics = new PIXI.Graphics();

    // Get center points of both hexes
    const point1 = canvas.grid.getTopLeftPoint(cell1);
    const point2 = canvas.grid.getTopLeftPoint(cell2);

    const center1 = {
      x: point1.x + canvas.grid.sizeX / 2,
      y: point1.y + canvas.grid.sizeY / 2
    };
    const center2 = {
      x: point2.x + canvas.grid.sizeX / 2,
      y: point2.y + canvas.grid.sizeY / 2
    };

    // Road visual properties
    const colors = {
      earth: 0x8B4513,    // Brown
      gravel: 0x808080,   // Gray
      paved: 0x404040     // Dark gray
    };

    const lineWidth = canvas.grid.sizeX * 0.15; // 15% of hex width
    const color = colors[roadType] || 0x808080;

    // Draw road line
    graphics.lineStyle(lineWidth, color, 0.8);
    graphics.moveTo(center1.x, center1.y);
    graphics.lineTo(center2.x, center2.y);

    // Add to canvas
    canvas.acksRoads.addChild(graphics);
  }

  /**
   * Register scene controls for road painting
   */
  static registerControls() {
    // TODO: Add road painting tool to scene controls
    // This will be a separate control mode like "walls" or "lighting"
    console.log("ACKS | Road painter controls registered");
  }

  /**
   * Find edge between two hex cells from mouse position
   * Returns the two cells that the mouse is between
   * @param {Object} mousePos - Mouse position {x, y}
   * @returns {Array|null} [cell1, cell2] or null if not near an edge
   */
  static findEdgeAtPosition(mousePos) {
    // Get current hex
    const currentCell = canvas.grid.getOffset(mousePos);
    if (!currentCell) return null;

    // Get all adjacent hexes
    const adjacent = canvas.grid.getAdjacentOffsets(currentCell);

    // Find which adjacent hex is closest to mouse
    // This is a simplified version - could be improved
    const cellCenter = canvas.grid.getTopLeftPoint(currentCell);
    const center = {
      x: cellCenter.x + canvas.grid.sizeX / 2,
      y: cellCenter.y + canvas.grid.sizeY / 2
    };

    // Check if mouse is closer to an edge than to center
    const distToCenter = Math.hypot(mousePos.x - center.x, mousePos.y - center.y);
    const hexRadius = canvas.grid.sizeX / 2;

    if (distToCenter < hexRadius * 0.5) {
      // Too close to center, not near an edge
      return null;
    }

    // Find closest adjacent hex
    let closestCell = null;
    let closestDist = Infinity;

    for (const adjCell of adjacent) {
      const adjPoint = canvas.grid.getTopLeftPoint(adjCell);
      const adjCenter = {
        x: adjPoint.x + canvas.grid.sizeX / 2,
        y: adjPoint.y + canvas.grid.sizeY / 2
      };

      // Calculate distance from mouse to the edge (midpoint)
      const midpoint = {
        x: (center.x + adjCenter.x) / 2,
        y: (center.y + adjCenter.y) / 2
      };

      const dist = Math.hypot(mousePos.x - midpoint.x, mousePos.y - midpoint.y);

      if (dist < closestDist) {
        closestDist = dist;
        closestCell = adjCell;
      }
    }

    if (closestCell && closestDist < hexRadius * 0.3) {
      return [currentCell, closestCell];
    }

    return null;
  }

  /**
   * Get road configuration for UI
   * @returns {Array} Road types with labels
   */
  static getRoadTypes() {
    return Object.entries(TERRAIN_CONFIG.roadTypes).map(([key, road]) => ({
      key,
      label: road.label,
      speedMultiplier: road.speedMultiplier,
      drivingMultiplier: road.drivingMultiplier
    }));
  }
}
