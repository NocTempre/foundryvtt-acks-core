/**
 * Terrain Configuration for ACKS Hexploration
 *
 * This configuration supports integration with Hexplorer and other modules
 * for wilderness travel, terrain-based movement, and encounter management.
 */

export const TERRAIN_CONFIG = {
  /**
   * Terrain types with movement, navigation, and encounter data
   */
  terrainTypes: {
    // Barrens
    "barrens": {
      label: "Barrens",
      movementMultiplier: 2/3,
      navigationThrow: 6,
      encounterDistance: "4d6*30",
      encounterDistanceAvg: 420,
      evasionThrows: {
        small: 12,      // 1-6 party
        medium: 14,     // 7-14
        large: 16,      // 15-30
        veryLarge: 18,  // 31-60
        huge: 20        // 61+
      },
      lairsPerHex: "1d4",
      layer: "ground"
    },

    // Desert
    "desert-rocky": {
      label: "Desert (Rocky)",
      movementMultiplier: 2/3,
      navigationThrow: 6,
      encounterDistance: "6d20*30",
      encounterDistanceAvg: 1890,
      evasionThrows: { small: 16, medium: 18, large: 20, veryLarge: 22, huge: 24 },
      lairsPerHex: "1d2",
      layer: "ground"
    },
    "desert-sandy": {
      label: "Desert (Sandy)",
      movementMultiplier: 2/3,
      navigationThrow: 6,
      encounterDistance: "4d6*30",
      encounterDistanceAvg: 420,
      evasionThrows: { small: 12, medium: 14, large: 16, veryLarge: 18, huge: 20 },
      lairsPerHex: "1d4",
      layer: "ground"
    },

    // Forest
    "forest-deciduous": {
      label: "Forest (Deciduous)",
      movementMultiplier: 2/3,
      navigationThrow: 8,
      encounterDistance: "5d8*3",
      encounterDistanceAvg: 68,
      evasionThrows: { small: 2, medium: 4, large: 6, veryLarge: 8, huge: 10 },
      lairsPerHex: "2d4",
      layer: "ground"
    },
    "forest-taiga": {
      label: "Forest (Taiga)",
      movementMultiplier: 2/3,
      navigationThrow: 8,
      encounterDistance: "3d6*15",
      encounterDistanceAvg: 157,
      evasionThrows: { small: 5, medium: 7, large: 9, veryLarge: 11, huge: 13 },
      lairsPerHex: "2d4",
      layer: "ground"
    },

    // Grassland
    "grassland": {
      label: "Grassland",
      movementMultiplier: 1,
      navigationThrow: 6,
      encounterDistance: "4d6*30",
      encounterDistanceAvg: 420,
      evasionThrows: { small: 9, medium: 11, large: 13, veryLarge: 15, huge: 17 },
      lairsPerHex: "1d3",
      layer: "ground"
    },
    "grassland-steppe": {
      label: "Grassland (Steppe)",
      movementMultiplier: 1,
      navigationThrow: 6,
      encounterDistance: "6d20*30",
      encounterDistanceAvg: 1890,
      evasionThrows: { small: 16, medium: 18, large: 20, veryLarge: 22, huge: 24 },
      lairsPerHex: "1d3-1",
      layer: "ground"
    },

    // Hills
    "hills-forested": {
      label: "Hills (Forested)",
      movementMultiplier: 2/3,
      navigationThrow: 8,
      encounterDistance: "5d8*3",
      encounterDistanceAvg: 68,
      evasionThrows: { small: 5, medium: 7, large: 9, veryLarge: 11, huge: 13 },
      lairsPerHex: "2d4",
      layer: "ground"
    },
    "hills-rocky": {
      label: "Hills (Rocky/Terraced)",
      movementMultiplier: 2/3,
      navigationThrow: 8,
      encounterDistance: "4d6*30",
      encounterDistanceAvg: 420,
      evasionThrows: { small: 12, medium: 14, large: 16, veryLarge: 18, huge: 20 },
      lairsPerHex: "1d4",
      layer: "ground"
    },

    // Jungle
    "jungle": {
      label: "Jungle",
      movementMultiplier: 1/2,
      navigationThrow: 14,
      encounterDistance: "5d4*3",
      encounterDistanceAvg: 38,
      evasionThrows: { small: 2, medium: 4, large: 6, veryLarge: 8, huge: 10 },
      lairsPerHex: "2d8",
      layer: "ground"
    },

    // Mountains
    "mountains-forested": {
      label: "Mountains (Forested)",
      movementMultiplier: 1/2,
      navigationThrow: 6,
      encounterDistance: "5d8*3",
      encounterDistanceAvg: 68,
      evasionThrows: { small: 5, medium: 7, large: 9, veryLarge: 11, huge: 13 },
      lairsPerHex: "2d4",
      layer: "ground"
    },
    "mountains-rocky": {
      label: "Mountains (Rocky/Terraced)",
      movementMultiplier: 1/2,
      navigationThrow: 6,
      encounterDistance: "4d6*30",
      encounterDistanceAvg: 420,
      evasionThrows: { small: 12, medium: 14, large: 16, veryLarge: 18, huge: 20 },
      lairsPerHex: "1d4+1",
      layer: "ground"
    },

    // Scrubland
    "scrubland-sparse": {
      label: "Scrubland (Low, Sparse)",
      movementMultiplier: 1,
      navigationThrow: 6,
      encounterDistance: "4d6*30",
      encounterDistanceAvg: 420,
      evasionThrows: { small: 12, medium: 14, large: 16, veryLarge: 18, huge: 20 },
      lairsPerHex: "1d2",
      layer: "ground"
    },
    "scrubland-dense": {
      label: "Scrubland (High, Dense)",
      movementMultiplier: 1,
      navigationThrow: 8,
      encounterDistance: "3d6*15",
      encounterDistanceAvg: 157,
      evasionThrows: { small: 9, medium: 11, large: 13, veryLarge: 15, huge: 17 },
      lairsPerHex: "2d4",
      layer: "ground"
    },

    // Swamp
    "swamp-marshy": {
      label: "Swamp (Marshy)",
      movementMultiplier: 1/2,
      navigationThrow: 10,
      encounterDistance: "3d6*15",
      encounterDistanceAvg: 157,
      evasionThrows: { small: 9, medium: 11, large: 13, veryLarge: 15, huge: 17 },
      lairsPerHex: "2d4+1",
      layer: "ground"
    },
    "swamp-scrubby": {
      label: "Swamp (Scrubby)",
      movementMultiplier: 1/2,
      navigationThrow: 10,
      encounterDistance: "5d8*3",
      encounterDistanceAvg: 68,
      evasionThrows: { small: 5, medium: 7, large: 9, veryLarge: 11, huge: 13 },
      lairsPerHex: "2d4+1",
      layer: "ground"
    },
    "swamp-forested": {
      label: "Swamp (Forested)",
      movementMultiplier: 1/2,
      navigationThrow: 14,
      encounterDistance: "5d4*3",
      encounterDistanceAvg: 38,
      evasionThrows: { small: 2, medium: 4, large: 6, veryLarge: 8, huge: 10 },
      lairsPerHex: "2d4+1",
      layer: "ground"
    },

    // Water terrains (for boat/ship travel)
    "water-calm": {
      label: "Water (Calm)",
      movementMultiplier: 1,
      navigationThrow: 6,
      encounterDistance: "6d20*30",
      encounterDistanceAvg: 1890,
      layer: "water",
      requiresVessel: true
    },
    "water-rough": {
      label: "Water (Rough)",
      movementMultiplier: 2/3,
      navigationThrow: 8,
      encounterDistance: "4d6*30",
      encounterDistanceAvg: 420,
      layer: "water",
      requiresVessel: true
    },
    "water-river": {
      label: "Water (River)",
      movementMultiplier: 1,
      navigationThrow: 6,
      encounterDistance: "3d6*15",
      encounterDistanceAvg: 157,
      layer: "water",
      requiresVessel: true
    },

    // Air layer (for flying creatures/vehicles)
    "air": {
      label: "Air",
      movementMultiplier: 1,
      navigationThrow: 6,
      encounterDistance: "6d20*30",
      encounterDistanceAvg: 1890,
      layer: "air",
      requiresFlight: true
    }
  },

  /**
   * Road types with speed modifiers and conditions
   */
  roadTypes: {
    "earth": {
      label: "Earth Road",
      speedMultiplier: 3/2,
      drivingMultiplier: 2,
      maxVehicleSpeed: 60,         // feet per round (12 miles per day)
      maxVehicleSpeedMiles: 12,
      ineffectiveConditions: ["rain", "muddy", "snowy"]
    },
    "gravel": {
      label: "Gravel Road",
      speedMultiplier: 3/2,
      drivingMultiplier: 2,
      maxVehicleSpeed: 90,
      maxVehicleSpeedMiles: 18,
      ineffectiveConditions: ["muddy", "snowy"]
    },
    "paved": {
      label: "Paved Road",
      speedMultiplier: 3/2,
      drivingMultiplier: 2,
      maxVehicleSpeed: null,       // no maximum
      maxVehicleSpeedMiles: null,
      ineffectiveConditions: ["snowy"]
    }
  },

  /**
   * Weather conditions affecting movement
   */
  weatherConditions: {
    "clear": {
      label: "Clear",
      movementModifier: 0,
      navigationModifier: 0
    },
    "rain": {
      label: "Rain",
      movementModifier: -1/3,
      navigationModifier: 2,
      affectsRoads: ["earth"]
    },
    "muddy": {
      label: "Muddy",
      movementModifier: -1/3,
      affectsRoads: ["earth", "gravel"]
    },
    "snowy": {
      label: "Snowy",
      movementModifier: -1/2,
      navigationModifier: 4,
      affectsRoads: ["earth", "gravel", "paved"]
    },
    "storm": {
      label: "Storm",
      movementModifier: -1/2,
      navigationModifier: 4,
      affectsWater: true
    },
    "fog": {
      label: "Fog",
      movementModifier: -1/4,
      navigationModifier: 4,
      encounterDistanceModifier: 0.5
    }
  },

  /**
   * Vessels for water and air travel
   */
  vesselTypes: {
    // Water vessels
    "raft": {
      label: "Raft",
      baseSpeed: 30,
      expeditionSpeed: 6,  // miles per day
      layer: "water",
      weatherDependent: false
    },
    "rowboat": {
      label: "Rowboat",
      baseSpeed: 60,
      expeditionSpeed: 12,
      layer: "water",
      weatherDependent: false
    },
    "sailboat": {
      label: "Sailboat",
      baseSpeed: 90,
      expeditionSpeed: 18,
      layer: "water",
      weatherDependent: true
    },
    "ship-small": {
      label: "Small Ship",
      baseSpeed: 120,
      expeditionSpeed: 24,
      layer: "water",
      weatherDependent: true
    },
    "ship-large": {
      label: "Large Ship",
      baseSpeed: 90,
      expeditionSpeed: 18,
      layer: "water",
      weatherDependent: true
    },
    "galley": {
      label: "Galley",
      baseSpeed: 150,
      expeditionSpeed: 30,
      layer: "water",
      weatherDependent: false  // uses oars
    },

    // Air vessels/mounts
    "pegasus": {
      label: "Flying Mount (Pegasus)",
      baseSpeed: 240,
      expeditionSpeed: 48,
      layer: "air",
      weatherDependent: true
    },
    "hippogriff": {
      label: "Flying Mount (Hippogriff)",
      baseSpeed: 180,
      expeditionSpeed: 36,
      layer: "air",
      weatherDependent: true
    },
    "griffin": {
      label: "Flying Mount (Griffin)",
      baseSpeed: 180,
      expeditionSpeed: 36,
      layer: "air",
      weatherDependent: true
    },
    "dragon": {
      label: "Dragon",
      baseSpeed: 240,
      expeditionSpeed: 48,
      layer: "air",
      weatherDependent: false
    },
    "airship": {
      label: "Airship",
      baseSpeed: 180,
      expeditionSpeed: 36,
      layer: "air",
      weatherDependent: true
    },
    "carpet": {
      label: "Flying Carpet",
      baseSpeed: 120,
      expeditionSpeed: 24,
      layer: "air",
      weatherDependent: false
    }
  },

  /**
   * Party size categories for evasion throws
   */
  partySizeCategories: [
    { max: 6, label: "Small (1-6)", key: "small" },
    { max: 14, label: "Medium (7-14)", key: "medium" },
    { max: 30, label: "Large (15-30)", key: "large" },
    { max: 60, label: "Very Large (31-60)", key: "veryLarge" },
    { max: Infinity, label: "Huge (61+)", key: "huge" }
  ]
};
