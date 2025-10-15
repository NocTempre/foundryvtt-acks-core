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
    context.totalMemberCount = this.actor.system.members?.length || 0; // Total individual members
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
   * Groups by name and counts duplicates, tracks vehicle assignments
   */
  _prepareMembers(includeAssignments = true) {
    const members = this.actor.system.members || [];

    // Build assignment map from vehicle items (avoid circular call)
    const assignmentMap = new Map();
    if (includeAssignments) {
      const vehicleItems = this.actor.items.filter(i => i.type === "vehicle");
      vehicleItems.forEach(vehicle => {
        const v = vehicle.system;
        // Crew members
        (v.slots.crew || []).forEach(c => {
          if (c.memberIndex !== undefined) {
            assignmentMap.set(c.memberIndex, {
              type: "crew",
              vehicleName: vehicle.name
            });
          }
        });
        // Passengers
        (v.slots.passengers || []).forEach(p => {
          if (p.memberIndex !== undefined) {
            assignmentMap.set(p.memberIndex, {
              type: "passenger",
              vehicleName: vehicle.name
            });
          }
        });
        // Draft animals
        (v.slots.animals || []).forEach(a => {
          if (a.sourceMemberIndex !== undefined) {
            assignmentMap.set(a.sourceMemberIndex, {
              type: "animal",
              vehicleName: vehicle.name
            });
          }
        });
      });
    }

    // Group members by actor ID (each member entry is separate)
    const grouped = new Map();
    members.forEach((member, memberIndex) => {
      const actor = game.actors.get(member.actorId);
      if (!actor) return;

      const name = actor.name;
      if (!grouped.has(name)) {
        grouped.set(name, {
          name: name,
          img: actor.img,
          expeditionSpeed: actor.system.movementacks?.expedition || 24,
          memberIndices: [], // Track which member array indices
          actorId: member.actorId, // All in group share same actorId
          assigned: [],
          unassignedIndices: [],
        });
      }

      const group = grouped.get(name);
      group.memberIndices.push(memberIndex);

      const assignment = assignmentMap.get(memberIndex);
      if (assignment) {
        group.assigned.push({
          memberIndex: memberIndex,
          ...assignment
        });
      } else {
        group.unassignedIndices.push(memberIndex);
      }
    });

    // Convert to array and add display properties
    return Array.from(grouped.values()).map(group => ({
      ...group,
      id: group.actorId, // Use actorId for reference
      count: group.memberIndices.length,
      displayName: group.count > 1 ? `${group.name} (${group.count})` : group.name,
      hasAssignments: group.assigned.length > 0,
      assignmentSummary: group.assigned.map(a => `${a.type}: ${a.vehicleName}`).join(", "),
    }));
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

      // Calculate total pulling power from assigned animals (sum of normal loads in stone)
      const assignedAnimals = v.slots.animals || [];
      const totalPullingPower = this._calculatePullingPower(assignedAnimals);
      const minLoad = v.animals.minLoad || 40;
      const maxLoad = v.animals.maxLoad || 80;
      const minCount = v.animals.minCount || 1;
      const maxCount = v.animals.maxCount || 2;

      // Check if vehicle has valid animal configuration
      const hasEnoughAnimals = totalPullingPower >= minLoad && assignedAnimals.length >= minCount;
      const tooManyAnimals = assignedAnimals.length > maxCount || totalPullingPower > maxLoad;

      return {
        id: vehicle.id,
        item: vehicle,
        name: vehicle.name,
        type: v.vehicleType,
        crew: v.slots.crew || [],
        crewCount: (v.slots.crew || []).length,
        crewRequired: v.crew.required,
        passengers: v.slots.passengers || [],
        passengerCount: (v.slots.passengers || []).length,
        passengerCapacity: v.crew.passengers,
        animals: assignedAnimals,
        animalCount: assignedAnimals.length,
        animalMinLoad: minLoad,
        animalMaxLoad: maxLoad,
        animalMinCount: minCount,
        animalMaxCount: maxCount,
        animalPower: totalPullingPower,
        hasEnoughAnimals: hasEnoughAnimals,
        tooManyAnimals: tooManyAnimals,
        cargo: v.cargo,
        cargoLoad: isHeavy ? "Heavy" : "Normal",
        speed: currentSpeed,
        isHeavy: isHeavy,
      };
    });
  }

  /**
   * Calculate total pulling power from animals (sum of normal load capacities in stone)
   */
  _calculatePullingPower(animals) {
    return animals.reduce((total, animal) => {
      return total + (animal.normalLoad || 0);
    }, 0);
  }

  /**
   * Calculate final movement speed and time per hex
   *
   * ACKS Speed System:
   * - expeditionSpeed = miles per DAY (e.g., 24 mi/day)
   * - Default travel = 8 hours/day
   * - Hourly speed = expeditionSpeed ÷ 8 (e.g., 3 mi/hr)
   *
   * Priority: vehicles (if present and used) > on-foot members
   */
  _calculateMovement() {
    // Check if party is using vehicles
    const vehicles = this._prepareVehicles();
    const slowestVehicle = vehicles.length > 0 ? vehicles.reduce((slowest, v) =>
      !slowest || v.speed < slowest.speed ? v : slowest, null) : null;

    // Use vehicle speed if available, otherwise use slowest member on foot
    const slowest = this._getSlowestMember();
    const baseMilesPerDay = slowestVehicle ? slowestVehicle.speed : (slowest?.expeditionSpeed || 24);
    const hoursPerDay = this.actor.system.movement.hoursPerDay || 8;
    const speedSource = slowestVehicle ? `${slowestVehicle.name} (vehicle)` : (slowest ? `${slowest.name} (on foot)` : "Default");

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
      speedSource,
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
   * Override to handle drops (both actors and items)
   */
  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return super._onDrop(event);
    }

    // Handle actor drops (add as party member)
    if (data.type === "Actor") {
      let actor;
      if (data.uuid) {
        actor = await fromUuid(data.uuid);
      } else if (data.id) {
        actor = game.actors.get(data.id);
      }
      if (!actor) return;

      // Only allow characters and monsters
      if (actor.type !== "character" && actor.type !== "monster") {
        ui.notifications.warn("Only characters and monsters can be added to the party");
        return;
      }

      // Prompt for quantity
      const content = `
        <form>
          <div class="form-group">
            <label>Add to party: <strong>${actor.name}</strong></label>
            ${actor.type === "monster" ? '<p style="color: #666;">Monster</p>' : ''}
            ${actor.system.draftAnimal?.enabled ? '<p style="color: #00cc00;">Draft Animal (' + actor.system.draftAnimal.normalLoad + ' stone)</p>' : ''}
          </div>
          <div class="form-group">
            <label>Quantity:</label>
            <input type="number" name="quantity" value="1" min="1" style="width: 100px;" />
            <p class="hint">Add multiple copies (e.g., 40 for militia or 4 for draft horses)</p>
          </div>
        </form>
      `;

      const quantity = await Dialog.wait({
        title: "Add Party Member",
        content: content,
        buttons: {
          ok: {
            label: "Add",
            callback: (html) => parseInt(html.find('[name="quantity"]').val()) || 1
          },
          cancel: {
            label: "Cancel",
            callback: () => null
          }
        },
        default: "ok"
      });

      if (!quantity) return;

      // Add specified quantity to members array
      const members = this.actor.system.members || [];
      for (let i = 0; i < quantity; i++) {
        members.push({
          actorId: actor.id,
          role: "member",
          mount: null,
          vehicle: null,
          vehicleSlot: null,
        });
      }

      await this.actor.update({ "system.members": members });
      await this._syncTokenSpeed();

      ui.notifications.info(`Added ${quantity}x ${actor.name} to party`);
      return;
    }

    // Handle item drops (call parent for vehicles, etc.)
    return super._onDrop(event);
  }

  /**
   * Override to handle item changes (vehicles added/removed/updated)
   */
  async _onDropItem(event, data) {
    const result = await super._onDropItem(event, data);
    // Sync token speed when vehicles change
    await this._syncTokenSpeed();
    return result;
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

    // Vehicle crew assignment (use event delegation for dynamically added elements)
    html.on("click", ".add-crew", this._onAddCrew.bind(this));
    html.on("click", ".remove-crew", this._onRemoveCrew.bind(this));
    html.on("click", ".add-passenger", this._onAddPassenger.bind(this));
    html.on("click", ".remove-passenger", this._onRemovePassenger.bind(this));
    html.on("click", ".add-animal", this._onAddAnimal.bind(this));
    html.on("click", ".remove-animal", this._onRemoveAnimal.bind(this));

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
   * Add member to party with quantity support
   */
  async _onAddMember(event) {
    event.preventDefault();

    // Show actor picker dialog with quantity (include both characters and monsters)
    const actors = game.actors.filter(a => a.type === "character" || a.type === "monster");
    const options = actors.map(a => {
      const type = a.type === "monster" ? " (Monster)" : "";
      const draftLabel = (a.type === "monster" && a.system.draftAnimal?.enabled) ? " [Draft]" : "";
      return `<option value="${a.id}">${a.name}${type}${draftLabel}</option>`;
    }).join("");

    const content = `
      <form>
        <div class="form-group">
          <label>Select Member:</label>
          <select name="actorId" style="width: 100%;">
            ${options}
          </select>
        </div>
        <div class="form-group">
          <label>Quantity:</label>
          <input type="number" name="quantity" value="1" min="1" style="width: 100px;" />
          <p class="hint">Add multiple copies (e.g., 40 for militia or 4 for draft horses)</p>
        </div>
      </form>
    `;

    const result = await Dialog.wait({
      title: "Add Party Member",
      content: content,
      buttons: {
        ok: {
          label: "Add",
          callback: (html) => ({
            actorId: html.find('[name="actorId"]').val(),
            quantity: parseInt(html.find('[name="quantity"]').val()) || 1
          })
        },
        cancel: {
          label: "Cancel",
          callback: () => null
        }
      },
      default: "ok"
    });

    if (!result || !result.actorId) return;

    // Add specified quantity to members array
    const members = this.actor.system.members || [];
    for (let i = 0; i < result.quantity; i++) {
      members.push({
        actorId: result.actorId,
        role: "member",
        mount: null,
        vehicle: null,
        vehicleSlot: null,
      });
    }

    await this.actor.update({ "system.members": members });
    await this._syncTokenSpeed();
  }

  /**
   * Remove member from party
   */
  async _onRemoveMember(event) {
    event.preventDefault();
    const actorId = event.currentTarget.dataset.actorId;

    const members = this.actor.system.members || [];
    const matchingIndices = members
      .map((m, idx) => m.actorId === actorId ? idx : null)
      .filter(idx => idx !== null);

    if (matchingIndices.length === 0) return;

    const actor = game.actors.get(actorId);
    const actorName = actor?.name || "Unknown";

    // If only one, remove it directly
    if (matchingIndices.length === 1) {
      const updatedMembers = members.filter((_, idx) => idx !== matchingIndices[0]);
      await this.actor.update({ "system.members": updatedMembers });
      await this._syncTokenSpeed();
      return;
    }

    // Multiple copies - ask how many to remove
    const content = `
      <form>
        <div class="form-group">
          <label>Remove <strong>${actorName}</strong> from party</label>
          <p>Currently in party: ${matchingIndices.length}</p>
        </div>
        <div class="form-group">
          <label>Quantity to remove:</label>
          <input type="number" name="quantity" value="${matchingIndices.length}" min="1" max="${matchingIndices.length}" style="width: 100px;" />
        </div>
      </form>
    `;

    const quantity = await Dialog.wait({
      title: "Remove Party Member",
      content: content,
      buttons: {
        ok: {
          label: "Remove",
          callback: (html) => parseInt(html.find('[name="quantity"]').val()) || matchingIndices.length
        },
        cancel: {
          label: "Cancel",
          callback: () => null
        }
      },
      default: "ok"
    });

    if (!quantity) return;

    // Remove the specified quantity (from the end of the list)
    const indicesToRemove = matchingIndices.slice(-quantity);
    const updatedMembers = members.filter((_, idx) => !indicesToRemove.includes(idx));

    await this.actor.update({ "system.members": updatedMembers });
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
        animals: { minLoad: 40, maxLoad: 80, minCount: 1, maxCount: 2 },
        speed: { encounter: 60, encounterHeavy: 30, expedition: 12, expeditionHeavy: 6 },
        cargo: { normal: 80, heavy: 120, current: 0 },
        combat: { ac: 0, hp: 2 },
        cost: { value: 50, currency: "gp" },
        slots: { crew: [], passengers: [], animals: [], cargo: [] }
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
   * Assign a driver to a vehicle
   */
  async _onAssignDriver(event) {
    event.preventDefault();
    const link = event.target.closest('.assign-driver');
    if (!link) return;

    const vehicleId = link.dataset.vehicleId;
    const vehicle = this.actor.items.get(vehicleId);

    if (!vehicle) return;

    // Get all available (unassigned) characters
    const memberGroups = this._prepareMembers();
    const availableMembers = memberGroups.flatMap(group => {
      // For each unassigned member in the group, create an option
      return group.unassignedIndices.map((memberIndex, idx) => ({
        memberIndex: memberIndex,
        name: group.name,
        displayName: group.count > 1
          ? `${group.name} #${idx + 1}`
          : group.name
      }));
    });

    if (availableMembers.length === 0) {
      ui.notifications.warn("No unassigned party members available");
      return;
    }

    const options = availableMembers.map(m =>
      `<option value="${m.memberIndex}">${m.displayName}</option>`
    ).join("");

    const content = `
      <form>
        <div class="form-group">
          <label>Select Driver:</label>
          <select name="memberIndex" style="width: 100%;">
            ${options}
          </select>
        </div>
      </form>
    `;

    const memberIndex = await Dialog.prompt({
      title: "Assign Driver",
      content: content,
      callback: (html) => parseInt(html.find('[name="memberIndex"]').val()),
    });

    if (memberIndex === undefined) return;

    const members = this.actor.system.members;
    const member = members[memberIndex];
    const actor = game.actors.get(member.actorId);
    if (!actor) return;

    // Update vehicle with driver info
    await vehicle.update({
      "system.slots.driver": {
        memberIndex: memberIndex,
        actorId: member.actorId,
        name: actor.name
      }
    });
  }

  /**
   * Remove driver from a vehicle
   */
  async _onRemoveDriver(event) {
    event.preventDefault();
    const link = event.target.closest('.remove-driver');
    if (!link) return;

    const vehicleId = link.dataset.vehicleId;
    const vehicle = this.actor.items.get(vehicleId);

    if (!vehicle) return;

    await vehicle.update({ "system.slots.driver": null });
  }

  /**
   * Add crew member to a vehicle
   */
  async _onAddCrew(event) {
    event.preventDefault();
    const link = event.target.closest('.add-crew');
    if (!link) return;

    const vehicleId = link.dataset.vehicleId;
    const vehicle = this.actor.items.get(vehicleId);

    if (!vehicle) return;

    // Check capacity
    const crew = vehicle.system.slots.crew || [];
    const required = vehicle.system.crew.required;
    if (crew.length >= required) {
      ui.notifications.warn("Vehicle has full crew");
      return;
    }

    // Get all available (unassigned) characters
    const memberGroups = this._prepareMembers();
    const availableMembers = memberGroups.flatMap(group => {
      // For each unassigned member in the group, create an option
      return group.unassignedIndices.map((memberIndex, idx) => ({
        memberIndex: memberIndex,
        name: group.name,
        displayName: group.count > 1
          ? `${group.name} #${idx + 1}`
          : group.name
      }));
    });

    if (availableMembers.length === 0) {
      ui.notifications.warn("No unassigned party members available");
      return;
    }

    const options = availableMembers.map(m =>
      `<option value="${m.memberIndex}">${m.displayName}</option>`
    ).join("");

    const content = `
      <form>
        <div class="form-group">
          <label>Select Crew Member:</label>
          <select name="memberIndex" style="width: 100%;">
            ${options}
          </select>
        </div>
      </form>
    `;

    const memberIndex = await Dialog.prompt({
      title: "Add Crew Member",
      content: content,
      callback: (html) => parseInt(html.find('[name="memberIndex"]').val()),
    });

    if (memberIndex === undefined) return;

    const members = this.actor.system.members;
    const member = members[memberIndex];
    const actor = game.actors.get(member.actorId);
    if (!actor) return;

    // Add crew member
    const updatedCrew = [...crew, {
      memberIndex: memberIndex,
      actorId: member.actorId,
      name: actor.name
    }];

    await vehicle.update({ "system.slots.crew": updatedCrew });
  }

  /**
   * Remove crew member from a vehicle
   */
  async _onRemoveCrew(event) {
    event.preventDefault();
    event.stopPropagation();

    // Find the actual link element (in case user clicked the icon inside)
    const link = event.target.closest('.remove-crew');
    if (!link) {
      console.error("Remove crew link not found");
      return;
    }

    const vehicleId = link.dataset.vehicleId;
    const crewIndex = parseInt(link.dataset.crewIndex);

    const vehicle = this.actor.items.get(vehicleId);
    if (!vehicle) {
      console.error("Vehicle not found:", vehicleId);
      return;
    }

    const crew = vehicle.system.slots.crew || [];
    const updatedCrew = crew.filter((_, index) => index !== crewIndex);

    await vehicle.update({ "system.slots.crew": updatedCrew });
    this.render();
  }

  /**
   * Add a passenger to a vehicle
   */
  async _onAddPassenger(event) {
    event.preventDefault();
    const link = event.target.closest('.add-passenger');
    if (!link) return;

    const vehicleId = link.dataset.vehicleId;
    const vehicle = this.actor.items.get(vehicleId);

    if (!vehicle) return;

    // Check capacity
    const passengers = vehicle.system.slots.passengers || [];
    const capacity = vehicle.system.crew.passengers;
    if (passengers.length >= capacity) {
      ui.notifications.warn("Vehicle is at full passenger capacity");
      return;
    }

    // Get all available (unassigned) characters
    const memberGroups = this._prepareMembers();
    const availableMembers = memberGroups.flatMap(group => {
      // For each unassigned member in the group, create an option
      return group.unassignedIndices.map((memberIndex, idx) => ({
        memberIndex: memberIndex,
        name: group.name,
        displayName: group.count > 1
          ? `${group.name} #${idx + 1}`
          : group.name
      }));
    });

    if (availableMembers.length === 0) {
      ui.notifications.warn("No unassigned party members available");
      return;
    }

    const options = availableMembers.map(m =>
      `<option value="${m.memberIndex}">${m.displayName}</option>`
    ).join("");

    const content = `
      <form>
        <div class="form-group">
          <label>Select Passenger:</label>
          <select name="memberIndex" style="width: 100%;">
            ${options}
          </select>
        </div>
      </form>
    `;

    const memberIndex = await Dialog.prompt({
      title: "Add Passenger",
      content: content,
      callback: (html) => parseInt(html.find('[name="memberIndex"]').val()),
    });

    if (memberIndex === undefined) return;

    const members = this.actor.system.members;
    const member = members[memberIndex];
    const actor = game.actors.get(member.actorId);
    if (!actor) return;

    // Add passenger
    const updatedPassengers = [...passengers, {
      memberIndex: memberIndex,
      actorId: member.actorId,
      name: actor.name
    }];

    await vehicle.update({ "system.slots.passengers": updatedPassengers });
  }

  /**
   * Remove a passenger from a vehicle
   */
  async _onRemovePassenger(event) {
    event.preventDefault();
    event.stopPropagation(); // Prevent event bubbling

    // Find the actual link element (in case user clicked the icon inside)
    const link = event.target.closest('.remove-passenger');
    if (!link) {
      console.error("Remove passenger link not found");
      return;
    }

    const vehicleId = link.dataset.vehicleId;
    const passengerIndex = parseInt(link.dataset.passengerIndex);

    console.log("Remove passenger:", { vehicleId, passengerIndex }); // Debug log

    const vehicle = this.actor.items.get(vehicleId);
    if (!vehicle) {
      console.error("Vehicle not found:", vehicleId);
      console.error("Available vehicles:", this.actor.items.filter(i => i.type === "vehicle").map(v => ({ id: v.id, name: v.name })));
      return;
    }

    const passengers = vehicle.system.slots.passengers || [];
    console.log("Current passengers:", passengers); // Debug log

    const updatedPassengers = passengers.filter((_, index) => index !== passengerIndex);
    console.log("Updated passengers:", updatedPassengers); // Debug log

    await vehicle.update({ "system.slots.passengers": updatedPassengers });
    // Force re-render to update the display
    this.render();
  }

  /**
   * Add an animal to a vehicle
   */
  async _onAddAnimal(event) {
    event.preventDefault();
    const link = event.target.closest('.add-animal');
    if (!link) return;

    const vehicleId = link.dataset.vehicleId;
    const vehicle = this.actor.items.get(vehicleId);

    if (!vehicle) return;

    // Get available animals from party members and items
    const availableAnimals = this._getAvailableAnimals();

    if (availableAnimals.length === 0) {
      ui.notifications.warn("No available draft animals. Add animals to party members' inventories or create animal actors.");
      return;
    }

    const options = availableAnimals.map(a =>
      `<option value="${a.id}" data-type="${a.sourceType}">${a.name} (${a.normalLoad} stone)</option>`
    ).join("");

    const content = `
      <form>
        <div class="form-group">
          <label>Select Animal:</label>
          <select name="animalId" style="width: 100%;">
            ${options}
          </select>
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: "Add Draft Animal",
      content: content,
      callback: (html) => html.find('[name="animalId"]').val(),
    });

    if (!result) return;

    const selectedAnimal = availableAnimals.find(a => a.id === result);
    if (!selectedAnimal) return;

    // Add animal to vehicle
    const animals = vehicle.system.slots.animals || [];
    const updatedAnimals = [...animals, {
      id: selectedAnimal.id,
      sourceType: selectedAnimal.sourceType,
      sourceMemberIndex: selectedAnimal.sourceMemberIndex,
      name: selectedAnimal.name,
      normalLoad: selectedAnimal.normalLoad,
    }];

    await vehicle.update({ "system.slots.animals": updatedAnimals });
  }

  /**
   * Get available draft animals from party members and items
   * Excludes animals already assigned to vehicles
   */
  _getAvailableAnimals() {
    const animals = [];

    // Build set of already-assigned member indices
    const assignedIndices = new Set();
    const vehicleItems = this.actor.items.filter(i => i.type === "vehicle");
    vehicleItems.forEach(vehicle => {
      const assignedAnimals = vehicle.system.slots.animals || [];
      assignedAnimals.forEach(animal => {
        if (animal.sourceMemberIndex !== undefined) {
          assignedIndices.add(animal.sourceMemberIndex);
        }
      });
    });

    // Check party members for animals
    const members = this.actor.system.members || [];
    members.forEach((member, memberIndex) => {
      // Skip if already assigned
      if (assignedIndices.has(memberIndex)) return;

      const actor = game.actors.get(member.actorId);
      if (!actor) return;

      // If the actor itself is a draft animal (monster type with draftAnimal.enabled flag)
      if (actor.type === "monster" && this._isDraftAnimal(actor)) {
        const normalLoad = actor.system.draftAnimal?.normalLoad || 0;
        animals.push({
          id: actor.id,
          sourceType: "actor",
          sourceMemberIndex: memberIndex,
          name: actor.name,
          normalLoad: normalLoad,
        });
      }
    });

    return animals;
  }

  /**
   * Check if an actor is a draft animal (has draftAnimal.enabled flag)
   */
  _isDraftAnimal(actor) {
    return actor.system.draftAnimal?.enabled === true;
  }

  /**
   * Remove an animal from a vehicle
   */
  async _onRemoveAnimal(event) {
    event.preventDefault();
    event.stopPropagation();

    const link = event.target.closest('.remove-animal');
    if (!link) {
      console.error("Remove animal link not found");
      return;
    }

    // Get vehicle ID from parent div
    const animalContainer = link.closest('[data-vehicle-id]');
    if (!animalContainer) {
      console.error("Animal container with vehicle-id not found");
      return;
    }

    const vehicleId = animalContainer.dataset.vehicleId;
    const animalIndex = parseInt(link.dataset.animalIndex);

    const vehicle = this.actor.items.get(vehicleId);
    if (!vehicle) {
      console.error("Vehicle not found:", vehicleId);
      return;
    }

    const animals = vehicle.system.slots.animals || [];
    const updatedAnimals = animals.filter((_, index) => index !== animalIndex);

    await vehicle.update({ "system.slots.animals": updatedAnimals });
    this.render();
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
