/**
 * Location Context Management
 * Handles entering/leaving locations via token interaction
 */

import { SYSTEM_ID } from "./config.js";

export class AcksLocationContext {
  /**
   * Initialize location context hooks
   */
  static init() {
    Hooks.on("getTokenHUDContext", this._onGetTokenHUDContext.bind(this));
  }

  /**
   * Add context menu options to tokens for entering/leaving locations
   */
  static _onGetTokenHUDContext(html, options) {
    // Add "Enter Location" option for location tokens
    options.push({
      name: "Enter Location",
      icon: '<i class="fas fa-door-open"></i>',
      condition: (li) => {
        const token = canvas.tokens.get(li.data("token-id"));
        return token?.actor?.type === "location";
      },
      callback: (li) => {
        const token = canvas.tokens.get(li.data("token-id"));
        if (token?.actor) {
          this.enterLocation(token.actor);
        }
      },
    });

    // Add "Leave Location" option for actors that are in a location
    options.push({
      name: "Leave Location",
      icon: '<i class="fas fa-door-closed"></i>',
      condition: (li) => {
        const token = canvas.tokens.get(li.data("token-id"));
        const actor = token?.actor;
        if (!actor || actor.type === "location") return false;
        // Support character, travel-party, or any actor with currentLocation flag
        return !!actor.getFlag(SYSTEM_ID, "currentLocation");
      },
      callback: (li) => {
        const token = canvas.tokens.get(li.data("token-id"));
        if (token?.actor) {
          this.leaveLocation(token.actor);
        }
      },
    });
  }

  /**
   * Enter a location - prompts for which character to enter with
   * @param {Actor} locationActor - The location being entered
   */
  static async enterLocation(locationActor) {
    if (!locationActor || locationActor.type !== "location") {
      ui.notifications.warn("Invalid location");
      return;
    }

    // Get all controlled tokens on the current scene
    const controlled = canvas.tokens.controlled;

    if (controlled.length === 0) {
      ui.notifications.warn("Select one or more character tokens to enter the location");
      return;
    }

    // Filter to valid actor types (character, travel-party, etc.)
    const validActors = controlled.filter(t =>
      t.actor && (t.actor.type === "character" || t.actor.type === "travel-party")
    );

    if (validActors.length === 0) {
      ui.notifications.warn("No valid actors selected (must be characters or travel parties)");
      return;
    }

    // Enter the location with all selected actors
    for (const token of validActors) {
      await this._setActorLocation(token.actor, locationActor.id, locationActor.name);
    }

    const names = validActors.map(t => t.actor.name).join(", ");
    ui.notifications.info(`${names} entered ${locationActor.name}`);

    // Emit hook for other modules/features
    Hooks.callAll("acks.enterLocation", {
      location: locationActor,
      actors: characters.map(t => t.actor),
    });
  }

  /**
   * Leave the current location
   * @param {Actor} actor - The actor leaving
   */
  static async leaveLocation(actor) {
    const locationId = actor.getFlag(SYSTEM_ID, "currentLocation");
    const locationName = actor.getFlag(SYSTEM_ID, "currentLocationName");

    if (!locationId) {
      ui.notifications.warn(`${actor.name} is not in a location`);
      return;
    }

    await this._clearActorLocation(actor);

    ui.notifications.info(`${actor.name} left ${locationName || "the location"}`);

    // Emit hook for other modules/features
    Hooks.callAll("acks.leaveLocation", {
      locationId,
      locationName,
      actor,
    });
  }

  /**
   * Set an actor's current location
   * @param {Actor} actor - The actor
   * @param {string} locationId - Location actor ID
   * @param {string} locationName - Location name for display
   * @private
   */
  static async _setActorLocation(actor, locationId, locationName) {
    await actor.setFlag(SYSTEM_ID, "currentLocation", locationId);
    await actor.setFlag(SYSTEM_ID, "currentLocationName", locationName);
  }

  /**
   * Clear an actor's current location
   * @param {Actor} actor - The actor
   * @private
   */
  static async _clearActorLocation(actor) {
    await actor.unsetFlag(SYSTEM_ID, "currentLocation");
    await actor.unsetFlag(SYSTEM_ID, "currentLocationName");
  }

  /**
   * Get the current location actor for a given actor
   * @param {Actor} actor - The actor
   * @returns {Actor|null} The location actor, or null
   */
  static getCurrentLocation(actor) {
    const locationId = actor.getFlag(SYSTEM_ID, "currentLocation");
    if (!locationId) return null;
    return game.actors.get(locationId);
  }

  /**
   * Get all actors currently in a location
   * @param {Actor} locationActor - The location
   * @returns {Actor[]} Array of actors in the location
   */
  static getActorsInLocation(locationActor) {
    if (!locationActor || locationActor.type !== "location") return [];

    return game.actors.filter(actor => {
      const currentLocationId = actor.getFlag(SYSTEM_ID, "currentLocation");
      return currentLocationId === locationActor.id;
    });
  }
}
