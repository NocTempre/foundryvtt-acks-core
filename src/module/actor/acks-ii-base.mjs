/**
 * ACKS II Base Actor Document
 * Base class for all ACKS II actor types (v14 clean implementation)
 * Extends Actor directly, not the legacy AcksActor
 */
export default class ACKS_II_Actor extends Actor {
  /**
   * Augment the actor's data preparation workflow
   */
  prepareData() {
    super.prepareData();
  }

  /**
   * Prepare base data that doesn't depend on other actors or items
   */
  prepareBaseData() {
    super.prepareBaseData();
    // Base implementation - subclasses can override
  }

  /**
   * Prepare derived data after items are prepared
   */
  prepareDerivedData() {
    super.prepareDerivedData();

    // Call the TypeDataModel's prepareDerivedData if it exists
    const systemData = this.system;
    if (systemData && typeof systemData.prepareDerivedData === 'function') {
      systemData.prepareDerivedData();
    }
  }

  /**
   * Get the ability modifier for a given ability
   * @param {string} ability - The ability abbreviation (str, int, dex, wil, con, cha)
   * @return {number} The ability modifier
   */
  getAbilityMod(ability) {
    return this.system.attributes?.[ability]?.mod ?? 0;
  }

  /**
   * Get the total ability bonus (modifier + additional bonuses)
   * @param {string} ability - The ability abbreviation
   * @return {number} The total ability bonus
   */
  getAbilityBonus(ability) {
    const attr = this.system.attributes?.[ability];
    if (!attr) return 0;
    return (attr.mod ?? 0) + (attr.bonus ?? 0);
  }

  /**
   * Roll an ability check
   * @param {string} ability - The ability to check (str, int, dex, wil, con, cha)
   * @param {Object} options - Additional options for the roll
   * @return {Promise<Roll>} The resulting roll
   */
  async rollAbilityCheck(ability, options = {}) {
    const abilityData = this.system.attributes?.[ability];
    if (!abilityData) {
      ui.notifications.warn(`Unknown ability: ${ability}`);
      return null;
    }

    const label = ability.toUpperCase();
    const score = abilityData.value;
    const modifier = this.getAbilityBonus(ability);

    // ACKS II uses d20 + modifier vs target (typically 11+)
    const roll = new Roll("1d20 + @mod", { mod: modifier });
    await roll.evaluate();

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${label} Check (Score: ${score})`,
      ...options,
    });

    return roll;
  }

  /**
   * Roll hit points for a level
   * @param {string} hitDie - The hit die (e.g., "1d6", "1d8")
   * @return {Promise<Roll>} The resulting roll
   */
  async rollHitPoints(hitDie = "1d6") {
    const conMod = this.getAbilityMod("con");
    const roll = new Roll(`${hitDie} + @mod`, { mod: conMod });
    await roll.evaluate();

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `Hit Points Roll (CON Mod: ${conMod >= 0 ? "+" : ""}${conMod})`,
    });

    return roll;
  }

  /**
   * Apply damage to the actor
   * @param {number} amount - Amount of damage to apply
   * @return {Promise<ACKS_II_Actor>} The updated actor
   */
  async applyDamage(amount) {
    const hp = this.system.hp;
    const newValue = Math.max(0, hp.current - amount);

    return this.update({
      "system.hp.current": newValue,
    });
  }

  /**
   * Heal the actor
   * @param {number} amount - Amount of healing to apply
   * @return {Promise<ACKS_II_Actor>} The updated actor
   */
  async applyHealing(amount) {
    const hp = this.system.hp;
    const newValue = Math.min(hp.max, hp.current + amount);

    return this.update({
      "system.hp.current": newValue,
    });
  }

  /**
   * Take a short rest
   * @return {Promise<ACKS_II_Actor>} The updated actor
   */
  async shortRest() {
    // Placeholder for short rest mechanics
    ui.notifications.info(`${this.name} takes a short rest.`);
    return this;
  }

  /**
   * Take a long rest
   * @return {Promise<ACKS_II_Actor>} The updated actor
   */
  async longRest() {
    // Restore HP to max on long rest
    const hp = this.system.hp;

    await this.update({
      "system.hp.current": hp.max,
    });

    ui.notifications.info(`${this.name} takes a long rest and restores all HP.`);
    return this;
  }
}
