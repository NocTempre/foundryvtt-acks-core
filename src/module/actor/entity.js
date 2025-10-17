import { AcksDice } from "../dice.js";
import { AcksUtility } from "../utility.js";
import { SYSTEM_ID } from "../config.js";

const TARGET_NUMBER_PATTERN = /^(\d+)\+?$/;

function parseTargetValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const match = value.match(TARGET_NUMBER_PATTERN);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export class AcksActor extends Actor {
  static async create(data, options) {
    // Case of compendium global import
    if (data instanceof Array) {
      return super.create(data, options);
    }
    // If the created actor has items (only applicable to foundry.utils.duplicated actors) bypass the new actor creation logic
    if (data.items) {
      return super.create(data, options);
    }

    data.system = data.system ?? {};
    data.system.isNew = true; // Flag the actor as new
    if (data.type == "character") {
      data.system.details = data.system.details ?? {};
      if (!data.system.details.characterType) {
        data.system.details.characterType = "pc";
      }
      const skills = await AcksUtility.loadCompendium("acks.acks-all-equipment");
      data.items = skills.map((i) => i.toObject()).filter((i) => i.type == "money");
    }

    const actor = await super.create(data, options);

    if (
      actor.type === "character" &&
      actor.system.details?.characterType === "henchman" &&
      actor.system.isNew
    ) {
      await actor.generateHenchmanScores();
    }

    return actor;
  }

  async _onUpdate(changed, options, userId) {
    if (options?.skipClassHpAuto) {
      return super._onUpdate(changed, options, userId);
    }
    console.log("Regular update", changed, options, userId);

    if (this.type == "character" && this.system.retainer?.enabled && this.system.retainer?.managerid != "") {
      let manager = game.actors.get(this.system.retainer.managerid);
      if (manager && manager.sheet.rendered) {
        manager.sheet.render();
      }
    }
    if (changed.system?.retainer?.enabled == false && this.system.retainer.managerid != "") {
      let manager = game.actors.get(this.system.retainer.managerid);
      setTimeout(() => {
        manager.delHenchman(this.id);
      }, 200);
    }
    if (this.type == "character" && changed.system?.scores) {
      const creationOrder = this.system.details?.creation?.order ?? [];
      const isHenchman = this.system.details?.characterType === "henchman";
      if (isHenchman || creationOrder.length >= 6) {
        setTimeout(() => {
          this.update({ "system.isNew": false });
        }, 200);
      }
    } else if (this.type == "monster" && changed.system?.saves) {
      setTimeout(() => {
        this.update({ "system.isNew": false });
      }, 200);
    }
    await super._onUpdate(changed, options, userId);
  }

  /**
   * Extends data from base Actor class
   */
  computeAdditionnalData() {
    // Skip derived data computation for travel-party and location
    if (this.type === "travel-party" || this.type === "location") {
      return;
    }

    const data = this.system;

    // Compute modifiers from actor scores
    this.computeModifiers();
    this._isSlow();
    this.computeAC();
    this.computeAAB();

    // Compute modifiers from actor scores
    if (this.isOwner || game.user.isGM) {
      this.computeEncumbrance();
      this.computeBHR();
    }

    // Determine Initiative
    data.initiative.value = data.initiative.mod || 0;
    if (this.type == "character") {
      data.initiative.value += data.scores.dex.mod;
      if (data.isSlow) {
        data.initiative.value -= 1;
      }
    }

    data.movement.encounter = Math.floor((data.movement.base / 3) * 10) / 10;
    if (this.type == "character" && this.system.config.movementAuto) {
      data.movementacks.stealth = Math.floor((data.movementacks.combat / 2) * 10) / 10;
      data.movementacks.climb = Math.floor((data.movementacks.combat / 3) * 10) / 10;
    }
  }

  /* -------------------------------------------- */
  prepareData() {
    super.prepareData();
  }

  /* -------------------------------------------- */
  prepareBaseData() {
    super.prepareBaseData();
    if (this.type === "character") {
      this.applyClassAutomation();
    }
  }

  /* -------------------------------------------- */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.computeAdditionnalData();
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
    /* -------------------------------------------- */
  async getExperience(value, options = {}) {
    if (this.type != "character") {
      return;
    }

    let modified = Math.floor(value + (this.system.details.xp.bonus * value) / 100);

    await this.update({
      "system.details.xp.value": modified + this.system.details.xp.value,
    });

    const speaker = ChatMessage.getSpeaker({ actor: this });
    await ChatMessage.create({
      content: game.i18n.format("ACKS.messages.GetExperience", {
        name: this.name,
        value: modified,
      }),
      speaker,
    });
  }

  /* -------------------------------------------- */
  manageMoney(name, quantity) {
    let money = this.items.find((i) => i.name.toLowerCase() == name.toLowerCase());
    if (!money) {
      return;
    }
    let newValue = Number(money.system.quantity) + Number(quantity);
    if (newValue < 0) {
      newValue = 0;
    }
    money.update({ "system.quantity": newValue });
  }

  /* -------------------------------------------- */
  /** Return true if the character has a "heavy helmet" equipped
   *
   */
  hasHeavyHelm() {
    if (this.type != "character") {
      return false;
    }
    let hasHeavyHelm = false;
    this.items.forEach((item) => {
      if (
        item.type == "armor" &&
        item.system.equipped &&
        item.name.toLowerCase().includes("heavy") &&
        item.name.toLowerCase().includes("helmet")
      ) {
        hasHeavyHelm = true;
      }
    });
    return hasHeavyHelm;
  }

  /* -------------------------------------------- */
  getHitDice() {
    return this.system.hp.hd;
  }

  /* -------------------------------------------- */
  getMaxHitPoints() {
    return this.system.hp.max;
  }

  /* -------------------------------------------- */
  getCurrentHitPoints() {
    return this.system.hp.value;
  }

  /* -------------------------------------------- */
  getConModifier() {
    if (this.type != "character") {
      return 0;
    }
    return this.system.scores.con.mod;
  }

  /* -------------------------------------------- */
  getWillModifier() {
    if (this.type != "character") {
      return 0;
    }
    return this.system.scores.wis.mod;
  }

  /* -------------------------------------------- */
  getLanguages() {
    let lang = this.items.filter((i) => i.type == "language");
    return lang;
  }

  /* -------------------------------------------- */
  getHenchmen() {
    if (this.type != "character") {
      return;
    }

    let subActors = [];
    for (let id of this.system.henchmenList) {
      subActors.push(foundry.utils.duplicate(game.actors.get(id)));
    }
    return subActors;
  }

  /* -------------------------------------------- */
  requestHenchman(subActorId) {
    let henchman = game.actors.get(subActorId);
    let d = new Dialog({
      title: "Assign " + henchman.name + " as a Hireling of " + this.name + "?",
      content: "<p>It will enable the Hireling flag in the actor, as well as an linked token actor.</p>",
      buttons: {
        one: {
          icon: '<i class="fas fa-check"></i>',
          label: "Yes",
          callback: async () => {
            await henchman.update({ "system.retainer.enabled": true, "prototypeToken.actorLink": true });
            this.addHenchman(subActorId);
          },
        },
        two: {
          icon: '<i class="fas fa-times"></i>',
          label: "No",
          callback: () => {
            return;
          },
        },
      },
      default: "two",
    });
    d.render(true);
  }

  /* -------------------------------------------- */
  async addHenchman(subActorId) {
    if (this.type != "character") {
      ui.notifications.error(game.i18n.localize("ACKS.error.HenchmanCharacter"));
      return;
    }
    let npc = game.actors.get(subActorId);
    if (npc?.type != "character") {
      ui.notifications.error(game.i18n.localize("ACKS.error.HenchmanMonster"));
      return;
    }
    if (!npc?.system.retainer?.enabled) {
      this.requestHenchman(subActorId);
      return;
    }
    // Check if it is a linked character
    if (!npc.prototypeToken.actorLink) {
      this.requestHenchman(subActorId);
      return;
    }
    // Check if the owner is a  linked character
    if (!this.prototypeToken.actorLink) {
      ui.notifications.error(game.i18n.localize("ACKS.error.ActorLinked"));
      return;
    }
    // Check if the henchman is already in another actor
    let henchmen = game.actors.filter((a) => a.type == "character" && a.system.henchmenList.includes(subActorId));
    if (henchmen.length > 0) {
      ui.notifications.error(game.i18n.localize("ACKS.error.HenchmanAlready"));
      return;
    }
    let subActors = foundry.utils.duplicate(this.system.henchmenList);
    subActors.push(subActorId);
    await this.update({ "system.henchmenList": subActors });

    // Set the name of the manager in the henchman data
    await npc.update({ "system.retainer.managerid": this.id });
  }
  /* -------------------------------------------- */
  async delHenchman(subActorId) {
    let newArray = [];
    for (let id of this.system.henchmenList) {
      if (id != subActorId) {
        newArray.push(id);
      }
    }
    await this.update({ "system.henchmenList": newArray });
    // Cleanup the manager id
    let npc = game.actors.get(subActorId);
    await npc.update({ "system.retainer.managerid": "" });
  }

  /* -------------------------------------------- */
  showHenchman(henchmanId) {
    let henchman = game.actors.get(henchmanId);
    henchman.sheet.render(true);
  }

  /* -------------------------------------------- */
  getManagerName() {
    if (this.type != "character" || this.system.retainer?.managerid == "") {
      return "";
    }
    let manager = game.actors.get(this.system.retainer.managerid);
    return manager.name;
  }
  /* -------------------------------------------- */
  updateMoney(moneyId, value) {
    let money = this.items.find((i) => i.id == moneyId);
    let newValue = money.system.quantity + value;
    if (newValue < 0) {
      newValue = 0;
    }
    money.update({ "system.quantity": newValue });
  }

  /* -------------------------------------------- */
  getTotalWages() {
    let total = 0;
    if (this.type != "character") {
      return 0;
    }
    this.system.henchmenList.forEach((id) => {
      let henchman = game.actors.get(id);
      let q = henchman.system.retainer?.quantity || 1;
      total += Number(henchman.system.retainer.wage) * Number(q);
    });
    return total;
  }

  /* -------------------------------------------- */
  payWages() {
    if (this.type != "character") {
      return;
    }

    let totalWages = this.getTotalWages() * 100;
    let totalMoney = this.getTotalMoneyGC() * 100;
    if (totalWages > totalMoney) {
      ui.notifications.error(game.i18n.localize("ACKS.error.NotEnoughMoney"));
      return;
    }
    // Get GC item
    let moneyItems = this.items.filter((i) => i.type == "money");
    // Sort money items per coppervalue, descending order
    moneyItems.sort((a, b) => a.system.coppervalue - b.system.coppervalue);
    // Loop through money items and decrement the totalWages value (expressed in copper)
    for (let item of moneyItems) {
      let quantity = Math.floor(totalWages / item.system.coppervalue);
      if (quantity > item.system.quantity) {
        quantity = item.system.quantity;
      }
      totalWages -= quantity * item.system.coppervalue;
      item.update({ "system.quantity": item.system.quantity - quantity });
      if (totalWages == 0) {
        break;
      }
    }
    // Send result chat message
    const speaker = ChatMessage.getSpeaker({ actor: this });
    ChatMessage.create({
      content: game.i18n.format("ACKS.messages.PayWages", {
        name: this.name,
        value: this.getTotalWages(),
      }),
      speaker,
    });
  }

  /* -------------------------------------------- */
  getTotalMoneyGC() {
    let total = 0;
    this.items.forEach((item) => {
      if (item.type == "money") {
        total += item.system.quantity * item.system.coppervalue;
      }
    });
    return total / 100;
  }
  /* -------------------------------------------- */
  getTotalMoneyEncumbrance() {
    let total = 0;
    this.items.forEach((item) => {
      if (item.type == "money") {
        total += item.system.quantity;
      }
    });
    let nbStone = Math.floor(total / 1000);
    let nbItems = Math.ceil((total - nbStone * 1000) / 166);
    return { stone: nbStone, item: nbItems };
  }

  /* -------------------------------------------- */
  updateWeight() {
    let toUpdate = [];
    for (let i of this.items) {
      if (i.system?.weight != undefined && i.system?.weight6 == -1) {
        let nbStones6 = Math.floor(i.system.weight / 166.66);
        toUpdate.push({ _id: i.id, "system.weight6": nbStones6, "system.weight": -1 });
      }
    }
    if (toUpdate.length > 0) {
      this.updateEmbeddedDocuments("Item", toUpdate);
    }
  }

  /* -------------------------------------------- */
  async updateImplements() {
    // Skip for travel-party and location actors
    if (this.type === "travel-party" || this.type === "location") {
      return;
    }
    if (this.system.saves.implements?.value == -1) {
      this.update({ "system.saves.implements.value": this.system.saves.wand.value });
    }
  }

  /* -------------------------------------------- */
  async updateLanguages() {
    if (this.type != "character") {
      return;
    }
    // Load compendium languages
    let languages = await AcksUtility.loadCompendium("acks.acks-languages");
    let langList = languages.map((i) => i.toObject());

    let toPush = [];
    if (this.system?.languages?.value) {
      for (let langName of this.system.languages.value) {
        // Do we have existing language?
        if (this.items.find((i) => i.name.toLowerCase() == langName.toLowerCase() && i.type == "language")) {
          continue;
        }
        let lang = langList.find((i) => i.name.toLowerCase() == langName.toLowerCase());
        if (lang) {
          toPush.push(lang);
        } else {
          // Create a new dynamic language item
          toPush.push({
            name: langName,
            type: "language",
            system: {
              description: ""
            },
          });
        }
      }
      if (toPush.length > 0) {
        this.createEmbeddedDocuments("Item", toPush);
      }
    }
  }

  /* -------------------------------------------- */
  isNew() {
    const data = this.system;
    return data.isNew;

    /*if (this.type == "character") {
      let ct = 0;
      Object.values(data.scores).forEach((el) => {
        ct += el.value;
      });
      return (ct == 0);
    } else if (this.type == "monster") {
      let ct = 0;
      Object.values(data.saves).forEach((el) => {
        ct += el.value;
      });
      return (ct == 0);
    }*/
  }

  /* -------------------------------------------- */
  async generateHenchmanScores() {
    if (this.type !== "character") {
      return;
    }
    const scores = this.system?.scores;
    if (!scores) {
      return;
    }

    if (!this.system.isNew) {
      return;
    }

    const abilityKeys = Object.keys(scores);
    const updates = {
      "system.details.characterType": "henchman",
      "system.retainer.enabled": true,
      "system.details.creation.order": abilityKeys,
    };

    for (const ability of abilityKeys) {
      const roll = await new Roll("3d6").evaluate({ async: true });
      updates[`system.scores.${ability}.value`] = roll.total;
    }

    await this.update(updates);
  }

  /* -------------------------------------------- */
  async generateSave(hd) {
    let saves = {};
    for (let i = 0; i <= hd; i++) {
      let tmp = CONFIG.ACKS.monster_saves[i];
      if (tmp) {
        saves = tmp;
      }
    }

    await this.update({
      "system.saves": {
        death: {
          value: saves.d,
        },
        wand: {
          value: saves.w,
        },
        implements: {
          value: saves.w,
        },
        paralysis: {
          value: saves.p,
        },
        breath: {
          value: saves.b,
        },
        spell: {
          value: saves.s,
        },
      },
    });
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  async rollHP(options = {}) {
    let roll = new Roll(this.system.hp.hd);
    await roll.evaluate();
    await this.update({
      system: {
        hp: {
          max: roll.total,
          value: roll.total,
        },
      },
    });
  }

  /* -------------------------------------------- */
  rollAdventuring(advKey, options = {}) {
    const label = game.i18n.localize(`ACKS.adventuring.${advKey}`);
    //console.log("ROLLADV", advKey);
    const rollParts = ["1d20"];

    const data = {
      actor: this,
      roll: {
        type: "above",
        target: this.system.adventuring[advKey],
      },
      details: game.i18n.format("ACKS.roll.details.adventuring", {
        adventuring: label,
      }),
    };

    let skip = false;
    let skipKey = game.settings.get(SYSTEM_ID, "skip-dialog-key");
    if (options.event && options.event[skipKey]) {
      skip = true;
    }

    // Roll and return
    return AcksDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("ACKS.roll.adventuring", { adventuring: label }),
      title: game.i18n.format("ACKS.roll.adventuring", { adventuring: label }),
    });
  }

  /* -------------------------------------------- */
  rollSave(save, options = {}) {
    const label = game.i18n.localize(`ACKS.saves.${save}.long`);
    const rollParts = ["1d20"];
    if (this.type == "character") {
      rollParts.push(this.system.save.mod);
    }

    let data = {
      actor: this,
      roll: {
        type: "above",
        target: this.system.saves[save].value,
        magic: this.type == "character" ? this.system.scores.wis.mod : undefined,
      },
      details: game.i18n.format("ACKS.roll.details.save", { save: label }),
    };

    let skip = false;
    let skipKey = game.settings.get(SYSTEM_ID, "skip-dialog-key");
    if (options.event && options.event[skipKey]) {
      skip = true;
    }

    const rollMethod = this.type == "character" ? AcksDice.RollSave : AcksDice.Roll;

    // Roll and return
    return rollMethod({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("ACKS.roll.save", { save: label }),
      title: game.i18n.format("ACKS.roll.save", { save: label }),
    });
  }

  /* -------------------------------------------- */
  rollMorale(options = {}) {
    const rollParts = ["2d6"];
    rollParts.push(this.system.details.morale);

    const data = {
      actor: this,
      roll: {},
    };

    let skip = false;
    let skipKey = game.settings.get(SYSTEM_ID, "skip-dialog-key");
    if (options.event && options.event[skipKey]) {
      skip = true;
    }

    // Roll and return
    return AcksDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("ACKS.roll.morale"),
      title: game.i18n.localize("ACKS.roll.morale"),
    });
  }

  /* -------------------------------------------- */
  rollLoyalty(options = {}) {
    const rollParts = ["2d6"];
    rollParts.push(this.system.retainer.loyalty);

    const data = {
      actor: this,
      roll: {
        type: "table",
        table: {
          1: game.i18n.format("ACKS.loyalty.hostility", {
            name: this.name,
          }),
          3: game.i18n.format("ACKS.loyalty.resignation", {
            name: this.name,
          }),
          6: game.i18n.format("ACKS.loyalty.grudging", {
            name: this.name,
          }),
          9: game.i18n.format("ACKS.loyalty.loyal", {
            name: this.name,
          }),
          12: game.i18n.format("ACKS.loyalty.fanatic", {
            name: this.name,
          }),
        },
      },
    };

    let skip = false;
    let skipKey = game.settings.get(SYSTEM_ID, "skip-dialog-key");
    if (options.event && options.event[skipKey]) {
      skip = true;
    }

    // Roll and return
    return AcksDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("ACKS.loyalty.check"),
      title: game.i18n.localize("ACKS.loyalty.check"),
    });
  }

  /* -------------------------------------------- */
  rollReaction(options = {}) {
    const rollParts = ["2d6"];

    const data = {
      actor: this,
      roll: {
        type: "table",
        table: {
          2: game.i18n.format("ACKS.reaction.Hostile", {
            name: this.name,
          }),
          3: game.i18n.format("ACKS.reaction.Unfriendly", {
            name: this.name,
          }),
          6: game.i18n.format("ACKS.reaction.Neutral", {
            name: this.name,
          }),
          9: game.i18n.format("ACKS.reaction.Indifferent", {
            name: this.name,
          }),
          12: game.i18n.format("ACKS.reaction.Friendly", {
            name: this.name,
          }),
        },
      },
    };

    let skip = false;
    let skipKey = game.settings.get(SYSTEM_ID, "skip-dialog-key");
    if (options.event && options.event[skipKey]) {
      skip = true;
    }

    // Roll and return
    return AcksDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("ACKS.reaction.check"),
      title: game.i18n.localize("ACKS.reaction.check"),
    });
  }

  /* -------------------------------------------- */
  hasEffect(effectId) {
    return this.effects.find((e) => e.statuses.has(effectId));
  }

  /* -------------------------------------------- */
  rollCheck(score, options = {}) {
    const label = game.i18n.localize(`ACKS.scores.${score}.long`);
    const rollParts = ["1d20"];

    const data = {
      actor: this,
      roll: {
        type: "check",
        target: this.system.scores[score].value,
      },

      details: game.i18n.format("ACKS.roll.details.attribute", {
        score: label,
      }),
    };

    let skip = false;
    let skipKey = game.settings.get(SYSTEM_ID, "skip-dialog-key");
    if (options.event && options.event[skipKey]) {
      skip = true;
    }

    // Roll and return
    return AcksDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("ACKS.roll.attribute", { attribute: label }),
      title: game.i18n.format("ACKS.roll.attribute", { attribute: label }),
    });
  }

  /* -------------------------------------------- */
  rollHitDice(options = {}) {
    const label = game.i18n.localize(`ACKS.roll.hd`);
    const rollParts = [this.system.hp.hd];
    if (this.type == "character") {
      rollParts.push(this.system.scores.con.mod * this.system.details.level);
    }

    const data = {
      actor: this,
      roll: {
        type: "hitdice",
      },
    };

    // Roll and return
    return AcksDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: false,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  /* -------------------------------------------- */
  rollBHR(options = {}) {
    const label = game.i18n.localize(`ACKS.roll.bhr`);
    const rollParts = [this.system.hp.bhr];
    if (this.type == "character") {
      rollParts.push();
    }

    const data = {
      actor: this,
      roll: {
        type: "Healing",
      },
    };

    // Roll and return
    return AcksDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  /* -------------------------------------------- */
  rollAppearing(options = {}) {
    const rollParts = [];
    let label = "";
    if (options.check == "wilderness") {
      rollParts.push(this.system.details.appearing.w);
      label = "(2)";
    } else {
      rollParts.push(this.system.details.appearing.d);
      label = "(1)";
    }
    const data = {
      actor: this,
      roll: {
        type: {
          type: "appearing",
        },
      },
    };

    // Roll and return
    return AcksDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("ACKS.roll.appearing", { type: label }),
      title: game.i18n.format("ACKS.roll.appearing", { type: label }),
    });
  }

  /* -------------------------------------------- */
  rollExploration(expl, options = {}) {
    const label = game.i18n.localize(`ACKS.exploration.${expl}.long`);
    const rollParts = ["1d20"];

    const data = {
      actor: this,
      roll: {
        type: "above",
        target: this.system.exploration[expl],
      },
      details: game.i18n.format("ACKS.roll.details.exploration", {
        expl: label,
      }),
    };

    let skip = false;
    let skipKey = game.settings.get(SYSTEM_ID, "skip-dialog-key");
    if (options.event && options.event[skipKey]) {
      skip = true;
    }

    // Roll and return
    return AcksDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("ACKS.roll.exploration", { exploration: label }),
      title: game.i18n.format("ACKS.roll.exploration", { exploration: label }),
    });
  }

  /* -------------------------------------------- */
  rollDamage(attData, options = {}) {
    const data = this.system;

    const rollData = {
      actor: this,
      item: attData.item,
      roll: {
        type: "damage",
      },
    };

    let dmgParts = [];
    if (!attData.roll.dmg) {
      dmgParts.push("1d6");
    } else {
      dmgParts.push(attData.roll.dmg);
    }

    // Add Str to damage
    if (attData.roll.type == "melee") {
      dmgParts.push(data.scores.str.mod);
    }

    // Add Melee mod to damage
    if (attData.roll.type == "melee") {
      dmgParts.push(data.damage.mod.melee);
    }

    // Add Missile mod to damage
    if (attData.roll.type == "missile") {
      dmgParts.push(data.damage.mod.missile);
    }

    // Damage roll
    AcksDice.Roll({
      event: options.event,
      parts: dmgParts,
      data: rollData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${attData.label} - ${game.i18n.localize("ACKS.Damage")}`,
      title: `${attData.label} - ${game.i18n.localize("ACKS.Damage")}`,
    });
  }

  async targetAttack(data, type, options) {
    if (game.user.targets.size > 0) {
      for (let t of game.user.targets.values()) {
        data.roll.target = t;
        await this.rollAttack(data, {
          type: type,
          skipDialog: options.skipDialog,
        });
      }
    } else {
      this.rollAttack(data, { type: type, skipDialog: options.skipDialog });
    }
  }

  /* -------------------------------------------- */
  rollAttack(attData, options = {}) {
    const data = this.system;
    let rollParts = ["1d20"];

    if (game.settings.get(SYSTEM_ID, "exploding20s")) {
      rollParts = ["1d20x="];
    }

    const dmgParts = [];
    let label = game.i18n.format("ACKS.roll.attacks", {
      name: this.name,
    });
    if (!attData.item) {
      dmgParts.push("1d6");
    } else {
      label = game.i18n.format("ACKS.roll.attacksWith", {
        name: attData.item.name,
      });
      dmgParts.push(attData.item.system.damage);
    }

    rollParts.push(data.thac0.bba.toString());
    if (options.type == "missile") {
      rollParts.push(data.scores.dex.mod.toString(), data.thac0.mod.missile.toString());
    } else if (options.type == "melee") {
      rollParts.push(data.scores.str.mod.toString(), data.thac0.mod.melee.toString());
    }
    if (attData?.item?.system.bonus) {
      rollParts.push(attData.item.system.bonus);
    }
    let thac0 = data.thac0.value;
    if (options.type == "melee") {
      dmgParts.push(data.scores.str.mod);
    }
    // Add Melee mod to damage
    if (options.type == "melee") {
      dmgParts.push(data.damage.mod.melee);
    }
    // Add Missile mod to damage
    if (options.type == "missile") {
      dmgParts.push(data.damage.mod.missile);
    }
    const rollData = {
      actor: this,
      item: attData.item,
      roll: {
        type: options.type,
        thac0: thac0,
        dmg: dmgParts,
        save: attData.roll.save,
        target: attData.roll.target,
      },
    };

    let skipKey = game.settings.get(SYSTEM_ID, "skip-dialog-key");
    if (options.event && options.event[skipKey]) {
      options.skipDialog = true;
    }

    // Roll and return
    return AcksDice.Roll({
      event: options.event,
      parts: rollParts,
      data: rollData,
      skipDialog: options.skipDialog,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  /* -------------------------------------------- */
  async applyDamage(amount = 0, multiplier = 1) {
    amount = Math.ceil(parseInt(amount) * multiplier);
    const hp = this.system.hp;

    // Remaining goes to health
    const dh = Math.clamp(hp.value - amount, -99, hp.max);

    // Update the Actor
    await this.update({
      "system.hp.value": dh,
    });
  }

  /* -------------------------------------------- */
  static _valueFromTable(table, val) {
    let output = undefined;
    for (let i = 0; i <= val; i++) {
      if (table[i] != undefined) {
        output = table[i];
      }
    }
    if (output == undefined) {
      // Take the first key/value of the table object, whatever it is
      for (let key in table) {
        output = table[key];
        break;
      }
    }
    return output;
  }

  /* -------------------------------------------- */
  _isSlow() {
    this.system.isSlow = false;
    if (this.type != "character") {
      return;
    }
    this.items.forEach((item) => {
      if (item.type == "weapon" && item.system.slow && item.system.equipped) {
        this.system.isSlow = true;
      }
    });
  }

  /* -------------------------------------------- */
  computeEncumbrance() {
    if (this.type !== "character") {
      return;
    }

    let totalEncumbrance = 0;

    this.items.forEach((item) => {
      if (item.type === "item" && item.system.subtype != "clothing") {
        totalEncumbrance += item.system.weight6 * item.system.quantity.value;
      } else if (["weapon", "armor"].includes(item.type)) {
        totalEncumbrance += item.system.weight6;
      }
    });
    totalEncumbrance /= 6; // Get the weight in stones
    totalEncumbrance += this.getTotalMoneyEncumbrance().stone;

    // Select the max encumbrance value
    let maxEncumbrance =
      this.system.encumbrance.forcemax > 0 ? this.system.encumbrance.forcemax : 20 + this.system.scores.str.mod;
    if (this.system.encumbrance.max != maxEncumbrance && this._id) {
      this.update({ "system.encumbrance.max": maxEncumbrance });
    }

    this.system.encumbrance = {
      pct: Math.clamp((totalEncumbrance / maxEncumbrance) * 100, 0, 100),
      max: maxEncumbrance,
      encumbered: totalEncumbrance > maxEncumbrance,
      value: Math.round(totalEncumbrance),
    };

    if (this.system.config.movementAuto) {
      this._calculateMovement();
    }
  }

  /* -------------------------------------------- */
  _calculateMovement() {
    let baseSpeed;
    if (this.system.encumbrance.value > this.system.encumbrance.max) {
      baseSpeed = CONFIG.ACKS.base_speed.overburdened; // 0
    } else if (this.system.encumbrance.value > 10) {
      baseSpeed = CONFIG.ACKS.base_speed.high_encumbrance; // 30
    } else if (this.system.encumbrance.value > 7) {
      baseSpeed = CONFIG.ACKS.base_speed.mid_encumbrance; // 60
    } else if (this.system.encumbrance.value > 5) {
      baseSpeed = CONFIG.ACKS.base_speed.low_encumbrance; // 90
    } else {
      baseSpeed = CONFIG.ACKS.base_speed.unencumbered; // 120
    }

    // apply movement mod but make sure speed can't be less than 0
    baseSpeed = Math.max(baseSpeed + this.system.movement.mod, 0);

    // Formulas from ACKS Revised Rulebook page 17
    this.system.movementacks.exploration = baseSpeed;
    this.system.movementacks.combat = Math.floor((baseSpeed / 3) * 10) / 10;
    this.system.movementacks.chargerun = baseSpeed;
    this.system.movementacks.expedition = Math.floor((baseSpeed / 5) * 10) / 10;
    this.system.movement.base = baseSpeed;
  }

  /* -------------- ------------------------------ */
  getFavorites() {
    return this.items.filter((i) => i.system.favorite);
  }
  buildFavoriteActions() {
    let fav = this.getFavorites();
    return fav;
  }
  /*-------------------------------------------- */
  buildRollList() {
    let rolls = [];
    for (let key in this.system.scores) {
      let attr = this.system.scores[key];
      rolls.push({
        key: key,
        value: attr.value,
        name: game.i18n.localize("ACKS.scores." + key + ".short"),
        type: "score",
      });
    }
    return rolls;
  }

  /**
   * Validate equipment slots and return warnings
   * @returns {Array} Array of validation warnings
   */
  validateEquipmentSlots() {
    if (this.type !== "character") {
      return [];
    }

    const warnings = [];
    const slotCounts = {};
    const equippedItems = this.items.filter((i) =>
      (i.type === "armor" || i.type === "item" || i.type === "weapon") && i.system.equipped
    );

    // Count items in each slot
    equippedItems.forEach((item) => {
      let slot = null;

      if (item.type === "armor") {
        slot = item.system.slot || "torso";
      } else if (item.type === "item") {
        slot = item.system.slot || "none";
      } else if (item.type === "weapon") {
        slot = item.system.hand || "mainHand";
      }

      if (slot && slot !== "none") {
        slotCounts[slot] = (slotCounts[slot] || 0) + 1;
      }
    });

    // Check slot limits
    const limits = CONFIG.ACKS?.slotLimits || {};
    for (const [slot, count] of Object.entries(slotCounts)) {
      const limit = limits[slot];
      if (limit && count > limit) {
        warnings.push({
          type: "slot_overflow",
          slot: slot,
          count: count,
          limit: limit,
          message: `Too many items in ${slot} slot: ${count}/${limit}`
        });
      }
    }

    return warnings;
  }

  computeAC() {
    if (this.type != "character") {
      return;
    }

    const data = this.system;
    const armors = this.items.filter((i) => i.type === "armor" && i.system.equipped);
    const items = this.items.filter((i) => i.type === "item" && i.system.equipped);

    // Base AAC (naked)
    let baseAac = 0;
    let shieldAac = 0;
    let itemAcBonus = 0;

    // Track best AC from torso and bracers slots (they don't stack)
    let torsoAac = 0;
    let bracersAac = 0;

    // Process armor items
    armors.forEach((armor) => {
      const slot = armor.system.slot || "torso";
      const type = armor.system.type;
      const aac = armor.system.aac?.value || 0;

      if (type === "shield") {
        // Shield AC (only one should be equipped per slot rules)
        shieldAac = Math.max(shieldAac, aac);
      } else if (slot === "torso") {
        // Torso armor (only use highest AAC if multiple somehow equipped)
        torsoAac = Math.max(torsoAac, aac);
      } else if (slot === "bracers") {
        // Bracers slot items (don't stack with torso armor per ACKS II rules)
        bracersAac = Math.max(bracersAac, aac);
      } else {
        // Other armor pieces (head, boots, gloves, etc.) add to AC
        itemAcBonus += aac;
      }
    });

    // Process magic items with AC bonuses (rings of protection, etc.)
    const equippedRings = items.filter((i) => i.system.slot === "ring");
    const ringAcBonus = equippedRings.reduce((sum, ring) => {
      // Check for non-stacking items
      if (ring.system.noStackWith) {
        const conflicts = items.filter((other) =>
          other.id !== ring.id &&
          other.name.toLowerCase().includes(ring.system.noStackWith.toLowerCase())
        );
        if (conflicts.length > 0) {
          return sum; // Don't add this ring's bonus
        }
      }
      return sum + (ring.system.acBonus || 0);
    }, 0);

    // Other equipped items (neck, belt, cloak, etc.)
    const otherItemAcBonus = items
      .filter((i) => i.system.slot !== "ring" && i.system.slot !== "none")
      .reduce((sum, item) => sum + (item.system.acBonus || 0), 0);

    // Torso armor and bracers don't stack - use whichever provides better AC
    // This handles the ACKS II rule where bracers-of-armor type items don't stack with worn armor
    baseAac = Math.max(torsoAac, bracersAac);

    // Calculate final AC
    data.aac.naked = data.scores.dex.mod;
    data.aac.value = baseAac + data.scores.dex.mod + shieldAac + itemAcBonus + ringAcBonus + otherItemAcBonus + data.aac.mod;
    data.aac.shield = shieldAac;
    data.aac.base = baseAac;
    data.aac.items = itemAcBonus + ringAcBonus + otherItemAcBonus;

    // Store validation warnings
    data.equipment = data.equipment || {};
    data.equipment.warnings = this.validateEquipmentSlots();
  }

  /* -------------------------------------------- */
  computeModifiers() {
    if (this.type != "character") {
      return;
    }
    const data = this.system;

    const standard = {
      0: -3,
      3: -3,
      4: -2,
      6: -1,
      9: 0,
      13: 1,
      16: 2,
      18: 3,
      19: 4,
      20: 5,
      21: 6,
      22: 7,
      23: 8,
      24: 9,
      25: 10,
    };
    data.scores.str.mod = AcksActor._valueFromTable(standard, data.scores.str.value);
    data.scores.int.mod = AcksActor._valueFromTable(standard, data.scores.int.value);
    data.scores.dex.mod = AcksActor._valueFromTable(standard, data.scores.dex.value);
    data.scores.cha.mod = AcksActor._valueFromTable(standard, data.scores.cha.value);
    data.scores.wis.mod = AcksActor._valueFromTable(standard, data.scores.wis.value);
    data.scores.con.mod = AcksActor._valueFromTable(standard, data.scores.con.value);

    const capped = {
      0: -2,
      3: -2,
      4: -1,
      6: -1,
      9: 0,
      13: 1,
      16: 1,
      18: 2,
    };
    data.scores.dex.init = AcksActor._valueFromTable(standard, data.scores.dex.value);
    data.scores.cha.npc = AcksActor._valueFromTable(standard, data.scores.cha.value);
    data.scores.cha.retain = data.scores.cha.mod + 4;
    data.scores.cha.loyalty = data.scores.cha.mod;

    const od = {
      0: 0,
      3: 30,
      4: 26,
      6: 22,
      9: 18,
      13: 14,
      16: 10,
      18: 6,
      19: 2,
    };
    data.exploration.odMod = AcksActor._valueFromTable(od, data.scores.str.value);

    const literacy = {
      3: "ACKS.Illiterate",
      9: "ACKS.Literate",
    };
    /*data.languages.literacy = AcksActor._valueFromTable(
      literacy,
      data.scores.int.value
    );*/

    /*const spoken = {
      0: "ACKS.NativeBroken",
      3: "ACKS.Native",
      13: "ACKS.NativePlus1",
      16: "ACKS.NativePlus2",
      18: "ACKS.NativePlus3",
      19: "ACKS.NativePlus4",
      20: "ACKS.NativePlus5",
      21: "ACKS.NativePlus6",
      22: "ACKS.NativePlus7",
      23: "ACKS.NativePlus8",
      24: "ACKS.NativePlus9",
      25: "ACKS.NativePlus10",
    };
    data.languages.spoken = AcksActor._valueFromTable(
      spoken,
      data.scores.int.value
    );*/
  }

  /* -------------------------------------------- */
  computeBHR() {
    if (this.type != "character") {
      return;
    }
    const data = this.system;

    const bhrcalc = {
      0: "1d2",
      4: "1d3",
      10: "1d4",
      17: "1d6",
      24: "1d8",
      30: "1d10",
      37: "2d6",
      50: "2d8",
      64: "2d10",
      77: "2d12",
      90: "3d10",
      111: "4d10",
      141: "5d10",
      171: "6d10",
    };

    let newBHR = "1d3";
    let value = data.hp.max;
    if (value > 171) {
      let diceNumber = Math.floor((value - 171) / 30) + 6;
      newBHR = diceNumber + "d10";
    } else {
      newBHR = AcksActor._valueFromTable(bhrcalc, Number(data.hp.max));
    }
    if (!newBHR) {
      newBHR = "1d2";
    }
    if (newBHR != data.hp.bhr) {
      data.hp.bhr = newBHR;
      this.update({ "system.hp.bhr": newBHR });
      this.update({ "system.fight.healingrate": newBHR });
    }
  }

  /* -------------------------------------------- */
  computeAAB() {
    const data = this.system;

    data.thac0.bba = 10 - data.thac0.throw;
  }

  applyClassAutomation() {
    const data = this.system;
    const details = data?.details;
    if (!details?.classLock) {
      if (data.hp?.auto?.active) {
        data.hp.auto.active = false;
      }
      return;
    }

    const classKey = details.classKey;
    if (!classKey) {
      if (data.hp?.auto?.active) {
        data.hp.auto.active = false;
      }
      return;
    }

    const classDefinitions = CONFIG.ACKS?.classes ?? {};
    const classDef = classDefinitions[classKey];
    if (!classDef || !Array.isArray(classDef.levels) || classDef.levels.length === 0) {
      return;
    }

    const currentXp = Number(details.xp?.value ?? 0) || 0;
    let activeLevel = classDef.levels[0];
    let nextLevel = null;

    for (const level of classDef.levels) {
      const levelXp = Number(level.xp ?? 0);
      if (currentXp >= levelXp) {
        activeLevel = level;
        continue;
      }
      nextLevel = level;
      break;
    }

    if (!activeLevel) {
      return;
    }

    // Update descriptive fields
    if (classDef.name) {
      details.class = classDef.name;
    }
    if (activeLevel.title) {
      details.title = activeLevel.title;
    }

    let levelValue = activeLevel.level !== undefined && activeLevel.level !== null ? activeLevel.level : details.level;
    const levelNumber = levelValue !== undefined && levelValue !== null ? Number(levelValue) : NaN;
    if (!Number.isNaN(levelNumber)) {
      details.level = levelNumber;
    }

    if (nextLevel) {
      const threshold = Number(nextLevel.xp ?? details.xp?.next);
      if (!Number.isNaN(threshold)) {
        details.xp.next = threshold;
      }
    } else {
      const fallback = Math.max(currentXp, Number(activeLevel.xp ?? currentXp));
      if (!Number.isNaN(fallback)) {
        details.xp.next = fallback;
      }
    }

    const hitDice = activeLevel.hit_dice ?? classDef.hit_die;
    if (hitDice) {
      data.hp.hd = hitDice;
    }

    const damageBonus = Number(activeLevel.damage_bonus);
    if (!Number.isNaN(damageBonus)) {
      data.damage.mod.melee = damageBonus;
      data.damage.mod.missile = damageBonus;
    }

    const cleaves = Number(activeLevel.cleaves);
    if (!Number.isNaN(cleaves)) {
      data.fight.cleaves = cleaves;
    }

    const attackThrow = parseTargetValue(activeLevel.attack_throw);
    if (attackThrow !== null) {
      data.thac0.throw = attackThrow;
    }

    const saveMap = {
      paralysis: "paralysis",
      death: "death",
      implements: "implements",
      spells: "spell",
      wand: "wand",
      breath: "breath",
    };

    for (const [sourceKey, targetKey] of Object.entries(saveMap)) {
      const saveValue = activeLevel[sourceKey];
      if (saveValue === undefined) continue;
      const parsed = parseTargetValue(saveValue);
      if (parsed === null) continue;
      const save = data.saves?.[targetKey];
      if (save?.value !== undefined) {
        save.value = parsed;
      }
    }

    const targetLevel = Number(details.level) || 1;
    // Ensure modifiers are calculated so CON modifier is applied to auto HP
    this.computeModifiers();
    const ensure = this._ensureClassHitPoints(classDef, targetLevel);
    if (ensure instanceof Promise) {
      ensure.catch((error) =>
        console.error("ACKS | Failed to ensure class-based hit points", error, { actor: this.id }),
      );
    }
  }

  async _ensureClassHitPoints(classDef, targetLevel) {
    if (!classDef || !targetLevel || targetLevel < 1) {
      return;
    }

    const details = this.system.details ?? {};
    const classKey = details.classKey;
    const hpData = this.system.hp ?? {};
    const autoData = hpData.auto ?? {};
    const levelInfo =
      classDef.levelIndex?.[targetLevel] ?? classDef.levels?.find((lv) => Number(lv.level) === targetLevel);
    const expression = levelInfo?.hit_dice ?? classDef.hit_die ?? "";

    const needsReroll =
      !autoData?.active ||
      autoData.classKey !== classKey ||
      autoData.level !== targetLevel ||
      autoData.expression !== expression;

    let baseHp = Number(autoData?.baseHp);
    let history = Array.isArray(autoData?.history) ? autoData.history : [];

    if (needsReroll || !Number.isFinite(baseHp)) {
      const rollResult = this._rollClassHitPointProgression(classDef, targetLevel);
      if (!rollResult) return;
      baseHp = rollResult.total;
      history = rollResult.history;

      if (history.length) {
        const classLabel = classDef?.name ?? details.class ?? "Class";
        const lines = history.map((entry) => {
          const segments = [`Level ${entry.level} (${entry.expression})`];
          if (entry.dice?.length) {
            const diceSegments = entry.dice.map((die) => {
              let fragment = "";
              if (die.raw === null || die.raw === undefined) {
                fragment = "?";
              } else {
                fragment = `${die.raw}`;
              }
              if (die.minOverride) {
                fragment += "->4";
              }
              fragment += `=${die.adjusted}`;
              return fragment;
            });
            segments.push(`Dice [${diceSegments.join(", ")}]`);
          } else {
            segments.push("Dice [none]");
          }
          if (entry.flatBonus) {
            const starSuffix = entry.flatBonusStar ? "*" : "";
            const sign = entry.flatBonus > 0 ? "+" : "";
            segments.push(`Flat ${sign}${entry.flatBonus}${starSuffix}`);
          }
          segments.push(`Subtotal ${entry.subtotal}`);
          if (entry.catchupApplied) {
            segments.push(`Catch-up -> ${entry.catchupMinimum} (prev ${entry.previousTotal})`);
          }
          segments.push(`Running total ${entry.total}`);
          return segments.join(" | ");
        });
        console.info(
          `ACKS | HP roll for ${this.name} (${classLabel}, level ${targetLevel})\n${lines.join(
            "\n",
          )}\nResulting base HP: ${baseHp}`,
        );
      }
    }

    if (!Number.isFinite(baseHp)) {
      baseHp = 0;
    }

    const conMod = Number(this.getConModifier());
    const conLevels = Math.min(targetLevel, 9); // CON bonus capped at level 9
    const conBonus = Number.isFinite(conMod) ? conMod * conLevels : 0;
    const newMax = Math.max(0, baseHp + conBonus);

    const currentMax = Number.isFinite(hpData.max) ? Number(hpData.max) : newMax;
    const currentValue = Number.isFinite(hpData.value) ? Number(hpData.value) : currentMax;
    const damage = Math.max(0, currentMax - currentValue);
    let newValue = Math.max(0, Math.round(newMax - damage));
    if (!Number.isFinite(newValue)) {
      newValue = newMax;
    }
    newValue = Math.max(0, Math.min(newMax, newValue));

    const currentBase = Number(this.system.hp?.base ?? this.system.hp?.baseMax ?? autoData?.baseHp);
    const currentConBonus = Number(this.system.hp?.conBonus ?? autoData?.conBonus);
    if (
      !needsReroll &&
      Number(hpData.max) === newMax &&
      Number(hpData.value) === newValue &&
      Number.isFinite(currentBase) &&
      currentBase === baseHp &&
      Number.isFinite(currentConBonus) &&
      currentConBonus === conBonus
    ) {
      return;
    }

    const updateData = {
      "system.hp.max": newMax,
      "system.hp.value": newValue,
      "system.hp.base": baseHp,
      "system.hp.conBonus": conBonus,
      "system.hp.auto": {
        active: true,
        classKey,
        level: targetLevel,
        expression,
        baseHp,
        history,
        timestamp: Date.now(),
      },
    };

    await this.update(updateData, { skipClassHpAuto: true });
  }

  _rollClassHitPointProgression(classDef, targetLevel) {
    const history = [];
    let runningTotal = 0;

    for (let level = 1; level <= targetLevel; level++) {
      const levelInfo = 
        classDef.levelIndex?.[level] ?? classDef.levels?.find((lv) => Number(lv.level) === level);
      if (!levelInfo?.hit_dice) break;

      const hd = AcksActor._parseHitDiceExpression(levelInfo.hit_dice ?? classDef.hit_die);
      if (!hd) continue;

      const diceCount = Number(hd.diceCount ?? 0); 
      const dieFaces = Number(hd.dieFaces ?? 0);
      const flatBonus = Number(hd.flatBonus ?? 0);
      const diceLog = [];

      const uniform = 
        typeof CONFIG.Dice?.randomUniform === "function" ? CONFIG.Dice.randomUniform : Math.random;
      let subtotal = 0;

      // Roll hit dice
      for (let i = 0; i < diceCount; i++) {
        const raw = Math.floor(uniform() * Math.max(dieFaces, 1)) + 1;
        let adjusted = raw;
        let minOverride = false;
        
        // First level minimum of 4 hp
        if (level === 1 && diceCount === 1 && adjusted < 4) {
          adjusted = 4;
          minOverride = true;
        }
        
        diceLog.push({ raw, adjusted, minOverride });
        subtotal += adjusted;
      }

      if (diceCount === 0) {
        diceLog.push({ raw: null, adjusted: 0, minOverride: false });
      }

      const subtotalWithFlat = subtotal + flatBonus;
      let finalLevelTotal = subtotalWithFlat;
      const previousTotal = runningTotal;
      let catchupApplied = false;

      // Minimum 1 HP per level after 1st
      if (level > 1 && finalLevelTotal <= previousTotal) {
        finalLevelTotal = previousTotal + 1;
        catchupApplied = true;
      }

      runningTotal = finalLevelTotal;

      history.push({
        level,
        expression: levelInfo.hit_dice ?? classDef.hit_die,
        dice: diceLog,
        flatBonus,
        flatBonusStar: Boolean(hd.star),
        subtotal: subtotalWithFlat,
        previousTotal,
        catchupApplied,
        catchupMinimum: catchupApplied ? runningTotal : null, 
        total: runningTotal
      });
    }

    return { total: runningTotal, history };
  }

  static _parseHitDiceExpression(expression) {
    if (!expression) return null;
    const match = String(expression)
      .trim()
      .match(/^(\d+)\s*[dD]\s*(\d+)(?:\s*\+\s*(\d+)\s*(\*)?)?\s*$/);
    if (!match) return null;
    return {
      diceCount: Number(match[1]),
      dieFaces: Number(match[2]),
      flatBonus: match[3] ? Number(match[3]) : 0,
      star: Boolean(match[4]),
    };
  }
}
