/**
 * Container Management System
 *
 * Handles items that can contain other items (bags, chests, saddlebags, etc.)
 * with weight reduction and mount requirements.
 */

import { ItemTransfer } from "./item-transfer.js";

export class ContainerManager {

  /**
   * Add an item to a container
   * @param {Item} item - The item to add
   * @param {Item} container - The container item
   * @param {Actor} carrier - The actor carrying the container
   * @returns {Promise<boolean>} Success
   */
  static async addToContainer(item, container, carrier) {
    if (!this.isContainer(container)) {
      ui.notifications.warn(`${container.name} is not a container`);
      return false;
    }

    const containerData = container.system.container;

    // Check capacity
    const itemWeight = ItemTransfer.getItemWeight(item);
    const newWeight = containerData.currentWeight + itemWeight;

    if (newWeight > containerData.capacityStone) {
      ui.notifications.warn(`${container.name} is full (${containerData.currentWeight}/${containerData.capacityStone} stone)`);
      return false;
    }

    // Check mount requirement
    if (containerData.requiresMount) {
      const hasMount = this._carrierHasMount(carrier);
      if (!hasMount) {
        ui.notifications.warn(`${container.name} requires a mount or vehicle`);
        return false;
      }
    }

    // Add item to container's contained list
    const containedItems = [...containerData.containedItems];
    containedItems.push({
      itemId: item.id,
      itemUuid: item.uuid,
      itemName: item.name,
      itemType: item.type,
      weight: itemWeight
    });

    // Update container
    await container.update({
      "system.container.containedItems": containedItems,
      "system.container.currentWeight": newWeight
    });

    // Mark item as contained (add flag)
    await item.update({
      "flags.acks-core.containedIn": container.id
    });

    ui.notifications.info(`Added ${item.name} to ${container.name}`);

    // Recalculate encumbrance
    if (carrier.computeEncumbrance) {
      carrier.computeEncumbrance();
    }

    return true;
  }

  /**
   * Remove an item from a container
   * @param {string} itemId - The item ID to remove
   * @param {Item} container - The container item
   * @param {Actor} carrier - The actor carrying the container
   * @returns {Promise<boolean>} Success
   */
  static async removeFromContainer(itemId, container, carrier) {
    const containerData = container.system.container;
    const containedItems = containerData.containedItems || [];

    const index = containedItems.findIndex(ci => ci.itemId === itemId);
    if (index === -1) {
      ui.notifications.warn("Item not found in container");
      return false;
    }

    const removedItem = containedItems[index];
    const updatedContained = containedItems.filter((_, i) => i !== index);
    const newWeight = containerData.currentWeight - removedItem.weight;

    // Update container
    await container.update({
      "system.container.containedItems": updatedContained,
      "system.container.currentWeight": Math.max(0, newWeight)
    });

    // Remove contained flag from item
    const item = carrier.items.get(itemId);
    if (item) {
      await item.update({
        "flags.acks-core.-=containedIn": null
      });
    }

    ui.notifications.info(`Removed ${removedItem.itemName} from ${container.name}`);

    // Recalculate encumbrance
    if (carrier.computeEncumbrance) {
      carrier.computeEncumbrance();
    }

    return true;
  }

  /**
   * Check if an item is a container
   * @param {Item} item
   * @returns {boolean}
   */
  static isContainer(item) {
    return item.type === "item" && item.system.container?.isContainer === true;
  }

  /**
   * Get effective weight of a container
   * Applies weight reduction multiplier to contents
   * @param {Item} container
   * @returns {number} Effective weight in stone
   */
  static getContainerWeight(container) {
    if (!this.isContainer(container)) {
      return ItemTransfer.getItemWeight(container);
    }

    const containerData = container.system.container;
    const baseWeight = container.system.weight6 ? container.system.weight6 / 6 : 0;
    const contentsWeight = containerData.currentWeight || 0;
    const reduction = containerData.capacityReduction || 0;

    // Apply weight reduction to contents
    const effectiveContentsWeight = contentsWeight * (1 - reduction);

    return baseWeight + effectiveContentsWeight;
  }

  /**
   * Get all items contained in a container
   * @param {Item} container
   * @param {Actor} carrier
   * @returns {Array} Array of items
   */
  static getContainedItems(container, carrier) {
    if (!this.isContainer(container)) {
      return [];
    }

    const containerData = container.system.container;
    const containedItems = containerData.containedItems || [];

    return containedItems.map(ci => {
      const item = carrier.items.get(ci.itemId);
      return {
        ...ci,
        item: item,
        exists: !!item
      };
    });
  }

