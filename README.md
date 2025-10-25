# 🚧 Experimental: Travel/Hexcrawl + Framework V2 (NocTempre fork)

**Status:** Alpha. Breaking changes likely. Test in a fresh world and keep backups. Do **not** open issues upstream for these experiments. This fork tracks Autarch’s core and layers prototypes on top.

## What’s being prototyped

* **Framework V2 (system architecture roadmap).** Internal refactor notes for a slimmer “engine core” and clearer extension points. See `FRAMEWORK_V2_Roadmap.md`.
* **Hexcrawl integration with Hexplorer.**

  * **Bridge:** syncing ACKS travel/time with Hexplorer hex state and tools (`HEXPLORER_BRIDGE.md`).
  * **Brush:** GM utilities for painting/maintaining exploration data on hex maps (`HEXPLORER_BRUSH.md`). 
  * **Integration notes & limits:** see `HEXPLORER_INTEGRATION.md` and `INTEGRATION_SUMMARY.md`.
  * Hexplorer module info: Foundry package + wiki.
* **Travel/Logistics “Party” tooling.**
  Design for a party-level travel actor (speed, watches, supplies, encumbrance roll-ups, time advancement): `TRAVEL_PARTY_DESIGN.md` and `TRAVEL_PARTY_UPGRADE.md`. Optional interaction with party/overview modules is being evaluated, not required.
* **Road Network model.**
  Draft mechanics for roads/trails and their effect on movement and hazard frequency: `ROAD_SYSTEM.md`.
* **Test harness.**
  WIP unit/fixture scaffolding for travel math and data integrity in `acks-tests/`.

## Try it (safe defaults)

1. **Clone this fork** and install as a local system (keep your main ACKS II system installed separately).
2. **New empty world.** Import nothing critical until you’re happy.
3. **Install Hexplorer** (premium) if you want hex features; otherwise the core still runs.
4. **Read the per-feature docs** linked above; enable only what you need.

## Known risks & caveats

* **Data format may change.** `old_packs/` and `srcdata/` may be reshaped; migrations are not guaranteed yet. Back up often.
* **Integration modules are optional.** Hexplorer adds hex tools; party helper modules are convenience only. If something conflicts, disable the add-on first.
* **Upstream parity.** This fork rebases periodically on Autarch’s system; experimental files are clearly separated and may not ever be merged upstream.

## Contributing/feedback

Open issues **here** (this fork) with reproducible steps and the feature tag (e.g., `hexplorer-bridge`, `party-travel`, `roads`). Please don’t file experimental bugs on Autarch’s repo.

## License
### System

This system is offered and may be used under the terms of
the [<span class="underline">Simulationist Adventure Game Authorization (SAGA) License v1.0</span>](saga-license.md),
the [<span class="underline">Autarch Compatibility License</span>](autarch-compatibility-license.md), and
the [<span class="underline">Autarch Community Use Guidelines</span>](autarch-community-use-guidelines.md).

This code is modified from a fork of the v1.0 code of the Old School Essentials System written by U~Man, and released under the GNUv3 license. The software source of this system is also distributed under the GNUv3 license and is considered open source.

Autarch, Adventurer Conqueror King, Adventurer Conqueror King System,
ACKS, ACKS II, and Imperial Imprint are trademarks of Autarch LLC.
You may find further information about the system
at [<span class="underline">autarch.co</span>](https://autarch.co/).
Auran Empire is trademark Alexander Macris.
