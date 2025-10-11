import { AcksActorSheet } from "./actor-sheet.js";
import { AcksCharacterModifiers } from "../dialog/character-modifiers.js";
import { AcksCharacterCreator } from "../dialog/character-creation.js";
import { templatePath, SYSTEM_ID, renderTemplate } from "../config.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 */
export class AcksActorSheetCharacter extends AcksActorSheet {
  constructor(...args) {
    super(...args);
  }

  /* -------------------------------------------- */

  /**
   * Extend and override the default options used by the 5e Actor Sheet
   * @returns {Object}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["acks", "sheet", "actor", "character"],
      template: templatePath("actors/character-sheet.html"),
      width: 800,
      height: 580,
      resizable: true,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "attributes",
        },
      ],
    });
  }

  /* -------------------------------------------- */
  generateScores() {
    new AcksCharacterCreator(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  /* -------------------------------------------- */
  /**
   * Prepare data for rendering the Actor sheet
   * The prepared data object contains both the actor data as well as additional sheet options
   */
  async getData() {
    const data = await super.getData();

    data.config.initiative = true; // game.settings.get(SYSTEM_ID, "initiative") != "group";
    data.config.BHR = game.settings.get(SYSTEM_ID, "bhr");
    data.config.removeMagicBonus = game.settings.get(SYSTEM_ID, "removeMagicBonus");
    data.isGM = game.user.isGM;

    data.isNew = this.actor.isNew();
    return data;
  }

  /* -------------------------------------------- */
  async _chooseLang() {
    let choices = CONFIG.ACKS.languages;

    let templateData = { choices: choices },
      dlg = await renderTemplate(templatePath("actors/dialogs/lang-create.html"), templateData);
    //Create Dialog window
    return new Promise((resolve) => {
      new Dialog({
        title: "",
        content: dlg,
        buttons: {
          ok: {
            label: game.i18n.localize("ACKS.Ok"),
            icon: '<i class="fas fa-check"></i>',
            callback: (html) => {
              resolve({
                choice: html.find('select[name="choice"]').val(),
              });
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("ACKS.Cancel"),
          },
        },
        default: "ok",
      }).render(true);
    });
  }

  /* -------------------------------------------- */
  _pushLang(table) {
    const data = this.actor.system;
    let update = foundry.utils.duplicate(data[table]);
    this._chooseLang().then((dialogInput) => {
      const name = CONFIG.ACKS.languages[dialogInput.choice];
      if (update.value) {
        update.value.push(name);
      } else {
        update = { value: [name] };
      }
      let newData = {};
      newData[table] = update;
      return this.actor.update({ system: newData });
    });
  }

  /* -------------------------------------------- */
  _popLang(table, lang) {
    const data = this.actor.system;
    let update = data[table].value.filter((el) => el != lang);
    let newData = {};
    newData[table] = { value: update };
    return this.actor.update({ system: newData });
  }

  /* -------------------------------------------- */
  async _onQtChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.update({ "system.quantity.value": parseInt(event.target.value) });
  }

  /* -------------------------------------------- */
  _onShowModifiers(event) {
    event.preventDefault();
    new AcksCharacterModifiers(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2,
    }).render(true);
  }

  /* -------------------------------------------- */
  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);

    $("form").bind("keydown", function (e) {
      if (e.keyCode === 13) return false;
    });

    html.find(".pay-wages").click((ev) => {
      this.actor.payWages();
    });

    html.find(".money-minus").click((ev) => {
      let moneyId = $(ev.currentTarget).data("money-id");
      this.actor.updateMoney(moneyId, -1);
    });
    html.find(".money-plus").click((ev) => {
      let moneyId = $(ev.currentTarget).data("money-id");
      this.actor.updateMoney(moneyId, 1);
    });

    html.find(".henchman-loyalty-check").click((ev) => {
      let henchId = $(ev.currentTarget).data("henchman-id");
      game.actors.get(henchId).rollLoyalty({ event: ev });
    });
    html.find(".henchman-morale-check").click((ev) => {
      let henchId = $(ev.currentTarget).data("henchman-id");
      game.actors.get(henchId).rollMorale({ event: ev });
    });

