import { templatePath, SYSTEM_ID } from "../config.js";

export class AcksJournalEntryEditor extends FormApplication {
  constructor(actor, entryData = {}, options = {}) {
    super(entryData, options);
    this.actor = actor;
    this.entryData = entryData;
    this.isNew = !entryData.id;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["acks", "dialog", "journal-entry-editor"],
      template: templatePath("actors/dialogs/journal-entry-editor.html"),
      width: 600,
      height: "auto",
      title: "Journal Entry",
      closeOnSubmit: true,
      submitOnChange: false,
      submitOnClose: false,
      resizable: true,
    });
  }

  get title() {
    const typeLabels = {
      identity: "Identity",
      stash: "Stash",
      bond: "Bond",
      advancement: "Advancement",
      downtime: "Downtime",
      desire: "Desire / Quest",
      lead: "Lead",
      grudge: "Grudge",
      travel: "Travel",
      legacy: "Legacy",
    };
    const typeLabel = typeLabels[this.entryData.type] || "Journal Entry";
    return this.isNew ? `New ${typeLabel}` : `Edit ${typeLabel}`;
  }

  getData() {
    const data = super.getData();

    const typeLabels = {
      identity: "Identity",
      stash: "Stash",
      bond: "Bond",
      advancement: "Advancement",
      downtime: "Downtime",
      desire: "Desire / Quest",
      lead: "Lead",
      grudge: "Grudge",
      travel: "Travel",
      legacy: "Legacy",
    };

    data.entryType = this.entryData.type;
    data.typeLabel = typeLabels[this.entryData.type] || "Unknown";
    data.data = this.entryData.data || {};
    data.gameDate = this.entryData.gameDate || "";
    data.gmOnly = this.entryData.gmOnly || false;
    data.owner = true;
    data.editable = true;

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('button[name="cancel"]').click((ev) => {
      ev.preventDefault();
      this.close();
    });
  }

  async _updateObject(event, formData) {
    // Prepare the entry data
    const entryData = {
      id: this.entryData.id || foundry.utils.randomID(),
      type: this.entryData.type,
      data: {},
      timestamp: this.entryData.timestamp || Date.now(),
      gameDate: formData.gameDate?.trim() || "",
      gmOnly: formData.gmOnly || false,
    };

    // Extract all data fields (including HTML from editors)
    for (const [key, value] of Object.entries(formData)) {
      if (key.startsWith("data.")) {
        const fieldName = key.substring(5);
        // Store as-is, including HTML from rich text editors
        entryData.data[fieldName] = value || "";
      }
    }

    // Calculate stash total if this is a stash entry
    if (entryData.type === "stash") {
      const gold = parseInt(entryData.data.wealthGold) || 0;
      const silver = parseInt(entryData.data.wealthSilver) || 0;
      const copper = parseInt(entryData.data.wealthCopper) || 0;
      entryData.data.wealthTotal = gold + (silver / 10) + (copper / 100);
    }

    // Get or create the character's journal
    let journal = await this._getOrCreateJournal();
    if (!journal) {
      ui.notifications.error("Failed to create or access character journal");
      return;
    }

    // Create or update the journal entry page
    const pageData = await this._createOrUpdatePage(journal, entryData);

    // Defensive check for pageData
    if (!pageData || (!pageData.id && !pageData._id)) {
      ui.notifications.error("Failed to get journal page ID");
      return;
    }

    // Update the actor's journal entries list
    const entries = foundry.utils.duplicate(this.actor.system.journal?.entries || []);
    const existingIndex = entries.findIndex(e => e && e.id === entryData.id);

    const entryMetadata = {
      id: entryData.id,
      type: entryData.type,
      pageId: pageData.id || pageData._id,
      timestamp: entryData.timestamp,
      gmOnly: entryData.gmOnly,
    };

    if (existingIndex >= 0) {
      entries[existingIndex] = entryMetadata;
    } else {
      entries.push(entryMetadata);
    }

    await this.actor.update({
      "system.journal.journalId": journal.id,
      "system.journal.entries": entries,
    });

    ui.notifications.info("Journal entry saved");
  }

  async _getOrCreateJournal() {
    const journalId = this.actor.system.journal?.journalId;

    if (journalId) {
      const journal = game.journal.get(journalId);
      if (journal) return journal;
    }

    // Create a new journal
    const journalData = {
      name: `${this.actor.name}'s Journal`,
      ownership: {
        [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      },
    };

    // Copy actor ownership to journal
    if (this.actor.ownership && typeof this.actor.ownership === 'object') {
      for (const [userId, level] of Object.entries(this.actor.ownership)) {
        if (userId !== "default") {
          journalData.ownership[userId] = level;
        }
      }
    }

    return await JournalEntry.create(journalData);
  }

  async _createOrUpdatePage(journal, entryData) {
    // Defensive check for journal.pages
    if (!journal || !journal.pages) {
      throw new Error("Journal or journal.pages is undefined");
    }

    // Generate page content from structured data
    const content = this._generatePageContent(entryData);
    const pageName = this._generatePageName(entryData);

    // Check if page already exists
    const existingPage = journal.pages.find(p =>
      p && p.getFlag && p.getFlag(SYSTEM_ID, "entryId") === entryData.id
    );

    const pageData = {
      name: pageName,
      type: "text",
      text: {
        content: content,
        format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,
      },
      flags: {
        [SYSTEM_ID]: {
          entryId: entryData.id,
          entryType: entryData.type,
          entryData: entryData.data,
          timestamp: entryData.timestamp,
          gameDate: entryData.gameDate,
          gmOnly: entryData.gmOnly,
        },
      },
    };

    // Only set custom ownership for GM-only entries
    // Otherwise, let it inherit from the journal (don't set empty object)
    if (entryData.gmOnly) {
      pageData.ownership = {
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
        [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      };
    }

    if (existingPage) {
      await existingPage.update(pageData);
      return existingPage;
    } else {
      const pages = await journal.createEmbeddedDocuments("JournalEntryPage", [pageData]);
      if (!pages || !pages.length || !pages[0]) {
        throw new Error("Failed to create journal page");
      }
      return pages[0];
    }
  }

  _generatePageName(entryData) {
    const typeLabels = {
      identity: "Identity",
      stash: "Stash",
      bond: "Bond",
      advancement: "Advancement",
      downtime: "Downtime",
      desire: "Quest",
      lead: "Lead",
      grudge: "Grudge",
      travel: "Travel",
      legacy: "Legacy",
    };

    let name = typeLabels[entryData.type] || "Entry";

    // Add distinguishing info from plain text fields
    const data = entryData.data;
    if (data.name && typeof data.name === 'string' && !data.name.includes('<')) {
      name += `: ${data.name.substring(0, 30)}`;
    } else if (data.location && typeof data.location === 'string' && !data.location.includes('<')) {
      name += `: ${data.location.substring(0, 30)}`;
    } else if (data.session) {
      name += ` (Session ${data.session})`;
    }

    if (entryData.gmOnly) {
      name = `[GM] ${name}`;
    }

    return name;
  }

  _generatePageContent(entryData) {
    const typeLabels = {
      identity: "Identity",
      stash: "Stash",
      bond: "Bond",
      advancement: "Advancement",
      downtime: "Downtime",
      desire: "Desire / Quest",
      lead: "Lead",
      grudge: "Grudge",
      travel: "Travel",
      legacy: "Legacy",
    };

    let html = `<h1>${typeLabels[entryData.type]}</h1>`;

    if (entryData.gmOnly) {
      html += `<p><em style="color: #a00;"><strong>[GM ONLY]</strong></em></p>`;
    }

    if (entryData.gameDate) {
      html += `<p><strong>Game Date:</strong> ${entryData.gameDate}</p>`;
    }

    html += `<p><em>Recorded: ${new Date(entryData.timestamp).toLocaleString()}</em></p>`;
    html += `<hr/>`;

    const data = entryData.data;
    const fields = this._getFieldsForType(entryData.type);

    for (const field of fields) {
      if (data[field.key]) {
        html += `<h3>${field.label}</h3>`;
        // Data is already HTML from rich text editors
        html += `<div>${data[field.key]}</div>`;
      }
    }

    return html;
  }

  _getFieldsForType(type) {
    const fieldMap = {
      identity: [
        { key: "name", label: "Name" },
        { key: "appearance", label: "Appearance" },
        { key: "goal", label: "Goal" },
        { key: "secret", label: "Secret" },
        { key: "quirk", label: "Quirk" },
        { key: "faction", label: "Faction" },
      ],
      stash: [
        { key: "location", label: "Location" },
        { key: "storedGear", label: "Stored Gear" },
        { key: "wealthGold", label: "Gold" },
        { key: "wealthSilver", label: "Silver" },
        { key: "wealthCopper", label: "Copper" },
        { key: "wealthNotes", label: "Other Valuables" },
        { key: "property", label: "Property" },
        { key: "sharedWith", label: "Shared With" },
        { key: "notes", label: "Notes" },
      ],
      bond: [
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "bond", label: "Bond" },
        { key: "notes", label: "Notes" },
      ],
      advancement: [
        { key: "session", label: "Session" },
        { key: "change", label: "Change" },
        { key: "notes", label: "Notes" },
      ],
      downtime: [
        { key: "activity", label: "Activity" },
        { key: "outcome", label: "Outcome" },
        { key: "status", label: "Status" },
        { key: "notes", label: "Notes" },
      ],
      desire: [
        { key: "quest", label: "Quest" },
        { key: "reward", label: "Reward" },
        { key: "status", label: "Status" },
        { key: "notes", label: "Notes" },
      ],
      lead: [
        { key: "lead", label: "Lead" },
        { key: "source", label: "Source" },
        { key: "notes", label: "Notes" },
      ],
      grudge: [
        { key: "name", label: "Name" },
        { key: "offense", label: "Offense" },
        { key: "when", label: "When/Where" },
        { key: "response", label: "Response" },
        { key: "notes", label: "Notes" },
      ],
      travel: [
        { key: "session", label: "Session" },
        { key: "route", label: "Route" },
        { key: "events", label: "Events" },
        { key: "notes", label: "Notes" },
      ],
      legacy: [
        { key: "deeds", label: "Deeds" },
        { key: "allies", label: "Allies" },
        { key: "impact", label: "Impact" },
        { key: "landmarks", label: "Landmarks" },
        { key: "song", label: "Song or Tale" },
        { key: "mourns", label: "Who Mourns" },
        { key: "rejoices", label: "Who Rejoices" },
        { key: "other", label: "Other" },
      ],
    };

    return fieldMap[type] || [];
  }
}
