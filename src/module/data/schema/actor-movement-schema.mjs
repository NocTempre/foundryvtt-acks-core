/**
 * Shared movement and encumbrance schemas for actors
 */

/**
 * Full movement schema for adventurers
 * Includes all movement modes
 * Used by: Adventurers
 * @return {Object} Schema definition for movement
 */
export function fullMovementSchema() {
  const { NumberField, SchemaField } = foundry.data.fields;

  return {
    movement: new SchemaField({
      exploration: new NumberField({ initial: 120, min: 0, integer: true }), // Feet/Turn
      combat: new NumberField({ initial: 40, min: 0, integer: true }), // Feet/Round
      chargeRun: new NumberField({ initial: 120, min: 0, integer: true }), // Feet/Round
      expedition: new NumberField({ initial: 24, min: 0, integer: true }), // Miles/Day
      stealth: new NumberField({ initial: 20, min: 0, integer: true }), // Feet/Round
      climb: new NumberField({ initial: 20, min: 0, integer: true }), // Feet/Round
    }),

    encumbrance: new SchemaField({
      current: new NumberField({ initial: 0, min: 0 }), // Stone (ST)
      limit: new NumberField({ initial: 20, min: 0 }), // Stone (ST) - 20+STR mod
      level: new NumberField({ initial: 0, min: 0, max: 4, integer: true }), // 0-4
    }),
  };
}

/**
 * Simple movement schema for creatures
 * Just basic movement rate
 * Used by: Monsters, simple creatures
 * @return {Object} Schema definition for simple movement
 */
export function simpleMovementSchema() {
  const { NumberField, SchemaField } = foundry.data.fields;

  return {
    movement: new SchemaField({
      combat: new NumberField({ initial: 40, min: 0, integer: true }), // Feet/Round
    }),
  };
}

/**
 * Animal/mount movement schema
 * Includes carrying capacity
 * Used by: Draft animals, mounts
 * @return {Object} Schema definition for animal movement
 */
export function animalMovementSchema() {
  const { NumberField, SchemaField } = foundry.data.fields;

  return {
    movement: new SchemaField({
      combat: new NumberField({ initial: 40, min: 0, integer: true }), // Feet/Round
      expedition: new NumberField({ initial: 24, min: 0, integer: true }), // Miles/Day
    }),

    carrying: new SchemaField({
      capacity: new NumberField({ initial: 20, min: 0 }), // Stone (ST)
      current: new NumberField({ initial: 0, min: 0 }), // Current load
    }),
  };
}
