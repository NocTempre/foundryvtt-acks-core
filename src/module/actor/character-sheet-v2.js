import { AcksActorSheetCharacter } from "./character-sheet.js";
import { templatePath } from "../config.js";

/**
 * ACKS II Official Character Sheet
 * Extends the standard character sheet with a new template
 */
export class AcksActorSheetCharacterV2 extends AcksActorSheetCharacter {
  /**
   * Extend and override the default options to use the V2 template
   * @returns {Object}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: templatePath("actors/character-sheet-v2.html"),
    });
  }
}
