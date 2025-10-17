import { templatePath, TextEditorRef, SYSTEM_ID } from "../config.js";
import { AcksLocationActions } from "../dialog/location-actions.js";

// Extend directly from Foundry's ActorSheet to avoid character/monster-specific logic
const BaseActorSheet = foundry.appv1?.sheets?.ActorSheet ?? ActorSheet;

export class AcksActorSheetLocation extends BaseActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["acks", "sheet", "actor", "location"],
      template: templatePath("actors/location-sheet.html"),
      width: 800,
      height: 600,
      resizable: true,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "details",
        },
      ],
    });
  }

  async getData() {
    // Get base data from parent ActorSheet
    const data = await super.getData();

    // Add ACKS config
    data.config = CONFIG.ACKS;

    // Location-specific data preparation
    data.kind = this.actor.system.kind;
    data.isSettlement = this.actor.system.kind === "settlement";
    data.isLair = this.actor.system.kind === "lair";
    data.isVessel = this.actor.system.kind === "vessel";

    // Enrich text fields
    data.enrichedDescription = await TextEditorRef.enrichHTML(
      this.actor.system.details.description,
      { async: true }
    );
    data.enrichedNotes = await TextEditorRef.enrichHTML(
      this.actor.system.details.notes,
      { async: true }
    );

    // Prepare linked documents
    data.linkedScenes = await this._prepareLinkedScenes() || [];
    data.linkedJournals = await this._prepareLinkedJournals() || [];
    data.linkedActors = await this._prepareLinkedActors() || [];

    // Prepare actions
    data.actions = this._prepareActions() || [];

    // Prepare edges
    data.edges = await this._prepareEdges() || [];

    // Prepare kind-specific data
    if (data.isSettlement) {
      data.marketClassLabel = this._getMarketClassLabel(this.actor.system.market.class);
      data.services = this._prepareServices();
    }

    if (data.isLair) {
      data.occupantActors = await this._prepareOccupants() || [];
      data.keyActorObjects = await this._prepareKeyActors() || [];
    }

    if (data.isVessel) {
      data.crewActors = await this._prepareCrewActors() || [];
      data.berthActors = await this._prepareBerthActors() || [];
      data.voyageProgress = this._calculateVoyageProgress() || { percent: 0, label: "Not underway" };
    }

    // Prepare cadence checks
    data.cadenceChecks = this._prepareCadenceChecks() || [];

    // Prepare actors at this location (for P2 actions window)
    data.actorsAtLocation = this._prepareActorsAtLocation() || [];

    return data;
  }

  /* -------------------------------------------- */
  /*  Data Preparation Helpers                    */
  /* -------------------------------------------- */

  async _prepareLinkedScenes() {
    const sceneIds = this.actor.system.links.scenes || [];
    return sceneIds.map(id => {
      const scene = game.scenes.get(id);
      return scene ? { id: scene.id, name: scene.name, uuid: scene.uuid } : null;
    }).filter(s => s !== null);
  }

  async _prepareLinkedJournals() {
    const journalIds = this.actor.system.links.journals || [];
    return journalIds.map(id => {
      const journal = game.journal.get(id);
      return journal ? { id: journal.id, name: journal.name, uuid: journal.uuid } : null;
    }).filter(j => j !== null);
  }

  async _prepareLinkedActors() {
    const actorIds = this.actor.system.links.actors || [];
    return actorIds.map(id => {
      const actor = game.actors.get(id);
      return actor ? { id: actor.id, name: actor.name, type: actor.type, uuid: actor.uuid } : null;
    }).filter(a => a !== null);
  }

  _prepareActions() {
    return (this.actor.system.actions || []).map(action => ({
      ...action,
      timeCostLabel: this._getTimeCostLabel(action.timeCost),
    }));
  }

  async _prepareEdges() {
    const edges = this.actor.system.edges || [];
    return Promise.all(edges.map(async edge => {
      let destinationName = "Unknown";
      if (edge.to) {
        const destActor = await fromUuid(edge.to);
        if (destActor) {
          destinationName = destActor.name;
        }
      }
      return {
        ...edge,
        destinationName,
      };
    }));
  }

  _prepareCadenceChecks() {
    return (this.actor.system.cadence?.checks || []).map(check => ({
      ...check,
      frequencyLabel: check.frequency || "manual",
    }));
  }

  _prepareServices() {
    const services = this.actor.system.services || {};
    return {
      lodging: services.lodging || { available: false, costPerDay: 0, quality: "poor" },
      healing: services.healing || { available: false, maxLevel: 0 },
      training: services.training || { available: false, trainers: [] },
      guilds: services.guilds || [],
      temples: services.temples || [],
      shipyard: services.shipyard || { available: false, dockingFee: 0, repairRate: 0 },
    };
  }

  _prepareActorsAtLocation() {
    // Get all actors with currentLocation flag matching this location
    return game.actors.filter(actor => {
      const currentLocationId = actor.getFlag(SYSTEM_ID, "currentLocation");
      return currentLocationId === this.actor.id;
    }).map(actor => ({
      id: actor.id,
      name: actor.name,
      type: actor.type,
      uuid: actor.uuid,
    }));
  }

  async _prepareOccupants() {
    const occupantIds = this.actor.system.lair?.currentOccupants || [];
    const actors = [];
    for (const uuid of occupantIds) {
      const actor = await fromUuid(uuid);
      if (actor) {
        actors.push({ id: actor.id, name: actor.name, uuid });
      }
    }
    return actors;
  }

  async _prepareKeyActors() {
    const keyActorIds = this.actor.system.lair?.keyActors || [];
    const actors = [];
    for (const uuid of keyActorIds) {
      const actor = await fromUuid(uuid);
      if (actor) {
        actors.push({ id: actor.id, name: actor.name, uuid });
      }
    }
    return actors;
  }

  async _prepareCrewActors() {
    const crewIds = this.actor.system.vessel?.crew?.current || [];
    const actors = [];
    for (const uuid of crewIds) {
      const actor = await fromUuid(uuid);
      if (actor) {
        actors.push({ id: actor.id, name: actor.name, uuid });
      }
    }
    return actors;
  }

  async _prepareBerthActors() {
    const berthIds = this.actor.system.vessel?.berths?.occupied || [];
    const actors = [];
    for (const uuid of berthIds) {
      const actor = await fromUuid(uuid);
      if (actor) {
        actors.push({ id: actor.id, name: actor.name, uuid });
      }
    }
    return actors;
  }

  _calculateVoyageProgress() {
    const voyage = this.actor.system.vessel?.voyage;
    if (!voyage || !voyage.totalHours || voyage.totalHours === 0) {
      return { percent: 0, label: "Not underway" };
    }
    const percent = Math.min(100, (voyage.progressHours / voyage.totalHours) * 100);
    return {
      percent: percent.toFixed(0),
      label: `${voyage.progressHours} / ${voyage.totalHours} hours`,
    };
  }

  /* -------------------------------------------- */
  /*  Label Helpers                               */
  /* -------------------------------------------- */

  _getMarketClassLabel(classNum) {
    const labels = {
      1: "Class I (Thorp)",
      2: "Class II (Hamlet)",
      3: "Class III (Village)",
      4: "Class IV (Town)",
      5: "Class V (City)",
      6: "Class VI (Metropolis)",
    };
    return labels[classNum] || `Class ${classNum}`;
  }

  _getTimeCostLabel(timeCost) {
    if (!timeCost) return "Instant";
    const parts = [];
    if (timeCost.watches) parts.push(`${timeCost.watches} watch${timeCost.watches > 1 ? "es" : ""}`);
    if (timeCost.days) parts.push(`${timeCost.days} day${timeCost.days > 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") : "Instant";
  }

  /* -------------------------------------------- */
  /*  Event Listeners                             */
  /* -------------------------------------------- */

  activateListeners(html) {
    // Call parent listeners (safe now that we extend ActorSheet directly)
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Kind selector
    html.find(".kind-select").change(this._onKindChange.bind(this));

    // Links tab
    html.find(".link-scene").click(this._onLinkScene.bind(this));
    html.find(".link-journal").click(this._onLinkJournal.bind(this));
    html.find(".link-actor").click(this._onLinkActor.bind(this));
    html.find(".unlink-document").click(this._onUnlinkDocument.bind(this));

    // Actions tab
    html.find(".action-create").click(this._onActionCreate.bind(this));
    html.find(".action-edit").click(this._onActionEdit.bind(this));
    html.find(".action-delete").click(this._onActionDelete.bind(this));

    // Edges tab
    html.find(".edge-create").click(this._onEdgeCreate.bind(this));
    html.find(".edge-edit").click(this._onEdgeEdit.bind(this));
    html.find(".edge-delete").click(this._onEdgeDelete.bind(this));

    // Cadence tab
    html.find(".cadence-create").click(this._onCadenceCreate.bind(this));
    html.find(".cadence-edit").click(this._onCadenceEdit.bind(this));
    html.find(".cadence-delete").click(this._onCadenceDelete.bind(this));

    // Lair-specific
    html.find(".mark-cleared").click(this._onMarkCleared.bind(this));
    html.find(".reset-lair").click(this._onResetLair.bind(this));
    html.find(".remove-occupant").click(this._onRemoveOccupant.bind(this));

    // Vessel-specific
    html.find(".remove-crew").click(this._onRemoveCrew.bind(this));
    html.find(".remove-berth").click(this._onRemoveBerth.bind(this));

    // Market-specific
    html.find(".generate-stock").click(this._onGenerateStock.bind(this));
    html.find(".restock-now").click(this._onRestockNow.bind(this));

    // P2 - Location Actions
    html.find(".view-location-actions").click(this._onViewLocationActions.bind(this));
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  async _onKindChange(event) {
    event.preventDefault();
    const newKind = event.currentTarget.value;
    await this.actor.update({ "system.kind": newKind });
  }

  async _onLinkScene(event) {
    event.preventDefault();
    // TODO: Implement scene linking dialog/picker
    ui.notifications.info("Scene linking will be implemented in a future update");
  }

  async _onLinkJournal(event) {
    event.preventDefault();
    // TODO: Implement journal linking dialog/picker
    ui.notifications.info("Journal linking will be implemented in a future update");
  }

  async _onLinkActor(event) {
    event.preventDefault();
    // TODO: Implement actor linking dialog/picker
    ui.notifications.info("Actor linking will be implemented in a future update");
  }

  async _onUnlinkDocument(event) {
    event.preventDefault();
    const target = event.currentTarget;
    const documentId = target.dataset.documentId;
    const documentType = target.dataset.documentType;

    if (!documentId || !documentType) return;

    const linkPath = `system.links.${documentType}`;
    const currentLinks = foundry.utils.getProperty(this.actor, linkPath) || [];
    const newLinks = currentLinks.filter(id => id !== documentId);

    await this.actor.update({ [linkPath]: newLinks });
  }

  async _onActionCreate(event) {
    event.preventDefault();
    const actions = foundry.utils.duplicate(this.actor.system.actions || []);
    const newAction = {
      id: foundry.utils.randomID(),
      name: "New Action",
      description: "",
      icon: "",
      macro: null,
      rollTable: null,
      timeCost: { watches: 0, days: 0 },
      requirements: { items: [], gold: 0, proficiencies: [], other: "" },
    };
    actions.push(newAction);
    await this.actor.update({ "system.actions": actions });
  }

  async _onActionEdit(event) {
    event.preventDefault();
    // TODO: Implement action editor dialog
    ui.notifications.info("Action editing will be implemented in a future update");
  }

  async _onActionDelete(event) {
    event.preventDefault();
    const actionId = event.currentTarget.dataset.actionId;
    const actions = foundry.utils.duplicate(this.actor.system.actions || []);
    const newActions = actions.filter(a => a.id !== actionId);
    await this.actor.update({ "system.actions": newActions });
  }

  async _onEdgeCreate(event) {
    event.preventDefault();
    const edges = foundry.utils.duplicate(this.actor.system.edges || []);
    const newEdge = {
      id: foundry.utils.randomID(),
      name: "New Route",
      to: null,
      nominalHours: 24,
      requirements: { items: [], other: "" },
      riskTable: null,
      cost: { gp: 0 },
    };
    edges.push(newEdge);
    await this.actor.update({ "system.edges": edges });
  }

  async _onEdgeEdit(event) {
    event.preventDefault();
    // TODO: Implement edge editor dialog
    ui.notifications.info("Edge editing will be implemented in a future update");
  }

  async _onEdgeDelete(event) {
    event.preventDefault();
    const edgeId = event.currentTarget.dataset.edgeId;
    const edges = foundry.utils.duplicate(this.actor.system.edges || []);
    const newEdges = edges.filter(e => e.id !== edgeId);
    await this.actor.update({ "system.edges": newEdges });
  }

  async _onCadenceCreate(event) {
    event.preventDefault();
    const checks = foundry.utils.duplicate(this.actor.system.cadence?.checks || []);
    const newCheck = {
      id: foundry.utils.randomID(),
      name: "New Check",
      frequency: "day",
      rollTable: null,
      macro: null,
      conditions: { inLair: false, atSea: false },
    };
    checks.push(newCheck);
    await this.actor.update({ "system.cadence.checks": checks });
  }

  async _onCadenceEdit(event) {
    event.preventDefault();
    // TODO: Implement cadence check editor dialog
    ui.notifications.info("Cadence check editing will be implemented in a future update");
  }

  async _onCadenceDelete(event) {
    event.preventDefault();
    const checkId = event.currentTarget.dataset.checkId;
    const checks = foundry.utils.duplicate(this.actor.system.cadence?.checks || []);
    const newChecks = checks.filter(c => c.id !== checkId);
    await this.actor.update({ "system.cadence.checks": newChecks });
  }

  async _onMarkCleared(event) {
    event.preventDefault();
    const currentTime = game.settings.get(SYSTEM_ID, "gameTime") || 0;
    await this.actor.update({
      "system.lair.cleared": true,
      "system.lair.clearedAt": currentTime,
      "system.lair.clearedBy": game.user.id,
    });
    ui.notifications.info(`${this.actor.name} marked as cleared`);
  }

  async _onResetLair(event) {
    event.preventDefault();
    await this.actor.update({
      "system.lair.cleared": false,
      "system.lair.clearedAt": null,
      "system.lair.clearedBy": null,
      "system.lair.currentOccupants": [],
    });
    ui.notifications.info(`${this.actor.name} has been reset`);
  }

  async _onRemoveOccupant(event) {
    event.preventDefault();
    const uuid = event.currentTarget.dataset.occupantUuid;
    const occupants = foundry.utils.duplicate(this.actor.system.lair?.currentOccupants || []);
    const newOccupants = occupants.filter(id => id !== uuid);
    await this.actor.update({ "system.lair.currentOccupants": newOccupants });
  }

  async _onRemoveCrew(event) {
    event.preventDefault();
    const uuid = event.currentTarget.dataset.crewUuid;
    const crew = foundry.utils.duplicate(this.actor.system.vessel?.crew?.current || []);
    const newCrew = crew.filter(id => id !== uuid);
    await this.actor.update({ "system.vessel.crew.current": newCrew });
  }

  async _onRemoveBerth(event) {
    event.preventDefault();
    const uuid = event.currentTarget.dataset.berthUuid;
    const berths = foundry.utils.duplicate(this.actor.system.vessel?.berths?.occupied || []);
    const newBerths = berths.filter(id => id !== uuid);
    await this.actor.update({ "system.vessel.berths.occupied": newBerths });
  }

  async _onGenerateStock(event) {
    event.preventDefault();
    // TODO: Implement stock generation based on market class
    ui.notifications.info("Stock generation will be implemented in P3");
  }

  async _onRestockNow(event) {
    event.preventDefault();
    // TODO: Implement manual restock
    ui.notifications.info("Manual restock will be implemented in P3");
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);

    // Handle different document types
    if (data.type === "Scene") {
      return this._onDropScene(data);
    } else if (data.type === "JournalEntry") {
      return this._onDropJournal(data);
    } else if (data.type === "Actor") {
      return this._onDropActor(data);
    }

    return super._onDrop(event);
  }

  async _onDropScene(data) {
    const scene = await fromUuid(data.uuid);
    if (!scene) return;

    const scenes = foundry.utils.duplicate(this.actor.system.links.scenes || []);
    if (!scenes.includes(scene.id)) {
      scenes.push(scene.id);
      await this.actor.update({ "system.links.scenes": scenes });

      // Also set flag on the scene
      const linkedLocations = scene.getFlag(SYSTEM_ID, "linkedLocations") || [];
      if (!linkedLocations.includes(this.actor.id)) {
        linkedLocations.push(this.actor.id);
        await scene.setFlag(SYSTEM_ID, "linkedLocations", linkedLocations);
      }

      ui.notifications.info(`Scene "${scene.name}" linked to ${this.actor.name}`);
    }
  }

  async _onDropJournal(data) {
    const journal = await fromUuid(data.uuid);
    if (!journal) return;

    const journals = foundry.utils.duplicate(this.actor.system.links.journals || []);
    if (!journals.includes(journal.id)) {
      journals.push(journal.id);
      await this.actor.update({ "system.links.journals": journals });
      ui.notifications.info(`Journal "${journal.name}" linked to ${this.actor.name}`);
    }
  }

  async _onDropActor(data) {
    const actor = await fromUuid(data.uuid);
    if (!actor || actor.id === this.actor.id) return;

    // Determine where to add the actor based on current tab or kind
    const kind = this.actor.system.kind;

    // Default: add to general links
    const actors = foundry.utils.duplicate(this.actor.system.links.actors || []);
    if (!actors.includes(actor.id)) {
      actors.push(actor.id);
      await this.actor.update({ "system.links.actors": actors });
      ui.notifications.info(`Actor "${actor.name}" linked to ${this.actor.name}`);
    }

    // TODO: In future, detect active tab and add to crew/occupants/keyActors accordingly
  }

  async _onViewLocationActions(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const actorId = button.dataset.actorId;

    if (!actorId) {
      ui.notifications.warn("Please select an actor first");
      return;
    }

    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.error("Actor not found");
      return;
    }

    // Open the location actions window
    new AcksLocationActions(actor, this.actor).render(true);
  }
}
