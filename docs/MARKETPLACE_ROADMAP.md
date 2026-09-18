# Marketplace roadmap

This document records the marketplace work intentionally deferred after the first exchange upgrade. The current release focuses on trustworthy arithmetic, completed-sale data, a persistent browsing surface, exact listings, stackable-item buy orders, and the two clear selling paths: **Sell now** and **Create listing**.

## Product rules established now

- Asking prices, bids, and completed-sale prices are different concepts and must always be labelled separately.
- Every price is a **unit price** unless the UI explicitly says total.
- The 12% exchange tax is calculated and enforced by the server; sell UIs show gross, tax, and net proceeds before submission.
- Buy orders reserve their full gold value. Cancelling returns only the unused reserve.
- If a buyer's inventory cannot receive a fill, the unfilled remainder is cancelled and its reserve is returned so an impossible order cannot block the book.
- Buy orders and Sell now apply to stackable commodities. Individually rolled equipment uses exact listings so buyers can inspect its stats.
- Price priority is deterministic: highest bid first for sellers, lowest ask first for buyers, and oldest order first when prices are equal.
- `MarketTransaction` is the source of truth for history, volume, medians, and trends. Active listings never masquerade as sales.

## Next improvements

### Equipment discovery

- Advanced filters for required level and individual stats.
- Compare an exact listing with currently equipped gear.
- Saved equipment-filter presets.
- A compact stat-difference view that remains readable on mobile.

### Market awareness

- Watchlists and saved searches.
- In-game notifications for filled orders, undercut listings, and watched price thresholds.
- Longer price history with selectable 24h / 7d / 30d / 90d windows.
- Confidence labels when an item has too few completed trades for a reliable trend.
- Deeper order-book view and optional cumulative depth visualization.

### Order management

- Listing expiry and a clear renewal flow.
- Repricing with an explicit fee and visible queue-position consequence.
- Partial-fill progress and fill-by-fill detail on My orders.
- Bulk withdrawal and relisting tools for established merchants.
- An optional multi-listing purchase flow that shows price impact before sweeping several asks.

### Merchant tools

- Cost-basis and realized-profit tracking.
- Inventory valuation using completed-sale medians with liquidity warnings.
- Sales velocity, average time-to-sale, fees paid, and capital currently tied up.
- Exportable personal ledger after the in-game ledger is mature.

## Later, only when the economy supports it

- Regional markets, transport, and hauling contracts. These create interesting arbitrage only after concurrent population and local liquidity are high enough; introducing them too early would fragment supply.
- Auctions for genuinely scarce, high-variance items. Common commodities should remain in the order book.
- Player storefronts, direct contracts, and guild procurement orders.
- Advanced crafting-material shopping lists and one-click order preparation.

## Economy integrity and operations

- Detect suspicious self-trading, wash volume, rapid price manipulation, and coordinated transfers.
- Rate-limit automated market actions and build moderation/audit views before exposing any market API.
- Monitor gold creation, gold destruction, velocity, spread, fill rate, time-to-sale, and wealth concentration.
- Tune taxes and listing fees from economy data rather than changing them invisibly. Any fee change must be reflected in every preview and history record.
- Add reversible admin tooling for stuck reserves or disputed transactions; never edit completed trade history silently.

## Success measures

- Players can answer “what will I pay/receive?” without doing arithmetic themselves.
- Quantity and total-price mistakes approach zero.
- Median time from opening an item to placing an order decreases.
- More players earn a meaningful share of income through trade without a small number of accounts controlling most volume.
- Bid/ask spreads narrow as participation grows, while rare equipment retains meaningful price discovery.

## Design references

- EVE Online’s explicit buy/sell order priority and wallet escrow: <https://support.eveonline.com/hc/en-us/articles/203218932-Buy-and-Sell-Orders>
- Guild Wars 2 Trading Post’s instant versus patient trading model: <https://wiki.guildwars2.com/wiki/Trading_Post>
- Albion Online’s marketplace separation of sell offers, buy orders, and history: <https://wiki.albiononline.com/wiki/Marketplace>

These are interaction references, not visual targets. Aergyle’s forest-dark surfaces, brass accents, item rarity language, spacing, and responsive shell remain the visual system.
