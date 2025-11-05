/**
 * TypeScript type definitions for ACKS II Actor system
 *
 * Note: This file assumes Foundry VTT types are available globally.
 * If using @league-of-foundry-developers/foundry-vtt-types, ensure it's installed.
 */

declare global {
  /**
   * Ability score data structure
   */
  interface AbilityScore {
    /** Raw ability score value (3-18) */
    value: number;
    /** Additional bonus from items/effects */
    bonus: number;
    /** Calculated modifier based on score */
    mod: number;
  }

  /**
   * All six ability scores for ACKS II
   */
  interface ACKS_II_Attributes {
    str: AbilityScore;
    int: AbilityScore;
    dex: AbilityScore;
    wil: AbilityScore;
    con: AbilityScore;
    cha: AbilityScore;
  }

  /**
   * Character details
   */
  interface ACKS_II_ActorDetails {
    /** Character biography (HTML) */
    biography: string;
    /** Additional notes (HTML) */
    notes: string;
    /** Character class name */
    class: string;
    /** Character level */
    level: number;
    /** Character alignment */
    alignment: string;
  }

  /**
   * Hit point data
   */
  interface ACKS_II_HitPoints {
    /** Current HP */
    value: number;
    /** Maximum HP */
    max: number;
    /** Temporary HP */
    temp: number;
  }

  /**
   * Armor class data
   */
  interface ACKS_II_ArmorClass {
    /** Total AC including all modifiers */
    value: number;
    /** Base AC before modifiers */
    base: number;
    /** AC bonus from items/effects */
    bonus: number;
  }

  /**
   * Movement data
   */
  interface ACKS_II_Movement {
    /** Base movement rate */
    base: number;
    /** Current movement rate (after modifiers) */
    current: number;
    /** Movement modifier */
    mod: number;
  }

  /**
   * Experience points data
   */
  interface ACKS_II_Experience {
    /** Current XP */
    value: number;
    /** XP needed for next level */
    next: number;
    /** XP bonus percentage */
    bonus: number;
  }

  /**
   * Complete ACKS II Actor system data
   */
  interface ACKS_II_ActorSystemData {
    attributes: ACKS_II_Attributes;
    details: ACKS_II_ActorDetails;
    hp: ACKS_II_HitPoints;
    ac: ACKS_II_ArmorClass;
    movement: ACKS_II_Movement;
    xp: ACKS_II_Experience;
  }

  /**
   * ACKS II Actor document type
   * Extends the global Actor if it exists, otherwise defines base structure
   */
  interface ACKS_II_Actor {
    system: ACKS_II_ActorSystemData;

    /**
     * Get the ability modifier for a given ability
     */
    getAbilityMod(ability: "str" | "int" | "dex" | "wil" | "con" | "cha"): number;

    /**
     * Get the total ability bonus (modifier + additional bonuses)
     */
    getAbilityBonus(ability: "str" | "int" | "dex" | "wil" | "con" | "cha"): number;

    /**
     * Roll an ability check
     */
    rollAbilityCheck(
      ability: "str" | "int" | "dex" | "wil" | "con" | "cha",
      options?: Record<string, any>
    ): Promise<any>;

    /**
     * Roll hit points for a level
     */
    rollHitPoints(hitDie?: string): Promise<any>;

    /**
     * Apply damage to the actor
     */
    applyDamage(amount: number): Promise<ACKS_II_Actor>;

    /**
     * Heal the actor
     */
    applyHealing(amount: number): Promise<ACKS_II_Actor>;

    /**
     * Take a short rest
     */
    shortRest(): Promise<ACKS_II_Actor>;

    /**
     * Take a long rest
     */
    longRest(): Promise<ACKS_II_Actor>;
  }
}

// This export makes it a module while still declaring global types
export {};
