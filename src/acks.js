// Import Modules
import { AcksItemSheet } from "./module/item/item-sheet.js";
import { AcksActorSheetCharacter } from "./module/actor/character-sheet.js";
import { AcksActorSheetCharacterV2 } from "./module/actor/character-sheet-v2.js";
import { AcksActorSheetMonster } from "./module/actor/monster-sheet.js";
import { AcksTravelPartySheet } from "./module/actor/travel-party-sheet.js";
import { AcksActorSheetLocation } from "./module/actor/location-sheet.js";
import { preloadHandlebarsTemplates } from "./module/preloadTemplates.js";
import { AcksActor } from "./module/actor/entity.js";
import { AcksItem } from "./module/documents/item.js";
import { ACKS, SYSTEM_ID, assetPath, normalizeAssetPath } from "./module/config.js";
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
import { ModuleIntegrations } from "./module/module-integrations.js";
import { HexplorerIntegration } from "./module/hexplorer-integration.js";
import { HexplorerBrushInjection } from "./module/hexplorer-brush-injection.js";
import { RoadPainter } from "./module/road-painter.js";
import { initPaperDollIntegration, isPaperDollActive, ACKS_PAPER_DOLL_CONFIG } from "./module/paperdoll-integration.js";
import { AcksLocationContext } from "./module/location-context.js";
import { ItemTransfer } from "./module/item-transfer.js";
import { ContainerManager } from "./module/container-manager.js";

const slugify = (value) => {
  if (typeof value !== "string" || value.trim() === "") return "";
  if (foundry.utils?.slugify) {
    return foundry.utils.slugify(value, { strict: true });
  }
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

async function loadClassDefinitions() {
  const fetchJson = foundry.utils?.fetchJsonWithTimeout ?? fetchJsonFallback;
  const FilePickerClass =
    foundry?.applications?.apps?.FilePicker?.implementation ??
    foundry?.app?.applications?.FilePicker?.implementation ??
    foundry?.applications?.apps?.FilePicker ??
    globalThis.FilePicker;

  const startCase = (value) => {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    return trimmed
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const collectRuleFiles = async (rootDirectory) => {
    if (!FilePickerClass?.browse) return [];

    const stack = [rootDirectory];
    const visited = new Set();
    const files = [];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) continue;
      visited.add(current);

      try {
        const result = await FilePickerClass.browse("data", current);
        for (const file of result.files ?? []) {
          if (typeof file === "string" && file.toLowerCase().endsWith(".json")) {
            files.push(file);
          }
        }
        for (const dir of result.dirs ?? []) {
          if (typeof dir === "string" && !visited.has(dir)) {
            stack.push(dir);
          }
        }
      } catch (error) {
        console.warn(`ACKS | Unable to browse rule directory ${current}`, error);
      }
    }

    return files;
  };

  const rulesRoot = assetPath("rules");
  const defaultFile = assetPath("rules/acks2_core7_classes.json");

  let ruleFiles = [];
  try {
    ruleFiles = await collectRuleFiles(rulesRoot);
  } catch (error) {
    console.warn("ACKS | Failed to enumerate rule files", error);
  }

  if (!ruleFiles?.length) {
    ruleFiles = [defaultFile];
  } else if (!ruleFiles.includes(defaultFile)) {
    ruleFiles.push(defaultFile);
  }

  const uniqueRuleFiles = Array.from(new Set(ruleFiles.filter((path) => typeof path === "string" && path.trim())));
  const classes = {};
  const list = [];
  const sources = new Map();
  const locale = game?.i18n?.lang ?? "en";

  for (const filePath of uniqueRuleFiles) {
    let raw;
    try {
      raw = await fetchJson(filePath);
    } catch (error) {
      console.error(`ACKS | Failed to load class definitions from ${filePath}`, error);
      continue;
    }

    let entries = [];
    if (Array.isArray(raw)) {
      entries = raw;
    } else if (Array.isArray(raw?.classes)) {
      entries = raw.classes;
    } else if (Array.isArray(raw?.entries)) {
      entries = raw.entries;
    }

    if (!entries.length) continue;

    const fileName = filePath.split("/").pop() ?? "classes";
    const fileStem = fileName.replace(/\.json$/i, "");
    const fallbackSourceRaw =
      (typeof raw?.source === "string" && raw.source.trim()) ? raw.source.trim() :
      (typeof raw?.label === "string" && raw.label.trim()) ? raw.label.trim() :
      fileStem;
    const fallbackSourceLabel = startCase(fallbackSourceRaw) || startCase(fileStem) || fileStem;
    const fallbackSourceId =
      slugify(raw?.sourceId ?? fallbackSourceRaw) ||
      slugify(fallbackSourceLabel) ||
      slugify(fileStem);

    if (fallbackSourceId && fallbackSourceLabel) {
      sources.set(fallbackSourceId, { id: fallbackSourceId, label: fallbackSourceLabel, file: filePath });
    }

    for (const entry of entries) {
      if (!entry?.name) continue;

      const entryType = typeof entry.type === "string" ? entry.type.toLowerCase() : "class";
      if (entryType !== "class") continue;

      const entrySourceRaw =
        (typeof entry.source === "string" && entry.source.trim()) ? entry.source.trim() : fallbackSourceRaw;
      const entrySourceLabel = startCase(entrySourceRaw) || fallbackSourceLabel;
      const entrySourceId =
        slugify(entry.sourceId ?? entrySourceRaw) ||
        fallbackSourceId;

      if (entrySourceId && entrySourceLabel) {
        sources.set(entrySourceId, { id: entrySourceId, label: entrySourceLabel, file: filePath });
      }

      const baseName = entry.name.trim();
      if (!baseName) continue;

      const baseSlug = slugify(entry.id ?? baseName);
      if (!baseSlug) continue;

      let baseId = entry.id ?? baseSlug;
      if (!entry.id && entrySourceId) {
        baseId = `${baseSlug}-${entrySourceId}`;
      }

      let uniqueId = baseId;
      let counter = 2;
      while (classes[uniqueId]) {
        uniqueId = `${baseId}-${counter++}`;
      }

      const levels = Array.isArray(entry.levels) ? entry.levels.map((lv) => ({ ...lv })) : [];
      const levelIndex = {};
      for (const level of levels) {
        const levelNumber = Number(level.level ?? 0);
        level.level = levelNumber;
        level.xp = Number(level.xp ?? 0);
        levelIndex[levelNumber] = level;
      }

      const iconPath = entry.icon ? normalizeAssetPath(entry.icon) : undefined;

      const classData = {
        ...entry,
        id: uniqueId,
        type: entryType,
        source: entrySourceLabel,
        sourceId: entrySourceId,
        file: filePath,
        levels,
        levelIndex,
        icon: iconPath ?? ACKS.classDefaultIcon,
      };

      classes[uniqueId] = classData;
      list.push({ id: uniqueId, label: entry.name, source: entrySourceLabel, icon: classData.icon });
    }
  }

  list.sort((a, b) => {
    const nameComparison = a.label.localeCompare(b.label, locale);
    if (nameComparison !== 0) return nameComparison;
    return (a.source ?? "").localeCompare(b.source ?? "", locale);
  });

  CONFIG.ACKS.classes = classes;
  CONFIG.ACKS.classList = list;
  CONFIG.ACKS.classSources = Array.from(sources.values()).sort((a, b) => a.label.localeCompare(b.label, locale));
}

