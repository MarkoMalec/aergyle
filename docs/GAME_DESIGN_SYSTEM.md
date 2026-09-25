# Aergyle — Game Design System

**Visual source of truth · Version 1.0 · September 2026**

Art direction: **The Wayfarer’s Atlas**. A living fantasy atlas interpreted through a contemporary game interface: green-black ink, warm brass, soft sculpted surfaces, clear sans-serif type and a growing collection of discoveries.

This is a specification for the actual Next.js game in this repository. It governs player-facing UI and all newly commissioned art. Read [the initial audit](design/VISUAL_AUDIT.md) for the reasoning and [verification](design/VERIFICATION.md) for implementation coverage. Gameplay systems remain defined in the existing inventory, rarity, progression and vocation documents. This document takes precedence over their old visual colour examples, never over their mechanical rules.

## 1. Visual Identity Summary

Aergyle combines the warmth of a traveller’s field atlas with the ease and polish of a modern RPG. Old-world character lives in the illustrated landscape, worn materials, practical tools and brass light. The interface is spacious, softly rounded and direct. It gives the collection room to breathe, and makes finding a Legendary item feel valuable.

The three identifying relationships are **warm brass against green-black ink**, **confident modern typography against weathered illustrations**, and **collected objects in softly rounded, rarity-lit recesses**. The existing crossed-sword shield remains the crest. The woodland scenery, practical tool silhouettes, painted warrior and world map remain valuable foundations.

The game’s everyday life matters: woodcutting, mining, fishing, blacksmithing, weaponsmithing, carpentry, gardening, gathering expeditions, travelling and trading. Do not present every carrot as an epic relic or promise combat features that are not implemented.

## 2. Core Design Principles

1. **The collection is the colour.** Surfaces are quiet. Resource art and rare objects can be expressive without requiring rainbow panels.
2. **A place for every thing.** Label equipment, group statistics, align quantities and explain the next action near its control.
3. **Brass marks intention.** Reserve solid brass for a primary action. Brass text and a soft green surface mark navigation selection. Green patina marks progress and equipped states.
4. **Space is part of the identity.** Use clean headings, comfortable corners and a few useful labels. Hide trailing empty inventory slots and secondary attribute groups behind clear disclosures. Reserve expressive frames for valuable objects.
5. **Small first.** A sprite must work at 32px. A screen must remain useful at 390px. A label must explain the control without hover.
6. **Respect the game underneath.** Keep item IDs, equipment indices, timers, query keys, rarity order, prices, taxes, server decisions and route semantics intact when styling.

## 3. Visual Personality / Keywords

**Resourceful, warm, tactile, clear, contemporary, quietly adventurous.**

- Resourceful: believable construction, readable tools, practical inventories.
- Weathered: broad material marks, a little edge wear, no dirt obscuring information.
- Clear: readable labels, intentional grouping, generous space; no catalogue numbers on every slot.
- Warm: parchment text and brass light against a cool background.
- Grounded: objects have weight; panels do not float or pulse continuously.
- Adventurous: the illustrated atlas and characters imply a world beyond the next task.

Do not use “modern fantasy” as a sufficient brief. The concrete constraints below define the style.

## 4. What Makes This Game Visually Unique

Aergyle’s signature is the relationship between **forest-dark surfaces, warm parchment text, soft brass controls and tangible painted objects**. Confident left-aligned Geist headings keep it contemporary. The crest, warrior and illustrated atlas provide the RPG presence. Avoid using medieval typography, tiny annotations and repeated ornamental rules to manufacture atmosphere.

The navigation has plain-language groups: Your adventure, Vocations, Trading. Its selected entry is a rounded green inset with brass type and icon. Equipment follows the character's anatomy beside the portrait: head above shoulders, chest and belt down the center, arms at the sides, and legs above feet. Inventory capacity is visible, with trailing empty space collapsed by default.

Rarity is a deliberate exception to the quiet frame: a whole coloured edge, light beneath the object, and increasingly special treatment as rarity rises. Legendary has warm gold and a crown, Mythic has ember-coral and a flame, Divine has luminous ivory and a sun. These remain still; the player can enjoy valuable equipment without a grid of pulsing distractions.

Tool and resource illustrations use warm upper-left light, cool lower-right shadow, broad painted facets and slightly enlarged functional parts. This repeated art grammar gives Aergyle identity beyond its logo.

## 5. Things We Explicitly Avoid

- IdleMMO imitation, including its item rendering, UI silhouette, pet proportions or palette.
- Glass panels over busy art, general backdrop blur, random gradients and glowing borders everywhere.
- White form cards inside the dark world; separate public and game visual identities.
- Medieval/serif display typography, decorative title underlines, all-caps paragraphs, tiny low-contrast statistics.
- Sharp cramped controls, thick bevelled buttons, excessive badges or an ornate gold frame around every panel. Comfortable rounding is encouraged; material, art and composition provide the character.
- Platform emoji as the principal game icon language. Legacy metadata may still contain emoji; new UI should not render those as its icon set.
- Photographic product renders, anime faces, tiny filigree, pixel art mixed with painted sprites, thick black cartoon outlines, coloured rim lighting and baked rarity halos.
- Decorative controls that look usable but do nothing. Atlas landmarks are real, keyboard-accessible buttons; they open the travel dialog instead of acting as inert annotations.

## 6. Color System

The default is intentionally dark. `src/styles/globals.css` owns the CSS custom properties; `tailwind.config.ts` exposes semantic utilities with alpha support. Use `hsl(var(--token) / opacity)` or the corresponding Tailwind utility. HSL triplets are space-separated. Do not reintroduce comma-separated values or hardcoded colours in components.

