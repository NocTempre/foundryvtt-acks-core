/**
 * ACKS II Adventurer Character Sheet
 * Clean v14 implementation using ApplicationV2 framework
 */

export default class AdventurerSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor(options = {}) {
    super(options);
    this.#actor = options.document;
  }

  /** @type {Actor} */
  #actor;

  /**
   * The document associated with this application
   * @type {Actor}
   */
  get document() {
    return this.#actor;
  }

  /**
   * Convenience reference to the Actor document
   * @type {Actor}
   */
  get actor() {
    return this.#actor;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["acks-ii", "sheet", "actor", "adventurer"],
    tag: "form",
    form: {
      handler: AdventurerSheet.#onSubmitForm,
      submitOnChange: true,
    },
    actions: {
      changeTab: AdventurerSheet.#onChangeTab,
      abilityCheck: AdventurerSheet.#onAbilityCheck,
      saveRoll: AdventurerSheet.#onSaveRoll,
      attackRoll: AdventurerSheet.#onAttackRoll,
      rollHP: AdventurerSheet.#onRollHP,
      shortRest: AdventurerSheet.#onShortRest,
      longRest: AdventurerSheet.#onLongRest,
      itemCreate: AdventurerSheet.#onItemCreate,
      itemEdit: AdventurerSheet.#onItemEdit,
      itemDelete: AdventurerSheet.#onItemDelete,
      itemToggle: AdventurerSheet.#onItemToggle,
    },
    window: {
      resizable: true,
      contentClasses: ["standard-form"],
    },
    position: {
      width: 720,
      height: 800,
    },
  };

  /** @override */
  static PARTS = {
    sheet: {
      template: "systems/acks-dev/templates/actors/adventurer-sheet.html",
    },
  };

  /** @override */
  tabGroups = {
    primary: "main",
  };

  /**
   * Track the current tab
   * @type {string}
   */
  #currentTab = "main";

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Update active tab visibility
    this.element.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    const activeTab = this.element.querySelector(`.tab-content[data-tab="${this.#currentTab}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }

    // Update active tab navigation
    this.element.querySelectorAll('.sheet-tabs .item').forEach(item => {
      item.classList.remove('active');
    });
    const activeNavItem = this.element.querySelector(`.sheet-tabs .item[data-tab="${this.#currentTab}"]`);
    if (activeNavItem) {
      activeNavItem.classList.add('active');
    }
  }

  /**
   * The ID of the Actor associated with this sheet
   * @type {string}
   */
  get id() {
    return `actor-${this.actor.id}`;
  }

  /**
   * The window title
   * @type {string}
   */
  get title() {
    return this.actor.name;
  }

  /** @override */
  async _prepareContext(options) {
    const context = {
      actor: this.actor,
      editable: this.isEditable,
      owner: this.actor.isOwner,
    };

    const actorData = this.actor.toObject(false);

    // Add the actor's data to context for easier access
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare items by type
    context.items = actorData.items || [];
    context.itemsByType = this.#prepareItems(context.items);

    // Add enriched biography and notes - safely handle missing data
    const TextEditorClass = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const biography = context.system?.character?.biography || "";
    const notes = context.system?.character?.notes || "";
    context.enrichedBiography = await TextEditorClass.enrichHTML(biography, { async: true });
    context.enrichedNotes = await TextEditorClass.enrichHTML(notes, { async: true });

    // Add ability score labels
    context.abilities = {
      str: { label: "STR", full: "Strength" },
      int: { label: "INT", full: "Intelligence" },
      dex: { label: "DEX", full: "Dexterity" },
      wil: { label: "WIL", full: "Willpower" },
      con: { label: "CON", full: "Constitution" },
      cha: { label: "CHA", full: "Charisma" },
    };

    // Add encumbrance level labels
    context.encumbranceLevels = ["Unencumbered", "Light", "Moderate", "Heavy", "Immobile"];
    const encLevel = context.system?.encumbrance?.level ?? 0;
    context.encumbranceLabel = context.encumbranceLevels[encLevel] || "Unknown";

    // Calculate encumbrance percentage
    if (context.system?.encumbrance) {
      const current = context.system.encumbrance.current || 0;
      const limit = context.system.encumbrance.limit || 1;
      context.system.encumbrance.percentage = Math.round((current / limit) * 100);
    }

    // Calculate saving throw totals
    if (context.system?.saves) {
      for (const [key, save] of Object.entries(context.system.saves)) {
        save.total = (save.value || 0) + (save.mod || 0);
      }
    }

    // Add current tab for template logic
    context.currentTab = this.#currentTab;

    return context;
  }

  /**
   * Organize items by type
   * @param {Object[]} items - The items array
   * @returns {Object} Items organized by type
   */
  #prepareItems(items) {
    const organized = {
      weapons: [],
      armor: [],
      equipment: [],
      spells: [],
      abilities: [],
    };

    for (let item of items) {
      item.img = item.img || Item.DEFAULT_ICON;

      // Organize by type
      if (item.type === "weapon") organized.weapons.push(item);
      else if (item.type === "armor") organized.armor.push(item);
      else if (item.type === "spell") organized.spells.push(item);
      else if (item.type === "ability") organized.abilities.push(item);
      else organized.equipment.push(item);
    }

    return organized;
  }

  /**
   * Check if the current user can edit this sheet
   * @type {boolean}
   */
  get isEditable() {
    return this.actor.isOwner;
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle tab changes
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static #onChangeTab(event, target) {
    const tabName = target.dataset.tab;
    this.#currentTab = tabName;

    // Update tab visibility without full re-render
    this.element.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    const activeTab = this.element.querySelector(`.tab-content[data-tab="${tabName}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }

    // Update tab navigation
    this.element.querySelectorAll('.sheet-tabs .item').forEach(item => {
      item.classList.remove('active');
    });
    target.classList.add('active');
  }

  /**
   * Handle form submission
   * @param {SubmitEvent} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The form data
   */
  static async #onSubmitForm(event, form, formData) {
    await this.document.update(formData.object);
    // Re-render to update calculated fields
    this.render();
  }

  /**
   * Handle ability check rolls
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static async #onAbilityCheck(event, target) {
    event.preventDefault();
    const ability = target.dataset.ability;
    await this.document.rollAbilityCheck(ability);
  }

  /**
   * Handle saving throw rolls
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static async #onSaveRoll(event, target) {
    event.preventDefault();
    const save = target.dataset.save;
    const saveData = this.document.system.saves[save];

    const roll = new Roll("1d20");
    await roll.evaluate();

    const targetValue = saveData.value + saveData.mod;
    const success = roll.total >= targetValue;

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: `${save.toUpperCase()} Save (Target: ${targetValue}) - ${success ? "Success!" : "Failure"}`,
    });
  }

  /**
   * Handle attack rolls
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static async #onAttackRoll(event, target) {
    event.preventDefault();
    const ac = parseInt(target.dataset.ac) || 0;
    const targetValue = this.document.system.attack[`vsAC${ac}`];

    const roll = new Roll("1d20");
    await roll.evaluate();

    const success = roll.total >= targetValue;

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: `Attack vs AC ${ac} (Need: ${targetValue}) - ${success ? "Hit!" : "Miss"}`,
    });
  }

  /**
   * Handle rolling HP
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static async #onRollHP(event, target) {
    event.preventDefault();
    const hitDie = this.document.system.hitDie || "1d6";
    await this.document.rollHitPoints(hitDie);
  }

  /**
   * Handle short rest
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static async #onShortRest(event, target) {
    event.preventDefault();
    await this.document.shortRest();
  }

  /**
   * Handle long rest
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static async #onLongRest(event, target) {
    event.preventDefault();
    await this.document.longRest();
  }

  /**
   * Handle creating a new item
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static async #onItemCreate(event, target) {
    event.preventDefault();
    const type = target.dataset.type;

    const itemData = {
      name: `New ${type.capitalize()}`,
      type: type,
      system: {},
    };

    return await Item.create(itemData, { parent: this.document });
  }

  /**
   * Handle editing an item
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static async #onItemEdit(event, target) {
    event.preventDefault();
    const li = target.closest(".item");
    const item = this.document.items.get(li.dataset.itemId);
    item.sheet.render(true);
  }

  /**
   * Handle deleting an item
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static async #onItemDelete(event, target) {
    event.preventDefault();
    const li = target.closest(".item");
    const item = this.document.items.get(li.dataset.itemId);

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: `Delete ${item.name}?` },
      content: `<p>Are you sure you want to delete <strong>${item.name}</strong>?</p>`,
    });

    if (confirmed) {
      await item.delete();
    }
  }

  /**
   * Handle toggling item equipped status
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static async #onItemToggle(event, target) {
    event.preventDefault();
    const li = target.closest(".item");
    const item = this.document.items.get(li.dataset.itemId);

    if (item.system.equipped !== undefined) {
      await item.update({ "system.equipped": !item.system.equipped });
    }
  }
}
