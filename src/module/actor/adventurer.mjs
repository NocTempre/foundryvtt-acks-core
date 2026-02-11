import ACKS_II_Actor from "./acks-ii-base.mjs";
import AdventurerSheet from "./adventurer-sheet.mjs";

/**
 * ACKS II Adventurer Document
 * For classed characters (PCs and Henchmen)
 * Clean rewrite for Foundry v14 compatibility
 * Extends ACKS_II_Actor base class
 */
export default class Adventurer extends ACKS_II_Actor {
  /** @type {AdventurerSheet|null} */
  #sheet = null;

  /**
   * Override the sheet property to return an ApplicationV2 instance
   * @type {AdventurerSheet}
   */
  get sheet() {
    if (!this.#sheet) {
      this.#sheet = new AdventurerSheet({ document: this });
    }
    return this.#sheet;
  }

  /**
   * Adventurer-specific data preparation
   */
  prepareBaseData() {
    super.prepareBaseData();
    // Adventurer-specific base data preparation can go here
  }

  /**
   * Adventurer-specific derived data preparation
   */
  prepareDerivedData() {
    super.prepareDerivedData();
    // Adventurer-specific derived data preparation can go here
    // Base class already calls system.prepareDerivedData()
  }

  // All common ACKS II methods (ability checks, damage, healing, etc.)
  // are inherited from ACKS_II_Actor base class

  // Add adventurer-specific methods here as needed
}
