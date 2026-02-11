import { minimalAttributesSchema } from "../schema/actor-attributes-schema.mjs";
import { minimalCombatSchema } from "../schema/actor-combat-schema.mjs";
import { animalMovementSchema } from "../schema/actor-movement-schema.mjs";

/**
 * ACKS II Animal/Mount Data Model
 * For draft animals, mounts, and working beasts
 * @see https://foundryvtt.com/api/classes/foundry.abstract.TypeDataModel.html
 */
export default class AnimalData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, SchemaField, StringField, HTMLField, BooleanField } = foundry.data.fields;

    return {
      // Shared schemas (minimal for animals)
      ...minimalAttributesSchema(), // Just STR for carrying
      ...minimalCombatSchema(), // Basic HP/AC
      ...animalMovementSchema(), // Movement + carrying capacity

      // Animal-specific fields
      details: new SchemaField({
        name: new StringField({ blank: true, initial: "" }),
        description: new HTMLField({ required: false, blank: true }),
        type: new StringField({ blank: true, initial: "animal" }), // horse, mule, ox, etc.
      }),

      draft: new SchemaField({
        canPull: new BooleanField({ initial: false }),
        canRide: new BooleanField({ initial: false }),
      }),

      // TODO: Add saddle/harness slots, specific animal abilities
    };
  }

  prepareDerivedData() {
    // TODO: Calculate carrying capacity from STR
  }
}
