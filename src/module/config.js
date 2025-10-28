const SYSTEM_PATH_MATCH = /(systems\/[^/]+)/.exec(import.meta.url);
export const SYSTEM_PATH = SYSTEM_PATH_MATCH?.[1] ?? "systems/acks-dev";
export const SYSTEM_ID = SYSTEM_PATH.split("/")[1];
export const TEMPLATE_PATH = `${SYSTEM_PATH}/templates`;
export const MODULE_PATH = `${SYSTEM_PATH}/module`;
export const ASSETS_PATH = `${SYSTEM_PATH}/assets`;

export const templatePath = (relativePath) => `${TEMPLATE_PATH}/${relativePath}`;
export const assetPath = (relativePath) => `${ASSETS_PATH}/${relativePath}`;
export const modulePath = (relativePath) => `${MODULE_PATH}/${relativePath}`;
export const TextEditorRef = foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
export const SOCKET_NAMESPACE = `system.${SYSTEM_ID}`;
export const renderTemplate = foundry?.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
export const normalizeAssetPath = (path) => {
  if (typeof path !== "string") return path;
  const cleaned = path.trim();
  if (!cleaned) return cleaned;

  const leadingSlash = cleaned.startsWith("/");
  const segments = cleaned.replace(/^\/+/, "").split("/");
  if (segments.length === 0) return cleaned;

  if (segments[0] === "systems") {
    if (segments[1] && segments[1] !== SYSTEM_ID) {
      segments[1] = SYSTEM_ID;
    }
    return `${leadingSlash ? "/" : ""}${segments.join("/")}`;
  }

  if (segments[0] === SYSTEM_ID) {
    segments.unshift("systems");
    return `${leadingSlash ? "/" : ""}${segments.join("/")}`;
  }

  return cleaned;
};

import { TERRAIN_CONFIG } from "./terrain-config.js";

