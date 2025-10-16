/**
 * Paper Doll UI Integration for ACKS II
 *
 * This module provides configuration for the fvtt-paper-doll-ui module to work with ACKS II equipment slots.
 * The Paper Doll UI stores equipped items in actor flags and uses filters to determine what items can go in which slots.
 *
 * @see https://github.com/theripper93/fvtt-paper-doll-ui
 */

import { MODULE_PATH, ASSETS_PATH } from "./config.js";

/**
 * Paper Doll slot configuration for ACKS II
 * Maps Paper Doll's visual slots to ACKS II equipment rules
 */
export const ACKS_PAPER_DOLL_CONFIG = {
  EQUIPPED_PATH: "equipped", // ACKS uses system.equipped for all equippable items
  HUE_ROTATE: 0,
  MAIN_COLOR: "#3d2817", // ACKS brown theme
  SLOTS: {
    LEFT: {
      HEAD: [
        {
          img: `${ASSETS_PATH}/icons/helmet.svg`,
          simpleFilter: ["armor"],
          filter: "return item.system.slot === 'head';",
        },
      ],
      CAPE: [
        {
          img: `${ASSETS_PATH}/icons/cloak.svg`,
          simpleFilter: ["armor", "item"],
          filter: "return item.system.slot === 'cloak';",
        },
      ],
      BODY: [
        {
          img: `${ASSETS_PATH}/icons/armor.svg`,
          simpleFilter: ["armor"],
          filter: "return item.system.slot === 'torso' && item.system.type !== 'shield';",
        },
      ],
      GLOVES: [
        {
          img: `${ASSETS_PATH}/icons/gauntlet.svg`,
          simpleFilter: ["armor", "item"],
          filter: "return item.system.slot === 'gloves';",
        },
      ],
      BOOTS: [
        {
          img: `${ASSETS_PATH}/icons/boots.svg`,
          simpleFilter: ["armor", "item"],
          filter: "return item.system.slot === 'boots';",
        },
      ],
    },
    RIGHT: {
      PENDANT: [
        {
          img: `${ASSETS_PATH}/icons/necklace.svg`,
          simpleFilter: ["item"],
          filter: "return item.system.slot === 'neck';",
        },
      ],
      BELT: [
        {
          img: `${ASSETS_PATH}/icons/belt.svg`,
          simpleFilter: ["item"],
          filter: "return item.system.slot === 'belt';",
        },
      ],
      BRACERS: [
        {
          img: `${ASSETS_PATH}/icons/bracers.svg`,
          simpleFilter: ["armor", "item"],
          filter: "return item.system.slot === 'bracers';",
        },
      ],
      RING: [
        {
          img: `${ASSETS_PATH}/icons/ring.svg`,
          simpleFilter: ["item"],
          filter: "return item.system.slot === 'ring';",
        },
        {
          img: `${ASSETS_PATH}/icons/ring.svg`,
          simpleFilter: ["item"],
          filter: "return item.system.slot === 'ring';",
        },
      ],
    },
    BOTTOM_LEFT_MAIN: {
      MAIN_LEFT: [
        {
          img: `${ASSETS_PATH}/icons/weapon.svg`,
          simpleFilter: ["weapon", "armor"],
          filter: "return (item.type === 'weapon' && item.system.hand === 'mainHand') || (item.type === 'armor' && item.system.type === 'shield');",
        },
      ],
    },
    BOTTOM_RIGHT_MAIN: {
      MAIN_RIGHT: [
        {
          img: `${ASSETS_PATH}/icons/weapon.svg`,
          simpleFilter: ["weapon", "armor"],
          filter: "return (item.type === 'weapon' && item.system.hand === 'offHand') || (item.type === 'armor' && item.system.type === 'shield');",
        },
      ],
    },
    // Wrist slots can be used for off-hand items like torches, holy symbols, etc.
    BOTTOM_LEFT_WRIST: {
      WRIST_LEFT: [
        {
          img: `${ASSETS_PATH}/icons/torch.svg`,
          simpleFilter: ["item"],
          filter: "return item.system.slot === 'offHand' || item.name.toLowerCase().includes('torch') || item.name.toLowerCase().includes('lantern');",
        },
      ],
    },
    BOTTOM_RIGHT_WRIST: {
      WRIST_RIGHT: [
        {
          img: `${ASSETS_PATH}/icons/holy-symbol.svg`,
          simpleFilter: ["item"],
          filter: "return item.system.slot === 'offHand' || item.name.toLowerCase().includes('holy') || item.name.toLowerCase().includes('symbol');",
        },
      ],
    },
  },
};

/**
 * Initialize Paper Doll integration
 * Called during system init hook
 */
export function initPaperDollIntegration() {
  // Set Paper Doll configuration for ACKS on ready
  Hooks.once("ready", async () => {
    await configurePaperDollForAcks();
  });

  // Register hook to sync Paper Doll equipped state with ACKS slot validation
  Hooks.on("paper-doll-equip", async (actor, item, equipped, slotData) => {
    if (!actor || !item) return;

    // Update the item's equipped state
    await item.update({ "system.equipped": equipped });

    // Trigger AC recalculation
    if (actor.type === "character") {
      actor.prepareData();
    }

    // Validate equipment slots and warn if limits exceeded
    if (actor.system.equipment?.warnings?.length > 0) {
      const warnings = actor.system.equipment.warnings;
      for (const warning of warnings) {
        ui.notifications.warn(
          game.i18n.format("ACKS.equipment.slotOverflow", {
            slot: game.i18n.localize(`ACKS.equipmentSlots.${warning.slot}`),
            count: warning.count,
            limit: warning.limit,
          })
        );
      }
    }
  });

  // Hook into Paper Doll render to add visual feedback
  Hooks.on("renderApplication", (app, html, data) => {
    if (app.constructor.name === "PaperDoll") {
      addSlotValidationVisuals(app, html);
    }
  });

  console.log("ACKS | Paper Doll UI integration initialized");
}

