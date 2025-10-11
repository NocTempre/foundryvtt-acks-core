import { AcksPartySheet } from "./dialog/party-sheet.js";
import { SYSTEM_ID } from "./config.js";

export const showPartySheet = (object) => {
  new AcksPartySheet(object, {
    top: window.screen.height / 2 - 180,
    left: window.screen.width / 2 - 140,
  }).render(true);
};

export const update = (actor, data) => {
  if (actor.getFlag(SYSTEM_ID, "party")) {
    Object.values(ui.windows).forEach((w) => {
      if (w instanceof AcksPartySheet) {
        w.render(true);
      }
    });
  }
};
