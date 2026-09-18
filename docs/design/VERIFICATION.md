# Redesign verification

Reviewed 14 September 2026 on branch `redesign`, using the existing development server at `http://localhost:3001`. The accepted direction is documented in [GAME_DESIGN_SYSTEM.md](../GAME_DESIGN_SYSTEM.md); starting conditions and 46 inspected raster assets are recorded in [VISUAL_AUDIT.md](VISUAL_AUDIT.md).

## What changed

- Forest-dark surfaces, warm brass and parchment remain the palette. Locally bundled Geist, 10–16px corners, cleaner headings and comfortable spacing supply the modern presentation.
- Responsive navigation replaces the permanent rail on phones. Profile, vocations, garden, marketplace, map and public entry screens share the same surfaces and controls.
- Inventory hides trailing empty capacity, preserves original indices and shows every occupied item. Attribute groups disclose secondary detail. Equipment preserves all 16 logical slots; paired shoulders, bracers and gloves have distinct left/right drag targets for the same item.
- Rarity uses full frames, object-local tint, distinct symbols and restrained static auras. Legendary, Mythic and Divine receive 2px frames and their own crown/flame/sun treatment. This carries into item details, marketplace thumbnails, listing badges and split previews.
- Resource action dialogs display the same equipment-adjusted duration as the resource list. No progression calculation changed.
- The combined `/play` page switches between the existing registration and sign-in forms, retaining each form’s values while hidden. Standalone routes remain available.

## Browser coverage

Inspected actual rendered pages in Chrome, using DOM checks and screenshots. The authenticated game session remained available throughout the review. Public forms were inspected on `127.0.0.1:3001` without signing out the game session.

| Viewport             | Coverage                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1440×1000            | Character, equipment, compact inventory, Legendary item details, rarity comparison                                                             |
| 1024×900             | Marketplace filters, search results and listings dialog; stacked filter/results layout                                                         |
| 768×1024             | Desktop-navigation breakpoint, atlas, local map scrolling and travel dialog                                                                    |
| 390×844              | Character inventory, item details, mobile navigation, garden, seed dialog, marketplace/my listings, homepage, registration and combined entry  |
| 320×740              | Garden’s local horizontal overflow, keyboard-opened resource action, inventory and split preview, all rarity tiers, long active-progress label |
| Desktop browser size | Sign-in artwork, form hierarchy and dark input/button readability                                                                              |

Observed document width equalled viewport width in the checked 1440px profile, 390px profile/item details, 320px profile/split preview, 320px garden and 320px rarity/activity fixture. The garden and wide tables retain local scrolling; the page itself does not expand to fit them.

### Interaction checks

- Inventory expansion changed 36 rendered slots to 85, retaining all 23 occupied items; collapsing preserved their source positions. Counts came from the rendered DOM, not a fabricated inventory.
- Equipment rendered 14 occupied logical slots plus two empty slots. The anatomy follow-up restores paired shoulder, bracer and hand positions with unique draggable and droppable IDs. Head, neck, chest, belt, legs and feet align vertically over a quiet figure outline. Weapons/tools and accessories occupy side columns; the equipment count excludes mirrored positions.
- Enter opened item details, attribute disclosures, resource choices and a marketplace row. Escape closed overlays. Mobile navigation opened with an accessible name and closed on route selection.
- Split preview showed the original/new quantities and accessible decrement/increment controls. Cancel returned focus to the original item trigger. On opening item details, focus starts at the content; Tab scrolls the action into view when vertical space is limited. No split was submitted.
- Selecting an empty garden plot enabled seed selection; the seed dialog showed the existing seed stock. Cancel and navigation completed normally. No planting or harvesting was submitted.
- Searching for “Gold Amulet” returned one grouped result; reset cleared the search. The listings dialog displayed the correct rarity and identified the user’s own listing as unavailable to purchase. No purchase/list/cancel-listing operation was submitted.
- Arrow-key input moved the atlas scroll position. Destination selection opened the existing travel dialog; it was closed without starting travel.
- `/play` switched from registration to sign-in by keyboard and exposed only the active form in the accessibility tree.
- A temporary visual fixture rendered the real `ItemArtwork`, `RarityBadge` and `ActionFillBar` components for all 12 tiers and a long travel label. It verified the restrained high-tier effects and wrapping at 320px. The fixture route was removed after review.

