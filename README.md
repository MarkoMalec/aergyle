# Aergyle

The game’s visual and asset specification is [GAME_DESIGN_SYSTEM.md](docs/GAME_DESIGN_SYSTEM.md). Start there before changing player UI or creating new artwork. See the [visual audit](docs/design/VISUAL_AUDIT.md) and [verification record](docs/design/VERIFICATION.md).

The [Atlas equipment pack](docs/ATLAS_EQUIPMENT_PACK.md) contains 21 generated item sprites, five weapons, and the Rare Trailwarden and Epic Duskwarden armor sets, with an additive database importer.

The [Atlas vocation expansion](docs/VOCATION_EXPANSION_PACK.md) adds 24 location-gated Mining, Woodcutting, Fishing and Blacksmithing resources with balanced input recipes and matching sprites.

The [Gardening and Gathering system](docs/GARDENING_AND_GATHERING.md) separates plot-based crop growing from location-based expeditions, including admin-tunable pools, durations, stat-aware mixed rewards, and 12 new resource sprites.

The [Tailoring system](docs/TAILORING_SYSTEM.md) adds blueprint-gated equipment crafting, gathered textile materials, explicit Crafting/Vocation menu categories, and the four-piece Fieldweave gathering set.

[Dungeons](docs/DUNGEONS_SYSTEM.md) are timed, lethal PvE runs resolved against the character's health and combat stats, with monster loot, a death penalty, admin balancing tools and an animal/monster bestiary.

[Settlements](docs/SETTLEMENTS_SYSTEM.md) are each location's villages, towns and cities: NPCs with their own shops (including timed rare finds) and one-time, daily and weekly quests, plus community projects that every player builds together to unlock new content.

[Notifications and Messages](docs/COMMUNICATION_SYSTEM.md) are the sidebar's bell and envelope: one-way notes the game sends any player, and private conversations between players — capped at ten each, deleted one side at a time, and reportable to the moderation queue in /admin.

Crafting also separates general metalwork, combat weapons and woodwork into Blacksmithing, Weaponsmithing and Carpentry while keeping one shared vocational production engine.

Players sign in at `/play` with email and password or with Discord. `/admin` has [its own accounts](docs/DEPLOYMENT.md#admin-access), separate from players, and takes an authenticator code on every sign-in; manage them with `npm run admin`.

## Project foundation

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Push to `main`. GitHub Actions builds a multi-arch image, publishes it to GHCR,
and the host pulls it — see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the
full workflow, rollback, and moving to a different server.

The game runs at https://mmo.markomalec.com
