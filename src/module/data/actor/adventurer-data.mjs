import { fullAttributesSchema } from "../schema/actor-attributes-schema.mjs";
import { fullCombatSchema } from "../schema/actor-combat-schema.mjs";
import { fullMovementSchema } from "../schema/actor-movement-schema.mjs";

/**
 * ACKS II Adventurer Data Model
 * For classed characters (PCs and Henchmen)
 * Clean rewrite for Foundry v14 compatibility
 * @see https://foundryvtt.com/api/classes/foundry.abstract.TypeDataModel.html
 * @see https://foundryvtt.wiki/en/development/api/DataModel
 * @see https://foundryvtt.com/article/system-data-models/
 */
export default class AdventurerData extends foundry.abstract.TypeDataModel {
  /**
   * Define the data schema for ACKS II actors
   * @return {Object} The schema definition
   */
  static defineSchema() {
    const { NumberField, SchemaField, StringField, HTMLField } = foundry.data.fields;

    return {
      // Shared schemas from base modules
      ...fullAttributesSchema(), // STR, INT, DEX, WIL, CON, CHA
      ...fullCombatSchema(), // HP, AC, saves, attack, initiative
      ...fullMovementSchema(), // Movement modes, encumbrance

      // Adventurer-specific: Character Information
      character: new SchemaField({
        name: new StringField({ blank: true, initial: "" }),
        birthplace: new StringField({ blank: true, initial: "" }),
        alignment: new StringField({ blank: true, initial: "" }),
        age: new NumberField({ initial: 18, min: 0, integer: true }),
        size: new StringField({ blank: true, initial: "Medium" }),
        gender: new StringField({ blank: true, initial: "" }),
        weight: new NumberField({ initial: 15, min: 0 }), // Stone (ST)
        biography: new HTMLField({ required: false, blank: true }),
        notes: new HTMLField({ required: false, blank: true }),
      }),

      // Adventurer-specific: Class Information
      class: new SchemaField({
        name: new StringField({ blank: true, initial: "" }),
        title: new StringField({ blank: true, initial: "" }),
        level: new NumberField({ initial: 1, min: 0, integer: true }),
      }),

      // Adventurer-specific: Adventuring Proficiencies (Target numbers)
      adventuring: new SchemaField({
        climbing: new NumberField({ initial: 18, integer: true }), // Throw
        dungeonbashing: new NumberField({ initial: 18, integer: true }), // Throw
        listening: new NumberField({ initial: 18, integer: true }), // Throw
        searching: new NumberField({ initial: 18, integer: true }), // Throw
        trapbreaking: new NumberField({ initial: 18, integer: true }), // Throw
      }),

      // Adventurer-specific: Experience Points
      xp: new SchemaField({
        current: new NumberField({ initial: 0, min: 0, integer: true }),
        bonus: new NumberField({ initial: 0, integer: true }), // Mod
        next: new NumberField({ initial: 0, min: 0, integer: true }),
      }),
    };
  }

  /**
   * Prepare derived data for the actor
   * Called after base data is prepared but before rendering
   */
  prepareDerivedData() {
    this._prepareAbilityModifiers();
    this._prepareEncumbranceLevel();
    this._prepareAttackTargets();
    // Additional derived calculations can be added here
  }

  /**
   * Calculate encumbrance level based on current load
   * Levels: 0 (0-5 ST), 1 (>5 ST), 2 (>7 ST), 3 (>10 ST), 4 (>limit ST, immobile)
   * @private
   */
  _prepareEncumbranceLevel() {
    const current = this.encumbrance.current;
    const limit = this.encumbrance.limit;
    let level = 0;

    if (current > limit) level = 4; // Over limit, immobile
    else if (current > 10) level = 3;
    else if (current > 7) level = 2;
    else if (current > 5) level = 1;
    else level = 0;

    this.encumbrance.level = level;
  }

  /**
   * Calculate attack targets vs AC based on base attack value
   * Formula: Target to hit AC X = base + X
   * @private
   */
  _prepareAttackTargets() {
    const base = this.attack.base;

    // Calculate targets for AC 0-10
    for (let ac = 0; ac <= 10; ac++) {
      const key = `vsAC${ac}`;
      this.attack[key] = base + ac;
    }
  }

  /**
   * Calculate ability score modifiers from raw scores
   * ACKS II uses: 3=-3, 4-5=-2, 6-7=-1, 8-12=0, 13-15=+1, 16-17=+2, 18=+3
   * @private
   */
  _prepareAbilityModifiers() {
    const abilities = ["str", "int", "dex", "wil", "con", "cha"];

    for (const ability of abilities) {
      const score = this.attributes[ability].value;
      let modifier = 0;

      if (score === 3) modifier = -3;
      else if (score <= 5) modifier = -2;
      else if (score <= 7) modifier = -1;
      else if (score <= 12) modifier = 0;
      else if (score <= 15) modifier = 1;
      else if (score <= 17) modifier = 2;
      else if (score >= 18) modifier = 3;

      this.attributes[ability].mod = modifier;
    }
  }
}
