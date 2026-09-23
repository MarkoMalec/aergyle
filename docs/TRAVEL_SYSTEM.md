# Travel System

A journey's length comes from the **route time** between two locations and the
character's **Movement Speed**. Players see only the result: the travel time in
the atlas dialog and the progress bar while travelling. Both come from
`getJourneySeconds` in `src/server/travel/service.ts`, so they always agree.

## Route times

- `TravelRoute` stores one base time (seconds, at 100% movement speed) per
  location pair. Routes are undirected: A→B and B→A share one row, stored with
  the lower location id as `locationAId` (`toTravelRoutePair` in
  `src/game/world/travel.ts`).
- Pairs without a row use `TravelConfig.secondsPerTravel` (row id 1), and if no
  config is saved, 4 hours.
- Deleting a location deletes its routes.

Edit both in **/admin/travel**: a grid of locations in minutes (either cell of
a pair edits the same route) plus the default time.

## Movement Speed

`travelSeconds = baseSeconds × 100 / movementSpeed`
(`applyMovementSpeed`). The base stat is 100%; gear and food effects change it,
so 125% takes 80% of the base time and 80% takes 125%. Speed is floored at 10%
so heavy gear can never make a journey endless.

The final stats are read once in `startTravel` (`src/server/travel/service.ts`),
so `endsAt` is fixed when the journey starts. Later changes to gear, food or
admin route times do not affect journeys already underway.

## Seeding

`prisma/content/travel.ts` derives starting times from straight-line distance
between atlas markers (`src/game/world/atlasLocations.ts`), scaled so the
farthest pair takes 4 hours and rounded to 5 minutes. Those are the starting
coordinates only: moving a pin in /admin/locations changes where the location
is drawn, not a route time that has already been seeded.

```
npm run db:seed:travel             # --check: list missing pairs
npm run db:seed:travel -- --apply  # create missing pairs only
npm run test:travel
```

The seed only fills pairs that have no route, so times tuned in /admin are
never overwritten. It is optional: a new location appears in the /admin/travel
grid right away and uses the default time until its pairs are filled in.
