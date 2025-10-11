// Import Modules
import { AcksItemSheet } from "./module/item/item-sheet.js";
import { AcksActorSheetCharacter } from "./module/actor/character-sheet.js";
import { AcksActorSheetMonster } from "./module/actor/monster-sheet.js";
import { preloadHandlebarsTemplates } from "./module/preloadTemplates.js";
import { AcksActor } from "./module/actor/entity.js";
import { AcksItem } from "./module/documents/item.js";
import { ACKS, SYSTEM_ID } from "./module/config.js";
import { registerMainSettings } from "./module/settings.js";
import { registerHelpers } from "./module/helpers.js";
import * as chat from "./module/chat.js";
import * as treasure from "./module/treasure.js";
import * as macros from "./module/macros.js";
import * as party from "./module/party.js";
import { AcksCombat, AcksCombatClass } from "./module/combat.js";
import { AcksTokenHud } from "./module/acks-token-hud.js";
import { AcksUtility } from "./module/utility.js";
import { AcksPolyglot } from "./module/apps/polyglot-support.js";
import { AcksTableManager } from "./module/apps/table-manager.js";
import { AcksCommands } from "./module/apps/acks-commands.js";
import AcksItemSheetV2 from "./module/item/item-sheet-v2.mjs";
import LanguageData from "./module/data/item/language-data.mjs";
import MoneyData from "./module/data/item/money-data.mjs";
import ItemData from "./module/data/item/item-data.mjs";
import WeaponData from "./module/data/item/weapon-data.mjs";
import ArmorData from "./module/data/item/armor-data.mjs";
import SpellData from "./module/data/item/spell-data.mjs";
import AbilityData from "./module/data/item/ability-data.mjs";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function () {
  //CONFIG.debug.hooks = true;
  const ActorsCollection = foundry.documents?.collections?.Actors ?? globalThis.Actors ?? game?.actors?.constructor;
  const ItemsCollection = foundry.documents?.collections?.Items ?? globalThis.Items ?? game?.items?.constructor;
  const ActorSheetV1 = foundry.appv1?.sheets?.ActorSheet;
  const ItemSheetV1 = foundry.appv1?.sheets?.ItemSheet;
  const ActorDirectoryClass =
    foundry.applications?.sidebar?.tabs?.ActorDirectory ??
    foundry.applications?.directories?.ActorDirectory ??
    globalThis.ActorDirectory ??
    game?.actors?.directory?.constructor;

  // Clamp/Clamped management v11/v12
  if (Math.clamp === undefined) {
    Math.clamp = function (a, b, c) {
      return Math.max(b, Math.min(c, a));
    };
  }

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d6 + @initiative.value",
    decimals: 1,
  };

  CONFIG.ACKS = ACKS;

  game.acks = {
    rollItemMacro: macros.rollItemMacro,
  };

  // Custom Handlebars helpers
  registerHelpers();
  registerMainSettings();

  CONFIG.Actor.documentClass = AcksActor;
  CONFIG.Item.documentClass = AcksItem;
  CONFIG.Item.dataModels = {
    language: LanguageData,
    money: MoneyData,
    item: ItemData,
    weapon: WeaponData,
    armor: ArmorData,
    spell: SpellData,
    ability: AbilityData,
  };
  CONFIG.Combat.documentClass = AcksCombatClass;

  // Register sheet application classes
  ActorsCollection.unregisterSheet("core", ActorSheetV1);
  ActorsCollection.registerSheet(SYSTEM_ID, AcksActorSheetCharacter, {
    types: ["character"],
    makeDefault: true,
  });
  ActorsCollection.registerSheet(SYSTEM_ID, AcksActorSheetMonster, {
    types: ["monster"],
    makeDefault: true,
  });
  // Unregister default item sheet
  ItemsCollection.unregisterSheet("core", ItemSheetV1);
  if (AcksUtility.isMinVersion(13)) {
    // If Foundry is v13 or more - register both old and new Item sheets for now.
    ItemsCollection.registerSheet(SYSTEM_ID, AcksItemSheet, {
      makeDefault: false,
    });
    ItemsCollection.registerSheet(SYSTEM_ID, AcksItemSheetV2, {
      makeDefault: true,
    });
  } else {
    // Use old item sheet for Foundry v12
    ItemsCollection.registerSheet(SYSTEM_ID, AcksItemSheet, {
      makeDefault: false,
    });
  }

  await preloadHandlebarsTemplates();

  AcksTokenHud.init();
  AcksCommands.init();

  // Ensure new effect transfer
  CONFIG.ActiveEffect.legacyTransferral = false;

  Hooks.on("getSceneControlButtons", (controls) => {
    const V13 = AcksUtility.isMinVersion(13);
    const targetControl = V13 ? controls?.tokens : controls.find((control) => control.name === "token");
    if (!targetControl) {
      return;
    }
    const partyBtnAction = () => {
      const actorDirectory = game.actors.apps.find((app) => app instanceof ActorDirectoryClass);
      if (actorDirectory) {
        party.showPartySheet(actorDirectory);
      } else {
        ui.notifications.error("Something went wrong. Can't find ActorDirectory.");
      }
    };
    const partyButtonTool = {
      name: "acksPartyButton",
      title: "ACKS.dialog.partysheet",
      icon: "fas fa-users",
      button: true,
      visible: true,
    };
    if (V13) {
      partyButtonTool.onChange = () => partyBtnAction();
      targetControl.tools.acksPartyButton = partyButtonTool;
    } else {
      // onClick is deprecated in v13
      partyButtonTool.onClick = () => partyBtnAction();
      targetControl.tools.push(partyButtonTool);
    }
  });
});

// Setup Polyglot stuff if needed
AcksPolyglot.init();

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function () {
  // Localize CONFIG objects once up-front
  const toLocalize = ["saves_short", "saves_long", "scores", "armor", "colors", "tags"];
  for (let o of toLocalize) {
    CONFIG.ACKS[o] = Object.entries(CONFIG.ACKS[o]).reduce((obj, e) => {
      obj[e[0]] = game.i18n.localize(e[1]);
      return obj;
    }, {});
  }
});

Hooks.on("chatMessage", (html, content, msg) => {
  if (content[0] == "/") {
    let regExp = /(\S+)/g;
    let commands = content.match(regExp);
    if (game.acks.commands.processChatCommand(commands, content, msg)) {
      return false;
    }
  }
  return true;
});

Hooks.once("ready", async () => {
  Hooks.on("hotbarDrop", (bar, data, slot) => macros.createAcksMacro(data, slot));

  AcksUtility.updateWeightsLanguages();
  AcksUtility.displayWelcomeMessage();
  AcksUtility.setupSocket();
  AcksTableManager.init();
});

// License and KOFI infos
Hooks.on("preUpdateCombatant", AcksCombat.updateCombatant);
Hooks.on("renderCombatTracker", AcksCombat.format);
Hooks.on("preUpdateCombat", AcksCombat.preUpdateCombat);
Hooks.on("getCombatTrackerEntryContext", AcksCombat.addContextEntry);
Hooks.on("combatTurn", AcksCombat.combatTurn);
Hooks.on("combatRound", AcksCombat.combatRound);

Hooks.on("renderChatLog", (app, html, data) => AcksItem.chatListeners(html));
Hooks.on("getChatLogEntryContext", chat.addChatMessageContextOptions);
Hooks.on("renderChatMessageHTML", chat.addChatMessageButtons);
Hooks.on("renderRollTableConfig", treasure.augmentTable);
Hooks.on("updateActor", party.update);

Hooks.on("renderActorDirectory", (app, html, data) => AcksUtility.addButtons(app, html, data));