Game mutations, timed completion/reward events, physical drag/drop persistence and purchasing were not exercised against the user’s live inventory. Existing handlers, services, item IDs and calculations remain in place. This is visual/interaction verification, not a complete gameplay regression suite.

## Code and token checks

- `npx tsc --noEmit --pretty false`: passes separately from Next’s build, which is configured to skip TypeScript validation.
- Production compilation and page generation: passed in an isolated copy using the repository’s installed dependencies and existing environment configuration, leaving the running development server’s `.next` directory alone. The final build exited successfully after the last UI fixes; all 275 source files matched the built copy byte for byte.
- Lint: the original project had 506 errors and 141 warnings. Diagnostics are compared by file, severity, rule and message, ignoring shifted line numbers. The final full lint run reports 490 errors and 120 warnings, all pre-existing by this comparison. No new diagnostics are introduced by the redesign.
- Rarity checks: all 12 tiers retain their order and display configuration; legacy swatches resolve to the new palette; valid custom hex colours are preserved; invalid colours fall back; dark custom text and the muted Worthless/Broken text receive readable parchment. Seventy-two focused assertions passed.
- Contrast: 34 solid text/background pairings checked. The minimum among shared reading colours on the four normal dark surfaces is 5.50:1; primary button text is 7.97:1; destructive button text is 5.41:1. These checks do not certify arbitrary image backgrounds or every possible administrator-defined colour.
- Reduced motion: the stylesheet suppresses transitions and animations under `prefers-reduced-motion: reduce`. Rarity effects are static. This rule was inspected in source; operating-system motion settings were not changed.
- Formatting and `git diff --check` pass. No UI dependency or database migration was added.

The build requires network access to the configured database for existing static skill route generation. A sandboxed attempt compiled successfully but could not resolve the database host; a build with network access completed. Existing build output includes dynamic-route notices, an outdated Browserslist database notice and the optional `sharp` recommendation. Those dependency/server concerns are outside this visual change.

## Asset status

Existing artwork was retained. Photographic jewelry/revolver/backpack stages, some heavy outlines and bright log halos remain known legacy differences; a uniform slot treatment cannot repaint them. The design bible specifies replacement camera, lighting, materials, transparency, silhouette, scale and standalone generation prompts. It explicitly distinguishes future standards from currently shipped legacy assets.

## Equipment anatomy follow-up

The profile equipment board was reviewed at 1280×1000, 820×1180 and 390×844. Body positions stay anatomical at each size, with no page-level horizontal overflow. At 900px and below, the portrait stacks above the equipment. Empty slots use gear outline icons; the loading skeleton shares the live layout.

Both shoulder positions open the same item details. A drag from the right shoulder to the left produced distinct source/target IDs, returned HTTP 200 from the equipment API and preserved the 14/16 equipped count. Paired slots have left/right accessible names. Active dragging raises its panel above nearby surfaces.

Validation: `tsc --noEmit`, ESLint for all changed components, `git diff --check`, and an isolated production build passed. No new gameplay data or equipment assignments were introduced by this layout change.

## World atlas interaction follow-up

Reviewed 15 September 2026. The separate destination button stack was removed. All eight live locations—including the existing Crownhold and Greenveil Plains starters—now appear as native buttons on the illustrated map, with truthful current, reachable, and locked states from the database. Each opens an atlas entry with terrain, notable features, a cartographer's note, access requirements, and a route preview. The six-location vocation expansion seed contract remains unchanged.

The travel request still uses the existing `/api/travel/start` route. After the server accepts it, the dialog shows one short route-drawing transition and then refreshes into the existing authoritative travel progress state. Reduced-motion users receive the state change without the visual delay. No travel or cancellation was submitted against the review character.

Browser checks covered 1440×1000, 1024×768, 768×1024, 390×844, and 320×740. The current location remained in the initial map framing, mouse/pointer dragging and arrow-key scrolling stayed local to the map, dialogs fit with their close and primary actions reachable, and document width equalled viewport width at every checked size. Available, current, and locked entries were inspected in the rendered UI; Escape and close retained the selected entry throughout the closing animation.

Focused validation: the new atlas metadata assertions passed, all six atlas-equipment checks passed, all five vocation-expansion checks passed, changed-file ESLint passed, `tsc --noEmit` passed, `git diff --check` passed, and the production build completed with `/map` emitted as a dynamic route.