export const ACKS = {
  classes: {},
  classList: [],
  classSources: [],
  classDefaultIcon: `${ASSETS_PATH}/ui/icons/class-placeholder.svg`,
  terrain: TERRAIN_CONFIG,
  hitDiceModifiers: {
    d4: { value: 0, label: "d4 (0)" },
    d6: { value: 2, label: "d6 (2)" },
    d8: { value: 4, label: "d8 (4)" },
    d10: { value: 6, label: "d10 (6)" },
    d12: { value: 8, label: "d12 (8)" },
  },
  statusEffects: [
    {
      acks: true,
      id: "surprised",
      name: "Surprised",
      img: `${ASSETS_PATH}/icons/surprised.svg`,
      duration: { rounds: 1 },
    },
    { acks: true, id: "overnumbering", name: "OverNumbered", img: "icons/svg/regen.svg" },
    { acks: true, id: "done", name: "Done", img: "icons/svg/cancel.svg" },
    { acks: true, id: "readied", name: "Readied", img: "icons/svg/ice-aura.svg" },
    { acks: true, id: "delayed", name: "Delayed", img: "icons/svg/clockwork.svg" },
    { acks: true, id: "slumbering", name: "Slumbering", img: "icons/svg/stoned.svg" },
  ],
  surpriseTableAdventurers: {
    forelos: {
      forelos: {
        monsterModifier: +10,
        adventurerModifier: +10,
        canEvade: false,
        description: "ACKS.surprise.forelos.forelos",
      },
      fore: { monsterModifier: 1, adventurerModifier: +10, canEvade: true, description: "ACKS.surprise.forelos.fore" },
      los: { monsterModifier: 0, adventurerModifier: +10, canEvade: true, description: "ACKS.surprise.forelos.los" },
      none: { monsterModifier: -1, adventurerModifier: +10, canEvade: true, description: "ACKS.surprise.forelos.none" },
    },
    fore: {
      forelos: {
        monsterModifier: 10,
        adventurerModifier: +1,
        canEvade: false,
        description: "ACKS.surprise.fore.forelos",
      },
      fore: { monsterModifier: 1, adventurerModifier: 1, canEvade: true, description: "ACKS.surprise.fore.fore" },
      los: { monsterModifier: 0, adventurerModifier: 1, canEvade: true, description: "ACKS.surprise.fore.los" },
      none: { monsterModifier: -1, adventurerModifier: 1, canEvade: true, description: "ACKS.surprise.fore.none" },
    },
    los: {
      forelos: {
        monsterModifier: 10,
        adventurerModifier: 0,
        canEvade: false,
        description: "ACKS.surprise.los.forelos",
      },
      fore: { monsterModifier: 1, adventurerModifier: 0, canEvade: true, description: "ACKS.surprise.los.fore" },
      los: { monsterModifier: 0, adventurerModifier: 0, canEvade: true, description: "ACKS.surprise.los.los" },
      none: { monsterModifier: -1, adventurerModifier: 0, canEvade: true, description: "ACKS.surprise.los.none" },
    },
    none: {
      forelos: {
        monsterModifier: 10,
        adventurerModifier: -1,
        canEvade: false,
        description: "ACKS.surprise.none.forelos",
      },
      fore: { monsterModifier: 1, adventurerModifier: -1, canEvade: false, description: "ACKS.surprise.none.fore" },
      los: { monsterModifier: 0, adventurerModifier: -1, canEvade: false, description: "ACKS.surprise.none.los" },
      none: { monsterModifier: -10, adventurerModifier: -10, canEvade: false, description: "ACKS.surprise.none.none" },
    },
  },
  scores: {
    str: "ACKS.scores.str.long",
    int: "ACKS.scores.int.long",
    wis: "ACKS.scores.wis.long",
    dex: "ACKS.scores.dex.long",
    con: "ACKS.scores.con.long",
    cha: "ACKS.scores.cha.long",
  },
  roll_type: {
    result: "=",
    above: "≥",
    below: "≤",
  },
  saves_short: {
    death: "ACKS.saves.death.short",
    wand: "ACKS.saves.wand.short",
    paralysis: "ACKS.saves.paralysis.short",
    breath: "ACKS.saves.breath.short",
    spell: "ACKS.saves.spell.short",
  },
  saves_long: {
    death: "ACKS.saves.death.long",
    wand: "ACKS.saves.wand.long",
    paralysis: "ACKS.saves.paralysis.long",
    breath: "ACKS.saves.breath.long",
    spell: "ACKS.saves.spell.long",
  },
  armor: {
    unarmored: "ACKS.armor.unarmored",
    veryLight: "ACKS.armor.veryLight",
    light: "ACKS.armor.light",
    medium: "ACKS.armor.medium",
    heavy: "ACKS.armor.heavy",
    shield: "ACKS.armor.shield",
  },
  equipmentSlots: {
    head: "ACKS.equipmentSlots.head",
    neck: "ACKS.equipmentSlots.neck",
    cloak: "ACKS.equipmentSlots.cloak",
    torso: "ACKS.equipmentSlots.torso",
    bracers: "ACKS.equipmentSlots.bracers",
    gloves: "ACKS.equipmentSlots.gloves",
    belt: "ACKS.equipmentSlots.belt",
    boots: "ACKS.equipmentSlots.boots",
    ring: "ACKS.equipmentSlots.ring",
    mainHand: "ACKS.equipmentSlots.mainHand",
    offHand: "ACKS.equipmentSlots.offHand",
    none: "ACKS.equipmentSlots.none",
  },
  slotLimits: {
    head: 1,
    neck: 1,
    cloak: 1,
    torso: 1,
    bracers: 1,
    gloves: 1,
    belt: 1,
    boots: 1,
    ring: 2,
    mainHand: 1,
    offHand: 1,
  },
  colors: {
    green: "ACKS.colors.green",
    red: "ACKS.colors.red",
    yellow: "ACKS.colors.yellow",
    purple: "ACKS.colors.purple",
    blue: "ACKS.colors.blue",
    orange: "ACKS.colors.orange",
    white: "ACKS.colors.white",
  },
  proficiencyType: {
    general: "ACKS.proficiencyType.general",
    class: "ACKS.proficiencyType.class",
  },
  tags: {
    melee: "ACKS.items.Melee",
    missile: "ACKS.items.Missile",
    slow: "ACKS.items.Slow",
    twohanded: "ACKS.items.TwoHanded",
    blunt: "ACKS.items.Blunt",
    brace: "ACKS.items.Brace",
    splash: "ACKS.items.Splash",
    reload: "ACKS.items.Reload",
    charge: "ACKS.items.Charge",
  },
  tag_images: {
    melee: `${ASSETS_PATH}/melee.png`,
    missile: `${ASSETS_PATH}/missile.png`,
    slow: `${ASSETS_PATH}/slow.png`,
    twohanded: `${ASSETS_PATH}/twohanded.png`,
    blunt: `${ASSETS_PATH}/blunt.png`,
    brace: `${ASSETS_PATH}/brace.png`,
    splash: `${ASSETS_PATH}/splash.png`,
    reload: `${ASSETS_PATH}/reload.png`,
    charge: `${ASSETS_PATH}/charge.png`,
  },
  hireling_categories: {
    henchman: "ACKS.hireling.henchman",
    mercenary: "ACKS.hireling.mercenary",
    specialist: "ACKS.hireling.specialist",
  },
  item_subtypes: {
    item: "ACKS.items.item",
    clothing: "ACKS.items.clothing",
  },
  monster_saves: {
    0: {
      label: "Normal Human",
      d: 15,
      w: 17,
      p: 14,
      b: 16,
      s: 18,
    },
    1: {
      label: "1",
      d: 14,
      w: 16,
      p: 13,
      b: 15,
      s: 17,
    },
    2: {
      label: "2-3",
      d: 13,
      w: 15,
      p: 12,
      b: 14,
      s: 16,
    },
    4: {
      label: "4",
      d: 12,
      w: 14,
      p: 11,
      b: 13,
      s: 15,
    },
    5: {
      label: "5-6",
      d: 11,
      w: 13,
      p: 10,
      b: 12,
      s: 14,
    },
    7: {
      label: "7",
      d: 10,
      w: 12,
      p: 9,
      b: 11,
      s: 13,
    },
    8: {
      label: "8-9",
      d: 9,
      w: 11,
      p: 8,
      b: 10,
      s: 12,
    },
    10: {
      label: "10",
      d: 8,
      w: 10,
      p: 7,
      b: 9,
      s: 11,
    },
    11: {
      label: "11-12",
      d: 7,
      w: 9,
      p: 6,
      b: 8,
      s: 10,
    },
    13: {
      label: "13",
      d: 6,
      w: 8,
      p: 5,
      b: 7,
      s: 9,
    },
    14: {
      label: "14+",
      d: 5,
      w: 7,
      p: 4,
      b: 6,
      s: 8,
    },
  },
  base_speed: {
    unencumbered: 120,
    low_encumbrance: 90,
    mid_encumbrance: 60,
    high_encumbrance: 30,
    overburdened: 0,
  },
  body_weight: {
    character: 12,        // Average human body weight in stone
    small_creature: 5,    // Halfling, gnome, etc
    large_creature: 30,   // Ogre, large humanoids
    default: 12,
  },
  mortal_treatment_timing: {
    2: { label: "Treatment within 1 Round (+2)", value: 2 },
    "-3": { label: "Treatment within 1 Turn of Injury (-3)", value: -3 },
    "-5": { label: "Treatment within 1 Hour of Injury (-5)", value: -5 },
    "-8": { label: "Treatment within 1 Day of Injury (-8)", value: -8 },
    "-10": { label: "Treatment more than 1 day after Injury (-10)", value: -10 },
  },
  mortal_spell_levels: {
    0: { label: "None (0)", value: 0 },
    1: { label: "1", value: 1 },
    2: { label: "2", value: 2 },
    3: { label: "3", value: 3 },
    4: { label: "4", value: 4 },
    5: { label: "5", value: 5 },
    6: { label: "6", value: 6 },
  },
  mortal_class_levels: {
    0: { label: "Not applicable", value: 0 },
    1: { label: "1 (+0)", value: 1 },
    2: { label: "2 (+1)", value: 2 },
    3: { label: "3 (+2)", value: 3 },
    4: { label: "4 (+2)", value: 4 },
    5: { label: "5 (+2)", value: 5 },
    6: { label: "6 (+3)", value: 6 },
    7: { label: "7 (+4)", value: 7 },
    8: { label: "8 (+4)", value: 8 },
    9: { label: "9 (+4)", value: 9 },
    10: { label: "10 (+5)", value: 10 },
    11: { label: "11 (+6)", value: 11 },
    12: { label: "12 (+6)", value: 12 },
    13: { label: "13 (+6)", value: 13 },
    14: { label: "14 (+7)", value: 14 },
  },
  mortal_healer_proficiency: {
    0: { label: "None (0)", value: 0 },
    1: { label: "1", value: 1 },
    2: { label: "2", value: 2 },
    3: { label: "3", value: 3 },
    4: { label: "4", value: 4 },
    5: { label: "5", value: 5 },
  },
  tampering_span: [
    { label: "Youthful (+2)", value: 2 },
    { label: "Adult (0)", value: 0 },
    { label: "Middle Aged (-5)", value: -5 },
    { label: "Old (-10)", value: -10 },
    { label: "Ancient (-20)", value: -20 },
  ],
  tampering_spine: {
    0: { label: "None (0)", value: 0 },
    "-5": { label: "1 (-5)", value: -5 },
    "-10": { label: "2 (-10)", value: -10 },
  },
  tampering_limbs: {
    0: { label: "None (0)", value: 0 },
    "-2": { label: "1 (-2)", value: -2 },
    "-4": { label: "2 (-4)", value: -4 },
    "-6": { label: "3 (-6)", value: -6 },
    "-8": { label: "4 (-8)", value: -8 },
    "-10": { label: "5 (-10)", value: -10 },
    "-12": { label: "6 (-12)", value: -12 },
    "-14": { label: "7 (-14)", value: -14 },
    "-16": { label: "8 (-16)", value: -16 },
  },
  thiefSkills: {
    1: { backstab: "+1d", climbing: 6, hiding: 19, listening: 14, lockpicking: 18, pickpocketing: 17, searching: 18, sneaking: 17, trapbreaking: 18 },
    2: { backstab: "+1d", climbing: 5, hiding: 18, listening: 13, lockpicking: 17, pickpocketing: 16, searching: 17, sneaking: 16, trapbreaking: 17 },
    3: { backstab: "+1d", climbing: 4, hiding: 17, listening: 12, lockpicking: 16, pickpocketing: 15, searching: 16, sneaking: 15, trapbreaking: 16 },
    4: { backstab: "+1d", climbing: 3, hiding: 16, listening: 11, lockpicking: 15, pickpocketing: 14, searching: 15, sneaking: 14, trapbreaking: 15 },
    5: { backstab: "+2d", climbing: 2, hiding: 15, listening: 10, lockpicking: 14, pickpocketing: 13, searching: 14, sneaking: 13, trapbreaking: 14 },
    6: { backstab: "+2d", climbing: 1, hiding: 14, listening: 9, lockpicking: 13, pickpocketing: 12, searching: 13, sneaking: 12, trapbreaking: 13 },
    7: { backstab: "+2d", climbing: 0, hiding: 12, listening: 8, lockpicking: 11, pickpocketing: 10, searching: 11, sneaking: 10, trapbreaking: 11 },
    8: { backstab: "+2d", climbing: -1, hiding: 10, listening: 7, lockpicking: 9, pickpocketing: 8, searching: 9, sneaking: 8, trapbreaking: 9 },
    9: { backstab: "+3d", climbing: -2, hiding: 8, listening: 6, lockpicking: 7, pickpocketing: 6, searching: 7, sneaking: 6, trapbreaking: 7 },
    10: { backstab: "+3d", climbing: -3, hiding: 6, listening: 5, lockpicking: 5, pickpocketing: 4, searching: 5, sneaking: 4, trapbreaking: 5 },
    11: { backstab: "+3d", climbing: -4, hiding: 4, listening: 4, lockpicking: 3, pickpocketing: 2, searching: 3, sneaking: 2, trapbreaking: 3 },
    12: { backstab: "+3d", climbing: -5, hiding: 2, listening: 3, lockpicking: 1, pickpocketing: 0, searching: 1, sneaking: 0, trapbreaking: 2 },
    13: { backstab: "+4d", climbing: -6, hiding: 0, listening: 2, lockpicking: -1, pickpocketing: -2, searching: -1, sneaking: -2, trapbreaking: 2 },
    14: { backstab: "+4d", climbing: -7, hiding: -2, listening: 1, lockpicking: -3, pickpocketing: -4, searching: -3, sneaking: -4, trapbreaking: 1 }
  },
  // Special thief skills that can be acquired
  specialThiefSkills: {
    backstabbing: {
      name: "Backstabbing",
      type: "power",
      description: "Add your Backstab bonus to damage when attacking from behind. Counts as two skills when selecting thief abilities.",
      hasTarget: false
    },
    deciphering: {
      name: "Deciphering",
      type: "rollable",
      description: "Decipher coded messages, treasure maps, obscure languages, and incomplete arcane instructions.",
      hasTarget: true,
      targetProgression: 4  // Available from level 4+
    },
    scrollreading: {
      name: "Scroll Reading",
      type: "rollable",
      description: "Read arcane or divine scrolls without being a spellcaster.",
      hasTarget: true,
      targetProgression: 4  // Available from level 4+
    },
    shadowysenses: {
      name: "Shadowy Senses",
      type: "power",
      description: "Enhanced perception in darkness and shadows, allowing superior awareness in low-light conditions.",
      hasTarget: false
    },
    jackofalltrades: {
      name: "Jack of All Trades",
      type: "power",
      description: "Learn one thief skill not normally available to your class from a limited list. This skill represents your versatility.",
      hasTarget: false
    }
  },
  // Rebuking undead progression table for crusaders
  // Values are target numbers (10+ means roll 10 or higher on d20)
  // R = automatic success (Rebuke), D = automatic destruction
  rebukingUndead: {
    skeleton: [10, 7, 4, "R", "R", "D", "D", "D", "D", "D", "D", "D", "D", "D"],
    zombie: [13, 10, 7, 4, "R", "R", "D", "D", "D", "D", "D", "D", "D", "D"],
    ghoul: [16, 13, 10, 7, 4, "R", "R", "D", "D", "D", "D", "D", "D", "D"],
    wight: [19, 16, 13, 10, 7, 4, "R", "R", "D", "D", "D", "D", "D", "D"],
    wraith: [null, 19, 16, 13, 10, 7, 4, "R", "R", "D", "D", "D", "D", "D"],
    mummy: [null, null, 19, 16, 13, 10, 7, 4, "R", "R", "D", "D", "D", "D"],
    specter: [null, null, null, 19, 16, 13, 10, 7, 4, "R", "R", "D", "D", "D"],
    vampire: [null, null, null, null, 19, 16, 13, 10, 7, 4, "R", "R", "D", "D"],
    incarnation: [null, null, null, null, null, 19, 16, 13, 10, 7, 4, "R", "R", "D"]
  },
};
