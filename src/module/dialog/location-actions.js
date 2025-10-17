import { templatePath, TextEditorRef, SYSTEM_ID } from "../config.js";

export class AcksLocationActions extends FormApplication {
  constructor(actor, location, options = {}) {
    super({}, options);
    this.actor = actor;
    this.location = location;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["acks", "dialog", "location-actions"],
      template: templatePath("actors/dialogs/location-actions.html"),
      width: 600,
      height: "auto",
      title: "Location Actions",
      closeOnSubmit: false,
      submitOnChange: false,
      submitOnClose: false,
      resizable: true,
    });
  }

  get title() {
    return `${this.location.name} - Actions for ${this.actor.name}`;
  }

  getData() {
    const data = super.getData();

    data.location = this.location;
    data.actor = this.actor;
    data.actions = this._prepareActions();
    data.owner = this.actor.isOwner;
    data.editable = true;

    return data;
  }

  /**
   * Prepare actions, filtering by requirements
   */
  _prepareActions() {
    const allActions = this.location.system.actions || [];

    return allActions.map(action => {
      const meetsReqs = this._meetsRequirements(action.requirements || {});
      return {
        ...action,
        available: meetsReqs,
        requirementsMet: meetsReqs,
        timeCostLabel: this._getTimeCostLabel(action.timeCost),
      };
    });
  }

  /**
   * Check if actor meets action requirements
   */
  _meetsRequirements(reqs) {
    if (!reqs) return true;

    // Check gold requirement
    if (reqs.gold && reqs.gold > 0) {
      const actorGold = this._getActorGold();
      if (actorGold < reqs.gold) return false;
    }

    // Check item requirements
    if (reqs.items && reqs.items.length > 0) {
      for (const itemName of reqs.items) {
        const hasItem = this.actor.items.find(i =>
          i.name.toLowerCase() === itemName.toLowerCase()
        );
        if (!hasItem) return false;
      }
    }

    // Check proficiency requirements
    if (reqs.proficiencies && reqs.proficiencies.length > 0) {
      for (const profName of reqs.proficiencies) {
        const hasProf = this.actor.items.find(i =>
          i.type === "ability" &&
          i.name.toLowerCase() === profName.toLowerCase()
        );
        if (!hasProf) return false;
      }
    }

    // TODO: Handle custom requirements in reqs.other

    return true;
  }

  /**
   * Get actor's total gold
   */
  _getActorGold() {
    if (typeof this.actor.getTotalMoneyGC === "function") {
      return this.actor.getTotalMoneyGC();
    }

    // Fallback: sum money items
    let total = 0;
    this.actor.items.forEach(item => {
      if (item.type === "money") {
        const copperValue = item.system.coppervalue || 0;
        const quantity = item.system.quantity || 0;
        total += (copperValue * quantity) / 100; // Convert to gold
      }
    });
    return total;
  }

  /**
   * Format time cost label
   */
  _getTimeCostLabel(timeCost) {
    if (!timeCost) return "Instant";
    const parts = [];
    if (timeCost.watches) parts.push(`${timeCost.watches} watch${timeCost.watches > 1 ? "es" : ""}`);
    if (timeCost.days) parts.push(`${timeCost.days} day${timeCost.days > 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") : "Instant";
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('button[name="close"]').click((ev) => {
      ev.preventDefault();
      this.close();
    });

    html.find(".execute-action").click(this._onExecuteAction.bind(this));
  }

  async _onExecuteAction(event) {
    event.preventDefault();
    const actionId = event.currentTarget.dataset.actionId;
    const action = this.location.system.actions.find(a => a.id === actionId);

    if (!action) {
      ui.notifications.error("Action not found");
      return;
    }

    // Check requirements again
    if (!this._meetsRequirements(action.requirements || {})) {
      ui.notifications.warn("You do not meet the requirements for this action");
      return;
    }

    // Execute macro or roll table
    let executed = false;

    if (action.macro) {
      const macro = game.macros.get(action.macro);
      if (macro) {
        await macro.execute({
          actor: this.actor,
          location: this.location,
          action: action,
        });
        executed = true;
      } else {
        ui.notifications.warn(`Macro not found: ${action.macro}`);
      }
    } else if (action.rollTable) {
      const table = game.tables.get(action.rollTable);
      if (table) {
        await table.draw({
          displayChat: true,
          rollMode: game.settings.get("core", "rollMode"),
        });
        executed = true;
      } else {
        ui.notifications.warn(`Roll table not found: ${action.rollTable}`);
      }
    } else {
      // No macro or table, just post action to chat
      await this._postActionToChat(action);
      executed = true;
    }

    if (!executed) return;

    // Consume time if specified
    if (action.timeCost && (action.timeCost.watches || action.timeCost.days)) {
      await this._advanceTime(action.timeCost);
    }

    // Consume gold if required
    if (action.requirements?.gold && action.requirements.gold > 0) {
      // TODO: Implement gold deduction
      ui.notifications.info(`Cost: ${action.requirements.gold} gp (auto-deduction not yet implemented)`);
    }

    ui.notifications.info(`Executed: ${action.name}`);
  }

  /**
   * Post action to chat
   */
  async _postActionToChat(action) {
    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="acks location-action">
          <h3>${action.name}</h3>
          <p><strong>Location:</strong> ${this.location.name}</p>
          ${action.description ? `<p>${action.description}</p>` : ""}
          ${action.timeCost ? `<p><em>Time: ${this._getTimeCostLabel(action.timeCost)}</em></p>` : ""}
        </div>
      `,
    };

    await ChatMessage.create(chatData);
  }

  /**
   * Advance time and emit hook
   */
  async _advanceTime(timeCost) {
    const currentTime = game.settings.get(SYSTEM_ID, "gameTime") || 0;
    const hours = (timeCost.watches || 0) * 4 + (timeCost.days || 0) * 24;
    const newTime = currentTime + hours;

    await game.settings.set(SYSTEM_ID, "gameTime", newTime);

    // Emit hook for future timekeeper integration
    Hooks.callAll("acks.timePassed", {
      hours,
      oldTime: currentTime,
      newTime,
      actor: this.actor,
      location: this.location,
    });

    ui.notifications.info(`Time advanced by ${hours} hours`);
  }

  async _updateObject(event, formData) {
    // No form submission needed for this dialog
  }
}
