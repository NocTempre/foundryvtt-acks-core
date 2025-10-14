/**
 * Module Integrations for ACKS
 *
 * Provides passive detection and optional UI for terrain-based movement.
 * Does NOT hook into external modules - they must call ACKS APIs directly.
 */

import { HexplorerIntegration } from "./hexplorer-integration.js";
import { SYSTEM_ID } from "./config.js";

export class ModuleIntegrations {

  /**
   * Initialize all module integrations
   */
  static init() {
    Hooks.once("ready", () => {
      this.detectModules();
      this.setupUI();
    });
  }

  /**
   * Detect which optional modules are active (for informational purposes only)
   */
  static detectModules() {
    const modules = {
      hexplorer: game.modules.get("hexplorer")?.active,
      weatherControl: game.modules.get("weather-control")?.active,
      simpleCalendar: game.modules.get("foundryvtt-simple-calendar")?.active,
      smallTime: game.modules.get("smalltime")?.active,
      simpleTimekeeping: game.modules.get("simple-timekeeping")?.active
    };

    console.log("ACKS | Module Detection:", modules);

    // Store detected modules
    if (!game.acks) game.acks = {};
    game.acks.detectedModules = modules;

    return modules;
  }

  /**
   * Setup optional UI elements based on settings
   * Does NOT hook into other modules - just adds ACKS UI
   */
  static setupUI() {
    const hexplorerEnabled = game.settings.get(SYSTEM_ID, "hexplorerIntegration");

    // Only add UI if explicitly enabled
    if (hexplorerEnabled) {
      console.log("ACKS | Adding Hex Movement calculator to character sheets");

      // Add button to character sheets
      Hooks.on("renderActorSheet", (sheet, html) => {
        if (sheet.actor.type !== "character") return;
        this._addHexMovementButton(sheet, html);
      });
    }

    // Log that terrain API is available regardless of settings
    console.log("ACKS | Terrain movement API available at game.acks.hexplorer");
    console.log("ACKS | Terrain data available at game.acks.terrain");
  }

  /**
   * Add hex movement button to actor sheet
   * @private
   */
  static _addHexMovementButton(sheet, html) {
    // Find the movement section in ACKS character sheet
    const movementRow = html.find('.acks-attribute-row').has('.attribute-movement').first();
    if (!movementRow.length) {
      console.warn("ACKS | Could not find movement section in character sheet");
      return;
    }

    // Check if button already exists
    if (html.find('.acks-hex-movement').length) return;

    // Add button to the movement row
    const button = $(`
      <div class="flexrow" style="margin-top: 10px;">
        <button type="button" class="acks-hex-movement" title="Calculate hex-based movement" style="width: 100%; padding: 5px;">
          <i class="fas fa-map"></i> Hex Movement Calculator
        </button>
      </div>
    `);

    button.on("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._showHexMovementDialog(sheet.actor);
    });

    movementRow.append(button);
  }

  /**
   * Show hex movement configuration dialog
   * @private
   */
  static _showHexMovementDialog(actor) {
    const terrainOptions = HexplorerIntegration.getAllTerrainTypes()
      .map(t => `<option value="${t.key}">${t.label}</option>`)
      .join('');

    const roadOptions = HexplorerIntegration.getAllRoadTypes()
      .map(r => `<option value="${r.key}">${r.label}</option>`)
      .join('');

    const vesselOptions = HexplorerIntegration.getAllVesselTypes()
      .map(v => `<option value="${v.key}">${v.label}</option>`)
      .join('');

    const weatherOptions = HexplorerIntegration.getAllWeatherConditions()
      .map(w => `<option value="${w.key}">${w.label}</option>`)
      .join('');

    const content = `
      <form>
        <div class="form-group">
          <label>Terrain Type:</label>
          <select name="terrain" style="width: 100%;">
            ${terrainOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Road Type (optional):</label>
          <select name="road" style="width: 100%;">
            <option value="">None</option>
            ${roadOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Vessel (optional):</label>
          <select name="vessel" style="width: 100%;">
            <option value="">None (on foot)</option>
            ${vesselOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Weather:</label>
          <select name="weather" style="width: 100%;">
            ${weatherOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Party Size:</label>
          <input type="number" name="partySize" value="6" min="1" style="width: 100%;" />
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 5px;">
            <input type="checkbox" name="hasDriving" />
            Has Driving Proficiency
          </label>
        </div>
      </form>
    `;

    new Dialog({
      title: "Hex Movement Calculator",
      content: content,
      buttons: {
        calculate: {
          icon: '<i class="fas fa-calculator"></i>',
          label: "Calculate",
          callback: (html) => {
            const formData = new FormDataExtended(html[0].querySelector("form")).object;
            const summary = HexplorerIntegration.createMovementSummary(
              actor,
              formData.terrain,
              {
                roadType: formData.road || null,
                weather: formData.weather || "clear",
                vessel: formData.vessel || null,
                partySize: parseInt(formData.partySize) || 6,
                hasDriving: formData.hasDriving || false
              }
            );

            ChatMessage.create({
              user: game.user.id,
              speaker: ChatMessage.getSpeaker({ actor: actor }),
              content: summary,
              type: CONST.CHAT_MESSAGE_TYPES.OTHER
            });
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "calculate",
      render: (html) => {
        // Make form more readable
        html.find('select, input[type="number"]').css({
          'margin-top': '5px',
          'margin-bottom': '10px'
        });
      }
    }).render(true);
  }
}