| Role / CSS token         | Exact sRGB | Use                                               |
| ------------------------ | ---------- | ------------------------------------------------- |
| `background`             | `#111B1E`  | Page canvas                                       |
| `sidebar-background`     | `#0E171A`  | Atlas index rail                                  |
| `surface-inset`          | `#142125`  | Item recesses, inputs, progress tracks            |
| `card`                   | `#1B292D`  | Panels and resource rows                          |
| `muted`                  | `#223136`  | Quiet secondary grouping                          |
| `popover`                | `#24343A`  | Opaque dialogs, menus, item details               |
| `secondary`              | `#2A3A3E`  | Secondary buttons and neutral badges              |
| `accent`                 | `#334642`  | Hover/selection surface                           |
| `sidebar-accent`         | `#263A38`  | Active navigation background                      |
| `border`                 | `#3C4D50`  | Decorative separation, panel rules                |
| `border-strong`          | `#71837E`  | Edges that identify important controls            |
| `input`                  | `#647674`  | Input border                                      |
| `foreground`             | `#EEE5D2`  | Primary reading, panel/title text                 |
| `text-secondary`         | `#C1C8BD`  | Descriptions with normal emphasis                 |
| `muted-foreground`       | `#A9B5B1`  | Labels, secondary numbers, metadata               |
| `text-disabled`          | `#738580`  | Disabled information only                         |
| `primary`                | `#D2AF70`  | Brass actions, fine rules, navigation selection   |
| `primary-foreground`     | `#172023`  | Text on a solid brass button                      |
| `ring`                   | `#E4C58B`  | Keyboard focus; never replaced by hover           |
| `success`, `xp`          | `#91BDA0`  | Progress, equipped marker, positive comparison    |
| `warning`                | `#E2B974`  | Missing requirements, caution with an explanation |
| `danger`                 | `#ED9C8F`  | Error text, negative comparison, discard edge     |
| `destructive`            | `#A54439`  | Destructive button fill                           |
| `destructive-foreground` | `#FFF0E5`  | Text on destructive buttons                       |
| `info`                   | `#96BDD0`  | Informational status or future mana resource      |
| `currency`               | `#E2BC73`  | Gold balances, prices, trade totals               |

Card and popover foregrounds equal primary reading text; secondary/accent foregrounds also use `#EEE5D2`. Sidebar foreground equals `#C1C8BD`. Its primary and ring follow the global values. There is no independently invented “success green” inside a component.

**Behaviour:** hover raises a dark surface one step; selection adds a structural edge/marker; pressed controls move down 1px; focus uses a 2px pale brass outline with a 3px offset (shared buttons also use a ring); disabled controls reduce emphasis and cannot be activated. Do not lower the opacity of a whole category merely because its values are zero.

`--border` is often a decorative divider and is not a sufficient boundary for every interactive control. Use `--input`, `--border-strong`, shape, readable labels and focus for controls. Never assume an arbitrary alpha tint meets contrast requirements.

## 7. Typography

**One family:** locally bundled Geist Sans (`geist/font/sans`), then Arial/sans-serif. `--font-display` points to Geist as well. No serif headings or remote font requests. The root document applies the font variable once; game layouts do not install another font or another `html/body` pair.

| Role                  | Size / line height | Weight / treatment                 |
| --------------------- | ------------------ | ---------------------------------- |
| Homepage hero         | 48–72px / 1.05     | 600, sentence case, tight tracking |
| Wordmark              | 24px / 1           | 700, -.04em tracking               |
| Page title            | 28–36px / 1.2      | 650, -.04em tracking               |
| Panel/section heading | 18px / 1.4         | 600, -.02em tracking               |
| Resource/item title   | 18–20px / 1.25     | 600; long names wrap               |
| Dialog title          | 20px / 1.25        | 600; reserve close-button space    |
| Body / controls       | 14px / 1.5         | 400 / 500–600                      |
| Stat values           | 13–14px / 1.5      | 600, tabular numerals              |
| Secondary copy        | 12–14px / 1.5      | 400                                |
| Journal eyebrow       | 11px / 1.5         | 600, uppercase, .1em tracking      |
| Equipment label       | 11px / 1.3         | Sentence case, muted               |

Uppercase is limited to one short page eyebrow or a compact level label. Navigation groups, buttons, category headings and item names use natural case. Remove annotations that merely repeat the neighbouring heading. Do not use tiny numeric rarity seals. Prefer tabular sans-serif figures over code-like monospace in normal gameplay.

## 8. Shape Language

Use **soft, confident rectangles**. The shared radius token is 14px: panels use `rounded-lg` (14px), standard inputs/dialogs use `rounded-md` (12px), buttons 8px. Inventory cells are 12px, navigation entries 10px, resource cards 12px, item popovers 16px, small rarity symbols/badges 7px and quantity labels 4px. Progress tracks have rounded 7px ends. Avatar, level dial and currency capsule may be circular/pill-shaped.

Rounded corners are functional comfort. Character comes from the art, restrained material tint, crest and rarity system, not from making every corner sharp. Do not add simulated screws, leather straps or nested ornamental frames.

The portrait has a fine outer brass edge, 14px corners and a very faint inner highlight. On desktop its minimum height is 320px and it stretches with the equipment panel; its absolutely positioned image does not dictate the grid height. Do not clip interactive containers: focus rings, rarity marks and dragged items must remain visible. Only the portrait image is intentionally cropped.

## 9. Spacing & Layout

Use a 4px spacing base: 4, 8, 12, 16, 20, 24, 32, 48. The intentional 10px exception is dense inventory spacing.

- Rail: 248px, fixed on desktop. A fixed header (mark, character card, utility row, search) above its own vertical scrolling navigation area.
- Content: one shell inset; a maximum 1360px content wrapper including padding; 36px side gutters, 24px at narrower desktop/tablet, 16px on phones.
- Top bar: minimum 76px desktop / 68px mobile; sticky, opaque enough to read; grows when an action must wrap.
- Page heading: 28px below, no bottom rule. Short description only if it helps orient the player.
- Major panels: 24px apart. Panel header: 22px top / 24px sides, no dividing line; body: 24px; mobile header: 18px top / 16px sides, body: 16px.
- Profile: portrait plus wider equipment panel; inventory below; attributes below the collection, with Character open and other categories expandable. At 900px and below, stack the portrait above equipment so the body arrangement keeps enough room.
- Vocation: resources plus a right column; stack at 1100px. Keep the resource choice and its cost close together. The right column reads Nearby, Your progress, Current activity (only while one runs) and Metrics, each under a centred `game-section-label` caption. Skill progress is a collapsible: closed it is one row (icon, name, level plaque, bar), open it adds the level, the XP still needed and the percentage. Metrics are lifetime totals — items gathered, total experience, time spent — from `UserSkillMetric` and `UserTrackProgress`.
- Marketplace: one compact, borderless filter toolbar (search, item type with sprites, rarity, unit price, sort) above the results and a sticky selected-market panel (320px at `lg`, 380px at `xl`). The toolbar is a single row from `xl` and wraps below it. Result rows switch between the compact and four-column layouts with a container query on the results panel, not the viewport. Below `lg` the selected market opens in a bottom sheet.