async function fetchJsonFallback(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    throw new Error(`Failed to load JSON from ${path}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

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

  await loadClassDefinitions();

  game.acks = {
    rollItemMacro: macros.rollItemMacro,
    brushes: HexplorerBrushInjection,
    ItemTransfer: ItemTransfer,
    ContainerManager: ContainerManager,
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
    label: "ACKS Character Sheet (Classic)",
  });
  ActorsCollection.registerSheet(SYSTEM_ID, AcksActorSheetCharacterV2, {
    types: ["character"],
    makeDefault: false,
    label: "ACKS II Character Sheet (Official Layout)",
  });
  ActorsCollection.registerSheet(SYSTEM_ID, AcksActorSheetMonster, {
    types: ["monster"],
    makeDefault: true,
  });
  ActorsCollection.registerSheet(SYSTEM_ID, AcksTravelPartySheet, {
    types: ["travel-party"],
    makeDefault: true,
  });
  ActorsCollection.registerSheet(SYSTEM_ID, AcksActorSheetLocation, {
    types: ["location"],
    makeDefault: true,
    label: "ACKS Location Sheet",
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
  AcksLocationContext.init();

  // Initialize module integrations
  ModuleIntegrations.init();
  HexplorerIntegration.initialize();
  HexplorerBrushInjection.init();
  RoadPainter.init();

  // Initialize Paper Doll UI integration if module is active
  if (isPaperDollActive()) {
    initPaperDollIntegration();
    console.log("ACKS | Paper Doll UI module detected and integrated");
  }

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
