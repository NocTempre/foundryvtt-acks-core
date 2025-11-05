/**
 * Shared combat-related schemas for actors
 */

/**
 * Full combat schema for adventurers and monsters
 * Includes HP, AC, saves, attacks
 * Used by: Adventurers, Monsters
 * @return {Object} Schema definition for combat stats
 */
export function fullCombatSchema() {
  const { NumberField, SchemaField, StringField } = foundry.data.fields;

  return {
    // Hit Die and Hit Points
    hitDie: new StringField({ initial: "1d6", blank: true }),
    hp: new SchemaField({
      current: new NumberField({ initial: 0, min: 0, integer: true }),
      max: new NumberField({ initial: 0, min: 0, integer: true }),
    }),

    // Initiative
    initiative: new SchemaField({
      mod: new NumberField({ initial: 0, integer: true }),
    }),

    // Armor Class (different configurations)
    ac: new SchemaField({
      noArmor: new NumberField({ initial: 10, integer: true }),
      noShield: new NumberField({ initial: 10, integer: true }),
      withShield: new NumberField({ initial: 10, integer: true }),
    }),

    // Combat Stats
    healingRate: new NumberField({ initial: 1, min: 0, integer: true }),
    mortalWounds: new NumberField({ initial: 0, min: 0, integer: true }),
    cleaves: new NumberField({ initial: 0, min: 0, integer: true }),

    // Saving Throws (Target numbers and modifiers)
    saves: new SchemaField({
      paralysis: new SchemaField({
        value: new NumberField({ initial: 13, integer: true }),
        mod: new NumberField({ initial: 0, integer: true }),
      }),
      death: new SchemaField({
        value: new NumberField({ initial: 14, integer: true }),
        mod: new NumberField({ initial: 0, integer: true }),
      }),
      blast: new SchemaField({
        value: new NumberField({ initial: 15, integer: true }),
        mod: new NumberField({ initial: 0, integer: true }),
      }),
      implements: new SchemaField({
        value: new NumberField({ initial: 16, integer: true }),
        mod: new NumberField({ initial: 0, integer: true }),
      }),
      spells: new SchemaField({
        value: new NumberField({ initial: 17, integer: true }),
        mod: new NumberField({ initial: 0, integer: true }),
      }),
    }),

    // Surprise
    surprise: new SchemaField({
      others: new NumberField({ initial: 0, integer: true }),
      avoid: new NumberField({ initial: 0, integer: true }),
    }),

    // Attack base value (target to hit AC 0, others calculated)
    attack: new SchemaField({
      base: new NumberField({ initial: 11, integer: true }),
      vsAC0: new NumberField({ initial: 11, integer: true }),
      vsAC1: new NumberField({ initial: 12, integer: true }),
      vsAC2: new NumberField({ initial: 13, integer: true }),
      vsAC3: new NumberField({ initial: 14, integer: true }),
      vsAC4: new NumberField({ initial: 15, integer: true }),
      vsAC5: new NumberField({ initial: 16, integer: true }),
      vsAC6: new NumberField({ initial: 17, integer: true }),
      vsAC7: new NumberField({ initial: 18, integer: true }),
      vsAC8: new NumberField({ initial: 19, integer: true }),
      vsAC9: new NumberField({ initial: 20, integer: true }),
      vsAC10: new NumberField({ initial: 21, integer: true }),
    }),
  };
}

/**
 * Minimal combat schema for simple creatures
 * Just HP, AC, and basic attack
 * Used by: Followers, Peasants, simple animals
 * @return {Object} Schema definition for minimal combat stats
 */
export function minimalCombatSchema() {
  const { NumberField, SchemaField, StringField } = foundry.data.fields;

  return {
    hitDie: new StringField({ initial: "1d6", blank: true }),
    hp: new SchemaField({
      current: new NumberField({ initial: 0, min: 0, integer: true }),
      max: new NumberField({ initial: 0, min: 0, integer: true }),
    }),

    ac: new SchemaField({
      value: new NumberField({ initial: 10, integer: true }),
    }),

    attack: new SchemaField({
      base: new NumberField({ initial: 11, integer: true }),
    }),
  };
}

/**
 * Troop/unit combat schema
 * For mass combat units
 * Used by: Troops, military units
 * @return {Object} Schema definition for troop combat stats
 */
export function troopCombatSchema() {
  const { NumberField, SchemaField, StringField } = foundry.data.fields;

  return {
    hitDie: new StringField({ initial: "1d6", blank: true }),
    hp: new SchemaField({
      current: new NumberField({ initial: 0, min: 0, integer: true }),
      max: new NumberField({ initial: 0, min: 0, integer: true }),
    }),

    ac: new SchemaField({
      value: new NumberField({ initial: 10, integer: true }),
    }),

    attack: new SchemaField({
      base: new NumberField({ initial: 11, integer: true }),
    }),

    morale: new NumberField({ initial: 0, integer: true }),

    unit: new SchemaField({
      size: new NumberField({ initial: 1, min: 1, integer: true }), // Number of individuals
      currentSize: new NumberField({ initial: 1, min: 0, integer: true }),
    }),
  };
}
