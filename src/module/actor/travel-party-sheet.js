/**
 * Travel Party Sheet for ACKS Hexploration
 *
 * Manages overland travel with party members, vehicles/mounts,
 * automated encounter rolls, and integration with Hexplorer + Calendar
 */

import { RoadPainter } from "../road-painter.js";
import { HexplorerIntegration } from "../hexplorer-integration.js";
import { TERRAIN_CONFIG } from "../terrain-config.js";
import { templatePath } from "../config.js";

// Use Foundry v13 compatible ActorSheet
const BaseActorSheet = foundry.appv1?.sheets?.ActorSheet ?? ActorSheet;

export class AcksTravelPartySheet extends BaseActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["acks", "sheet", "actor", "travel-party"],
      template: templatePath("actors/travel-party-sheet.html"),
      width: 750,
      height: 800,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "members",
        },
      ],
      scrollY: [".tab.members", ".tab.vehicles", ".tab.travel"],
    });
  }

  async getData() {
    // Get base context from ActorSheet
    const context = await super.getData();

    // Add ACKS config
    context.config = CONFIG.ACKS;
    context.isGM = game.user.isGM;

    // Prepare members data
    context.members = this._prepareMembers();
    context.slowestMember = this._getSlowestMember();

    // Prepare vehicles data
    context.vehicles = this._prepareVehicles();

    // Movement calculation
    context.movement = this._calculateMovement();

    // Terrain/Road/Weather options
    context.terrainTypes = HexplorerIntegration.getAllTerrainTypes();
    context.roadTypes = this._getRoadTypes();
    context.weatherTypes = this._getWeatherTypes();

    // Travel state
    context.isActive = this.actor.system.travel.active;
    context.encountersToday = this.actor.system.encounters.rollsToday || [];

    // Flags
    context.hexplorerActive = game.modules.get("hexplorer")?.active;

    // Auto-sync token speed when sheet is rendered
    if (context.hexplorerActive && canvas?.tokens) {
      this._syncTokenSpeed();
    }

    return context;
  }

  /**
   * Prepare member data with actor references
   */
  _prepareMembers() {
    const members = this.actor.system.members || [];
    return members.map((member) => {
      const actor = game.actors.get(member.actorId);
      if (!actor) return null;

      return {
        id: member.actorId,
        actor: actor,
        name: actor.name,
        img: actor.img,
        expeditionSpeed: actor.system.movementacks?.expedition || 24,
        role: member.role || "member",
        mount: member.mount,
        vehicle: member.vehicle,
        vehicleSlot: member.vehicleSlot,
      };
    }).filter(m => m !== null);
  }

  /**
   * Find slowest party member
   */
  _getSlowestMember() {
    const members = this._prepareMembers();
    if (members.length === 0) return null;

    return members.reduce((slowest, member) => {
      if (!slowest || member.expeditionSpeed < slowest.expeditionSpeed) {
        return member;
      }
      return slowest;
    }, null);
  }

  /**
   * Prepare vehicle/mount data from owned items
   */
  _prepareVehicles() {
    // Get all vehicle items owned by this travel party
    const vehicleItems = this.actor.items.filter(i => i.type === "vehicle");

    return vehicleItems.map((vehicle) => {
      const v = vehicle.system;

      // Determine if vehicle is overloaded
      const isHeavy = v.cargo.current > v.cargo.normal;
      const currentSpeed = isHeavy ? v.speed.expeditionHeavy : v.speed.expedition;

      return {
        id: vehicle.id,
        item: vehicle,
        name: vehicle.name,
        type: v.vehicleType,
        driver: v.slots.driver,
        passengers: v.slots.passengers || [],
        passengerCount: (v.slots.passengers || []).length,
        passengerCapacity: v.crew.passengers,
        cargo: v.cargo,
        cargoLoad: isHeavy ? "Heavy" : "Normal",
        speed: currentSpeed,
        isHeavy: isHeavy,
        animals: `${v.animals.count} ${v.animals.type}`,
      };
    });
  }

  /**
   * Calculate final movement speed and time per hex
   *
   * ACKS Speed System:
   * - expeditionSpeed = miles per DAY (e.g., 24 mi/day)
   * - Default travel = 8 hours/day
   * - Hourly speed = expeditionSpeed ÷ 8 (e.g., 3 mi/hr)
   */
  _calculateMovement() {
    const slowest = this._getSlowestMember();
    const baseMilesPerDay = slowest?.expeditionSpeed || 24;
    const hoursPerDay = this.actor.system.movement.hoursPerDay || 8;

    const terrain = this.actor.system.travel.currentTerrain || "grassland";
    const terrainData = TERRAIN_CONFIG.terrainTypes[terrain];
    const terrainMultiplier = terrainData?.movementMultiplier || 1;

    // Road multiplier (if on road)
    let roadMultiplier = 1;
    const roadType = this.actor.system.travel.currentRoad;
    if (roadType) {
      const roadData = TERRAIN_CONFIG.roadTypes[roadType];
      // TODO: Check if party has driver with proficiency
      const hasDriverProficiency = false;
      roadMultiplier = hasDriverProficiency
        ? roadData.drivingMultiplier
        : roadData.speedMultiplier;
    }

    // Weather multiplier
    let weatherMultiplier = 1;
    const weather = this.actor.system.travel.currentWeather || "clear";
    const weatherData = TERRAIN_CONFIG.weatherConditions[weather];
    if (weatherData) {
      weatherMultiplier = 1 + (weatherData.movementModifier || 0);
    }

    // Final calculation (all multipliers apply to daily distance)
    const finalMultiplier = terrainMultiplier * roadMultiplier * weatherMultiplier;
    const finalMilesPerDay = Math.floor(baseMilesPerDay * finalMultiplier);

    // Convert to hourly speed
    const baseMilesPerHour = baseMilesPerDay / hoursPerDay;
    const finalMilesPerHour = finalMilesPerDay / hoursPerDay;

    // Calculate time per hex using Hexplorer's formula
    // Hexplorer formula: hoursPerHex = hexDistance / (tokenSpeed * cellSpeedMultiplier)
    // We store base hourly speed in token, Hexplorer applies terrain multiplier from cell
    let timePerHex = null;
    let hexDistance = null;
    if (canvas?.scene?.grid) {
      hexDistance = canvas.scene.grid.distance || 6;
      if (finalMilesPerHour > 0) {
        // Calculate expected time with all multipliers applied
        timePerHex = hexDistance / finalMilesPerHour;
      }
    }

    return {
      baseMilesPerDay,
      baseMilesPerHour,
      terrainMultiplier,
      roadMultiplier,
      weatherMultiplier,
      finalMultiplier,
      finalMilesPerDay,
      finalMilesPerHour,
      hoursPerDay,
      hexDistance,
      timePerHex,
      terrainLabel: terrainData?.label || terrain,
      roadLabel: roadType ? TERRAIN_CONFIG.roadTypes[roadType]?.label : "None",
      weatherLabel: weatherData?.label || weather,
    };
  }

  /**
   * Get road types for dropdown
   */
  _getRoadTypes() {
    return [
      { key: "", label: "None" },
      ...Object.entries(TERRAIN_CONFIG.roadTypes).map(([key, road]) => ({
        key,
        label: road.label,
      })),
    ];
  }

  /**
   * Get weather types for dropdown
   */
  _getWeatherTypes() {
    return Object.entries(TERRAIN_CONFIG.weatherConditions).map(([key, weather]) => ({
      key,
      label: weather.label,
    }));
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Member management
    html.find(".add-member").click(this._onAddMember.bind(this));
    html.find(".remove-member").click(this._onRemoveMember.bind(this));

    // Vehicle management
    html.find(".create-vehicle").click(this._onCreateVehicle.bind(this));
    html.find(".edit-vehicle").click(this._onEditVehicle.bind(this));
    html.find(".delete-vehicle").click(this._onDeleteVehicle.bind(this));
    html.find(".item-name.rollable").click(this._onEditVehicle.bind(this));

    // Travel controls
    html.find(".toggle-travel").click(this._onToggleTravel.bind(this));

    // Terrain/road/weather selection
    html.find('select[name="system.travel.currentTerrain"]').change(
      this._onTerrainChange.bind(this)
    );
    html.find('select[name="system.travel.currentRoad"]').change(
      this._onRoadChange.bind(this)
    );
    html.find('select[name="system.travel.currentWeather"]').change(
      this._onWeatherChange.bind(this)
    );
    html.find(".detect-terrain").click(this._onDetectTerrain.bind(this));
  }

  /**
   * Add member to party
   */
  async _onAddMember(event) {
    event.preventDefault();

    // Show actor picker dialog
    const actors = game.actors.filter(a => a.type === "character");
    const options = actors.map(a => `<option value="${a.id}">${a.name}</option>`).join("");

    const content = `
      <form>
        <div class="form-group">
          <label>Select Character:</label>
          <select name="actorId" style="width: 100%;">
            ${options}
          </select>
        </div>
      </form>
    `;

    const actorId = await Dialog.prompt({
      title: "Add Party Member",
      content: content,
      callback: (html) => html.find('[name="actorId"]').val(),
    });

    if (!actorId) return;

    // Add to members array
    const members = this.actor.system.members || [];
    members.push({
      actorId: actorId,
      role: "member",
      mount: null,
      vehicle: null,
      vehicleSlot: null,
    });

    await this.actor.update({ "system.members": members });
    await this._syncTokenSpeed();
  }

  /**
   * Remove member from party
   */
  async _onRemoveMember(event) {
    event.preventDefault();
    const actorId = event.currentTarget.dataset.actorId;

    const members = this.actor.system.members.filter(m => m.actorId !== actorId);
    await this.actor.update({ "system.members": members });
    await this._syncTokenSpeed();
  }

  /**
   * Create a new vehicle
   */
  async _onCreateVehicle(event) {
    event.preventDefault();

    const itemData = {
      name: "New Vehicle",
      type: "vehicle",
      system: {
        vehicleType: "cart",
        crew: { required: 1, passengers: 0 },
        animals: { type: "heavy horse", count: 1 },
        speed: { encounter: 60, encounterHeavy: 30, expedition: 12, expeditionHeavy: 6 },
        cargo: { normal: 80, heavy: 120, current: 0 },
        combat: { ac: 0, hp: 2 },
        cost: { value: 50, currency: "gp" },
        slots: { driver: null, passengers: [], cargo: [] }
      }
    };

    const item = await this.actor.createEmbeddedDocuments("Item", [itemData]);
    item[0].sheet.render(true);
  }

  /**
   * Edit a vehicle
   */
  async _onEditVehicle(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (item) {
      item.sheet.render(true);
    }
  }

  /**
   * Delete a vehicle
   */
  async _onDeleteVehicle(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    const confirmed = await Dialog.confirm({
      title: "Delete Vehicle",
      content: `<p>Are you sure you want to delete <strong>${item.name}</strong>?</p>`,
      defaultYes: false
    });

    if (confirmed) {
      await item.delete();
      await this._syncTokenSpeed();
    }
  }

  /**
   * Toggle travel state
   */
  async _onToggleTravel(event) {
    event.preventDefault();

    const active = this.actor.system.travel.active;

    if (!active) {
      // Start travel
      await this.actor.update({
        "system.travel.active": true,
        "system.travel.hoursToday": 0,
      });

      ui.notifications.info("Travel started. Encounters will be rolled hourly.");
    } else {
      // Stop travel
      await this.actor.update({
        "system.travel.active": false,
      });

      ui.notifications.info("Travel stopped.");
    }
  }

  /**
   * Sync movement speed to Hexplorer token
   *
   * Hexplorer formula: hoursPerHex = hexDistance / (tokenSpeed * cellSpeedMultiplier)
   *
   * We want:
   * - Terrain multiplier applied via cell.speedMultiplier (set by Hexplorer brush)
   * - Road/weather multipliers applied via token speed
   *
   * So: tokenSpeed = baseMilesPerHour * roadMultiplier * weatherMultiplier
   */
  async _syncTokenSpeed() {
    if (!game.modules.get("hexplorer")?.active) return;

    // Find party token on canvas
    const token = canvas?.tokens?.placeables?.find(
      t => t.actor?.id === this.actor.id
    );

    if (!token) return;

    const movement = this._calculateMovement();

    // Token speed includes road/weather but NOT terrain
    // (Hexplorer applies terrain via cell.speedMultiplier)
    const tokenSpeed = movement.baseMilesPerHour * movement.roadMultiplier * movement.weatherMultiplier;

    await token.document.setFlag("hexplorer", "speed", tokenSpeed);
  }

  /**
   * Terrain selection changed
   */
  async _onTerrainChange(event) {
    const terrain = event.target.value;
    await this.actor.update({ "system.travel.currentTerrain": terrain });
    await this._syncTokenSpeed();
  }

  /**
   * Road selection changed
   */
  async _onRoadChange(event) {
    const road = event.target.value || null;
    await this.actor.update({ "system.travel.currentRoad": road });
    await this._syncTokenSpeed();
  }

  /**
   * Weather selection changed
   */
  async _onWeatherChange(event) {
    const weather = event.target.value;
    await this.actor.update({ "system.travel.currentWeather": weather });
    await this._syncTokenSpeed();
  }

  /**
   * Detect terrain from Hexplorer hex
   */
  async _onDetectTerrain(event) {
    event.preventDefault();

    if (!game.modules.get("hexplorer")?.active) {
      ui.notifications.warn("Hexplorer is not active");
      return;
    }

    // Find party token on canvas
    const token = canvas.tokens.placeables.find(
      t => t.actor?.id === this.actor.id
    );

    if (!token) {
      ui.notifications.warn("No token found for this travel party");
      return;
    }

    // Get hex cell
    const cell = canvas.grid.getOffset({ x: token.x, y: token.y });
    const cellKey = `${cell.i}-${cell.j}`;

    // Read terrain from hex
    const hexData = canvas.scene.getFlag("hexplorer", "exploration")?.[cellKey];

    if (!hexData) {
      ui.notifications.warn("No terrain data in this hex");
      return;
    }

    // Extract ACKS terrain type
    const terrain = hexData.acksTerrainType || null;
    const road = hexData.acksRoadType || null;

    if (terrain) {
      await this.actor.update({
        "system.travel.currentTerrain": terrain,
        "system.travel.currentRoad": road,
      });

      ui.notifications.info(`Detected terrain: ${TERRAIN_CONFIG.terrainTypes[terrain]?.label}`);
    }
  }
}
