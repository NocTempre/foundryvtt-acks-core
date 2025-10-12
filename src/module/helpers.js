import { templatePath, assetPath } from "./config.js";

export const registerHelpers = async function () {
  // Handlebars template helpers
  Handlebars.registerHelper("eq", function (a, b) {
    return a == b;
  });

  Handlebars.registerHelper("gt", function (a, b) {
    return a >= b;
  });

  Handlebars.registerHelper("toFixed", function (number, digits) {
    if (!Number(number)) {
      number = 0;
    }
    if (!Number(digits)) {
      digits = 0;
    }
    return Number(number).toFixed(digits);
  });

  Handlebars.registerHelper("mod", function (val) {
    if (val > 0) {
      return `+${val}`;
    } else if (val < 0) {
      return `${val}`;
    } else {
      return "0";
    }
  });

  Handlebars.registerHelper("add", function (lh, rh) {
    return parseInt(lh) + parseInt(rh);
  });

  Handlebars.registerHelper("subtract", function (lh, rh) {
    return parseInt(lh) - parseInt(rh);
  });

  Handlebars.registerHelper("fsubtract", (lh, rh) => {
    return parseFloat(lh) - parseFloat(rh);
  });

  Handlebars.registerHelper("divide", function (lh, rh) {
    return Math.floor(parseFloat(lh) / parseFloat(rh));
  });

  Handlebars.registerHelper("fdivide", (lh, rh) => {
    return parseFloat(lh) / parseFloat(rh);
  });

  Handlebars.registerHelper("mult", function (lh, rh) {
    return parseFloat(lh) * parseFloat(rh);
  });

  Handlebars.registerHelper("multround", function (lh, rh) {
    return Math.round(parseFloat(lh) * parseFloat(rh) * 100) / 100;
  });

  Handlebars.registerHelper("roundTreas", function (value) {
    return Math.round(value * 100) / 100;
  });

  Handlebars.registerHelper("getWeightTooltip", function (weight, maxWeight) {
    if (weight > maxWeight) {
      return game.i18n.localize("ACKS.EncumbranceTitle.Overburdened");
    } else if (weight > 10) {
      return game.i18n.localize("ACKS.EncumbranceTitle.High");
    } else if (weight > 7) {
      return game.i18n.localize("ACKS.EncumbranceTitle.Medium");
    } else if (weight > 5) {
      return game.i18n.localize("ACKS.EncumbranceTitle.Low");
    } else {
      return game.i18n.localize("ACKS.EncumbranceTitle.Unencumbered");
    }
  });

  Handlebars.registerHelper("getTagIcon", function (tag) {
    const index = Object.keys(CONFIG.ACKS.tags).find((k) => CONFIG.ACKS.tags[k] == tag);
    return CONFIG.ACKS.tag_images[index];
  });

  const myClamp = (num, min, max) => Math.min(Math.max(num, min), max);
  Handlebars.registerHelper("counter", function (status, value, max) {
    return status ? myClamp((100.0 * value) / max, 0, 100) : myClamp(100 - (100.0 * value) / max, 0, 100);
  });

  // Handle v12 removal of this helper
  Handlebars.registerHelper("select", function (selected, options) {
    const escapedValue = RegExp.escape(Handlebars.escapeExpression(selected));
    const rgx = new RegExp(" value=[\"']" + escapedValue + "[\"']");
    const html = options.fn(this);
    return html.replace(rgx, "$& selected");
  });

  Handlebars.registerHelper("split", function (str, separator, keep) {
    return str.split(separator)[keep];
  });

  Handlebars.registerHelper("healthBarStyle", function (isFull, value, max) {
    const numericMax = Number(max) || 0;
    const numericValue = Number(value) || 0;
    let height;

    if (numericMax <= 0) {
      height = isFull ? 0 : 100;
    } else {
      const percent = (100 * numericValue) / numericMax;
      height = isFull ? percent : 100 - percent;
    }

    const clamped = myClamp(height, 0, 100);
    return `height: ${clamped}%;`;
  });

  // If you need to add Handlebars helpers, here are a few useful examples:
  Handlebars.registerHelper("concat", function () {
    let outStr = "";
    for (let arg in arguments) {
      if (typeof arguments[arg] != "object") {
        outStr += arguments[arg];
      }
    }
    return outStr;
  });

  Handlebars.registerHelper("isDefined", function (value) {
    return typeof value !== typeof void 0;
  });

  Handlebars.registerHelper("acksPartial", (relativePath) => templatePath(relativePath));
  Handlebars.registerHelper("acksAsset", (relativePath) => assetPath(relativePath));

  Handlebars.registerHelper("includes", (haystack, needle) => {
    if (!Array.isArray(haystack)) return false;
    return haystack.includes(needle);
  });

  Handlebars.registerHelper("length", (value) => {
    if (Array.isArray(value) || typeof value === "string") {
      return value.length;
    }
    if (value instanceof Set || value instanceof Map) {
      return value.size;
    }
    return 0;
  });
};
