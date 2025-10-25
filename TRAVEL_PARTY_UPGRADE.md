# Travel Party Encumbrance & Item Transfer System

## Overview

This upgrade implements a comprehensive item ownership tracking and transfer system for travel parties, allowing characters to lend items to mounts, pack animals, and vehicles while maintaining proper encumbrance calculations.

## What's New

### 1. Item Ownership Tracking

Every item now tracks:
- **Original Owner**: Who owns the item (never changes)
- **Current Carrier**: Who has it now (changes on transfer)
- **Transfer Timestamp**: When it was transferred
- **Retrieval Restriction**: Conditions for retrieval (same-party, same-hex, same-scene, always, gm-approval)

### 2. Delegated Items System

Characters and monsters can now:
- Transfer items to party members
- Track items they've lent to others
- Retrieve delegated items (based on retrieval restrictions)
- See encumbrance breakdown (own items vs received items)

### 3. Enhanced Encumbrance Calculation

The system now calculates:
- **Base Encumbrance**: Character's own gear
- **Delegated Weight**: Items lent to others (subtracted from carrier's weight)
- **Received Weight**: Items borrowed from others (added to carrier's weight)
- **Effective Encumbrance**: Base - Delegated + Received

Monsters (draft animals, mounts) use their `draftAnimal.normalLoad` or `mountStats.effectiveCapacity` as max encumbrance.

### 4. Travel Party Sheet Enhancements

The travel party sheet now shows:
- **Encumbrance Display**: Current/Max stone for each member (red if overloaded)
- **Delegated Item Count**: Icon showing how many items are lent out
- **Animal Icons**: Visual indicators for draft animals and rideable mounts
- **Quick Access**: Click member's portrait icon to open their sheet for item management

### 5. Character Sheet Integration

Right-click on any item (except spells, abilities, languages, money) to:
- **Transfer to Party Member**: Opens dialog to select recipient
- **View Transfer Preview**: See how transfer affects encumbrance
- **Set Retrieval Restrictions**: Control when you can retrieve the item

New button: **"Retrieve Delegated Items"** - Shows all items you've lent and allows batch retrieval

## How to Use

### Transferring Items

**Method 1: Right-Click Context Menu**
1. Open a character's sheet
2. Right-click on an item (weapon, armor, or general item)
3. Select **"Transfer to Party Member"**
4. Choose recipient from dropdown (shows their current encumbrance)
5. Set retrieval restriction
6. Click **"Transfer"**

**Method 2: Via Dialog** (future enhancement)
- Will add transfer button to item controls in template

### Retrieving Items

1. Open character sheet
2. Click **"Retrieve Delegated Items"** button (in inventory section)
3. Select items to retrieve (grayed out if outside retrieval range)
4. Click **"Retrieve Selected"** or **"Retrieve All"**

### Setting Up a Travel Party

1. Create a Travel-Party actor
2. Drag characters and monsters (pack animals, mounts) onto the party sheet
3. For draft animals, make sure `draftAnimal.enabled = true` and set `normalLoad` (in stone)
4. Assign animals to vehicles as draft animals
5. Assign characters as crew or passengers
6. Open character sheets and transfer gear to pack animals/vehicles

### Encumbrance Flow Example

**Scenario**: Fighter wants to put their backpack on a mule

1. Fighter opens their sheet (encumbrance: 18/25 stone)
2. Right-clicks "Backpack" item (8 stone)
3. Selects "Transfer to Party Member"
4. Chooses "Mule" from dropdown
5. Dialog shows: Mule 5/40 st → **13/40 st** (8 stone added)
6. Sets retrieval to "same-party" (default)
7. Clicks "Transfer"

**Result**:
- Fighter: 18/25 → **10/25 stone** (backpack removed)
- Mule: 5/40 → **13/40 stone** (backpack added)
- Fighter's delegated items: +1 (can retrieve later)
- Backpack ownership: `originalOwner: fighter-id`, `currentCarrier: mule-id`, `isLent: true`

## Data Structure

### Item Ownership (all items except money, spells, abilities, languages)

```javascript
system.ownership: {
  originalOwner: "actor-id",        // Who owns it
  currentCarrier: "actor-id",       // Who has it
  transferredAt: 1234567890,        // Timestamp
  isLent: true,                     // Is this a loan?
  retrievalRestriction: "same-party" // Retrieval rules
}
```

### Delegated Items (on characters/monsters)

```javascript
system.delegatedItems: [
  {
    itemId: "Actor.xyz.Item.abc",  // Item UUID
    itemName: "Backpack",
    itemType: "item",
    itemImg: "icons/bag.png",
    currentCarrier: "mule-id",
    carrierName: "Pack Mule",
    transferredAt: 1234567890,
    canRetrieve: true               // Based on restriction rules
  }
]
```

### Mount Stats (on monsters)

```javascript
system.mountStats: {
  canBeRidden: false,
  canBeDraft: false,  // Alias for draftAnimal.enabled
  baseCapacity: 0,
  equippedSaddle: null,           // Item ID (future)
  equippedHarness: null,          // Item ID (future)
  effectiveCapacity: 0,           // With bonuses
  currentLoad: 0                  // Auto-updated
}
```

### Container Items (future - structure ready)

```javascript
system.container: {
  isContainer: false,
  capacityStone: 0,
  capacityReduction: 0,           // Weight multiplier (bag of holding)
  requiresMount: false,           // Saddlebags require mount
  containedItems: [],
  currentWeight: 0
}
```

### Mount Equipment (future - structure ready)

```javascript
system.mountEquipment: {
  equipmentType: "none",          // saddle, harness, barding
  capacityBonus: 0,               // Extra stone capacity
  speedModifier: 0,               // Speed bonus/penalty
  mountTypes: []                  // Compatibility list
}
```

## API Reference

### ItemTransfer Utility

```javascript
// Transfer an item
await game.acks.ItemTransfer.transferItem(item, fromActor, toActor, {
  restriction: "same-party"
});

// Retrieve an item
await game.acks.ItemTransfer.retrieveItem(itemUuid, originalOwner);

// Check if transfer is allowed
const canTransfer = game.acks.ItemTransfer.canTransfer(item, fromActor, toActor);

// Check if retrieval is allowed
const canRetrieve = game.acks.ItemTransfer.canRetrieve(item, owner, carrier);

// Get item weight in stone
const weight = game.acks.ItemTransfer.getItemWeight(item);

// Get effective encumbrance breakdown
const enc = await game.acks.ItemTransfer.getEffectiveEncumbrance(actor);
// Returns: { base: 15, delegated: 10, received: 5, effective: 10 }
```

### ItemTransferDialog

```javascript
// Show transfer dialog
await ItemTransferDialog.show(item, fromActor);

// Show retrieve dialog
await ItemTransferDialog.showRetrieveDialog(ownerActor);
```

## Retrieval Restrictions

| Restriction | Description | Can Retrieve When |
|------------|-------------|-------------------|
| `same-party` | Default - must be in same travel party | Both actors in same Travel-Party |
| `same-hex` | Must be in same hex | Both tokens in same hex (requires Hexplorer) |
| `same-scene` | Must be in same scene | Both tokens in current scene |
| `always` | No restrictions | Anytime (items teleport) |
| `gm-approval` | GM only | User is GM |

## Files Changed/Added

### New Files

- `src/module/item-transfer.js` - Core transfer utility
- `src/module/dialog/item-transfer-dialog.js` - Transfer UI dialogs
- `TRAVEL_PARTY_UPGRADE.md` - This documentation

### Modified Files

**Data Structure:**
- `src/template.json` - Added ownership, container, mountEquipment, delegatedItems, mountStats

**Core Logic:**
- `src/acks.js` - Imported ItemTransfer, exposed as game.acks.ItemTransfer
- `src/module/actor/entity.js` - Enhanced computeEncumbrance() for characters and monsters

**UI:**
- `src/module/actor/travel-party-sheet.js` - Enhanced member display with encumbrance info
- `src/templates/actors/travel-party-sheet.html` - Added encumbrance display, animal icons
- `src/module/actor/character-sheet.js` - Added item transfer context menu

## Testing Checklist

### Basic Transfer

- [ ] Create a character with some items
- [ ] Create a travel party and add the character
- [ ] Add a monster with `draftAnimal.enabled = true` and `normalLoad = 40`
- [ ] Right-click an item on the character → Transfer to party member
- [ ] Select the animal, confirm encumbrance updates correctly
- [ ] Check character's encumbrance decreased
- [ ] Check animal's encumbrance increased

### Retrieval

- [ ] Click "Retrieve Delegated Items" button on character
- [ ] See transferred item in list
- [ ] Retrieve it
- [ ] Confirm item returns to character
- [ ] Confirm encumbrance updates correctly

### Travel Party UI

- [ ] Open travel party sheet
- [ ] Verify member encumbrance displays (X/Y st)
- [ ] Verify delegated item count shows (orange share icon)
- [ ] Verify overloaded members show in red
- [ ] Verify animal icons appear for draft animals
- [ ] Click member's portrait icon, confirm sheet opens

### Encumbrance Calculation

- [ ] Transfer multiple items, verify math is correct
- [ ] Overload an animal, verify red display
- [ ] Transfer items between multiple party members
- [ ] Verify delegated items don't count against carrier's weight

### Retrieval Restrictions

- [ ] Transfer item with "same-hex" restriction
- [ ] Move tokens to different hexes
- [ ] Try to retrieve (should fail)
- [ ] Move tokens to same hex
- [ ] Try to retrieve (should succeed)

### Container Items

- [ ] Create a backpack container (10 stone capacity, no reduction)
- [ ] Add items to container via API
- [ ] Verify container weight = base weight + contents weight
- [ ] Create bag of holding (100 stone capacity, 90% reduction)
- [ ] Add 50 stone of items to bag of holding
- [ ] Verify character encumbrance = bag weight (1 stone) + effective contents (5 stone) = 6 stone
- [ ] Try to create saddlebag with requiresMount=true on character without mount (should fail)
- [ ] Add mount to party, try again (should succeed)
- [ ] View container contents dialog
- [ ] Remove items from container

### Vehicle Cargo

- [ ] Create vehicle with 2 passengers
- [ ] Verify cargo shows passenger body weight (12 stone each) + their gear
- [ ] Add crew member, verify crew weight is minimal (body + max 2 stone gear)
- [ ] Transfer items to vehicle, verify cargo updates
- [ ] Overload vehicle beyond normal capacity, verify orange "Heavy" warning
- [ ] Overload beyond maximum, verify red "OVERLOADED!" warning
- [ ] Assign insufficient draft animals, verify "CANNOT MOVE!" warning
- [ ] Add enough animals, verify warnings clear

## Phase 2: Containers & Enhanced Vehicles (IMPLEMENTED)

### Container Items ✅

**Implemented Features:**
- Bags, chests, saddlebags support
- Weight reduction (bag of holding: 90% reduction)
- Items flagged as "contained in" to track nesting
- Containers can require mounts (saddlebags must be on mount/vehicle)
- Automatic encumbrance calculation includes container weight reduction

**API:**
```javascript
// Create a container
const bag = await game.acks.ContainerManager.createContainer(actor, {
  name: "Backpack",
  capacity: 10,          // 10 stone capacity
  capacityReduction: 0,  // 0 = normal bag (full weight)
  requiresMount: false,
  baseWeight: 0.5,      // Bag itself weighs 0.5 stone
  img: "icons/containers/bags/pack-leather-brown-tan.webp"
});

// Bag of Holding example
const magicBag = await game.acks.ContainerManager.createContainer(actor, {
  name: "Bag of Holding",
  capacity: 100,
  capacityReduction: 0.9,  // 90% weight reduction!
  baseWeight: 1
});

// Add item to container
await game.acks.ContainerManager.addToContainer(item, container, carrier);

// Remove item from container
await game.acks.ContainerManager.removeFromContainer(itemId, container, carrier);

// Show container contents dialog
await game.acks.ContainerManager.showContainerDialog(container, carrier);
```

### Enhanced Vehicle System ✅

**Implemented Features:**
- Automatic cargo calculation from passengers + crew + items
- Body weight constants (configurable per actor type)
- Vehicle cargo displays: current/normal (max: heavy)
- Overload warnings (red) and cannot-move warnings (orange)
- Draft animal pulling power vs cargo weight validation
- Heavy load penalties (reduced speed)

**Body Weight Configuration:**
```javascript
CONFIG.ACKS.body_weight = {
  character: 12,        // Average human
  small_creature: 5,    // Halfling, gnome
  large_creature: 30,   // Ogre, etc
  default: 12
};
```

**Vehicle Cargo Display:**
- Shows actual cargo (passengers + crew + items)
- Color-coded: normal (black), heavy (orange), overloaded (red)
- Warnings if draft animals can't pull the load
- Warnings if exceeds maximum capacity

## Future Enhancements

### Phase 3: Mount Equipment (Structure Ready, Not Implemented)

Data structures are in place for:

1. **Mount Equipment**
   - Saddles (increase capacity, allow riding)
   - Harnesses (increase draft capacity)
   - Barding (armor for mounts)
   - Equipment compatibility checks

Already in template.json:
```javascript
system.mountEquipment: {
  equipmentType: "saddle" | "harness" | "barding",
  capacityBonus: 5,        // +5 stone capacity
  speedModifier: 2,        // +2 miles/day
  mountTypes: ["riding-horse", "mule"]  // Compatibility
}
```

Ready for implementation when needed!

### Phase 3: Advanced Features

1. **Bulk Transfer**
   - Transfer multiple items at once
   - "Pack animal" preset (transfer all gear except equipped)
   - "Unload" preset (retrieve all delegated items)

2. **Smart Suggestions**
   - "This character is overloaded - transfer items?" prompt
   - Suggest optimal load distribution
   - Warn when removing animals would overload vehicle

3. **Automated Encumbrance**
   - Auto-transfer to mounts when joining party
   - Auto-retrieve when leaving party
   - Distribute weight evenly across pack animals

## Troubleshooting

### Items don't transfer

**Check:**
- Is the actor in a travel party with the recipient?
- Is the item type transferable? (Spells, abilities, languages, money cannot be transferred)
- Are there console errors?

### Can't retrieve items

**Check:**
- Retrieval restriction setting
- Are actors in same party/hex/scene (depending on restriction)?
- Is the item still on the carrier?

### Encumbrance not updating

**Check:**
- Call `actor.computeEncumbrance()` to force recalculation
- Check console for errors
- Verify `weight6` property on items is set correctly

### Travel party not showing encumbrance

**Check:**
- Party members have been added (drag actors onto party sheet)
- Actors have encumbrance calculated (characters auto-calculate, monsters need `draftAnimal.enabled`)
- Re-render sheet (close and reopen)

## Migration Notes

**Existing Worlds:**
- No migration required - system adds fields dynamically
- Existing items will have empty ownership (not lent)
- Existing characters will have empty delegatedItems array
- System is backwards compatible

**Data Safety:**
- All transfers create new item copies (original is deleted)
- Ownership tracking preserves original owner ID
- If carrier is deleted, items are lost (future: auto-return to owner)

## Support

For issues or questions:
1. Check console for error messages
2. Verify data structure in actor/item inspection
3. Test with fresh actor/party to isolate issues
4. Report bugs with reproduction steps

## Credits

Designed and implemented for ACKS Core system based on Adventurer Conqueror King System.

---

**Version:** 1.0.0
**Date:** 2025-01-XX
**Compatible with:** Foundry VTT v11+, ACKS Core v2.0+
