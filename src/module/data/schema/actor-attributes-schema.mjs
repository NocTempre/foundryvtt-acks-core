/**
 * Shared data schema for the six ability scores (STR, INT, DEX, WIL, CON, CHA)
 * Used by: Adventurers, Monsters
 * @return {Object} Schema definition for attributes
 */
export function fullAttributesSchema() {
  const { NumberField, SchemaField } = foundry.data.fields;

  const abilityScoreSchema = () => ({
    value: new NumberField({ initial: 10, min: 3, max: 18, integer: true }),
    bonus: new NumberField({ initial: 0, integer: true }),
    mod: new NumberField({ initial: 0, integer: true }),
  });

  return {
    attributes: new SchemaField({
      str: new SchemaField(abilityScoreSchema()),
      int: new SchemaField(abilityScoreSchema()),
      dex: new SchemaField(abilityScoreSchema()),
      wil: new SchemaField(abilityScoreSchema()),
      con: new SchemaField(abilityScoreSchema()),
      cha: new SchemaField(abilityScoreSchema()),
    }),
  };
}

/**
 * Minimal attributes schema for creatures without full ability scores
 * Used by: Draft animals, Peasants, simple creatures
 * Only includes STR for carrying capacity
 * @return {Object} Schema definition for minimal attributes
 */
export function minimalAttributesSchema() {
  const { NumberField, SchemaField } = foundry.data.fields;

  return {
    attributes: new SchemaField({
      str: new SchemaField({
        value: new NumberField({ initial: 10, min: 3, max: 18, integer: true }),
        mod: new NumberField({ initial: 0, integer: true }),
      }),
    }),
  };
}

// Default export for backwards compatibility
export default fullAttributesSchema;
