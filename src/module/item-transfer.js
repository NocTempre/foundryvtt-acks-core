/**
 * Item Transfer and Ownership System
 *
 * Handles transferring items between actors while maintaining ownership tracking,
 * enabling item lending within travel parties and proper encumbrance delegation.
 */

import { SYSTEM_ID } from "./config.js";

export class ItemTransfer {

  /**
   * Transfer an item from one actor to another
   * @param {Item} item - The item to transfer
   * @param {Actor} fromActor - Source actor
   * @param {Actor} toActor - Destination actor
   * @param {Object} options - Transfer options
   * @param {boolean} options.clearOwnership - Clear ownership tracking (for returns)
   * @param {string} options.restriction - Retrieval restriction level
   * @returns {Promise<Item>} The newly created item on the destination actor
   */
  static async transferItem(item, fromActor, toActor, options = {}) {
    if (!item || !fromActor || !toActor) {
      ui.notifications.error("Invalid transfer parameters");
      return null;
    }

    // Validate transfer is allowed
    if (!this.canTransfer(item, fromActor, toActor)) {
      ui.notifications.warn("Cannot transfer this item");
      return null;
    }

    // Get or initialize ownership data
    const originalOwner = item.system.ownership?.originalOwner || fromActor.id;
    const isReturn = options.clearOwnership || (originalOwner === toActor.id);

    // Prepare ownership metadata
    const ownershipData = {
      "system.ownership.originalOwner": isReturn ? "" : originalOwner,
      "system.ownership.currentCarrier": isReturn ? "" : toActor.id,
      "system.ownership.transferredAt": Date.now(),
      "system.ownership.isLent": !isReturn,
      "system.ownership.retrievalRestriction": options.restriction || "same-party"
    };

    // Create item data for destination
    const itemData = item.toObject();
    foundry.utils.mergeObject(itemData, ownershipData);

    // Create item on destination actor
    const [newItem] = await toActor.createEmbeddedDocuments("Item", [itemData]);

    // Track delegated item on original owner (if lending)
    if (!isReturn && originalOwner === fromActor.id && fromActor.id !== toActor.id) {
      await this._addDelegatedItem(fromActor, newItem, toActor);
    }

    // If this is a return, remove from delegated list
    if (isReturn && originalOwner === toActor.id) {
      await this._removeDelegatedItem(toActor, item.uuid);
    }

    // Delete from source actor
    await item.delete();

    // Recalculate encumbrance
    if (fromActor.computeEncumbrance) fromActor.computeEncumbrance();
    if (toActor.computeEncumbrance) toActor.computeEncumbrance();

    ui.notifications.info(`Transferred ${item.name} from ${fromActor.name} to ${toActor.name}`);

    return newItem;
  }

  /**
   * Retrieve a delegated item back to its original owner
   * @param {string} itemUuid - UUID of the item to retrieve
   * @param {Actor} originalOwner - The original owner actor
   * @returns {Promise<Item>} The retrieved item
   */
  static async retrieveItem(itemUuid, originalOwner) {
    const item = await fromUuid(itemUuid);
    if (!item) {
      ui.notifications.warn("Item not found");
      return null;
    }

    const currentCarrier = game.actors.get(item.system.ownership?.currentCarrier);
    if (!currentCarrier) {
      ui.notifications.warn("Current carrier not found");
      return null;
    }

    // Check retrieval permission
    if (!this.canRetrieve(item, originalOwner, currentCarrier)) {
      ui.notifications.warn("Cannot retrieve - outside retrieval range");
      return null;
    }

    // Transfer back with clearOwnership flag
    return await this.transferItem(item, currentCarrier, originalOwner, {
      clearOwnership: true
    });
  }

  /**
   * Check if an item can be transferred
   * @param {Item} item - The item
   * @param {Actor} fromActor - Source actor
   * @param {Actor} toActor - Destination actor
   * @returns {boolean}
   */
  static canTransfer(item, fromActor, toActor) {
    // Cannot transfer spells, abilities, languages
    if (["spell", "ability", "language"].includes(item.type)) {
      return false;
    }

    // Cannot transfer to same actor
    if (fromActor.id === toActor.id) {
      return false;
    }

    // Cannot transfer money items (for now - may enable later)
    if (item.type === "money") {
      return false;
    }

    return true;
  }

  /**
   * Check if an item can be retrieved based on retrieval restrictions
   * @param {Item} item - The item
   * @param {Actor} originalOwner - Original owner
   * @param {Actor} currentCarrier - Current carrier
   * @returns {boolean}
   */
  static canRetrieve(item, originalOwner, currentCarrier) {
    const restriction = item.system.ownership?.retrievalRestriction || "same-party";

    switch (restriction) {
      case "always":
        return true;

      case "same-party":
        // Check if both actors are in the same travel party
        return this._areInSameParty(originalOwner, currentCarrier);

      case "same-hex":
        // Check if both actors are in the same hex (requires Hexplorer)
        return this._areInSameHex(originalOwner, currentCarrier);

      case "same-scene":
        // Check if both actors are in the same scene
        return this._areInSameScene(originalOwner, currentCarrier);

      case "gm-approval":
        // Only GMs can retrieve
        return game.user.isGM;

      default:
        return false;
    }
  }

