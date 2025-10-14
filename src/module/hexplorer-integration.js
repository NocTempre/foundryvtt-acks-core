/**
 * Hexplorer Integration for ACKS
 *
 * Provides APIs for calculating movement, navigation, and encounters
 * based on terrain types when using the Hexplorer module.
 */

import { TERRAIN_CONFIG } from "./terrain-config.js";
import { AcksDice } from "./dice.js";
import { SYSTEM_ID } from "./config.js";

export class HexplorerIntegration {

  /**
   * Calculate hex-based movement for an actor
   * @param {Actor} actor - The actor moving through the hex
   * @param {string} terrainType - The terrain type identifier
   * @param {Object} options - Additional options
   * @param {string} options.roadType - Road type if on a road
   * @param {string} options.weather - Current weather condition
   * @param {string} options.vessel - Vessel type if using one
   * @param {number} options.partySize - Size of the party
   * @param {boolean} options.hasDriving - Whether party has Driving proficiency
   * @returns {Object|null} Movement calculation results
   */
  static calculateHexMovement(actor, terrainType, options = {}) {
    const terrain = TERRAIN_CONFIG.terrainTypes[terrainType];
    if (!terrain) {
      console.warn(`ACKS | Unknown terrain type: ${terrainType}`);
      return null;
    }

    // Get base expedition speed from actor
    let baseSpeed = actor?.system?.movementacks?.expedition || 24;
    let multiplier = terrain.movementMultiplier;
    let navigationThrow = terrain.navigationThrow;

    // Check if terrain requires special movement (water/air)
    if (terrain.requiresVessel && !options.vessel) {
      return {
        error: "This terrain requires a vessel for travel",
        terrain: terrain
      };
    }

    if (terrain.requiresFlight && !options.vessel) {
      return {
        error: "This terrain requires flight capability",
        terrain: terrain
      };
    }

    // Handle vessel-based movement
    if (options.vessel) {
      const vessel = TERRAIN_CONFIG.vesselTypes[options.vessel];
      if (!vessel) {
        console.warn(`ACKS | Unknown vessel type: ${options.vessel}`);
      } else {
        // Check if vessel matches terrain layer
        if (terrain.layer === vessel.layer || terrain.layer === "ground") {
          baseSpeed = vessel.expeditionSpeed;

          // Apply weather effects to weather-dependent vessels
          if (vessel.weatherDependent && options.weather) {
            const weather = TERRAIN_CONFIG.weatherConditions[options.weather];
            if (weather?.affectsWater && terrain.layer === "water") {
              multiplier += weather.movementModifier || 0;
            }
          }
        }
      }
    }

    // Apply road multiplier if on a road
    if (options.roadType && terrain.layer === "ground") {
      const road = TERRAIN_CONFIG.roadTypes[options.roadType];
      if (road) {
        // Check if weather makes road ineffective
        const weatherIneffective = options.weather &&
          road.ineffectiveConditions?.includes(options.weather);

        if (!weatherIneffective) {
          const roadMultiplier = options.hasDriving ?
            road.drivingMultiplier :
            road.speedMultiplier;
          multiplier *= roadMultiplier;

          // Apply max vehicle speed if applicable
          if (road.maxVehicleSpeed && baseSpeed * multiplier > road.maxVehicleSpeed) {
            baseSpeed = road.maxVehicleSpeed / multiplier;
          }
        }
      }
    }

    // Apply weather modifiers (if not already handled by vessel)
    if (options.weather && !options.vessel) {
      const weather = TERRAIN_CONFIG.weatherConditions[options.weather];
      if (weather) {
        multiplier += weather.movementModifier || 0;
        navigationThrow += weather.navigationModifier || 0;
      }
    }

    // Ensure multiplier doesn't go below 0
    multiplier = Math.max(0.1, multiplier);

    // Calculate final speeds
    const finalExpeditionSpeed = Math.floor(baseSpeed * multiplier);
    const explorationSpeed = finalExpeditionSpeed * 5; // Convert expedition to exploration
    const encounterDistance = terrain.encounterDistance;
    const evasionThrow = this._getEvasionThrow(terrain, options.partySize || 6);

    return {
      terrain: terrain,
      speeds: {
        expedition: finalExpeditionSpeed,      // miles per day
        exploration: explorationSpeed,         // feet per turn
        base: baseSpeed,
        multiplier: multiplier
      },
      navigation: {
        throw: navigationThrow,
        description: `Navigation check: ${navigationThrow}+ on 1d20`
      },
      encounter: {
        distance: encounterDistance,
        distanceAvg: terrain.encounterDistanceAvg,
        evasion: {
          throw: evasionThrow,
          description: `Evasion check: ${evasionThrow}+ on 1d20`
        }
      },
      lairsPerHex: terrain.lairsPerHex,
      modifiers: {
        terrain: terrain.movementMultiplier,
        road: options.roadType ?
          (options.hasDriving ? 2 : 1.5) : 1,
        weather: options.weather ?
          TERRAIN_CONFIG.weatherConditions[options.weather]?.movementModifier || 0 : 0,
        vessel: options.vessel || "none"
      }
    };
  }

  /**
   * Get the evasion throw based on terrain and party size
   * @private
   */
  static _getEvasionThrow(terrain, partySize) {
    const evasion = terrain.evasionThrows;
    if (!evasion) return null;

    const category = TERRAIN_CONFIG.partySizeCategories.find(
      cat => partySize <= cat.max
    );

    return evasion[category?.key] || evasion.huge;
  }

