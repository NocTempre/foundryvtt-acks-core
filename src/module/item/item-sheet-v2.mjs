import { AcksUtility } from "../utility.js";
import AcksEffectUtil from "../effect/acks-effect-util.mjs";
import { templatePath } from "../config.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const TextEditorRef = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;

export default class AcksItemSheetV2 extends HandlebarsApplicationMixin(ItemSheetV2) {
  constructor(...args) {
    super(...args);
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["acks", "item-v2"],
    position: {
      // initial size of the window
      width: 570,
      height: 400,
    },
    window: {
      resizable: true,
    },
    form: {
      submitOnChange: true,
      submitOnClose: true,
    },
    actions: {
      // button actions, defined in template as data-action
      createEffect: AcksItemSheetV2.#addEffect,
      toggleEffect: AcksItemSheetV2.#toggleEffect,
      editEffect: AcksItemSheetV2.#editEffect,
      deleteEffect: AcksItemSheetV2.#deleteEffect,
      toggleMelee: AcksItemSheetV2.#toggleMelee,
      toggleMissile: AcksItemSheetV2.#toggleMissile,
      deleteTag: AcksItemSheetV2.#deleteTag,
    },
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "description", label: "ACKS.category.description" },
        { id: "effects", label: "ACKS.category.effects" },
      ],
      initial: "description",
    },
  };

  /** @override */
  tabGroups = {
    primary: "description",
  };

  /** @override */
  static PARTS = {
    header: {
      template: templatePath("items/v2/item/header.hbs"),
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    description: {
      template: templatePath("items/v2/item/description.hbs"),
      scrollable: [""],
    },
    effects: {
      template: templatePath("items/v2/item/effects.hbs"),
      templates: [templatePath("items/v2/common/item-active-effects.hbs")],
      scrollable: [""],
    },
  };

  get item() {
    return this.document;
  }

  /**
   * Modify the provided options passed to a render request.
   * @param {RenderOptions} options Options which configure application rendering behavior
   * @protected
   */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);

    // change initial height of window to accommodate for more details (left "stats" block with configuration)
    if (options.isFirstRender && ["spell", "ability", "weapon"].includes(this.item.type)) {
      Object.assign(options.position, { height: 530 });
    }
  }

  /**
   * Actions performed after a first render of the Application.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @returns {Promise<void>}
   * @protected
   */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const tagInput = this.element.querySelector(':scope input[data-action="add-tag"]');
    tagInput?.addEventListener("keydown", this.#tagInputKeydownHandler.bind(this));
  }

  /**
   * Actions performed before closing the Application.
   * Pre-close steps are awaited by the close process.
   * @param {RenderOptions} options                 Provided render options
   * @returns {Promise<void>}
   * @protected
   */
  async _preClose(options) {
    //TODO: not sure we need this, seems foundry is removing them
    const tagInput = this.element.querySelector(':scope input[data-action="add-tag"]');
    tagInput?.removeEventListener("keydown", this.#tagInputKeydownHandler.bind(this));
    await super._preClose(options);
  }

  /**
   * Allow subclasses to dynamically configure render parts.
   * @param {HandlebarsRenderOptions} options
   * @returns {Record<string, HandlebarsTemplatePart>}
   * @protected
   */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    // if item can't have Active Effects remove corresponding part
    if (!this._hasActiveEffects()) {
      delete parts.effects;
    }
    return parts;
  }

  /**
   * Prepare application tab data for a single tab group.
   * @param {string} group The ID of the tab group to prepare
   * @returns {Record<string, ApplicationTab>}
   * @protected
   */
  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    // if item can't have Active Effects remove corresponding tab
    if (!this._hasActiveEffects()) {
      delete tabs.effects;
    }
    return tabs;
  }

  /**
   * Returns true if item can have Active Effects
   * @return {boolean}
   * @protected
   */
  _hasActiveEffects() {
    return ["item", "weapon", "armor", "spell", "ability"].includes(this.item.type);
  }

  /**
   * Prepare data for rendering the Item sheet
   * The prepared data object contains both the actor data and additional sheet options
   * @param {ApplicationRenderOptions} options https://foundryvtt.com/api/interfaces/foundry.applications.types.ApplicationRenderOptions.html
   * @return {Promise<ApplicationRenderContext>} https://foundryvtt.com/api/interfaces/foundry.applications.types.ApplicationRenderContext.html
   */
  async _prepareContext(options) {
    const context = {
      ...(await super._prepareContext(options)),
      item: this.item,
      config: CONFIG.ACKS,
      system: this.item.system,
      isGM: game.user.isGM,
      isPhysical: "cost" in this.item.system && "weight6" in this.item.system,
      hasTags: "tags" in this.item.system && this.item.system.tags.length > 0,
    };

    return context;
  }

  /**
   * Prepare context that is specific to only a single rendered part.
   *
   * It is recommended to augment or mutate the shared context so that downstream methods like _onRender have
   * visibility into the data that was used for rendering. It is acceptable to return a different context object
   * rather than mutating the shared context at the expense of this transparency.
   *
   * @param {string} partId                         The part being rendered
   * @param {ApplicationRenderContext} context      Shared context provided by _prepareContext
   * @param {HandlebarsRenderOptions} options       Options which configure application rendering behavior
   * @returns {Promise<ApplicationRenderContext>}   Context data for a specific part
   * @protected
   */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);

    switch (partId) {
      case "description":
        context.tab = context.tabs[partId];
        context = await this._prepareDescriptionContext(context);
        break;

      case "effects":
        context.tab = context.tabs[partId];
        context = await this._prepareEffectsContext(context);
        break;
      default:
        break;
    }

    return context;
  }

  /**
   * Prepare context for Effects Tab
   * @param {ApplicationRenderContext} context
   * @return {Promise<ApplicationRenderContext>}
   * @private
   */
  async _prepareEffectsContext(context) {
    context.effects = await AcksUtility.prepareActiveEffectCategories(this.item.effects);

    return context;
  }

  /**
   * Prepare context for Description Tab
   * @param {ApplicationRenderContext} context
   * @return {Promise<ApplicationRenderContext>}
   * @private
   */
  async _prepareDescriptionContext(context) {
    context.getDetailsPartialPath = () => {
      return templatePath(`items/v2/details/details-${this.item.type}.hbs`);
    };

    const enrichmentOptions = {
      secrets: this.item.isOwner,
      relativeTo: this.item,
    };

    context.enriched = {
      description: await TextEditorRef.enrichHTML(this.item.system.description, enrichmentOptions),
    };

    return context;
  }

  /**
   * Handle adding new active effect.
   * @this {AcksItemSheetV2}
   * @param {Event} event
   * @param {HTMLElement} target - add effect button
   */
  static async #addEffect(event, target) {
    const effectType = target.dataset.effectType;
    await AcksEffectUtil.addEffect(effectType, this.item);
  }

  /**
   * Handle toggling of an active event.
   * @this {AcksItemSheetV2}
   * @param {Event} event
   * @param {HTMLElement} target
   * @return {Promise<void>}
   */
  static async #toggleEffect(event, target) {
    const effectId = target.dataset.effectId;
    await AcksEffectUtil.toggleEffect(effectId, this.item);
  }

  /**
   * Handle editing of an active event.
   * @this {AcksItemSheetV2}
   * @param {Event} event
   * @param {HTMLElement} target
   * @return {Promise<void>}
   */
  static async #editEffect(event, target) {
    const effectId = target.dataset.effectId;
    await AcksEffectUtil.editEffect(effectId, this.item);
  }

  /**
   * Handle deleting of an active event.
   * @this {AcksItemSheetV2}
   * @param {Event} event
   * @param {HTMLElement} target
   * @return {Promise<void>}
   */
  static async #deleteEffect(event, target) {
    const effectId = target.dataset.effectId;
    await AcksEffectUtil.deleteEffect(effectId, this.item);
  }

  /**
   * Handle melee flag toggling for weapon.
   * @this {AcksItemSheetV2}
   * @param {Event} event
   * @param {HTMLElement} target
   * @return {Promise<void>}
   */
  static async #toggleMelee(event, target) {
    this.item.update({ "system.melee": !this.item.system.melee });
  }

  /**
   * Handle missile flag toggling for weapon.
   * @this {AcksItemSheetV2}
   * @param {Event} event
   * @param {HTMLElement} target
   * @return {Promise<void>}
   */
  static async #toggleMissile(event, target) {
    this.item.update({ "system.missile": !this.item.system.missile });
  }

  /**
   * Remove tag from item
   * @param {Event} event
   * @param {HTMLElement} target
   * @return {Promise<void>}
   */
  static async #deleteTag(event, target) {
    if (this.isEditable) {
      const tag = target.dataset.tag;
      this.item.popTag(tag);
    }
  }

  /**
   * Handle Enter key press in TAG input of weapon sheet
   * @param {KeyboardEvent} event
   */
  #tagInputKeydownHandler(event) {
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      const val = event.target?.value ?? "";
      if (val.length > 0) {
        const values = val.split(",");
        this.item.pushTag(values);
      }
    }
  }
}