Do not nest Tailwind `container` inside `game-content`. Use `min-w-0` for shrinking grid/flex children. Tables and the atlas own their horizontal overflow; the page does not.

## 10. Surface / Panel System

| Surface         | Construction                                                                                |
| --------------- | ------------------------------------------------------------------------------------------- |
| Canvas          | Ink background; very low-strength green atmospheric light in one corner                     |
| Recess          | Dark inset, fine edge, shallow inner shadow; reserved for objects and controls              |
| Panel           | Card surface, 1px divider border, 14px radius, soft downward shadow and faint top highlight |
| Flat panel      | `game-panel-flat`: the same card surface and shadow with no border; rows inside are separated by tint (`game-metric-row`) |
| Interactive row | Panel-like surface; border strengthens on hover; native button                              |
| Overlay         | Popover surface, stronger edge, opaque body, larger downward shadow                         |

Panel shadow is `0 4px 20px #080F121F, inset 0 1px 0 #EEE5D207`. Overlay shadow is `0 18px 50px #060C10A6, inset 0 1px 0 #EEE5D215`. Shadows separate layers; they are not ambient magical glow.

Prefer the flat panel for new surfaces: separate things with tint and spacing rather than outlines. Do not put a border on a panel, a row or a badge in new UI.

Use an unruled header for equipment/inventory/progression; separate it from contents with spacing. Avoid wrapping every single statistic in a second card. Use rows and separators inside a section. A neutral panel does not brighten on hover unless it is actually interactive.

## 11. Buttons

Use `src/components/ui/button.tsx`. Keep Radix `asChild` for links; never nest a link inside a button.

- **Primary:** brass fill, dark ink text, thin brass edge. Start gathering, confirm listing/purchase, sign in or begin a journey. One primary decision per dialog.
- **Secondary:** dark raised fill, parchment label. Unequip, inspect, choose a secondary action.
- **Outline:** inset/canvas fill with visible boundary. Cancel or less prominent navigation.
- **Ghost:** transparent until hover, then raised dark surface. Low-emphasis utilities.
- **Destructive:** oxblood fill and pale text. Use only when data/items are actually lost; stopping an action or unequipping is not inherently destructive.
- **Icon-only:** 40px or larger box, accessible verb label, 16–20px icon. Close controls are 40px.
- **Disabled:** 50% opacity, no hover/press action. Explain blocking conditions nearby if the player cannot infer them.
- **Pressed:** 1px downward movement, no bounce. Keyboard focus remains visible.

Default height is 40px; small buttons 32px are for compact auxiliary controls. Prefer 44px for touch-dominant new actions. Labels describe effects: “Choose seeds”, “Split stack”, “Confirm purchase”. Do not use a gold-filled button just to make an unimportant action prominent.

## 12. Navigation

Use `GameNavigation`; its server wrapper fetches the real skill names and keeps the Gardening and Gathering fallbacks, plus the player's skill levels. Destinations live in `navigation-links.ts` so the rail and the search share one list. Icons identify actual vocations: axe, pickaxe, fish, flame, sprout and leaf. New skills without a mapping fall back to a leaf until a suitable icon is chosen.

Entries are compact: 32px rows, a 17px icon, a 13px label, and — for a skill — its mastery level in a small plaque at the right. **Navigation carries no borders.** Selected state = darker green surface + brass label/icon + `aria-current="page"`. Hover = a faint raised surface. Neither state requires animation. Labels stay visible on desktop. Groups (Character, World, Bestiary, Vocations, Crafting, Trade) are Radix collapsibles whose heading is a small muted caption with a chevron; the open/closed choice lasts for the session.

The rail header holds, in order: the mark, a character card (avatar, name, level) that opens the profile, a six-button utility row, and the search box. Utility buttons are 32px and icon-only, each with a shadcn tooltip naming it; features that do not exist yet (notifications, messages, friends, settings) say "work in progress" in that tooltip and do nothing when pressed. Pins open a popover listing up to five player-chosen shortcuts and a button that pins or unpins the page they are on; pins are kept in the browser, not on the character. Search opens a cmdk dialog (Ctrl/Cmd + K) over pages, items, beasts, NPCs and settlements, served by `/api/search`. The rail has no footer.

The mobile rail becomes a Radix Sheet, opened by a labelled menu button. Escape closes it, focus is trapped while open, and focus returns to the trigger. Link activation closes the sheet. Inventory links to `/profile#inventory`; it is a section shortcut, not a duplicate profile route. My listings has its own navigation destination.

Future notifications: a small filled dot plus an accessible count/name, or a compact count at the right. Never use an unexplained blinking dot.

## 13. Item Slots

A slot is a **68×68px object recess**, with 12px corners and 5px image padding. Use `object-contain`, never crop a sprite. Inventory cells keep their size as columns change. Equipment cells adapt between 44px and 64px to preserve the anatomical arrangement on narrow screens. Compact market thumbnails use the same frame at 56px.

- Empty inventory: quiet inset surface, no repeated plus signs. Empty equipment: a quiet outline icon of the gear type and a persistent label below.
- Occupied: full rarity-coloured frame and a restrained radial tint behind the object. Frame intensity scales by tier (section 26). Quantity remains inside a dark plaque at the lower-right.
- Epic and above: a small distinct rarity symbol at the upper-right. Legendary/Mythic/Divine add a 2px frame and a modest still aura. Never animate all rare inventory items.
- Equipped: a 6px green dot at lower-left, separate from the rarity symbol. Details offer “Unequip”; equipment labels supply context.
- Hover/open details: subtle parchment tint on the trigger. Keyboard focus: visible outline outside the frame.
- Valid drop/hover target: 2px green outline offset 2px. Discard target uses danger instead, remaining distinct from a red Mythic frame.
- Locked, if supplied by a future system: lock symbol and a reason in details; do not repurpose the dashed Worthless/Broken frame as the sole locked indicator.
- Disabled: keep the object visible; disable the unavailable action in details and explain why.
- Newly acquired, when an acquisition event exists: one 320ms reveal and a small “New” label that clears after inspection. No current fake acquisition state is introduced.

