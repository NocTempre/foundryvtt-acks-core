import { AcksDice } from "../dice.js";
import { templatePath, renderTemplate } from "../config.js";

export class AcksCharacterCreator extends FormApplication {
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.classes = ["acks", "dialog", "creator"];
    options.id = "character-creator";
    options.template = templatePath("actors/dialogs/character-creation.html");
    options.width = 235;
    return options;
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   * @type {String}
   */
  get title() {
    return `${this.object.name}: ${game.i18n.localize("ACKS.dialog.generator")}`;
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData() {
    const system = this.object.system;

    system.details = system.details ?? {};
    system.details.creation = system.details.creation ?? { order: [] };

    system.counters = system.counters ?? {
      str: 0,
      wis: 0,
      dex: 0,
      int: 0,
      cha: 0,
      con: 0,
      gold: 0,
    };
    system.stats = system.stats ?? {
      sum: 0,
      avg: 0,
      std: 0,
    };

    const creationOrder = Array.from(system.details.creation.order ?? []);
    this._creationOrder = creationOrder;
    const creationLocks = {};
    for (const ability of creationOrder) {
      creationLocks[ability] = true;
    }

    system.user = game.user;
    system.config = CONFIG.ACKS;
    system.characterType = system.details?.characterType ?? "pc";
    system.creationOrder = creationOrder;
    system.creationLocks = creationLocks;
    system.currentScores = {};
    for (const [key, score] of Object.entries(system.scores ?? {})) {
      system.currentScores[key] = Number(score.value) || 0;
    }

    return system;
  }

  /* -------------------------------------------- */
  doStats(html) {
    const values = html
      .find(".attribute-list .score-value")
      .map((_, input) => parseInt(input.value, 10))
      .get()
      .filter((value) => !Number.isNaN(value) && value !== 0);

    const stats = html.find(".roll-stats");

    if (values.length === 0) {
      stats.find(".sum").text(0);
      stats.find(".avg").text(0);
      stats.find(".std").text(0);
      this.object.system.stats = { sum: 0, avg: 0, std: 0 };
      return;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    stats.find(".sum").text(sum);
    stats.find(".avg").text(Math.round((10 * mean)) / 10);
    stats.find(".std").text(Math.round(100 * std) / 100);

    this.object.system.stats = {
      sum,
      avg: Math.round((10 * mean)) / 10,
      std: Math.round(100 * std) / 100,
    };
  }

  /* -------------------------------------------- */
  async rollScore(score, options = {}) {
    if (score === "gold") {
      return this._rollGold(options);
    }

    if (this._isScoreLocked(score) || (this.object.system.details?.characterType ?? "pc") !== "pc") {
      return null;
    }

    const orderLength = this._getCreationOrder().length;
    const rollConfig = this._getPcRollConfig(orderLength);
    if (!rollConfig) {
      return null;
    }

    this._ensureCounters();
    const currentCount = Number(this.object.system.counters[score] ?? 0);
    this.object.system.counters[score] = currentCount + 1;

    const label = game.i18n.localize(`ACKS.scores.${score}.long`);
    const minHint = rollConfig.minimum ? ` (min ${rollConfig.minimum})` : "";
    const data = {
      roll: {
        type: "result",
      },
    };

    const roll = await AcksDice.Roll({
      event: options.event,
      parts: [rollConfig.formula],
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this.object }),
      flavor: game.i18n.format("ACKS.dialog.generateScore", {
        score: label,
        count: this.object.system.counters[score],
      }) + minHint,
      title:
        game.i18n.format("ACKS.dialog.generateScore", {
          score: label,
          count: this.object.system.counters[score],
        }) + minHint,
    });

    if (!roll) {
      return null;
    }

    let total = roll.total;
    if (rollConfig.minimum && total < rollConfig.minimum) {
      this._announceMinimum(score, total, rollConfig.minimum);
      total = rollConfig.minimum;
    }

    const updatedOrder = this._getCreationOrder();
    if (!updatedOrder.includes(score)) {
      updatedOrder.push(score);
    }
    this._creationOrder = updatedOrder;
    await this.object.update({
      [`system.scores.${score}.value`]: total,
      "system.details.creation.order": this._creationOrder,
      "system.details.characterType": "pc",
    });

    this.object.system.scores[score].value = total;
    this.object.system.details.creation = this.object.system.details.creation ?? { order: [] };
    this.object.system.details.creation.order = Array.from(this._creationOrder);

    return total;
  }

