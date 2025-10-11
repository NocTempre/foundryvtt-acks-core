import { templatePath } from "./config.js";

export const preloadHandlebarsTemplates = async function () {
  const relativePaths = [
    // Character Sheets
    "actors/character-sheet.html",
    "actors/monster-sheet.html",
    // Actor partials
    // Sheet tabs
    "actors/partials/character-header.html",
    "actors/partials/character-attributes-tab.html",
    "actors/partials/character-abilities-tab.html",
    "actors/partials/character-spells-tab.html",
    "actors/partials/character-inventory-tab.html",
    "actors/partials/character-bonuses-tab.html",
    "actors/partials/character-notes-tab.html",
    "actors/partials/character-effects-tab.html",
    "actors/partials/character-hirelings-tab.html",
    "actors/partials/monster-header.html",
    "actors/partials/monster-attributes-tab.html",

    "items/partials/item-generic-effects-tab.html",

    // v2 sheet parts
    "items/v2/details/details-item.hbs",
    "items/v2/details/details-armor.hbs",
    "items/v2/details/details-language.hbs",
    "items/v2/details/details-money.hbs",
    "items/v2/details/details-ability.hbs",
    "items/v2/details/details-spell.hbs",
    "items/v2/details/details-weapon.hbs",
    "items/v2/common/item-description.hbs",
  ];

  return loadTemplates(relativePaths.map(templatePath));
};