Equipment entries derive from `EQUIPMENT_SLOTS`, preserving all logical slots and indices. Shoulders, bracers and gloves appear on both sides of a subtle figure outline; each pair still represents one equipped item. Each visual position has a unique droppable and draggable ID, while both sides share the canonical equipment index. Give the two sides distinct accessible labels. The two rings remain separate logical slots. Weapons and tools sit to the left, and jewelry and backpack to the right. The main hand is level with the shoulders and the off hand sits beneath it; while a two-handed weapon is held, the off hand shows a non-interactive copy of it at 65% opacity. Tools sit in their own scrolling list that shows two at a time, so adding a tool never makes the panel taller. Because that list scrolls, dragged items are drawn in the drag context's `DragOverlay` rather than moved in place. Count logical equipped slots once. The loading skeleton uses the same arrangement. Preserve this body-shaped composition rather than turning equipment into an inventory grid.

Inventory always renders every occupied slot in its original position and six trailing empty targets (at least 18 total, capped to capacity). “Show all 85 slots” reveals the remaining empty capacity. It does not compact or renumber saved inventory. Discard lives in an expandable section with the existing replacement-to-delete consequence stated clearly. Splitting is available in the item menu and retains the right-click shortcut.

## 14. Tooltips

Simple help is a Tooltip; interactive item information is a Popover. Never put equip/list/split controls in a disappearing hover-only tooltip.

**Item detail order:** 80px framed artwork alongside the rarity symbol/name, coloured item title and equipment category → description → aligned stat rows → currency value → actions → unavailable-action explanation. The full popover edge and subtle upper tint continue the rarity treatment.

Item popovers are 360px, capped at viewport minus 24px, with internal scrolling if space is limited. They are opaque. Open item details with focus on the content; the next Tab reaches the first action and scrolls it into view. Simple tooltips are at most 320px, use 12px text, and have a strong boundary. Do not blur the item behind its own text.

Future comparisons show signed values with a plus/minus and a word or icon as well as success/danger colour. Flavour text uses a short sans-serif italic paragraph below factual description, never mixed into the stat list. This release preserves available item descriptions and does not invent lore for each item.

## 15. Progress / Resource UI

XP uses green patina. Currency uses brass-gold. If health and mana bars are introduced, use danger/info respectively, with an explicit label and value; do not infer current resource values from maximum-stat metadata.

Progress tracks are narrow, 7px high and softly rounded. Show the level, percentage or remaining XP in text as appropriate. Use tabular numerals for changing counts. Clamp visual progress to its valid range. Existing timer/server calculations stay authoritative.

`ActionFillBar` supplies labelled progress semantics and retains the existing lagged preview. A compact active-action strip can live in the header; its text sits above a subdued fill so readability does not vary with percentage. Do not announce every timer tick to a screen reader. Completion summaries and toasts are the event-level feedback.

The garden keeps its six-column topology. A plant is readable above a small timer plaque; timer text can shorten to hours/minutes/seconds in a tile. A ready crop adds green edging and “Ready”, not colour alone. Selecting a plot adds a visible checkmark. Long explanations belong above the garden or in the seed dialog.

## 16. Modals & Overlays

Use existing Radix Dialog and Sheet primitives. Dialog body = opaque popover surface, stronger border, 12px radius, overlay shadow. Backdrop = ink at 85%. Default width 512px, capped to viewport minus 32px; maximum height viewport minus 32px with internal scroll.

Title at the top, context below, one decision area at the bottom. Close is always labelled and at least a 40px hit area. Descriptions explain the consequence and requirements. Purchase/listing summaries show quantity, price, tax and proceeds without changing calculations.

Opening: 180–200ms fade with a tiny settle. Closing: 120–180ms. Keep existing Radix focus management and Escape support. Use mobile sheets for navigation, not as a reason to convert every existing game dialog. Never place a custom fixed tooltip inside a transformed ancestor.

## 17. Icons

Lucide is the interface icon family already installed. Use 16–20px icons, 1.5–1.75px stroke weight, one inherited semantic colour. An icon accompanying text is `aria-hidden`; icon-only actions get an accessible name on the control.

The existing raster coin stack remains a small currency identifier at 14–18px. It is a legacy exception to the line-icon family, not a model for new navigation icons. Use real item sprites for inventory, rewards and resource choices. Do not substitute emoji for sprites, and do not reuse one profession's symbol for unrelated skills.

## 18. Backgrounds

The normal play canvas is dark ink with a single soft green atmospheric light, approximately `#4B675328` fading to transparent across 55% of the field. It contains no moving particles, dashboard grid or heavy noise texture.

The homepage/authentication may use `homepage/background1.jpg`, covered by a dark ink gradient strong enough for all reading surfaces. The existing heroine remains foreground art on the homepage. Avoid covering her face with text.

The colourful world map is framed as an atlas page. Never spread it behind the inventory, forms or statistics. Landmark controls use opaque dark plaques and open an informative travel dialog; the primary travel decision remains inside that dialog. Map overflow stays inside its bounded, focusable scroll region, which initially keeps the player's current location in view.

## 19. Effects & Decoration

Approved: fine portrait highlight, green equipped dot, full rarity frame, object-local radial tint, distinct rarity symbols, still aura on high tiers and quiet surface shadows. Each has a specific meaning or structural role. Clean headers and generous space remain free of ornamental rules.

Avoid particles on common items, vignette over form text, random lens flares, animated noise and independent coloured shadows. Do not bake UI decoration into a sprite. Colour does not spill from a crystal onto neighbouring slots.

