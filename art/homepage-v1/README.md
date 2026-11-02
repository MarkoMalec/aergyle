# Aergyle homepage art v1

Generated with the built-in OpenAI image-generation tool on 30 October 2026.
These files are the untouched PNG masters; matching runtime copies live in
[`public/assets/homepage/`](../../public/assets/homepage/).

| Slot | Master | Runtime asset | Size | Notes |
| --- | --- | --- | --- | --- |
| Dawn hero | `hero-dawn-v1.png` | `/assets/homepage/hero-dawn-v1.png` | 1536 x 1024 | Valley, Crownhold, and sunrise |
| Hero figure | `hero-wayfarer-v1.png` | `/assets/homepage/hero-wayfarer-v1.png` | 1024 x 1536 | RGBA cutout; rock reaches the canvas bottom |
| Quay market | `market-quay-v1.png` | `/assets/homepage/market-quay-v1.png` | 1536 x 1024 | Golden-hour trade scene |
| Dungeon | `dungeon-descent-v1.png` | `/assets/homepage/dungeon-descent-v1.png` | 1536 x 1024 | Caldrath Undervault entrance |
| Night camp | `night-camp-v1.png` | `/assets/homepage/night-camp-v1.png` | 1536 x 1024 | Mining and idle-progress scene |
| Atlas | `atlas-last-page-v1.png` | `/assets/homepage/atlas-last-page-v1.png` | 1536 x 1024 | Closing CTA scene |
| Share image | `og-aergyle-v1.jpg` | `/assets/homepage/og-aergyle-v1.jpg` | 1200 x 630 | Dawn hero and cutout composited for Open Graph |

`PROMPTS.md` is the accepted final prompt set and includes the shared visual
direction, composition maps, each asset prompt, and acceptance criteria. The
generation prompts retained those specifications and added only production
labels and explicit layout safeguards (such as clean negative space for
overlaid page content). No runtime crop, compression, or alpha manipulation
has been applied to these masters.

`og-aergyle-v1.jpg` is a non-generated composition of the dawn master and
transparent wayfarer. It keeps the city, sunrise, and traveler in the central
share-safe area and automatically activates the conditional homepage Open Graph
metadata already in `src/app/page.tsx`.