  /**
   * Get the party size category
   */
  static getPartySizeCategory(partySize) {
    return TERRAIN_CONFIG.partySizeCategories.find(
      cat => partySize <= cat.max
    ) || TERRAIN_CONFIG.partySizeCategories[TERRAIN_CONFIG.partySizeCategories.length - 1];
  }

  /**
   * Roll encounter distance for a terrain type
   */
  static rollEncounterDistance(terrainType) {
    const terrain = TERRAIN_CONFIG.terrainTypes[terrainType];
    if (!terrain?.encounterDistance) return null;

    const formula = terrain.encounterDistance.replace(/\*/g, '*');
    return AcksDice.Roll({
      parts: [formula],
      data: {},
      title: `Encounter Distance - ${terrain.label}`,
      flavor: `Rolling ${terrain.encounterDistance}`
    });
  }

  /**
   * Roll number of lairs in a hex
   */
  static rollLairsPerHex(terrainType) {
    const terrain = TERRAIN_CONFIG.terrainTypes[terrainType];
    if (!terrain?.lairsPerHex) return null;

    return AcksDice.Roll({
      parts: [terrain.lairsPerHex],
      data: {},
      title: `Lairs per Hex - ${terrain.label}`,
      flavor: `Rolling ${terrain.lairsPerHex}`
    });
  }

  /**
   * Get available terrains filtered by layer
   */
  static getTerrainsByLayer(layer = "ground") {
    return Object.entries(TERRAIN_CONFIG.terrainTypes)
      .filter(([key, terrain]) => terrain.layer === layer)
      .map(([key, terrain]) => ({
        key,
        label: terrain.label,
        ...terrain
      }));
  }

  /**
   * Get all terrain types for UI selection
   */
  static getAllTerrainTypes() {
    return Object.entries(TERRAIN_CONFIG.terrainTypes)
      .map(([key, terrain]) => ({
        key,
        label: terrain.label,
        layer: terrain.layer
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Get all road types for UI selection
   */
  static getAllRoadTypes() {
    return Object.entries(TERRAIN_CONFIG.roadTypes)
      .map(([key, road]) => ({
        key,
        label: road.label
      }));
  }

  /**
   * Get all vessel types for UI selection
   */
  static getAllVesselTypes() {
    return Object.entries(TERRAIN_CONFIG.vesselTypes)
      .map(([key, vessel]) => ({
        key,
        label: vessel.label,
        layer: vessel.layer
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Get all weather conditions for UI selection
   */
  static getAllWeatherConditions() {
    return Object.entries(TERRAIN_CONFIG.weatherConditions)
      .map(([key, weather]) => ({
        key,
        label: weather.label
      }));
  }

  /**
   * Hook for simple-timekeeping module
   * Called when time advances during expedition
   */
  static onTimeAdvanced(timeData) {
    if (!game.settings.get(SYSTEM_ID, "timekeepingIntegration")) return;

    // Trigger encounter checks based on time passed
    // This is a hook point for future encounter system
    Hooks.callAll("acks.timeAdvanced", timeData);
  }

  /**
   * Hook for weather module
   * Called when weather changes
   */
  static onWeatherChanged(weatherCondition) {
    if (!game.settings.get(SYSTEM_ID, "weatherIntegration")) return;

    // Store current weather in game state
    if (!game.acks) game.acks = {};
    game.acks.currentWeather = weatherCondition;

    Hooks.callAll("acks.weatherChanged", weatherCondition);

    ui.notifications?.info(`Weather changed to: ${weatherCondition}`);
  }

  /**
   * Create a movement summary for display
   */
  static createMovementSummary(actor, terrainType, options = {}) {
    const result = this.calculateHexMovement(actor, terrainType, options);
    if (!result) return "Unknown terrain";
    if (result.error) return result.error;

    const parts = [];
    parts.push(`<h3>${result.terrain.label}</h3>`);
    parts.push(`<p><strong>Movement Speed:</strong></p>`);
    parts.push(`<ul>`);
    parts.push(`<li>Expedition: ${result.speeds.expedition} miles/day</li>`);
    parts.push(`<li>Exploration: ${result.speeds.exploration}' per turn</li>`);
    parts.push(`</ul>`);
    parts.push(`<p><strong>Navigation Throw:</strong> ${result.navigation.throw}+</p>`);
    parts.push(`<p><strong>Encounter Distance:</strong> ${result.encounter.distance} (avg ${result.encounter.distanceAvg}')</p>`);
    if (result.encounter.evasion.throw) {
      parts.push(`<p><strong>Evasion Throw:</strong> ${result.encounter.evasion.throw}+</p>`);
    }
    parts.push(`<p><strong>Lairs per Hex:</strong> ${result.lairsPerHex}</p>`);

    if (options.roadType || options.weather || options.vessel) {
      parts.push(`<p><strong>Modifiers:</strong></p>`);
      parts.push(`<ul>`);
      if (options.roadType) {
        parts.push(`<li>Road: ${options.roadType} (${options.hasDriving ? '2x' : '1.5x'})</li>`);
      }
      if (options.weather) {
        parts.push(`<li>Weather: ${options.weather}</li>`);
      }
      if (options.vessel) {
        parts.push(`<li>Vessel: ${options.vessel}</li>`);
      }
      parts.push(`</ul>`);
    }

    return parts.join('\n');
  }

  /**
   * Initialize the integration
   */
  static initialize() {
    console.log("ACKS | Hexplorer Integration initialized");

    // Expose to global game object
    if (!game.acks) game.acks = {};
    game.acks.hexplorer = this;
    game.acks.terrain = TERRAIN_CONFIG;
  }
}