    html.find(".morale-check a").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollMorale({ event: ev });
    });

    html.find(".loyalty-check a").click((ev) => {
      let actorObject = this.actor;
      actorObject.rollLoyalty({ event: ev });
    });

    html.find(".ability-score .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let score = element.parentElement.parentElement.dataset.score;
      let stat = element.parentElement.parentElement.dataset.stat;
      if (!score) {
        if (stat == "lr") {
          actorObject.rollLoyalty(score, { event: ev });
        }
      } else {
        actorObject.rollCheck(score, { event: ev });
      }
    });

    html.find(".exploration .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let expl = element.parentElement.parentElement.dataset.exploration;
      actorObject.rollExploration(expl, { event: ev });
    });

    html.find(".adventuring .attribute-name a").click((ev) => {
      let actorObject = this.actor;
      let element = ev.currentTarget;
      let advKey = element.parentElement.dataset.adventuring;
      actorObject.rollAdventuring(advKey, { event: ev });
    });

    html.find(".inventory .item-titles .item-caret").click((ev) => {
      let items = $(ev.currentTarget.parentElement.parentElement).children(".item-list");
      if (items.css("display") == "none") {
        let el = $(ev.currentTarget).find(".fas.fa-caret-right");
        el.removeClass("fa-caret-right");
        el.addClass("fa-caret-down");
        items.slideDown(200);
      } else {
        let el = $(ev.currentTarget).find(".fas.fa-caret-down");
        el.removeClass("fa-caret-down");
        el.addClass("fa-caret-right");
        items.slideUp(200);
      }
    });

    html.find("a[data-action='modifiers']").click((ev) => {
      this._onShowModifiers(ev);
    });

    if (this.options.editable) {
      html.find("[data-action='select-class']").click((ev) => this._onSelectClass(ev));
    }

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Update Inventory Item
    html.find(".item-edit").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find(".item-delete").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });

    // Open henchman/hireling sheet
    html.find(".open-henchman").click((ev) => {
      const li = $(ev.currentTarget);
      this.actor.showHenchman(li.data("henchmanId"));
    });
    html.find(".hireling-edit-quantity").change((ev) => {
      // Get input value of the field
      let quantity = $(ev.currentTarget).val();
      // Get the hireling id
      let hirelingId = $(ev.currentTarget).parents(".item").data("henchmanId");
      // Update the hireling quantity
      let hireling = game.actors.get(hirelingId);
      hireling.update({ "system.retainer.quantity": quantity });
    });

    // Delete Inventory Item
    html.find(".henchman-delete").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.delHenchman(li.data("henchmanId"));
      li.slideUp(200, () => this.render(false));
    });

    html.find(".item-push").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._pushLang(table);
    });

    html.find(".item-pop").click((ev) => {
      ev.preventDefault();
      const header = ev.currentTarget;
      const table = header.dataset.array;
      this._popLang(table, $(ev.currentTarget).closest(".item").data("lang"));
    });

    html.find(".item-create").click(async (event) => {
      event.preventDefault();
      const header = event.currentTarget;
      const type = header.dataset.type;
      const systemData = foundry.utils.duplicate(header.dataset);
      delete systemData.type;
      const itemData = {
        name: `New ${type.capitalize()}`,
        type: type,
        system: systemData,
      };
      await this.actor.createEmbeddedDocuments("Item", [itemData]);
    });

    //Toggle Equipment
    html.find(".item-toggle").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      //console.log("item", item.system.equipped);
      await this.actor.updateEmbeddedDocuments("Item", [
        {
          _id: li.data("itemId"),
          system: {
            equipped: !item.system.equipped,
          },
        },
      ]);
    });

    html.find(".item-favorite").click(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      //console.log("item", item.system.favorite);
      await this.actor.updateEmbeddedDocuments("Item", [
        {
          _id: li.data("itemId"),
          system: {
            favorite: !item.system.favorite,
          },
        },
      ]);
    });

    html
      .find(".quantity input")
      .click((ev) => ev.target.select())
      .change(this._onQtChange.bind(this));

    html.find("a[data-action='generate-scores']").click((ev) => {
      this.generateScores(ev);
    });
  }

  async _onSelectClass(event) {
    event.preventDefault();
    if (this.actor?.system?.details?.classLock) {
      return;
    }
    const choices = CONFIG.ACKS?.classList ?? [];
    if (!choices.length) {
      ui.notifications?.warn(game.i18n.localize("ACKS.details.classListMissing"));
      return;
    }

    const currentKey = this.actor?.system?.details?.classKey ?? "";
    const options = choices
      .map((entry) => {
        const selected = entry.id === currentKey ? " selected" : "";
        const optionLabel = entry.source ? `${entry.label} (${entry.source})` : entry.label;
        return `<option value="${entry.id}"${selected}>${optionLabel}</option>`;
      })
      .join("");

    const content = `
      <form class="acks-class-select">
        <div class="form-group">
          <label>${game.i18n.localize("ACKS.details.class")}</label>
          <div class="form-fields">
            <select name="classKey" data-dtype="String">
              <option value="">${game.i18n.localize("ACKS.details.selectClassPrompt")}</option>
              ${options}
            </select>
          </div>
        </div>
      </form>`;

    const classKey = await Dialog.prompt({
      title: game.i18n.localize("ACKS.details.classSelectionTitle"),
      content,
      label: game.i18n.localize("ACKS.Ok"),
      rejectClose: true,
      callback: (html) => html.find("[name='classKey']").val(),
    });

    if (!classKey) {
      return;
    }

    const updateData = {
      "system.details.classKey": classKey,
      "system.details.classLock": true,
    };

    await this.actor.update(updateData);
  }
}