Future exceptionally rare reveals may use a single restrained sweep across the slot, maximum 400ms. Their resting appearance returns to the normal slot system.

## 20. Motion / Animation

`--ease-game: cubic-bezier(.2,.7,.2,1)`. Durations: fast 120ms, normal 180ms, reward 320ms. These tokens are the defaults for new CSS; existing Radix animations use their nearby 200ms timing.

- Hover/focus: colour/border transition, no scale.
- Press: 1px down. Release returns immediately through the same easing.
- Progress: interpolate only the fill; labels do not bob or change size.
- Modal: fade/settle; no spring or overshoot.
- Travel confirmation: after the server accepts the journey, draw the route once in under one second, then return to a still progress state. Never loop the route effect.
- Reward: one short event response, then stillness.
- Loading: a skeleton or small activity indicator only while work is actually pending.

`prefers-reduced-motion: reduce` suppresses animations/transitions globally while preserving state changes and text feedback. Never tie a game mechanic or API call to the end of an animation.

## 21. Responsive UI Rules

Required review sizes: **1440×1000**, **1024×768**, **768×1024**, **390×844**, and **320×740**.

Below 768px, remove the permanent rail/inset and expose the menu Sheet. At 1100px, stack vocation and marketplace columns. At 900px, the profile stacks its portrait above equipment; the portrait becomes a bounded 260px image, increasing to 300px below 768px. The equipment keeps its body arrangement at every breakpoint.

Do not shrink text to make columns fit. Wrap descriptions and action rows. Preserve 68px inventory cells and 44px minimum garden cells; a very narrow garden can scroll within its own region without changing which plot is where. Map and market tables can scroll locally. Let dialogs scroll vertically and ensure the close action remains reachable.

Verify the browser’s `scrollWidth` against viewport width. Test long item/skill names, full quantities, empty lists, and an active action in the top bar. At 200% zoom content should reflow rather than hide navigation or the primary action.

## 22. Accessibility / Contrast Requirements

Target WCAG 2.2 AA: at least **4.5:1 for normal text**, **3:1 for large text**, and **3:1 for necessary non-text control/state indicators** against adjacent colours. Large means 24 CSS px regular or approximately 18.7px bold, not simply a component named “large”. Use solid pairings from this palette for reading.

- Body, secondary labels and rarity text must pass against their intended dark surface. Muted Worthless/Broken tones also receive the parchment text fallback. Decorative faint rules need not carry a state alone.
- A custom rarity colour from administration is retained; it may not pass. The frame preserves custom colour; `resolveRarityTextColor` uses parchment for text if the colour falls below 4.5:1 against the tinted detail surface. Badges always include the written rarity.
- Controls have a visible focus state; the header must not obscure focused content. The shell has a skip-to-content link.
- Native buttons for resource choices and stop actions; labelled inputs/selects; keyboard activation for market rows; no mandatory hover interaction.
- Target size: never below the 24×24px WCAG minimum without a valid spacing/equivalent-control exception. Prefer 40–44px for actions; item slots are 68px.
- Rarity has a name and distinct symbol, ready crops have text, selection has a check, errors have a message. Do not rely solely on red/green.
- Use correct headings, progressbar values, dialog titles/descriptions and focus return. Do not add rapid live announcements for progress ticks.

Standards: [WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). These are acceptance requirements; the automated checks and manual coverage are recorded separately, not a blanket compliance certification.

## 23. Item Sprite Art Direction

**Style: faceted field specimens.** Illustrate a tangible object as if a skilled atlas illustrator recorded it with small, decisive painted planes. Believable construction, simplified mass, an unmistakable contour. Medium stylisation, no photographic microdetail.

| Attribute         | Requirement for new assets                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Master canvas     | 1024×1024px RGBA, genuine transparent background, sRGB                                                                                               |
| Runtime export    | 256×256px transparent WebP or PNG; 512px only where a large detail view needs it                                                                     |
| Camera            | Orthographic-like three-quarter view, about 20° above the object, about 25–30° yaw; no wide-angle lens or strong foreshortening                      |
| Direction         | Long tools/weapons run handle lower-left to working end upper-right, about 45°; tool head can project right                                          |
| Rounded resources | Front/identifying cut face points lower-left/front; object recedes upper-right; no arbitrary reverse orientation within a family                     |
| Occupancy         | Longest nontransparent dimension 76–84% of canvas, centred optically; 8–12% safety margin on each edge                                               |
| Proportion        | Main functional part enlarged 10–15% for recognition; robust handles, not needle-thin shafts                                                         |
| Silhouette        | One dominant mass plus at most two secondary masses; no loose unrelated props                                                                        |
| Edge              | Crisp painted edge; local dark material edge approximately 1px at 64px output where needed; no uniform black contour thicker than 1px                |
| Light             | One warm-neutral key from upper-left at about 10 o’clock/45° elevation; broad cool fill, not a second visible lamp                                   |
| Shading           | Three dominant value families: light, local midtone, cool shadow. Five to seven broad material planes; avoid airbrushed plastic gradients            |
| Highlight         | Short broken strokes on bevels; highlights occupy less than 8% of the object; no white bloom                                                         |
| Shadow            | Painted self-shadow, cooler/darker than local material; no ground, cast shadow stage, drop shadow or floating black ellipse                          |
| Texture           | Two or three broad identifying marks; readable at 64px; no pore maps or endless wood grain                                                           |
| Colour            | Restrained natural materials; warm highlights, desaturated teal-grey shadows. Saturated accents occupy at most 15% except inherently colourful crops |
| Effects           | No ambient halo, particles, frame, text, rarity colour, UI quantity, watermark or vignette                                                           |
| Readability       | Category obvious at 32px, material at 64px, identifying detail at 128px                                                                              |

The useful existing tool direction comes from the felling axe/pickaxe/tin sword; the useful resource mass comes from ore, logs and vegetables. Existing bright log halos are **not** part of the specification. Existing 128px fish and 160px cartoon axe are resolution/style exceptions; do not upscale them as if new detail exists.