  /**
   * Add item to actor's delegated items list
   * @private
   */
  static async _addDelegatedItem(ownerActor, item, carrierActor) {
    const delegated = ownerActor.system.delegatedItems || [];

    // Check if already tracked (avoid duplicates)
    if (delegated.some(d => d.itemId === item.uuid)) {
      return;
    }

    delegated.push({
      itemId: item.uuid,
      itemName: item.name,
      itemType: item.type,
      itemImg: item.img,
      currentCarrier: carrierActor.id,
      carrierName: carrierActor.name,
      transferredAt: Date.now(),
      canRetrieve: this.canRetrieve(item, ownerActor, carrierActor)
    });

    await ownerActor.update({ "system.delegatedItems": delegated });
  }

  /**
   * Remove item from actor's delegated items list
   * @private
   */
  static async _removeDelegatedItem(ownerActor, itemUuid) {
    const delegated = ownerActor.system.delegatedItems || [];
    const filtered = delegated.filter(d => d.itemId !== itemUuid);

    await ownerActor.update({ "system.delegatedItems": filtered });
  }

  /**
   * Check if two actors are in the same travel party
   * @private
   */
  static _areInSameParty(actor1, actor2) {
    // Find all travel-party actors
    const parties = game.actors.filter(a => a.type === "travel-party");

    for (const party of parties) {
      const members = party.system.members || [];
      const actor1InParty = members.some(m => m.actorId === actor1.id);
      const actor2InParty = members.some(m => m.actorId === actor2.id);

      if (actor1InParty && actor2InParty) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if two actors are in the same hex (requires Hexplorer)
   * @private
   */
  static _areInSameHex(actor1, actor2) {
    if (!game.modules.get("hexplorer")?.active) {
      return false;
    }

    // Get tokens for both actors
    const token1 = canvas?.tokens?.placeables?.find(t => t.actor?.id === actor1.id);
    const token2 = canvas?.tokens?.placeables?.find(t => t.actor?.id === actor2.id);

    if (!token1 || !token2) {
      return false;
    }

    // Get hex coordinates
    const hex1 = canvas.grid.getOffset({ x: token1.x, y: token1.y });
    const hex2 = canvas.grid.getOffset({ x: token2.x, y: token2.y });

    return hex1.i === hex2.i && hex1.j === hex2.j;
  }

  /**
   * Check if two actors are in the same scene
   * @private
   */
  static _areInSameScene(actor1, actor2) {
    // Get tokens for both actors in current scene
    const token1 = canvas?.tokens?.placeables?.find(t => t.actor?.id === actor1.id);
    const token2 = canvas?.tokens?.placeables?.find(t => t.actor?.id === actor2.id);

    return !!token1 && !!token2;
  }

  /**
   * Get weight of an item in stone
   * @param {Item} item
   * @returns {number} Weight in stone
   */
  static getItemWeight(item) {
    if (item.type === "money") {
      // Money weight calculated separately
      return 0;
    }

    if (["item", "weapon", "armor"].includes(item.type)) {
      const weight6 = item.system.weight6 || 0;
      const quantity = item.system.quantity?.value || 1;
      return (weight6 * quantity) / 6;
    }

    return 0;
  }

  /**
   * Calculate total weight of delegated items for an actor
   * @param {Actor} actor
   * @returns {number} Total delegated weight in stone
   */
  static async getDelegatedWeight(actor) {
    const delegated = actor.system.delegatedItems || [];
    let totalWeight = 0;

    for (const delegatedItem of delegated) {
      const item = await fromUuid(delegatedItem.itemId);
      if (item) {
        totalWeight += this.getItemWeight(item);
      }
    }

    return totalWeight;
  }

  /**
   * Get all items that are lent to an actor
   * @param {Actor} actor
   * @returns {Array} Array of items lent to this actor
   */
  static getReceivedItems(actor) {
    return actor.items.filter(item => {
      const ownership = item.system.ownership;
      return ownership?.isLent && ownership?.currentCarrier === actor.id;
    });
  }

  /**
   * Get effective encumbrance for actor (base - delegated + received)
   * @param {Actor} actor
   * @returns {Promise<Object>} Encumbrance breakdown
   */
  static async getEffectiveEncumbrance(actor) {
    // Base encumbrance (own items)
    const baseEnc = actor.system.encumbrance?.value || 0;

    // Delegated weight (items lent to others)
    const delegatedWeight = await this.getDelegatedWeight(actor);

    // Received weight (items borrowed from others)
    const receivedItems = this.getReceivedItems(actor);
    const receivedWeight = receivedItems.reduce((sum, item) => {
      return sum + this.getItemWeight(item);
    }, 0);

    return {
      base: baseEnc,
      delegated: delegatedWeight,
      received: receivedWeight,
      effective: baseEnc - delegatedWeight + receivedWeight
    };
  }
}
