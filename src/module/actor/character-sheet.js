import { AcksActorSheet } from "./actor-sheet.js";
import { AcksCharacterModifiers } from "../dialog/character-modifiers.js";
import { AcksCharacterCreator } from "../dialog/character-creation.js";
import { AcksJournalEntryEditor } from "../dialog/journal-entry-editor.js";
import { ItemTransferDialog } from "../dialog/item-transfer-dialog.js";
import { AcksClassPackageDialog } from "../dialog/class-package-selection.js";
import { templatePath, SYSTEM_ID, renderTemplate, TextEditorRef } from "../config.js";

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

    // Prepare journal data
    data.journalLinked = !!this.actor.system.journal?.journalId;
    data.simpleQuestActive = game.modules.get("simple-quest")?.active || false;
    data.journalEntries = await this._prepareJournalEntries();

    // Current location
    data.currentLocationName = this.actor.getFlag(SYSTEM_ID, "currentLocationName") || null;

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
  // Journal methods
  async _prepareJournalEntries() {
    // Defensive checks for undefined/null journal structure
    if (!this.actor?.system?.journal) return [];

    const entries = this.actor.system.journal.entries || [];
    const journalId = this.actor.system.journal.journalId;

    if (!journalId || !entries.length) return [];

    // Ensure entries is actually an array
    if (!Array.isArray(entries)) return [];

    const journal = game.journal.get(journalId);
    if (!journal) return [];

    const typeLabels = {
      identity: "Identity",
      stash: "Stash",
      bond: "Bond",
      advancement: "Advancement",
      downtime: "Downtime",
      desire: "Desire / Quest",
      lead: "Lead",
      grudge: "Grudge",
      travel: "Travel",
      legacy: "Legacy",
    };

    const badgeColors = {
      identity: "#620630",
      stash: "#2c5aa0",
      bond: "#a05c2c",
      advancement: "#2ca05c",
      downtime: "#5c2ca0",
      desire: "#a0862c",
      lead: "#2c8da0",
      grudge: "#a02c5c",
      travel: "#5ca02c",
      legacy: "#333333",
    };

    const preparedEntries = [];
    for (const entry of entries) {
      if (!entry || !entry.pageId) continue;

      const page = journal.pages.get(entry.pageId);
      if (!page) continue;

      const entryData = page.getFlag(SYSTEM_ID, "entryData") || {};
      const gameDate = page.getFlag(SYSTEM_ID, "gameDate") || null;
      const realDate = new Date(entry.timestamp || Date.now());

      // Enrich HTML content for all text fields
      const enrichedData = {};
      if (entryData && typeof entryData === 'object') {
        for (const [key, value] of Object.entries(entryData)) {
          if (typeof value === 'string' && value.trim()) {
            // Enrich HTML to convert entity links (@UUID) to clickable links
            enrichedData[key] = await TextEditorRef.enrichHTML(value, {
              async: true,
              relativeTo: this.actor,
            });
          } else {
            enrichedData[key] = value;
          }
        }
      }

      preparedEntries.push({
        id: entry.id,
        type: entry.type,
        pageId: entry.pageId,
        typeLabel: typeLabels[entry.type] || entry.type,
        badgeColor: badgeColors[entry.type] || "#666666",
        session: entryData.session || null,
        gameDate: gameDate,
        data: enrichedData,
        timestamp: entry.timestamp,
        timestampFormatted: realDate.toLocaleDateString() + " " + realDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    // Sort by timestamp (newest first)
    preparedEntries.sort((a, b) => b.timestamp - a.timestamp);

    return preparedEntries;
  }

  async _onJournalCreate() {
    const journalData = {
      name: `${this.actor.name}'s Journal`,
      ownership: {
        [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      },
    };

    // Copy actor ownership to journal
    if (this.actor.ownership && typeof this.actor.ownership === 'object') {
      for (const [userId, level] of Object.entries(this.actor.ownership)) {
        if (userId !== "default") {
          journalData.ownership[userId] = level;
        }
      }
    }

    const journal = await JournalEntry.create(journalData);

    await this.actor.update({
      "system.journal.journalId": journal.id,
    });

    ui.notifications.info(`Journal created for ${this.actor.name}`);
    this.render(false);
  }

  async _onJournalOpen() {
    const journalId = this.actor.system.journal?.journalId;
    if (!journalId) return;

    const journal = game.journal.get(journalId);
    if (journal) {
      journal.sheet.render(true);
    }
  }

  async _onJournalSimpleQuest() {
    const journalId = this.actor.system.journal?.journalId;
    if (!journalId) return;

    const journal = game.journal.get(journalId);
    if (!journal) return;

    // Check if simple-quest is active
    if (!game.modules.get("simple-quest")?.active) {
      ui.notifications.warn("Simple Quest module is not active");
      return;
    }

    // Open the journal in simple-quest
    if (ui.simpleQuest) {
      ui.simpleQuest.openToPage(journal.uuid);
    }
  }

  async _onJournalAddEntry(entryType) {
    if (!entryType) return;

    const entryData = {
      type: entryType,
      data: {},
    };

    new AcksJournalEntryEditor(this.actor, entryData, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 500) / 2,
    }).render(true);
  }

  async _onJournalEditEntry(entryId) {
    const entries = this.actor.system.journal?.entries || [];
    const entry = entries.find(e => e.id === entryId);

    if (!entry) return;

    const journalId = this.actor.system.journal?.journalId;
    const journal = game.journal.get(journalId);
    if (!journal) return;

    const page = journal.pages.get(entry.pageId);
    if (!page) return;

    const entryData = {
      id: entry.id,
      type: entry.type,
      data: page.getFlag(SYSTEM_ID, "entryData") || {},
      timestamp: entry.timestamp,
      gameDate: page.getFlag(SYSTEM_ID, "gameDate") || "",
    };

    new AcksJournalEntryEditor(this.actor, entryData, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 500) / 2,
    }).render(true);
  }

  async _onJournalDeleteEntry(entryId) {
    const confirmed = await Dialog.confirm({
      title: "Delete Journal Entry",
      content: "<p>Are you sure you want to delete this journal entry?</p>",
    });

    if (!confirmed) return;

    const entries = this.actor.system.journal?.entries || [];
    const entry = entries.find(e => e.id === entryId);

    if (!entry) return;

    // Delete the journal page
    const journalId = this.actor.system.journal?.journalId;
    const journal = game.journal.get(journalId);
    if (journal) {
      const page = journal.pages.get(entry.pageId);
      if (page) {
        await page.delete();
      }
    }

    // Remove from actor's entry list
    const updatedEntries = entries.filter(e => e.id !== entryId);
    await this.actor.update({
      "system.journal.entries": updatedEntries,
    });

    ui.notifications.info("Journal entry deleted");
    this.render(false);
  }

  async _onJournalViewPage(pageId) {
    const journalId = this.actor.system.journal?.journalId;
    if (!journalId) return;

    const journal = game.journal.get(journalId);
    if (!journal || !journal.pages) return;

    const page = journal.pages.get(pageId);
    if (!page) return;

    // Use page's show method instead of rendering journal with pageId
    // This avoids Foundry's iteration issues when the journal structure is complex
    if (page.sheet) {
      page.sheet.render(true);
    } else {
      // Fallback: render journal sheet without pageId option, then navigate
      const sheet = journal.sheet;
      sheet.render(true);
      // Wait for sheet to render, then try to navigate to the page
      setTimeout(() => {
        if (sheet._pages) {
          sheet._pages.pageIndex = journal.pages.contents.indexOf(page);
          sheet.render(false);
        }
      }, 100);
    }
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
      html.find("[data-action='roll-class-package']").click((ev) => this._onRollClassPackage(ev));
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

    // Mounts handlers
    html.find(".open-mount").click((ev) => {
      const li = $(ev.currentTarget);
      const mountId = li.data("mountId");
      const mount = game.actors.get(mountId);
      if (mount) {
        mount.sheet.render(true);
      }
    });

    html.find(".mount-delete").click((ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.delMount(li.data("mountId"));
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

    // Journal tab listeners
    html.find(".journal-create").click((ev) => {
      ev.preventDefault();
      this._onJournalCreate();
    });

    html.find(".journal-open").click((ev) => {
      ev.preventDefault();
      this._onJournalOpen();
    });

    html.find(".journal-simple-quest").click((ev) => {
      ev.preventDefault();
      this._onJournalSimpleQuest();
    });

    html.find(".journal-add-entry").click((ev) => {
      ev.preventDefault();
      const entryType = html.find(".journal-entry-type").val();
      if (!entryType) {
        ui.notifications.warn("Please select an entry type");
        return;
      }
      this._onJournalAddEntry(entryType);
      // Reset the selector
      html.find(".journal-entry-type").val("");
    });

    html.find(".entry-edit").click((ev) => {
      ev.preventDefault();
      const entryId = $(ev.currentTarget).data("entryId");
      this._onJournalEditEntry(entryId);
    });

    html.find(".entry-delete").click((ev) => {
      ev.preventDefault();
      const entryId = $(ev.currentTarget).data("entryId");
      this._onJournalDeleteEntry(entryId);
    });

    html.find(".entry-view-page").click((ev) => {
      ev.preventDefault();
      const pageId = $(ev.currentTarget).data("pageId");
      this._onJournalViewPage(pageId);
    });

    // Journal filter and sort listeners
    html.find(".journal-filter-type").change((ev) => {
      this._onJournalFilter(html, ev.target.value);
    });

    html.find(".journal-sort-order").change((ev) => {
      this._onJournalSort(html, ev.target.value);
    });

    html.find(".journal-clear-filters").click((ev) => {
      ev.preventDefault();
      html.find(".journal-filter-type").val("all");
      html.find(".journal-sort-order").val("newest");
      this._onJournalFilter(html, "all");
      this._onJournalSort(html, "newest");
    });

    // Item transfer listeners
    html.find(".item-transfer").click(async (ev) => {
      ev.preventDefault();
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      if (item) {
        await ItemTransferDialog.show(item, this.actor);
      }
    });

    html.find(".retrieve-delegated-items").click(async (ev) => {
      ev.preventDefault();
      await ItemTransferDialog.showRetrieveDialog(this.actor);
    });

    // Context menu for items (right-click)
    this._contextMenu(html);
  }

  /* -------------------------------------------- */
  /**
   * Setup context menu for items
   */
  _contextMenu(html) {
    const contextMenuClass = foundry.applications?.ux?.ContextMenu?.implementation || ContextMenu;
    new contextMenuClass(html[0], ".item", [
      {
        name: "Edit",
        icon: '<i class="fas fa-edit"></i>',
        callback: (li) => {
          const element = li instanceof HTMLElement ? li : li[0];
          const itemId = element.dataset.itemId;
          const item = this.actor.items.get(itemId);
          item.sheet.render(true);
        }
      },
      {
        name: "Transfer to Party Member",
        icon: '<i class="fas fa-exchange-alt"></i>',
        condition: (li) => {
          const element = li instanceof HTMLElement ? li : li[0];
          const itemId = element.dataset.itemId;
          const item = this.actor.items.get(itemId);
          return item && !["spell", "ability", "language", "money"].includes(item.type);
        },
        callback: (li) => {
          const element = li instanceof HTMLElement ? li : li[0];
          const itemId = element.dataset.itemId;
          const item = this.actor.items.get(itemId);
          if (item) {
            ItemTransferDialog.show(item, this.actor);
          }
        }
      },
      {
        name: "Delete",
        icon: '<i class="fas fa-trash"></i>',
        callback: (li) => {
          const element = li instanceof HTMLElement ? li : li[0];
          const itemId = element.dataset.itemId;
          this.actor.deleteEmbeddedDocuments("Item", [itemId]);
          element.style.transition = 'all 0.2s';
          element.style.opacity = '0';
          element.style.height = '0';
          setTimeout(() => this.render(false), 200);
        }
      }
    ], { jQuery: false });
  }

  /* -------------------------------------------- */
  // Journal filter and sort methods
  _onJournalFilter(html, filterType) {
    const entries = html.find(".journal-entry-card");
    entries.each(function() {
      const entryType = $(this).data("entryType");
      if (filterType === "all" || entryType === filterType) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  }

  _onJournalSort(html, sortOrder) {
    const container = html.find(".journal-entry-list");
    const entries = container.find(".journal-entry-card").get();

    entries.sort((a, b) => {
      const aCard = $(a);
      const bCard = $(b);

      if (sortOrder === "newest") {
        // Already sorted by timestamp in getData
        return 0;
      } else if (sortOrder === "oldest") {
        // Reverse current order
        return aCard.index() > bCard.index() ? -1 : 1;
      } else if (sortOrder === "type") {
        // Sort by entry type
        const aType = aCard.data("entryType");
        const bType = bCard.data("entryType");
        return aType.localeCompare(bType);
      }
      return 0;
    });

    // Reorder DOM elements
    container.append(entries);
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

    // Prompt for package selection if packages are available
    const classDef = CONFIG.ACKS?.classes?.[classKey];
    if (classDef) {
      const className = classDef.name.toLowerCase();
      const classSlug = classKey.split('-')[0];
      const packages = CONFIG.ACKS?.classPackages?.[className] || CONFIG.ACKS?.classPackages?.[classSlug];

      if (packages && packages.length > 0) {
        // Ask if they want to roll for a package
        const shouldRoll = await Dialog.confirm({
          title: "Class Package",
          content: `<p>Would you like to roll for a ${classDef.name} starting package?</p><p>This will roll 3d6 and let you select proficiencies and starting equipment.</p>`,
          yes: () => true,
          no: () => false,
        });

        if (shouldRoll) {
          await AcksClassPackageDialog.handlePackageSelection(this.actor);
        }
      }
    }
  }

  async _onRollClassPackage(event) {
    event.preventDefault();
    await AcksClassPackageDialog.handlePackageSelection(this.actor);
  }
}