**Category construction:** weapons need one strong blade/head and a visible grip; armor should be empty wearable forms, with no mannequin; paired gloves/boots are one controlled overlapping pair; tools communicate their working edge; resources use one chunk/log/fish or a compact coherent pile; consumables use a simple bottle/vessel with one clear contents colour; quest objects get one identifying symbol, not extra glow; artifacts use an unusual silhouette and controlled material contrast instead of more particles.

## 24. Character / Creature / Pet Art Direction

Characters and creatures exist in the art library. Pets have no implemented collection UI; these rules are prospective art requirements, not new mechanics.

- Humans: 6.5–7 heads tall, moderately enlarged hands/gear, grounded proportions. Three-quarter pose toward the viewer with the face readable. Painted planes and hair clumps; no skin pores, anime eyes or glossy lips.
- Clothing: functional layers with a restrained violet/indigo accent, drawn from existing heroine/warrior art. Brass trims and cool steel. Do not clad every villager in legendary armor.
- Portrait: face in upper-middle, clear eyes/brows, shoulders support silhouette; crop around chest; lighting agrees with item sprites. Use a quiet cool background if the brief is explicitly a portrait.
- Full body: feet contained, 82–88% height, neutral or purposeful pose, no dramatic perspective mismatch. Transparent export for use over the world/UI.
- Goblins/creatures: one memorable proportion (ears, jaw, shell, etc.), readable limbs and face, three main colour masses. Keep the expressive goblin character without thick mascot outlines.
- Pets, if commissioned: anatomically legible miniature creatures, one distinguishing feature, around 75–82% canvas occupancy; affectionate through expression/pose rather than huge bobble heads.

The original portrait and heroine are retained as established work. Their detailed rendering is not permission to add photographic finish to new 32px item art. Do not mix the experimental pixel character into the painted production family.

## 25. Material Rendering Rules

| Material                | Paint it this way                                                                    | Never                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Iron / steel            | Blue-grey planes, charcoal undersides, one pale bevel stroke, one or two nicks       | Chrome mirrors, studio reflections, random electric-blue rim         |
| Brass / gold            | Ochre midtone, umber shadow, pale straw highlight; broad embossed geometry           | Yellow bloom, every pixel shiny, excessive filigree                  |
| Wood                    | Warm brown body, two broad grain paths, lighter cut surface, a readable knot         | Black line hatching everywhere, molten orange emission               |
| Stone / ore             | Four to seven angular planes, cooler shadows, two or three mineral flecks            | Photographic gravel texture, indistinct rubble piles                 |
| Crystal                 | Three to five large facets, dark base, one contained light face                      | Rainbow reflections, lens flares or colour leaking into transparency |
| Cloth                   | Matte colour, two or three broad folds, clear hem                                    | Micro weave or plastic satin shine                                   |
| Leather                 | Warm desaturated brown, compressed edge, one seam and one broad worn area            | Dense embossed patterns on a 64px object                             |
| Organic matter          | Soft but deliberate planes, one defining cut/leaf/gill shape, natural local colour   | Wet photographic specularity or unrelated decorative foliage         |
| Magical matter          | Unusual internal form, one accent hue; emission only inside the silhouette           | Rarity-coded halo or particles baked into the file                   |
| Potion / glass          | Slightly opaque illustrated glass, one side highlight, clear liquid mass and stopper | Realistic refractive caustics or ornate gold cages on basic potions  |
| Currency                | Three to five thick coins, one simple stamped notch/sigil, compact stack             | Highly saturated cartoon outline or many scattered tiny coins        |
| Seeds / small resources | Compact group of three to five, varied tilt, consistent light                        | A single unreadable speck or exploding scatter of particles          |

Use one primary and at most one secondary material on common equipment. Exceptional artifacts may use three. Material richness comes from value design and silhouette before texture.

## 26. Rarity System

Preserve all **12 existing tiers and their mechanical order**. Rarity should be immediately noticeable in the collection and rewarding to inspect. Use colour, edge strength, background light and a symbol together. Detailed views always spell out the rarity; the trigger’s accessible name includes it. Order numbers below document mechanics and are not printed on slots.

| Order | Tier      | Exact display colour | Symbol             |
| ----- | --------- | -------------------- | ------------------ |
| 01    | Worthless | `#A4AAA5`            | Dashed circle      |
| 02    | Broken    | `#C69D82`            | Broken link        |
| 03    | Common    | `#C1C8BD`            | Circle             |
| 04    | Uncommon  | `#78C995`            | Leaf               |
| 05    | Rare      | `#79B9EB`            | Diamond            |
| 06    | Exquisite | `#70D7CF`            | Faceted gem        |
| 07    | Epic      | `#BD9AF7`            | Four-point sparkle |
| 08    | Elite     | `#EB9CC6`            | Star               |
| 09    | Unique    | `#EEAE77`            | Hexagon            |
| 10    | Legendary | `#F2C66D`            | Crown              |
| 11    | Mythic    | `#FF9289`            | Flame              |
| 12    | Divine    | `#FFF0CA`            | Sun                |

The rarity colours intentionally have more saturation than the surrounding UI. Warm gold should feel precious; Mythic has clear ember-coral energy; Divine is warm luminous ivory. Do not make Legendary look like a routine brass button or let the base palette mute its identity.

**Frame construction (`rarity-frame`):** blend the edge colour into `surface-inset`; place a radial colour wash at 50%/100%, fading to transparency at 80%, over the dark inset. Keep the object itself naturally coloured.

| Tiers                     | Edge / wash strength             | Rim / aura                   |
| ------------------------- | -------------------------------- | ---------------------------- |
| Worthless, Broken         | 1px dashed, 45% colour / 5% wash | None                         |
| Common                    | 1px solid, 45% / 6%              | None                         |
| Uncommon                  | 1px solid, 65% / 12%             | None                         |
| Rare, Exquisite           | 1px solid, 85% / 18%             | None                         |
| Epic, Elite, Unique       | 1px solid, 95% / 24%             | 8% inner rim, 7% 16px aura   |
| Legendary, Mythic, Divine | 2px solid, 100% / 30%            | 18% inner rim, 16% 16px aura |

For the top three tiers, mix 25% white into the top edge for a still light catch. Epic and above get a 21px dark-backed symbol at top-right; other tiers keep symbols in their detail badges. Quantity and equipment dots occupy separate corners. A high-tier frame remains visible even around opaque legacy artwork.