  _getCreationOrder() {
    if (!Array.isArray(this._creationOrder)) {
      this._creationOrder = Array.from(this.object.system.details?.creation?.order ?? []);
    }
    return Array.from(this._creationOrder);
  }

  _isScoreLocked(score) {
    return this._getCreationOrder().includes(score);
  }

  _getPcRollConfig(index) {
    if (index === 0) {
      return { formula: "5d6kh3", minimum: 13 };
    }
    if (index === 1 || index === 2) {
      return { formula: "4d6kh3", minimum: 9 };
    }
    if (index >= 6) {
      return null;
    }
    return { formula: "3d6" };
  }

  async _rollGold(options = {}) {
    this._ensureCounters();
    const currentCount = Number(this.object.system.counters.gold ?? 0);
    this.object.system.counters.gold = currentCount + 1;
    const data = {
      roll: {
        type: "result",
      },
    };
    const roll = await AcksDice.Roll({
      event: options.event,
      parts: ["3d6"],
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this.object }),
      flavor: game.i18n.format("ACKS.dialog.generateScore", {
        score: "Gold",
        count: this.object.system.counters.gold,
      }),
      title: game.i18n.format("ACKS.dialog.generateScore", {
        score: "Gold",
        count: this.object.system.counters.gold,
      }),
    });
    return roll ? roll.total : null;
  }

  _ensureCounters() {
    if (!this.object.system.counters) {
      this.object.system.counters = {
        str: 0,
        wis: 0,
        dex: 0,
        int: 0,
        cha: 0,
        con: 0,
        gold: 0,
      };
    }
  }

  _announceMinimum(score, rolledTotal, minimum) {
    const label = game.i18n.localize(`ACKS.scores.${score}.long`);
    const message = `${label}: minimum ${minimum} applied (rolled ${rolledTotal}).`;
    ChatMessage.create({
      content: message,
      speaker: ChatMessage.getSpeaker({ actor: this.object }),
    });
  }

  _updateSubmitState(html) {
    const submit = html.find('button[type="submit"]');
    if (!submit.length) {
      return;
    }
    const type = this.object.system.details?.characterType ?? "pc";
    const isComplete = this._getCreationOrder().length >= 6;
    if (type === "pc" && !isComplete) {
      submit.attr("disabled", "disabled");
    } else {
      submit.removeAttr("disabled");
    }
  }

  _syncLockState(html) {
    const type = this.object.system.details?.characterType ?? "pc";
    const locked = new Set(this._getCreationOrder());
    html.find(".attribute-list .form-group").each((_, element) => {
      const group = $(element);
      const ability = group.data("score");
      const anchor = group.find("a.score-roll");
      const input = group.find("input.score-value");
      const isLocked = type !== "pc" || locked.has(ability);

      if (anchor.length) {
        if (isLocked) {
          anchor.addClass("locked").attr("aria-disabled", "true");
        } else {
          anchor.removeClass("locked").removeAttr("aria-disabled");
        }
      }

      if (isLocked) {
        input.attr("readonly", "readonly");
      } else {
        input.removeAttr("readonly");
      }

      if (type !== "pc") {
        input.attr("readonly", "readonly");
      }
    });

    this._updateSubmitState(html);
  }

  async _onTypeChange(event, html) {
    const target = event.currentTarget;
    const selectedType = target.value;
    const currentType = this.object.system.details?.characterType ?? "pc";
    if (selectedType === currentType) {
      return;
    }

    if (selectedType === "henchman") {
      await this.object.update({
        "system.details.characterType": "henchman",
        "system.details.creation.order": [],
        "system.isNew": true,
      });
      this.object.system.isNew = true;
      this._creationOrder = [];
      await this.object.generateHenchmanScores();
    } else {
      await this.object.update({
        "system.details.characterType": "pc",
        "system.details.creation.order": [],
        "system.isNew": true,
      });
      this.object.system.isNew = true;
      this._creationOrder = [];
      await this._resetPcScores();
    }

    this.render(true);
  }

  async _resetPcScores() {
    const updates = {};
    for (const ability of Object.keys(this.object.system.scores ?? {})) {
      updates[`system.scores.${ability}.value`] = 0;
    }
    updates["system.isNew"] = true;
    await this.object.update(updates);
    for (const ability of Object.keys(this.object.system.scores ?? {})) {
      this.object.system.scores[ability].value = 0;
    }
    this._creationOrder = [];
    this.object.system.details.creation = this.object.system.details.creation ?? { order: [] };
    this.object.system.details.creation.order = [];
    this.object.system.isNew = true;
    this.object.system.stats = { sum: 0, avg: 0, std: 0 };
  }

  /* -------------------------------------------- */
  async close(options) {
    // Gather scores
    let scores = {};
    $(this.form)
      .find(".form-group[data-score]")
      .each((_, d) => {
        let gr = $(d).closest(".form-group");
        let val = gr.find(".score-value").val();
        scores[gr.data("score")] = val;
      });
    const gold = $(this.form).find(".gold-value").val();
    const speaker = ChatMessage.getSpeaker({ actor: this });
    const templateData = {
      config: CONFIG.ACKS,
      scores: scores,
      title: game.i18n.localize("ACKS.dialog.generator"),
      stats: this.object.system.stats,
      gold: gold,
    };
    const content = await renderTemplate(templatePath("chat/roll-creation.html"), templateData);
    ChatMessage.create({
      content: content,
      speaker,
    });
    return super.close(options);
  }

  /* -------------------------------------------- */
  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('input[name="character-type"]').change((ev) => {
      this._onTypeChange(ev, html);
    });

    html.find("a.score-roll").click(async (ev) => {
      ev.preventDefault();
      const anchor = ev.currentTarget;
      if (anchor.classList.contains("locked")) {
        return;
      }
      const group = anchor.closest(".form-group");
      if (!group) {
        return;
      }
      const score = group.dataset.score;
      const total = await this.rollScore(score, { event: ev });
      if (total === null || total === undefined) {
        return;
      }
      $(group).find("input.score-value").val(total).trigger("change");
      $(anchor).addClass("locked").attr("aria-disabled", "true");
      this._syncLockState(html);
    });

    html.find("a.gold-roll").click(async (ev) => {
      ev.preventDefault();
      const total = await this._rollGold({ event: ev });
      if (total === null || total === undefined) {
        return;
      }
      $(ev.currentTarget)
        .closest(".roll-stats")
        .find(".gold-value")
        .val(total * 10);
    });

    html.find("input.score-value").change(() => {
      this.doStats(html);
      this._updateSubmitState(html);
    });

    this._syncLockState(html);
    this.doStats(html);
    this._updateSubmitState(html);
  }

  async _onSubmit(event, { updateData = null, preventClose = false, preventRender = false } = {}) {
    super._onSubmit(event, { updateData: updateData, preventClose: preventClose, preventRender: preventRender });
    // Update stats
    let update = {};
    $(this.form)
      .find(".form-group[data-score]")
      .each((_, element) => {
        const group = $(element);
        const value = Number(group.find(".score-value").val()) || 0;
        update[`system.scores.${group.data("score")}`] = { mod: 0, bonus: 0, value: value };
      });
    await this.object.update(update);

    // Generate gold
    let gold = event.target.elements.namedItem("gold").value;
    this.object.manageMoney("Gold", gold);
  }

  /* -------------------------------------------- */
  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  async _updateObject(event, formData) {
    event.preventDefault();
    // Update the actor
    this.object.update(formData);
    // Re-draw the updated sheet
    this.object.sheet.render(true);
  }
}
