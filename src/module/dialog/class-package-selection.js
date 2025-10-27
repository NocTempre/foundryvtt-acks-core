export class AcksClassPackageDialog {
  /**
   * Show package selection dialog for PCs
   * @param {AcksActor} actor - The actor selecting a package
   * @param {Object} packageResult - Result from rollClassPackage()
   * @returns {Promise<Object|null>} The selected package or null if cancelled
   */
  static async showPackageSelection(actor, packageResult) {
    const { roll, eligiblePackages, allPackages } = packageResult;

    if (!allPackages || allPackages.length === 0) {
      ui.notifications?.warn("No packages available for your roll.");
      return null;
    }

    const classDef = CONFIG.ACKS?.classes?.[actor.system?.details?.classKey];
    const className = classDef?.name || "Class";

    // Get current character gold and encumbrance
    const currentGold = actor.items.filter(i => i.type === "money" && i.name === "Gold")
      .reduce((sum, item) => sum + (item.system.quantity || 0), 0);
    const currentEnc = actor.system?.encumbrance?.value || 0;
    const maxEnc = actor.system?.encumbrance?.max || 20;

    // Build package options HTML
    const packageOptions = allPackages
      .map((pkg) => {
        const isEligible = pkg.minRoll <= roll;
        const profList = pkg.proficiencies?.join(", ") || "None";
        const equipList = pkg.equipment?.slice(0, 5).join(", ") || "None";
        const equipMore = pkg.equipment?.length > 5 ? `... and ${pkg.equipment.length - 5} more` : "";
        const goldText = pkg.gold ? `${pkg.gold}gp` : "0gp";

        // Add spell list if package includes spells
        const spellList = pkg.spells?.join(", ") || "";
        const spellChoice = pkg.spellChoice ? ` +${pkg.spellChoice} choice` : "";
        const spellSection = spellList ? `<div style="margin-bottom: 0.3em;"><strong>Spells:</strong> ${spellList}${spellChoice}</div>` : "";

        return `
          <div class="package-option" style="margin-bottom: 1em; padding: 0.5em; border: 1px solid ${isEligible ? '#4a4' : '#888'}; background: ${isEligible ? '#f0fff0' : '#f8f8f8'}; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em;">
              <label style="font-weight: bold; margin: 0;">
                <input type="radio" name="package" value="${allPackages.indexOf(pkg)}" ${!isEligible ? 'disabled' : ''} style="margin-right: 0.5em;">
                ${pkg.name} (${pkg.minRoll}-${pkg.maxRoll})
              </label>
            </div>
            <div style="font-size: 0.9em; margin-left: 1.5em;">
              <div style="margin-bottom: 0.3em;"><strong>Proficiencies:</strong> ${profList}</div>
              ${spellSection}
              <div><strong>Equipment:</strong> ${equipList}${equipMore}</div>
            </div>
            <div style="position: absolute; top: 0.5em; right: 0.5em; text-align: right; font-size: 0.85em;">
              <div style="color: #d4af37; font-weight: bold;">${goldText}</div>
              <div style="color: #666; font-style: italic;">${pkg.encumbrance || "? st"}</div>
            </div>
          </div>
        `;
      })
      .join("");

    const content = `
      <div class="acks-package-selection">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1em;">
          <div>
            <strong>You rolled ${roll} for your ${className} package.</strong><br>
            <span style="font-size: 0.9em;">Select a package from the options below (you may choose any package up to your roll):</span>
          </div>
          <div style="text-align: right; font-size: 0.9em; padding: 0.5em; background: #f0f0f0; border-radius: 4px;">
            <div><strong>Current Gold:</strong> <span style="color: #d4af37;">${currentGold}gp</span></div>
            <div><strong>Current Enc:</strong> ${currentEnc} / ${maxEnc} st</div>
          </div>
        </div>
        <form>
          ${packageOptions}
        </form>
      </div>
    `;

    return new Promise((resolve) => {
      new Dialog({
        title: `${className} Package Selection`,
        content: content,
        buttons: {
          select: {
            icon: '<i class="fas fa-check"></i>',
            label: "Select Package",
            callback: (html) => {
              const selected = html.find('input[name="package"]:checked').val();
              if (selected === undefined) {
                ui.notifications?.warn("Please select a package.");
                resolve(null);
                return;
              }
              const packageIndex = parseInt(selected, 10);
              resolve(allPackages[packageIndex]);
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(null),
          },
        },
        default: "select",
        close: () => resolve(null),
      }).render(true);
    });
  }

  /**
   * Auto-apply package for NPCs/Henchmen based on roll
   * @param {AcksActor} actor - The actor receiving the package
   * @param {Object} packageResult - Result from rollClassPackage()
   * @returns {Promise<Object|null>} The applied package or null if none matched
   */
  static async autoApplyPackage(actor, packageResult) {
    const { eligiblePackages } = packageResult;

    if (!eligiblePackages || eligiblePackages.length === 0) {
      ui.notifications?.info("No package matched the roll.");
      return null;
    }

    // If multiple packages match, pick the first one (highest in range)
    const selectedPackage = eligiblePackages[0];

    await actor.applyClassPackage(selectedPackage);

    return selectedPackage;
  }

  /**
   * Main entry point for package selection workflow
   * @param {AcksActor} actor - The actor selecting a package
   * @param {number|null} manualRoll - Optional manual roll value (GM only)
   * @returns {Promise<void>}
   */
  static async handlePackageSelection(actor, manualRoll = null) {
    if (!actor || actor.type !== "character") {
      return;
    }

    // GM can set manual roll or choose to roll normally
    let roll = manualRoll;
    if (roll === null && game.user.isGM) {
      const gmChoice = await this.showGMOptions(actor);
      if (gmChoice === null) return; // Cancelled
      if (gmChoice.type === "manual") {
        roll = gmChoice.value;
      }
    }

    // Roll for package (or use manual roll)
    const packageResult = roll !== null
      ? await actor.rollClassPackage(roll)
      : await actor.rollClassPackage();

    if (!packageResult) {
      return;
    }

    const characterType = actor.system?.details?.characterType;

    if (characterType === "pc" || game.user.isGM) {
      // Show selection dialog for PCs or GMs
      const selectedPackage = await this.showPackageSelection(actor, packageResult);
      if (selectedPackage) {
        await actor.applyClassPackage(selectedPackage);
      }
    } else {
      // Auto-apply for NPCs/Henchmen
      await this.autoApplyPackage(actor, packageResult);
    }
  }

  /**
   * Show GM options for manual roll or package selection
   * @param {AcksActor} actor - The actor
   * @returns {Promise<Object|null>} Choice object or null if cancelled
   */
  static async showGMOptions(actor) {
    const classKey = actor.system?.details?.classKey;
    if (!classKey) return { type: "roll" };

    const classDef = CONFIG.ACKS?.classes?.[classKey];
    const className = classDef?.name.toLowerCase() || classKey.split('-')[0];
    const packages = CONFIG.ACKS?.classPackages?.[className];

    if (!packages || packages.length === 0) {
      return { type: "roll" };
    }

    const content = `
      <div class="acks-gm-package-options">
        <p><strong>GM Options for ${classDef?.name || "Class"} Package</strong></p>
        <div class="form-group">
          <label>
            <input type="radio" name="gm-choice" value="roll" checked>
            Roll 3d6 normally
          </label>
        </div>
        <div class="form-group">
          <label>
            <input type="radio" name="gm-choice" value="manual">
            Set manual roll value:
            <input type="number" name="manual-roll" min="3" max="18" value="10" style="width: 60px; margin-left: 0.5em;">
          </label>
        </div>
        <div class="form-group">
          <label>
            <input type="radio" name="gm-choice" value="choose">
            Choose package directly (no roll)
          </label>
        </div>
      </div>
    `;

    return new Promise((resolve) => {
      new Dialog({
        title: "GM: Package Selection Options",
        content: content,
        buttons: {
          ok: {
            icon: '<i class="fas fa-check"></i>',
            label: "Continue",
            callback: (html) => {
              const choice = html.find('input[name="gm-choice"]:checked').val();
              if (choice === "roll") {
                resolve({ type: "roll" });
              } else if (choice === "manual") {
                const value = parseInt(html.find('input[name="manual-roll"]').val(), 10);
                resolve({ type: "manual", value: value });
              } else if (choice === "choose") {
                resolve({ type: "manual", value: 18 }); // Max roll to show all packages
              }
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(null),
          },
        },
        default: "ok",
      }).render(true);
    });
  }
}