  /**
   * Create a container item
   * @param {Actor} actor - The actor to create the container for
   * @param {Object} containerDef - Container definition
   * @returns {Promise<Item>}
   */
  static async createContainer(actor, containerDef) {
    const {
      name = "Container",
      capacity = 10,
      capacityReduction = 0,
      requiresMount = false,
      baseWeight = 1,
      img = "icons/svg/item-bag.svg"
    } = containerDef;

    const itemData = {
      name: name,
      type: "item",
      img: img,
      system: {
        weight6: baseWeight * 6,
        quantity: { value: 1, max: 1 },
        container: {
          isContainer: true,
          capacityStone: capacity,
          capacityReduction: capacityReduction,
          requiresMount: requiresMount,
          containedItems: [],
          currentWeight: 0
        }
      }
    };

    const [item] = await actor.createEmbeddedDocuments("Item", [itemData]);
    return item;
  }

  /**
   * Show container contents dialog
   * @param {Item} container
   * @param {Actor} carrier
   */
  static async showContainerDialog(container, carrier) {
    const containedItems = this.getContainedItems(container, carrier);
    const containerData = container.system.container;

    const content = this._buildContainerDialogContent(container, containedItems, containerData);

    new Dialog({
      title: `${container.name} Contents`,
      content: content,
      buttons: {
        close: {
          icon: '<i class="fas fa-times"></i>',
          label: "Close"
        }
      },
      render: (html) => {
        // Add remove item listeners
        html.find('.remove-from-container').click(async (ev) => {
          const itemId = ev.currentTarget.dataset.itemId;
          await this.removeFromContainer(itemId, container, carrier);
          // Re-render dialog
          this.showContainerDialog(container, carrier);
        });
      }
    }).render(true);
  }

  /**
   * Build container dialog content
   * @private
   */
  static _buildContainerDialogContent(container, containedItems, containerData) {
    const items = containedItems.map(ci => {
      const exists = ci.exists ? '' : ' (missing)';
      return `
        <div class="flexrow" style="align-items: center; padding: 5px 0; border-bottom: 1px solid #ccc;">
          <img src="${ci.item?.img || 'icons/svg/mystery-man.svg'}" width="24" height="24" style="border: 1px solid #999; border-radius: 3px; margin-right: 8px;"/>
          <div style="flex: 1;">
            <strong>${ci.itemName}${exists}</strong><br/>
            <span style="font-size: 0.85em; color: #666;">${ci.weight.toFixed(1)} stone</span>
          </div>
          ${ci.exists ? `<a class="remove-from-container" data-item-id="${ci.itemId}" title="Remove"><i class="fas fa-times"></i></a>` : ''}
        </div>
      `;
    }).join('');

    const emptyMsg = containedItems.length === 0
      ? '<p style="text-align: center; color: #999; padding: 20px;"><em>Container is empty</em></p>'
      : '';

    return `
      <div>
        <div style="background: #f0f0f0; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
          <strong>Capacity:</strong> ${containerData.currentWeight.toFixed(1)} / ${containerData.capacityStone} stone<br/>
          ${containerData.capacityReduction > 0 ? `<strong>Weight Reduction:</strong> ${(containerData.capacityReduction * 100).toFixed(0)}%<br/>` : ''}
          ${containerData.requiresMount ? '<span style="color: #ff6600;"><strong>Requires Mount/Vehicle</strong></span>' : ''}
        </div>
        <div style="max-height: 300px; overflow-y: auto;">
          ${items}
          ${emptyMsg}
        </div>
      </div>
    `;
  }

  /**
   * Check if carrier has a mount or is on a vehicle
   * @private
   */
  static _carrierHasMount(carrier) {
    // Check if carrier is a monster (could be a mount itself)
    if (carrier.type === "monster") {
      return true;
    }

    // Check if carrier is in a travel party with mounts/vehicles
    const parties = game.actors.filter(a => a.type === "travel-party");
    for (const party of parties) {
      const members = party.system.members || [];
      const isInParty = members.some(m => m.actorId === carrier.id);

      if (isInParty) {
        // Check if party has mounts or vehicles
        const hasMounts = members.some(m => {
          const actor = game.actors.get(m.actorId);
          return actor && actor.type === "monster" && (
            actor.system.draftAnimal?.enabled ||
            actor.system.mountStats?.canBeRidden
          );
        });

        const hasVehicles = party.items.filter(i => i.type === "vehicle").length > 0;

        return hasMounts || hasVehicles;
      }
    }

    return false;
  }
}
