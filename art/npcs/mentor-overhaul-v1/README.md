# NPC mentor overhaul v1

Three skill mentors were rebuilt with the project-wide
[`NPC_ART_DIRECTION.md`](../NPC_ART_DIRECTION.md) brief. The pack deliberately
uses distinct, non-glamorous adult silhouettes and lived-in details instead of
the previous youthful, polished defaults.

The 1024×1536 RGBA masters are retained in this directory. The deterministic
512×768 RGBA runtime exports live in `public/assets/npcs/`.

| Mentor           | Skill       | Character direction                                                                                                                                     | Runtime asset                                   |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Elowen Briarwell | Gathering   | An early-fifties woman forager: wry, meticulous and weathered, with a crooked nose, silver-threaded braid, repaired layers and orderly specimen pouches | `/assets/npcs/elowen-briarwell-gatherer-v1.png` |
| Orrin Quill      | Alchemy     | A compact late-fifties male field alchemist: clever, impulsive and scarred by his own work, with a battered portable kit                                | `/assets/npcs/orrin-quill-alchemist-v2.png`     |
| Bram Ironbough   | Woodcutting | A broad, mid-fifties male lumberjack: reserved, safety-first and visibly seasoned, with a maintained felling axe and hard-used forest gear              | `/assets/npcs/bram-ironbough-woodcutter-v1.png` |

The old Rowan Mossweft and Eira Alderfall assets, and Orrin Quill's v1 portrait,
were removed rather than retained alongside these replacements. The selected
generation prompt specs and source IDs are recorded in `PROMPTS.md` and
`generation.json`.