**Details:** use the rarity-coloured title, 80px framed art, written badge with symbol, full coloured popover edge and 12% upper surface tint. The top three tiers have a full-strength edge and a soft 28px/12% aura. Badges use 10% tint and a 45% edge. Never use an opaque bright rarity panel behind long descriptions. Static frames remain expressive with reduced motion; no pulses, sparkles drifting over neighbours or looping sheen.

Implementation lives in `RARITY_VISUALS`, `resolveRarityColor`, `resolveRarityTextColor` and `rarityStyle` in `src/utils/rarity-colors.ts`, plus `RarityMark`, `ItemRarityMark` and `RarityBadge`. Known legacy default database swatches resolve to this display palette; valid explicit custom `#RRGGBB` colours remain authoritative. Database records and rarity multipliers are unchanged. Custom frame colours are preserved, with a parchment text fallback below 4.5:1 against the 12% tinted popover. The old Tailwind helper remains for admin compatibility; player UI uses actual CSS colours. Compact labels, such as rarity filter options, pair a `game-rarity-chip` (the symbol on a small tile tinted with its colour) with `game-rarity-text`.

Rarity stays in the interface. The same natural-coloured sprite can represent different rarity instances. Do not bake rarity light into asset files.

## 27. AI Asset Generation Guidelines

Generation is a draft stage; the written rules plus inspection determine acceptance. Do not claim that one prompt guarantees consistency. Generate one asset per file. Keep a family’s camera, light and silhouette scale fixed across requests.

1. Combine the complete base prompt below with an item-specific brief and its material rule.
2. Specify whether a file is a sprite, portrait, full-body character or landscape. Do not silently use portrait backgrounds for inventory items.
3. Generate a 1024px master on true transparency; preserve the original and prompt. Create a separate runtime export.
4. Check alpha over ink, parchment and magenta. Reject fake checkerboards, white mats, fringe/halo contamination and baked drop shadows.
5. Inspect at 32, 64 and 128px, beside a tool, crop and metal resource. Reject a design whose recognisable feature disappears.
6. Compare long dimension/centering and light direction numerically/visually. Regenerate if the view differs; do not rotate a sprite with painted lighting to fake conformity.
7. Save files under the existing category directories with descriptive kebab-case names. Version new artwork (`-atlas-v1`) instead of overwriting a good original without review.
8. Update the consuming sprite reference deliberately. Do not rename IDs, item types, equipment slots, stats or database rows just to fit art naming.
9. Record original prompt, chosen output and known exceptions. Do not use another game’s name as a shorthand style reference.

A screenshot contact sheet of existing assets is an audit aid, not a universal style reference: several legacy assets conflict. The camera/material specification here wins.

## 28. Reusable AI Asset Prompt

Copy this entire prefix, then append an item description. It is intentionally independent of unavailable visual references.

```text
Create one inventory item sprite for Aergyle, in the “Wayfarer’s Atlas” art direction.
A tangible fantasy field specimen, illustrated with decisive faceted paint: believable
construction, simplified chunky mass, crisp silhouette, three dominant value families,
five to seven broad material planes, two or three identifying wear/texture marks.
Medium stylisation; a crafted atlas illustration, not a photograph or a 3D product render.

1024 by 1024 square RGBA canvas, genuinely transparent background. One isolated subject,
optically centred, longest visible dimension 76–84 percent of the canvas, 8–12 percent
clear margins. No floor, cast-shadow stage, border, label, text or vignette.
Orthographic-like three-quarter view, camera approximately 20 degrees above and
25–30 degrees around the object. Long tools/weapons run from lower-left handle to
upper-right working end at approximately 45 degrees. Other objects show the identifying
front face toward the lower-left and recede toward the upper-right.

One warm-neutral light from upper-left at 10 o’clock and 45 degrees elevation.
Cool desaturated teal-grey self-shadows; no second coloured rim light. Three clear
value groups. Short broken highlights on useful edges, under 8 percent of the object.
Local dark edge only where needed, no thick uniform black outline. Natural restrained
material colour; do not tint the whole item brass or green. Slightly enlarge the useful
head/blade/cut face by 10–15 percent for recognition. Readable category at 32px,
material at 64px and individual identifying feature at 128px.

No photorealism, anime, pixel art, plastic gradients, chrome studio lighting, tiny
filigree, muddy painterly smears, heavy cartoon outlines, ambient glow, bloom, particles,
rarity effects, floating shadow, checkerboard pattern, watermark, lettering or UI.

SUBJECT AND MATERIALS: [insert the item-specific description]
```

If the image service supports a negative-prompt field, move the “No…” paragraph there but keep the transparency and composition requirements in the positive prompt. If it does not, keep the paragraph as written. For characters, replace the item camera/proportion paragraph with section 24; retain material and lighting constraints.

## 29. Examples of Correct Asset Prompts

Each of these is appended to the complete prefix above; none relies on “match existing assets”.

**Simple Felling Axe (Woodcutting tool):** A single practical iron felling axe with a straight warm oak handle. Handle points lower-left; head upper-right, blade extending right. Slightly enlarged wedge-shaped head, two rivets, one bright cutting bevel, one dark cheek plane, two broad grain paths in the wood. Brown leather grip with one seam. Worn but serviceable, no gold, gems or magical effect.

**Oak Log (resource):** One short thick oak log. Its pale ochre cut end faces lower-left/front, its length recedes upper-right. Three visible growth rings, one asymmetric crack, chunky umber bark split into five broad ridges. The cut surface reflects warm light but does not emit light. No ground, leaves, tools or loose sawdust.

**Iron Ore (mining resource):** One compact asymmetrical fist-sized dark stone with five angular grey-brown planes and two broad dull iron deposits. Top-left face lightest, underside cool charcoal. Large clear silhouette, no crystalline neon seams or gravel pile.

**Iron Ingot (blacksmithing resource):** One weighty trapezoidal cast iron ingot, long axis receding upper-right. Broad cool-grey top face, dark side face, one pale upper-left bevel stroke and a single shallow casting notch. Matte steel with sparse wear; no writing, polish, glow or pedestal.