/**
 * Configure Paper Doll UI with ACKS slot configuration
 * This runs once on world load to set up the slots
 */
async function configurePaperDollForAcks() {
  const MODULE_ID = "fvtt-paper-doll-ui";

  try {
    // Get current Paper Doll config
    const currentConfig = game.settings.get(MODULE_ID, "globalConfig");

    // Only update if it's still the default or missing ACKS-specific slots
    const needsUpdate = !currentConfig.SLOTS?.LEFT?.HEAD?.[0]?.filter?.includes("item.system.slot");

    if (needsUpdate) {
      // Merge our ACKS config with any existing config
      const mergedConfig = foundry.utils.mergeObject(currentConfig || {}, ACKS_PAPER_DOLL_CONFIG);

      await game.settings.set(MODULE_ID, "globalConfig", mergedConfig);
      console.log("ACKS | Paper Doll configuration updated for ACKS II equipment system");
    }
  } catch (error) {
    console.warn("ACKS | Could not configure Paper Doll UI:", error);
  }
}

/**
 * Add visual feedback to Paper Doll slots based on ACKS slot validation
 * @param {Application} app - The Paper Doll application
 * @param {jQuery} html - The rendered HTML
 */
function addSlotValidationVisuals(app, html) {
  if (!app.actor || app.actor.type !== "character") return;

  // Get ACKS slot mapping
  const acksSlotToPaperDoll = {
    head: "HEAD",
    neck: "PENDANT",
    cloak: "CAPE",
    torso: "BODY",
    bracers: "BRACERS",
    gloves: "GLOVES",
    belt: "BELT",
    boots: "BOOTS",
    ring: "RING",
    mainHand: "MAIN_LEFT",
    offHand: "MAIN_RIGHT",
  };

  // Count equipped items per ACKS slot
  const slotCounts = {};
  const equippedItems = app.actor.items.filter((i) =>
    (i.type === "armor" || i.type === "item" || i.type === "weapon") && i.system.equipped
  );

  // Track which items are in which slots
  const itemsPerSlot = {};

  equippedItems.forEach((item) => {
    let acksSlot = null;

    if (item.type === "armor") {
      acksSlot = item.system.slot || "torso";
    } else if (item.type === "item") {
      acksSlot = item.system.slot || "none";
    } else if (item.type === "weapon") {
      acksSlot = item.system.hand || "mainHand";
    }

    if (acksSlot && acksSlot !== "none") {
      slotCounts[acksSlot] = (slotCounts[acksSlot] || 0) + 1;
      itemsPerSlot[acksSlot] = itemsPerSlot[acksSlot] || [];
      itemsPerSlot[acksSlot].push(item);
    }
  });

  // Check limits and mark over-equipped slots
  const limits = CONFIG.ACKS?.slotLimits || {};
  const overEquippedSlots = {};

  for (const [acksSlot, count] of Object.entries(slotCounts)) {
    const limit = limits[acksSlot];
    if (limit && count > limit) {
      overEquippedSlots[acksSlot] = {
        count,
        limit,
        items: itemsPerSlot[acksSlot],
      };
    }
  }

  // Apply visual styling to over-equipped slots
  html = html[0] || html;

  for (const [acksSlot, info] of Object.entries(overEquippedSlots)) {
    const paperDollSlot = acksSlotToPaperDoll[acksSlot];
    if (!paperDollSlot) continue;

    // Find all slots with this ID in the Paper Doll UI
    const slotElements = html.querySelectorAll(`.paper-doll-slot[data-id="${paperDollSlot}"]`);

    // Mark slots beyond the limit as inactive (red border)
    slotElements.forEach((element, index) => {
      if (index >= info.limit) {
        element.classList.add("acks-over-equipped");
        element.style.border = "2px solid #cc0000";
        element.style.opacity = "0.6";
        element.setAttribute("data-tooltip", `${element.getAttribute("data-tooltip") || ""} (INACTIVE - exceeds slot limit)`);
      }
    });
  }

  // Add custom CSS for over-equipped visual feedback
  if (!document.getElementById("acks-paperdoll-styles")) {
    const style = document.createElement("style");
    style.id = "acks-paperdoll-styles";
    style.textContent = `
      .paper-doll-slot.acks-over-equipped {
        filter: grayscale(50%) brightness(0.8);
        animation: acks-pulse-red 2s ease-in-out infinite;
      }

      @keyframes acks-pulse-red {
        0%, 100% {
          box-shadow: 0 0 5px rgba(204, 0, 0, 0.5);
        }
        50% {
          box-shadow: 0 0 15px rgba(204, 0, 0, 0.9);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Check if Paper Doll UI module is active
 * @returns {boolean}
 */
export function isPaperDollActive() {
  return game.modules.get("fvtt-paper-doll-ui")?.active ?? false;
}

/**
 * Get the Paper Doll configuration for ACKS
 * This can be called by the Paper Doll module to get system-specific config
 * @returns {object} Paper Doll configuration
 */
export function getAcksPaperDollConfig() {
  return foundry.utils.deepClone(ACKS_PAPER_DOLL_CONFIG);
}
