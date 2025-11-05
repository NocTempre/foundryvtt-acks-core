/**
 * ACKS Actor Router
 * Routes to the correct actor implementation based on type
 * - Legacy types (character, monster, etc.) → AcksActor from entity.js
 * - ACKS II types (acks-ii-adventurer, etc.) → ACKS_II_Actor hierarchy
 */

import { AcksActor as LegacyAcksActor } from "./entity.js";
import Adventurer from "./adventurer.mjs";

export default class AcksActorRouter extends Actor {
  /** @type {Actor|null} */
  #delegate = null;

  constructor(data, context) {
    super(data, context);

    // Create the appropriate delegate based on type
    const ActorClass = AcksActorRouter._getActorClass(this.type);

    if (ActorClass === LegacyAcksActor) {
      // For legacy actors, just set the prototype chain
      Object.setPrototypeOf(this, LegacyAcksActor.prototype);
    } else if (ActorClass === Adventurer) {
      // For ACKS II actors, set the prototype chain
      Object.setPrototypeOf(this, Adventurer.prototype);
    }
  }

  /**
   * Get the appropriate Actor class for a given type
   * @param {string} type - The actor type
   * @returns {typeof Actor} The Actor class to use
   * @private
   */
  static _getActorClass(type) {
    switch (type) {
      // ACKS II types - clean v14 implementation
      case "acks-ii-adventurer":
        return Adventurer;

      // Future ACKS II types:
      // case "acks-ii-monster":
      //   return Monster;
      // case "acks-ii-animal":
      //   return Animal;

      // Legacy ACKS types
      case "character":
      case "monster":
      case "travel-party":
      case "location":
        return LegacyAcksActor;

      // Default to legacy for unknown types
      default:
        return LegacyAcksActor;
    }
  }
}
