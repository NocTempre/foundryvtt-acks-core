/**
 * Dialog for transferring items between party members
 */

import { ItemTransfer } from "../item-transfer.js";

export class ItemTransferDialog {

  /**
   * Show dialog to transfer an item
   * @param {Item} item - The item to transfer
   * @param {Actor} fromActor - Source actor
   */
  static async show(item, fromActor) {
    // Get all potential recipients (party members)
    const recipients = this._getAvailableRecipients(fromActor);

    if (recipients.length === 0) {
      ui.notifications.warn("No party members available to transfer to");
      return;
    }

    const content = this._buildTransferForm(item, fromActor, recipients);

    const result = await Dialog.wait({
      title: `Transfer ${item.name}`,
      content: content,
      buttons: {
        transfer: {
          icon: '<i class="fas fa-exchange-alt"></i>',
          label: "Transfer",
          callback: (html) => ({
            recipientId: html.find('[name="recipient"]').val(),
            restriction: html.find('[name="restriction"]').val()
          })
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => null
        }
      },
      default: "transfer",
      render: (html) => {
        // Update weight display when recipient changes
        html.find('[name="recipient"]').change((ev) => {
          const recipientId = ev.target.value;
          const recipient = game.actors.get(recipientId);
          if (recipient) {
            const weight = ItemTransfer.getItemWeight(item);
            html.find('.transfer-weight-info').text(`This item weighs ${weight.toFixed(1)} stone`);

            const enc = recipient.system.encumbrance;
            if (enc) {
              const newEnc = (enc.value || 0) + weight;
              const max = enc.max || 20;
              const overloaded = newEnc > max;

              html.find('.recipient-enc-info').html(
                `${recipient.name}: ${enc.value}/${max} st → <strong style="color: ${overloaded ? '#cc0000' : '#00cc00'}">${newEnc.toFixed(1)}/${max} st</strong>`
              );
            }
          }
        });

        // Trigger initial update
        html.find('[name="recipient"]').trigger('change');
      }
    });

    if (!result) return;

    const toActor = game.actors.get(result.recipientId);
    if (!toActor) {
      ui.notifications.error("Recipient not found");
      return;
    }

    // Perform transfer
    await ItemTransfer.transferItem(item, fromActor, toActor, {
      restriction: result.restriction
    });

    // Re-render both actor sheets
    fromActor.sheet.render(false);
    toActor.sheet.render(false);
  }

  /**
   * Show dialog to retrieve delegated items
   * @param {Actor} owner - The original owner
   */
  static async showRetrieveDialog(owner) {
    const delegated = owner.system.delegatedItems || [];

    if (delegated.length === 0) {
      ui.notifications.info("No delegated items to retrieve");
      return;
    }

    const content = this._buildRetrieveForm(delegated, owner);

    const result = await Dialog.wait({
      title: `Retrieve Items - ${owner.name}`,
      content: content,
      buttons: {
        retrieve: {
          icon: '<i class="fas fa-undo"></i>',
          label: "Retrieve Selected",
          callback: (html) => {
            const selected = [];
            html.find('input[name="item-select"]:checked').each((i, el) => {
              selected.push(el.value);
            });
            return selected;
          }
        },
        retrieveAll: {
          icon: '<i class="fas fa-undo-alt"></i>',
          label: "Retrieve All",
          callback: (html) => {
            return delegated.map(d => d.itemId);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => null
        }
      },
      default: "retrieve"
    });

    if (!result || result.length === 0) return;

    // Retrieve each selected item
    let retrieved = 0;
    for (const itemUuid of result) {
      try {
        await ItemTransfer.retrieveItem(itemUuid, owner);
        retrieved++;
      } catch (err) {
        console.error(`Failed to retrieve item ${itemUuid}:`, err);
      }
    }

    ui.notifications.info(`Retrieved ${retrieved} item(s)`);
    owner.sheet.render(false);
  }

  /**
   * Build the transfer form HTML
   * @private
   */
  static _buildTransferForm(item, fromActor, recipients) {
    const weight = ItemTransfer.getItemWeight(item);

    const recipientOptions = recipients.map(r => {
      const enc = r.system.encumbrance;
      const encDisplay = enc ? `(${enc.value}/${enc.max} st)` : '';
      return `<option value="${r.id}">${r.name} ${encDisplay}</option>`;
    }).join('');

    return `
      <form>
        <div class="form-group">
          <label>Item to Transfer:</label>
          <div style="display: flex; align-items: center; gap: 8px; margin: 5px 0;">
            <img src="${item.img}" width="32" height="32" style="border: 1px solid #999; border-radius: 3px;"/>
            <strong>${item.name}</strong>
          </div>
          <p class="transfer-weight-info" style="font-size: 0.9em; color: #666; margin: 5px 0;">Weighs ${weight.toFixed(1)} stone</p>
        </div>

        <div class="form-group">
          <label>From:</label>
          <div><strong>${fromActor.name}</strong></div>
        </div>

        <div class="form-group">
          <label>Transfer To:</label>
          <select name="recipient" style="width: 100%;">
            ${recipientOptions}
          </select>
          <p class="recipient-enc-info" style="font-size: 0.9em; color: #666; margin: 5px 0;"></p>
        </div>

        <div class="form-group">
          <label>Retrieval Restriction:</label>
          <select name="restriction" style="width: 100%;">
            <option value="same-party">Same Party (default)</option>
            <option value="same-hex">Same Hex</option>
            <option value="same-scene">Same Scene</option>
            <option value="always">Always (no restriction)</option>
            <option value="gm-approval">GM Approval Required</option>
          </select>
          <p class="hint" style="font-size: 0.85em; font-style: italic;">Controls when you can retrieve this item</p>
        </div>
      </form>
    `;
  }

  /**
   * Build the retrieve form HTML
   * @private
   */
  static _buildRetrieveForm(delegated, owner) {
    const items = delegated.map(d => {
      const canRetrieve = d.canRetrieve ? '' : 'disabled';
      const canRetrieveText = d.canRetrieve ? '' : ' (out of range)';

      return `
        <div class="form-group" style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #ccc; padding: 8px 0;">
          <input type="checkbox" name="item-select" value="${d.itemId}" ${canRetrieve}/>
          <img src="${d.itemImg}" width="24" height="24" style="border: 1px solid #999; border-radius: 3px;"/>
          <div style="flex: 1;">
            <strong>${d.itemName}</strong><br/>
            <span style="font-size: 0.85em; color: #666;">
              Carried by: ${d.carrierName}${canRetrieveText}
            </span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <form>
        <p style="margin-bottom: 10px;">Select items to retrieve:</p>
        <div style="max-height: 400px; overflow-y: auto;">
          ${items}
        </div>
      </form>
    `;
  }

  /**
   * Get available recipients for item transfer
   * @private
   */
  static _getAvailableRecipients(fromActor) {
    const recipients = [];

    // Find all travel parties containing this actor
    const parties = game.actors.filter(a => a.type === "travel-party");

    for (const party of parties) {
      const members = party.system.members || [];
      const isInParty = members.some(m => m.actorId === fromActor.id);

      if (isInParty) {
        // Add all other party members as potential recipients
        members.forEach(member => {
          const actor = game.actors.get(member.actorId);
          if (actor && actor.id !== fromActor.id && !recipients.some(r => r.id === actor.id)) {
            recipients.push(actor);
          }
        });
      }
    }

    // Sort by name
    recipients.sort((a, b) => a.name.localeCompare(b.name));

    return recipients;
  }
}
