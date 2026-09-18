# Hunting and first-PvE foundation

Hunting is a timed, location-bound vocational expedition. A player chooses a
hunting ground inside their current world location and a duration, then claims
the resolved materials, XP, encounter journal, and any non-lethal damage after
the return time.

## Domain boundary

- `Creature` is the shared PvE catalogue. `ANIMAL` is used by Hunting;
  `MONSTER` is used by [dungeons](DUNGEONS_SYSTEM.md). Retaliation uses the
  animal's full attack profile (physical, magic and elemental damage, critical
  hits). Its defensive stats are deliberately ignored; see
  [Animal defensive stats](#animal-defensive-stats).
- `CreatureDrop` is a generic item loot table. Any item can be a drop;
  non-stackable items are granted one per inventory slot. Its `requiredLevel` is
  interpreted by the owning activity, rather than coupling the table to Hunting.
- `HuntingGround` and `HuntingGroundCreature` provide location sub-areas and
  weighted local populations.
- `CharacterHealth` is shared live health state with lazy regeneration. It is
  intentionally independent of expedition records so future PvE can reuse it.
- `UserHuntingExpedition` snapshots all balance, creature, drop, stat, defense,
  safety, and random-seed inputs at departure. Admin edits never rewrite an
  active hunt, and a failed claim retry cannot reroll its outcome.

## Resolution

Each duration defines the encounter count, quantity multiplier, danger
multiplier, XP, and Hunting-level gate. Each encounter selects one animal by its
relative ground weight, rolls all eligible drops independently, then resolves
retaliation and a ground mishap.

Discovery uses the shared Gathering/Hunting formula:

`find bonus % = clamp((skill - 1) × 0.5 + luck × 0.4 + efficiency, -50, 150)`

`effective chance = clamp(base chance × (1 + find bonus / 100), 0.001, 0.95)`

Quantity uses the duration multiplier plus a smaller skill/Luck/efficiency
bonus. Individual drop chances remain meaningful; only a completely empty
expedition receives one weighted fallback material.

## Animal defensive stats

Animals have the same health, armor, magic resist, evasion and block fields as
dungeon monsters because `Creature` is one shared model, but **Hunting ignores
them on purpose**. These stats describe how hard a creature is to defeat, and
Hunting never makes the character defeat anything: every encounter is a
guaranteed kill and the animal only gets a chance to retaliate. Hunting risk
comes from the animal's attack profile and ground mishaps, not from a fight
the character could lose. Leave these fields at 0 for animals; the admin
editor labels them "Defence — used in dungeons only".

## Controlled danger

- Effective danger is `duration danger × global admin danger`.
- An animal first rolls its configured attack chance. The strike is the same
  one dungeon monsters use (`resolveCreatureStrike` in
  `src/server/combat/rules.ts`): the evasion matching its attack style can
  avoid it; physical damage is reduced by armor, magic damage by magic
  resistance, and elemental damage by the matching resistance; critical hits
  multiply it and block halves it. Hunts snapshot the character's elemental
  resistances at departure.
- Ground mishaps roll once per encounter and are reduced by movement speed.
- The resolver caps potential loss to an admin-set percentage of maximum health.
- Claim-time health applies a second admin-set remaining-health floor, so Hunting
  is non-lethal even if the floor is configured to zero (one health remains).
- Players below the configured health threshold cannot depart.
- Admins can disable all Hunting damage or set the global danger multiplier to
  zero immediately. Live safety changes may only reduce an active expedition's
  danger; increases wait until the next departure. A 2,000-run simulator uses
  the production resolver.

## Operations

1. Deploy the migration in
   `prisma/migrations/20260917120000_hunting_pve_foundation/`.
2. Preview seed changes with `npm run db:seed:hunting -- --check`.
3. Apply starter content with `npm run db:seed:hunting -- --apply`.
4. Verify it with `npm run db:seed:hunting -- --verify`.
5. Balance live content at `/admin/hunting`. Players browse animals at
   `/animals`, with a profile page per animal.

The starter pack contains eight animals, eight material items, ten hunting
grounds covering all current world locations, and four duration tiers.
