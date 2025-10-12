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
    const data = this.system;

    data.fight = data.fight ?? {};
    data.fight.combat = data.fight.combat ?? { tier: "restricted", categories: [], weapons: [], styles: [] };
    data.fight.combat.tier = data.fight.combat.tier ?? "restricted";
    data.fight.combat.categories = Array.isArray(data.fight.combat.categories)
      ? data.fight.combat.categories
      : [];
    data.fight.combat.weapons = Array.isArray(data.fight.combat.weapons) ? data.fight.combat.weapons : [];
    data.fight.combat.styles = Array.isArray(data.fight.combat.styles) ? data.fight.combat.styles : [];

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
    const equippedWeapons = this.items.filter((i) => i.type === "weapon" && i.system.equipped);
    const favoriteNonWeapons = this.items.filter(
      (i) => i.system.favorite && !(i.type === "weapon" && i.system.equipped),
    );
    return [...equippedWeapons, ...favoriteNonWeapons];
  }
  buildFavoriteActions() {
    return this.getFavorites();
  }

  getCombatTraining() {
    this.system.fight = this.system.fight ?? {};
    let combat = foundry.utils.duplicate(this.system.fight.combat ?? {});

    combat.tier = combat.tier ?? "restricted";
    combat.categories = Array.isArray(combat.categories) ? Array.from(new Set(combat.categories)) : [];
    combat.weapons = Array.isArray(combat.weapons) ? Array.from(new Set(combat.weapons)) : [];
    combat.styles = Array.isArray(combat.styles) ? Array.from(new Set(combat.styles)) : [];

    const combatConfig = CONFIG.ACKS.combatTraining ?? {};
    const allowedRestricted = new Set((combatConfig.restrictedWeapons ?? []).map((opt) => opt.id));
    const allowedWeaponOptions = new Set((combatConfig.weaponOptions ?? []).map((opt) => opt.id));
    const allowedStyles = new Set((combatConfig.styles ?? []).map((opt) => opt.id));

    const legacyStyles = this.system?.fight?.weaponstyles;
    if (combat.styles.length === 0 && typeof legacyStyles === "string" && legacyStyles.trim().length) {
      const styleSet = new Set(combat.styles);
      for (const entry of splitListEntries(legacyStyles)) {
        const key = resolveStyleKey(entry);
        if (key && allowedStyles.has(key)) {
          styleSet.add(key);
        }
      }
      combat.styles = Array.from(styleSet);
    }

    const legacyWeapons = this.system?.fight?.weaponproficiencies;
    if (combat.weapons.length === 0 && typeof legacyWeapons === "string" && legacyWeapons.trim().length) {
      const converted = new Set(combat.weapons);
      const allAllowed = new Set([...allowedRestricted, ...allowedWeaponOptions]);
      for (const entry of splitListEntries(legacyWeapons)) {
        const slug = slugify(entry);
        const id = WEAPON_SLUG_ALIASES[slug] ?? slug;
        if (allAllowed.has(id)) {
          converted.add(id);
        }
      }
      combat.weapons = Array.from(converted);
    }

    this._normalizeCombatConfig(combat, { enforceLimits: true });

    this.system.fight.combat = combat;
    return combat;
  }

  getKnownFightingStyles() {
    const combat = this.getCombatTraining();
    const styles = new Set(combat.styles ?? []);
    for (const ability of this.itemTypes?.ability ?? []) {
      const key = resolveStyleKey(ability.name ?? "");
      if (key) {
        styles.add(key);
      }
    }
    return styles;
  }

  knowsFightingStyle(styleKey) {
    return this.getKnownFightingStyles().has(styleKey);
  }

  async setCombatTier(tier) {
    const allowed = Object.keys(CONFIG.ACKS.combatTraining.tiers);
    if (!allowed.includes(tier)) {
      return false;
    }
    const combat = foundry.utils.duplicate(this.getCombatTraining());
    combat.tier = tier;
    this._normalizeCombatConfig(combat, { enforceLimits: true });
    const validation = this._validateCombatConfig(combat);
    if (!validation.valid) {
      if (validation.reason) {
        ui.notifications?.warn(validation.reason);
      }
      return false;
    }
    this._normalizeCombatConfig(combat, { enforceLimits: true });
    await this.update({ "system.fight.combat": combat });
    return true;
  }

  async toggleCombatSelection(group, value, checked) {
    const combat = foundry.utils.duplicate(this.getCombatTraining());
    const key =
      group === "category" ? "categories" : group === "weapon" ? "weapons" : group === "style" ? "styles" : null;
    if (!key) {
      return false;
    }
    const current = new Set(combat[key] ?? []);
    if (checked) {
      current.add(value);
    } else {
      current.delete(value);
    }
    combat[key] = Array.from(current);
    this._normalizeCombatConfig(combat, { enforceLimits: false });
    if (checked && !combat[key].includes(value)) {
      if (group === "weapon" && (combat.tier === "narrow" || combat.tier === "broad")) {
        ui.notifications?.warn(game.i18n.localize("ACKS.notifications.combat.noWeaponsForCombo"));
      } else if (group === "weapon") {
        const config = CONFIG.ACKS.combatTraining ?? {};
        const lookupArray = [...(config.restrictedWeapons ?? []), ...(config.weaponOptions ?? [])];
        const match = lookupArray.find((opt) => opt.id === value);
        const weaponName = match ? game.i18n.localize(match.label) : value;
        ui.notifications?.warn(
          game.i18n.format("ACKS.notifications.weaponNotProficient", {
            actor: this.name,
            weapon: weaponName,
          }),
        );
      }
      return false;
    }
    const validation = this._validateCombatConfig(combat);
    if (!validation.valid) {
      if (validation.reason) {
        ui.notifications?.warn(validation.reason);
      }
      return false;
    }
    this._normalizeCombatConfig(combat, { enforceLimits: true });
    await this.update({ "system.fight.combat": combat });
    return true;
  }

  _normalizeCombatConfig(combat, { enforceLimits = false } = {}) {
    combat.tier = combat.tier ?? "restricted";

    const config = CONFIG.ACKS.combatTraining ?? {};
    const limits = getCombatLimits();
    const allowedStyles = new Set((config.styles ?? []).map((opt) => opt.id));
    const allowedRestricted = new Set((config.restrictedWeapons ?? []).map((opt) => opt.id));
    const allowedNarrow = new Set((config.narrowCategories ?? []).map((opt) => opt.id));
    const allowedBroad = new Set((config.broadCategories ?? []).map((opt) => opt.id));
    const allowedWeaponOptions = new Set((config.weaponOptions ?? []).map((opt) => opt.id));

    combat.styles = Array.from(new Set(combat.styles ?? [])).filter((id) => allowedStyles.has(id));
    combat.categories = Array.from(new Set(combat.categories ?? []));
    combat.weapons = Array.from(new Set(combat.weapons ?? []));

    switch (combat.tier) {
      case "restricted": {
        combat.categories = [];
        combat.weapons = combat.weapons.filter((id) => allowedRestricted.has(id));
        const limit = limits.restrictedWeapons ?? 0;
        if (enforceLimits && limit > 0 && combat.weapons.length > limit) {
          combat.weapons = combat.weapons.slice(0, limit);
        }
        break;
      }
      case "narrow": {
        combat.categories = combat.categories.filter((id) => allowedNarrow.has(id));
        if (enforceLimits) {
          const limit = limits.narrowCategories ?? 0;
          if (limit > 0 && combat.categories.length > limit) {
            combat.categories = combat.categories.slice(0, limit);
          }
        }
        const hasCombo = combat.categories.includes(NARROW_COMBO_ID);
        combat.weapons = hasCombo ? combat.weapons.filter((id) => allowedWeaponOptions.has(id)) : [];
        if (hasCombo && enforceLimits) {
          const limit = limits.narrowWeapons ?? 0;
          if (limit > 0 && combat.weapons.length > limit) {
            combat.weapons = combat.weapons.slice(0, limit);
          }
        }
        break;
      }
      case "broad": {
        combat.categories = combat.categories.filter((id) => allowedBroad.has(id));
        if (enforceLimits) {
          const limit = limits.broadCategories ?? 0;
          if (limit > 0 && combat.categories.length > limit) {
            combat.categories = combat.categories.slice(0, limit);
          }
        }
        const hasCombo = combat.categories.includes(BROAD_COMBO_ID);
        combat.weapons = hasCombo ? combat.weapons.filter((id) => allowedWeaponOptions.has(id)) : [];
        if (hasCombo && enforceLimits) {
          const limit = limits.broadWeapons ?? 0;
          if (limit > 0 && combat.weapons.length > limit) {
            combat.weapons = combat.weapons.slice(0, limit);
          }
        }
        break;
      }
      case "unrestricted":
        combat.categories = [];
        combat.weapons = [];
        break;
      default: {
        combat.tier = "restricted";
        combat.categories = [];
        combat.weapons = combat.weapons.filter((id) => allowedRestricted.has(id));
        const limit = limits.restrictedWeapons ?? 0;
        if (enforceLimits && limit > 0 && combat.weapons.length > limit) {
          combat.weapons = combat.weapons.slice(0, limit);
        }
        break;
      }
    }
  }

  _validateCombatConfig(combat) {
    const limits = getCombatLimits();
    const exceeds = (value, limit) => limit > 0 && value > limit;

    switch (combat.tier) {
      case "restricted":
        if (exceeds(combat.weapons.length, limits.restrictedWeapons ?? 0)) {
          return { valid: false, reason: game.i18n.localize("ACKS.notifications.combat.restrictedLimit") };
        }
        break;
      case "narrow": {
        if (exceeds(combat.categories.length, limits.narrowCategories ?? 0)) {
          return { valid: false, reason: game.i18n.localize("ACKS.notifications.combat.narrowCategoryLimit") };
        }
        const hasCombo = combat.categories.includes(NARROW_COMBO_ID);
        if (!hasCombo && combat.weapons.length > 0) {
          return { valid: false, reason: game.i18n.localize("ACKS.notifications.combat.noWeaponsForCombo") };
        }
        if (hasCombo && exceeds(combat.weapons.length, limits.narrowWeapons ?? 0)) {
          return { valid: false, reason: game.i18n.localize("ACKS.notifications.combat.narrowWeaponLimit") };
        }
        if (hasCombo) {
          const dependency = this._checkCombatComboDependencies(combat);
          if (!dependency.valid) {
            return dependency;
          }
        }
        break;
      }
      case "broad": {
        if (exceeds(combat.categories.length, limits.broadCategories ?? 0)) {
          return { valid: false, reason: game.i18n.localize("ACKS.notifications.combat.broadCategoryLimit") };
        }
        const hasCombo = combat.categories.includes(BROAD_COMBO_ID);
        if (!hasCombo && combat.weapons.length > 0) {
          return { valid: false, reason: game.i18n.localize("ACKS.notifications.combat.noWeaponsForCombo") };
        }
        if (hasCombo && exceeds(combat.weapons.length, limits.broadWeapons ?? 0)) {
          return { valid: false, reason: game.i18n.localize("ACKS.notifications.combat.broadWeaponLimit") };
        }
        if (hasCombo) {
          const dependency = this._checkCombatComboDependencies(combat);
          if (!dependency.valid) {
            return dependency;
          }
        }
        break;
      }
      default:
        break;
    }
    return { valid: true };
  }

  _checkCombatComboDependencies(combat) {
    const weapons = new Set(combat.weapons ?? []);
    if (weapons.size === 0) {
      return { valid: true };
    }
    const requiresShortbow = weapons.has("longbow") || weapons.has("composite-bow");
    if (requiresShortbow && !weapons.has("shortbow")) {
      return { valid: false, reason: game.i18n.localize("ACKS.notifications.combat.requiresShortbow") };
    }
    const requiresJavelin = weapons.has("spear") || weapons.has("pole-arm");
    if (requiresJavelin && !weapons.has("javelin")) {
      return { valid: false, reason: game.i18n.localize("ACKS.notifications.combat.requiresJavelin") };
    }
    return { valid: true };
  }

  _getWeaponClassification(item) {
    const override = item.system?.proficiencyKey?.trim();
    const baseSlug = override ? slugify(override) : slugify(item.name ?? "");
    const id = WEAPON_SLUG_ALIASES[baseSlug] ?? baseSlug;
    const info = getWeaponHandsInfo(item);
    const lowerName = (item.name ?? "").toLowerCase();
    const groups = {
      axes: id.includes("axe") || lowerName.includes("axe"),
      bows: id.includes("bow") || lowerName.includes("bow") || id.includes("crossbow") || lowerName.includes("crossbow") || id.includes("arbalest") || lowerName.includes("arbalest"),
      flails: id.includes("flail") || lowerName.includes("flail") || id.includes("hammer") || lowerName.includes("hammer") || id.includes("mace") || lowerName.includes("mace") || id.includes("war-pick") || lowerName.includes("war pick") || id.includes("morning") || lowerName.includes("morning"),
      swords: id.includes("sword") || lowerName.includes("sword") || id.includes("dagger") || lowerName.includes("dagger"),
      spears: id.includes("spear") || lowerName.includes("spear") || id.includes("javelin") || lowerName.includes("javelin") || id.includes("lance") || lowerName.includes("lance") || id.includes("pole") || lowerName.includes("pole"),
      exotics: EXOTIC_WEAPON_IDS.has(id),
    };

    const size = WEAPON_SIZE_CATEGORY[id] ?? (info.hands > 1 ? "large" : "medium");

    return {
      id,
      missile: info.missile,
      melee: info.melee,
      hands: info.hands,
      size,
      groups,
    };
  }

  _isProficientLegacy(item, classification) {
    const legacy = this.system?.fight?.weaponproficiencies;
    if (typeof legacy !== "string" || !legacy.trim()) {
      return false;
    }
    const entries = splitListEntries(legacy).map((entry) => slugify(entry));
    const lookup = new Set(entries);
    if (lookup.has(classification.id)) {
      return true;
    }
    if (lookup.has(slugify(item.name ?? ""))) {
      return true;
    }
    return false;
  }

  getWeaponProficiencyStatus(item) {
    if (!item || item.type !== "weapon") {
      return { valid: true };
    }

    const combat = this.getCombatTraining();
    const tier = combat.tier ?? "restricted";
    if (tier === "unrestricted") {
      return { valid: true };
    }

    const categories = new Set(combat.categories ?? []);
    const weapons = new Set((combat.weapons ?? []).map((w) => w));
    const comboCheck = this._checkCombatComboDependencies(combat);
    if (!comboCheck.valid) {
      return comboCheck;
    }

    const classification = this._getWeaponClassification(item);

    const allowRestricted = () => weapons.has(classification.id);
    const allowNarrowCategory = () => (
      (categories.has("narrow-axes") && classification.groups.axes) ||
      (categories.has("narrow-bows") && classification.groups.bows) ||
      (categories.has("narrow-flailhammermace") && classification.groups.flails) ||
      (categories.has("narrow-swords") && classification.groups.swords) ||
      (categories.has("narrow-spears") && classification.groups.spears) ||
      (categories.has("narrow-exotics") && classification.groups.exotics)
    );
    const allowBroadCategory = () => (
      (categories.has("broad-melee-small") && classification.melee && ["tiny", "small", "medium"].includes(classification.size)) ||
      (categories.has("broad-melee-large") && classification.melee && ["medium", "large"].includes(classification.size)) ||
      (categories.has("broad-axesflails") && (classification.groups.axes || classification.groups.flails)) ||
      (categories.has("broad-swords") && (classification.groups.swords || classification.groups.spears)) ||
      (categories.has("broad-missile") && classification.missile)
    );

    let proficient = false;
    if (tier === "restricted") {
      proficient = allowRestricted();
    } else if (tier === "narrow") {
      proficient = allowNarrowCategory() || (categories.has(NARROW_COMBO_ID) && weapons.has(classification.id));
    } else if (tier === "broad") {
      proficient = allowBroadCategory() || (categories.has(BROAD_COMBO_ID) && weapons.has(classification.id));
    }

    if (!proficient && this._isProficientLegacy(item, classification)) {
      proficient = true;
    }

    if (proficient) {
      return { valid: true };
    }

    const reason = game.i18n.format("ACKS.notifications.weaponNotProficient", {
      actor: this.name,
      weapon: item.name,
    });
    return { valid: false, reason };
  }

  async toggleItemEquipped(item) {
    const targetState = !item.system.equipped;
    const validation = this.validateEquipmentChange(item, targetState);
    if (!validation.valid) {
      if (validation.reason) {
        ui.notifications?.error(validation.reason);
      }
      return false;
    }
    await this.updateEmbeddedDocuments("Item", [
      {
        _id: item.id,
        "system.equipped": targetState,
      },
    ]);
    if (validation.warning) {
      ui.notifications?.warn(validation.warning);
    }
    return true;
  }

  validateEquipmentChange(item, equip) {
    if (!equip) {
      return { valid: true };
    }
    const isShield = item.type === "armor" && item.system?.type === "shield";
    if (item.type !== "weapon" && !isShield) {
      return { valid: true };
    }
    if (item.type === "weapon") {
      const status = this.getWeaponProficiencyStatus(item);
      if (!status.valid) {
        return status;
      }
    }
    const weapons = [];
    const shields = [];
    for (const weapon of this.itemTypes?.weapon ?? []) {
      if (weapon.id === item.id) {
        continue;
      }
      if (weapon.system?.equipped) {
        weapons.push(weapon);
      }
    }
    for (const armor of this.itemTypes?.armor ?? []) {
      if (armor.id === item.id) {
        continue;
      }
      if (armor.system?.equipped && armor.system?.type === "shield") {
        shields.push(armor);
      }
    }
    if (equip) {
      if (item.type === "weapon") {
        weapons.push(item);
      } else if (item.type === "armor" && item.system?.type === "shield") {
        shields.push(item);
      }
    }
    return this._validateWeaponConfiguration(weapons, shields);
  }

  _validateWeaponConfiguration(weapons, shields) {
    if (shields.length > 1) {
      return { valid: false, reason: "Cannot equip more than one shield at a time." };
    }
    const options = [];
    for (const weapon of weapons) {
      const usage = this._generateWeaponUsageOptions(weapon);
      if (usage.length === 0) {
        return { valid: false, reason: `Unable to determine how to wield ${weapon.name}.` };
      }
      options.push(usage);
    }
    const arrangements = this._generateUsageArrangements(options);
    const styleSet = this.getKnownFightingStyles();
    const shieldCount = shields.length;
    for (const arrangement of arrangements) {
      const evaluation = this._evaluateArrangement(arrangement, shieldCount, styleSet);
      if (evaluation.valid) {
        return evaluation;
      }
    }
    return {
      valid: false,
      reason:
        arrangements.length === 0
          ? "No valid way to wield equipped weapons with current fighting styles."
          : "Equipped weapons are not supported by known fighting styles.",
    };
  }

  _generateWeaponUsageOptions(item) {
    const info = getWeaponHandsInfo(item);
    const options = [];
    if (info.hands > 1) {
      if (info.melee) {
        options.push({ item, hands: 2, category: "melee" });
      }
      if (info.missile) {
        options.push({ item, hands: 2, category: "missile" });
      }
    } else {
      if (info.melee) {
        options.push({ item, hands: 1, category: "melee" });
      }
      if (info.missile) {
        options.push({ item, hands: 1, category: "missile" });
      }
    }
    return options;
  }

  _generateUsageArrangements(optionSets) {
    if (optionSets.length === 0) {
      return [[]];
    }
    const results = [];
    const iterate = (index, current) => {
      if (index >= optionSets.length) {
        results.push([...current]);
        return;
      }
      for (const option of optionSets[index]) {
        current.push(option);
        iterate(index + 1, current);
        current.pop();
      }
    };
    iterate(0, []);
    return results;
  }

  _evaluateArrangement(arrangement, shieldCount, styles) {
    let totalHands = shieldCount;
    let twoHandMelee = 0;
    let twoHandMissile = 0;
    let oneHandMelee = 0;
    let oneHandMissile = 0;

    for (const option of arrangement) {
      totalHands += option.hands;
      if (option.hands === 2) {
        if (option.category === "missile") {
          twoHandMissile += 1;
        } else {
          twoHandMelee += 1;
        }
      } else if (option.category === "missile") {
        oneHandMissile += 1;
      } else {
        oneHandMelee += 1;
      }
    }

    if (totalHands > 2) {
      return { valid: false, reason: "Equipped weapons and shields require more than two hands." };
    }

    if (twoHandMelee > 1 || twoHandMissile > 1) {
      return { valid: false, reason: "Cannot wield multiple two-handed weapons simultaneously." };
    }

    if (twoHandMelee && (oneHandMelee + oneHandMissile + shieldCount + twoHandMissile)) {
      return { valid: false, reason: "Two-handed melee weapons leave no hands for other gear." };
    }

    if (twoHandMissile && (oneHandMelee + oneHandMissile + shieldCount + twoHandMelee)) {
      return { valid: false, reason: "Two-handed missile weapons leave no hands for other gear." };
    }

    if (oneHandMelee > 0 && oneHandMissile > 0) {
      return { valid: false, reason: "Cannot mix melee and missile weapons in hand simultaneously." };
    }

    const required = new Set();

    if (twoHandMelee > 0) {
      required.add("twoHanded");
    }

    if (twoHandMissile > 0 || oneHandMissile > 0) {
      required.add("missile");
    }

    if (shieldCount > 0 && arrangement.length > 0) {
      required.add("weaponShield");
    }

    if (oneHandMelee > 0 && shieldCount === 0 && twoHandMelee === 0 && twoHandMissile === 0) {
      if (oneHandMelee === 1) {
        required.add("single");
      } else if (oneHandMelee === 2) {
        required.add("dual");
      } else {
        return { valid: false, reason: "Too many one-handed melee weapons equipped." };
      }
    }

    if (required.size === 0 && arrangement.length === 0) {
      return { valid: true };
    }

    for (const key of required) {
      if (!styles.has(key)) {
        const label = STYLE_LABELS[key] ?? key;
        return { valid: false, reason: `Missing fighting style: ${label}.` };
      }
    }

    return { valid: true };
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

  computeAC() {
    if (this.type != "character") {
      return;
    }
    // Compute AC
    let baseAac = 0;
    const data = this.system;
    data.aac.naked = baseAac + data.scores.dex.mod;
    const hasShieldStyle = this.knowsFightingStyle("weaponShield");
    let shieldBonus = 0;
    const armors = this.items.filter((i) => i.type == "armor");
    armors.forEach((a) => {
      if (a.system.equipped && a.system.type != "shield") {
        baseAac = a.system.aac.value;
      } else if (a.system.equipped && a.system.type == "shield") {
        if (hasShieldStyle) {
          shieldBonus = a.system.aac.value;
        }
      }
    });
    const activeShield = hasShieldStyle ? shieldBonus : 0;
    data.aac.value = baseAac + data.scores.dex.mod + activeShield + data.aac.mod;
    data.aac.shield = activeShield;
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
      return;
    }

    const classKey = details.classKey;
    if (!classKey) {
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
  }
}
