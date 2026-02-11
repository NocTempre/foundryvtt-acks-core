import { fullAttributesSchema } from "../schema/actor-attributes-schema.mjs";
import { fullCombatSchema } from "../schema/actor-combat-schema.mjs";
import { simpleMovementSchema } from "../schema/actor-movement-schema.mjs";

/**
 * ACKS II Monster Data Model
 * For creatures with full stat blocks
 * @see https://foundryvtt.com/api/classes/foundry.abstract.TypeDataModel.html
 */
export default class MonsterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, SchemaField, StringField, HTMLField } = foundry.data.fields;

    return {
      // Shared schemas
      ...fullAttributesSchema(), // STR, INT, DEX, WIL, CON, CHA
      ...fullCombatSchema(), // HP, AC, saves, attack
      ...simpleMovementSchema(), // Basic movement

      // Monster-specific fields
      details: new SchemaField({
        description: new HTMLField({ required: false, blank: true }),
        alignment: new StringField({ blank: true, initial: "" }),
        type: new StringField({ blank: true, initial: "monster" }),
        hitDice: new StringField({ blank: true, initial: "1" }),
        xpValue: new NumberField({ initial: 0, min: 0, integer: true }),
      }),

      // TODO: Add treasure, special abilities, etc.
    };
  }

  prepareDerivedData() {
    // TODO: Implement monster-specific calculations
  }
}