**Tomato Seeds (garden seed):** A tight group of five plump ochre tomato seeds, with varied tilt and shared upper-left lighting, occupying one compact oval silhouette. Three-value paint, one highlight per seed, no floating particles or green leaves. Keep the cluster legible at 32px.

**Perch (fishing resource):** One compact freshwater perch pointing right, subtle three-quarter view with the left flank readable. Warm olive and ochre body, three broad dark flank bars, muted orange fins, one small bright eye. Simplify fins into coherent shapes; no water, hook, fishing line or wet photographic gloss.

**Healing potion family (consumables):** Five transparent glass flasks carrying an unmistakable deep red liquid mass. Progress visibly from the squat Minor Healing Potion through Small, Medium and Big Healing Potions to the largest, heavily sealed Trollblood Elixir. Each uses a broad illustrated glass silhouette with an upper-left highlight; no floor, label, magical vapour or scattered gems.

**Future goblin portrait:** Replace the item-specific camera/composition paragraph with: a bust of a resourceful goblin looking three-quarter toward the viewer, one long folded ear and a broad cheek silhouette, worn cloth collar, compact face with readable brows; cool ink background, warm upper-left key, painted planes, no pores, no huge anime eyes or comedy bobble-head proportions. This is creature artwork, not an assertion that a playable goblin route exists.

## 30. Visual Do / Don’t Examples Described in Words

- **Do:** a clear sans-serif “Woodcutting” heading with generous breathing room, two timber choices with clear XP/time, quiet progress to the side. **Don’t:** “Woodcutting Skill Header” inside a grey rectangle with every statistic in a bright badge.
- **Do:** a dark rounded 68px recess, contained oak log, quiet full frame and quantity 9999 at the lower-right. **Don’t:** a quantity pill hanging into the row above and an orange glow around the entire card.
- **Do:** a 40px brass “Start” beside an outline “Cancel”. **Don’t:** three equally saturated green, blue and red actions competing for attention.
- **Do:** a simple iron cutting edge with three broad light values. **Don’t:** a common axe covered in gold filigree or a photographic axe shot under two studio lights.
- **Do:** a green crop edge plus “Ready”. **Don’t:** communicate readiness using hue alone.
- **Do:** opaque item details with a strong title and right-aligned values. **Don’t:** white text competing with a blurred portrait behind it.
- **Do:** keep map brightness inside its own framed region. **Don’t:** put semi-transparent inventory tiles over a full-screen world map.

## 31. Rules for Future UI Screens

Start with `PageHeading`, then a clear task area. Reuse `game-panel`, its spaced header/body, the existing Button primitives, sprite stages and semantic tokens. Avoid one-off global selectors that repaint arbitrary Tailwind classes.

Choose one primary action, show its prerequisites and consequence nearby, and expose a useful empty state. Use existing React Query/context/service flows. A visual redesign must not cause a new request on every animation frame or force a database migration.

Specify loading, empty, error, locked, active, complete and mobile states before declaring a screen done. Use truthful state from the existing API. Never turn a temporary absent response into a fake “all clear” state.

Review the screen with the wordmark hidden: clear type, warm art, forest-dark surfaces and collection treatment should still identify Aergyle. On phones, the same information order should remain understandable; do not simply hide the most difficult column.

## 32. Rules for Future Designers and Coding Agents

- Read this document and the relevant component before editing. Check the current route in a running browser; source inspection alone is not visual QA.
- Use the single root font setup. Keep new tokens in globals/Tailwind, new rarity decisions in `rarity-colors.ts`. Match exact roles, not whatever stock utility looks close.
- Reuse existing Radix behaviour and dnd-kit data. No large UI library is needed for these surfaces.
- Preserve the crest and strongest existing art. Do not repaint everything merely because a new tool is available.
- **Legacy-art policy:** current jewelry, revolver, backpack/potion stages, cartoon coin and a few heavily outlined sprites remain compatibility assets. The uniform frame improves their presentation but does not make them conforming new illustrations. Replace them by family, using the prompts above, and review at real slot size. Do not present them to an image model as the canonical style.
- New art has to pass alpha, camera, occupancy, lighting and small-size checks. New UI has to pass hierarchy, keyboard, contrast and responsive checks.
- Only one agent/designer should change the shared palette at a time. If identity changes, update this bible and the implementation together; do not accumulate competing “v2 final” guides.
- Keep migration notes factual. Record what shipped and what is prospective. This release defines motion for future acquisition events but does not fabricate those events.
- Run TypeScript and relevant existing checks, inspect build output, and manually check affected interaction paths. Document pre-existing failures separately; a green build that ignores TypeScript errors is not sufficient evidence.

### Implementation map

| Need                                             | Source                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Tokens, material/surface rules, responsive shell | `src/styles/globals.css`, `tailwind.config.ts`                                                                                   |
| Single font/document                             | `src/app/layout.tsx`                                                                                                             |
| Game providers and shell                         | `src/app/(game)/layout.tsx`                                                                                                      |
| Page heading                                     | `src/components/game/ui/PageHeading.tsx`                                                                                         |
| Sidebar / mobile navigation                      | `src/components/game/ui/Sidebars/` (`GameNavigation`, `SidebarHeader`, `GameSearch`, `navigation-links.ts`)                      |
| Auth presentation                                | `src/components/game/ui/AuthShell.tsx`                                                                                           |
| Buttons/dialogs/tooltip/popover                  | `src/components/ui/`                                                                                                             |
| Slot, drag trigger, item details                 | `src/components/dnd/`, `src/components/game/items/`                                                                              |
| Rarity palette/custom colours/symbols            | `src/utils/rarity-colors.ts`, `src/utils/ui/rarity-badge.tsx`, `src/utils/ui/rarity-mark.tsx`                                    |
| Vocation / XP / garden                           | `src/app/(game)/skills/[name]/`, `src/components/game/vocations/`, `src/components/game/actions/`, `src/components/game/garden/` |
| Initial evidence / final QA                      | `docs/design/VISUAL_AUDIT.md`, `docs/design/VERIFICATION.md`                                                                     |
