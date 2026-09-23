"use client";

import {
  BookOpen,
  Compass,
  LockKeyhole,
  MapPin,
  Navigation,
} from "lucide-react";
import { useMemo, useState } from "react";
import DragScrollContainer from "~/components/game/map/DragScrollContainer";
import { MapCanvas, pinStyle } from "~/components/game/map/PlaceMap";
import TravelLocationDialog from "~/components/game/map/TravelLocationDialog";
import type { MapPoint } from "~/game/world/maps";

export type AtlasLocationRow = {
  id: number;
  name: string;
  requiredLevel: number;
  /** Where it sits on the atlas; a location without a pin is not shown. */
  point: MapPoint | null;
};

export type AtlasActiveTravel = {
  fromLocation: { id: number; name: string } | null;
  toLocation: { id: number; name: string };
};

export default function WorldAtlas({
  image,
  locations,
  currentLocationId,
  userLevel,
  activeTravel,
  journeySeconds,
}: {
  /** The atlas artwork, set in /admin/locations. */
  image: string | null;
  locations: AtlasLocationRow[];
  currentLocationId: number | null;
  userLevel: number;
  activeTravel: AtlasActiveTravel | null;
  /** Travel time from the current location, by destination id. */
  journeySeconds: Record<number, number>;
}) {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null,
  );

  const locatedDestinations = useMemo(
    () =>
      locations.flatMap((location) =>
        location.point ? [{ location, point: location.point }] : [],
      ),
    [locations],
  );

  const currentLocation =
    locations.find((location) => location.id === currentLocationId) ?? null;
  const currentPoint = currentLocation?.point ?? null;
  const initialFocus = currentPoint
    ? { x: currentPoint.x / 100, y: currentPoint.y / 100 }
    : { x: 0.43, y: 0.48 };
  const reachableCount = locations.filter(
    (location) => userLevel >= Math.max(1, location.requiredLevel),
  ).length;

  return (
    <section className="atlas-frame game-panel" aria-labelledby="atlas-title">
      <header className="atlas-index-bar">
        <div className="atlas-index-title">
          <span className="atlas-index-icon" aria-hidden="true">
            <Compass />
          </span>
          <div>
            <p className="game-eyebrow">Wayfinder&apos;s chart</p>
            <h2 id="atlas-title" className="game-section-title mt-1">
              The known realm
            </h2>
          </div>
        </div>

        <div className="atlas-legend" aria-label="Map legend">
          <span>
            <i data-kind="current" aria-hidden="true" /> Current
          </span>
          <span>
            <i data-kind="reachable" aria-hidden="true" /> Reachable
          </span>
          <span>
            <i data-kind="locked" aria-hidden="true" /> Locked
          </span>
        </div>
      </header>

      <div className="game-atlas">
        {image ? (
          <DragScrollContainer
            className="game-atlas-viewport"
            initialFocus={initialFocus}
          >
            <MapCanvas image={image} alt="Illustrated terrain map of Aergyle">
              {locatedDestinations.map(({ location, point }) => {
                const isCurrent = location.id === currentLocationId;
                const isLocked =
                  userLevel < Math.max(1, location.requiredLevel);
                const isSelected = location.id === selectedLocationId;
                const accessLabel = isCurrent
                  ? "You are here"
                  : isLocked
                    ? `Level ${location.requiredLevel}`
                    : location.requiredLevel <= 1
                      ? "Open route"
                      : `Level ${location.requiredLevel}`;

                return (
                  <button
                    key={location.id}
                    type="button"
                    className="atlas-marker"
                    style={pinStyle(point)}
                    data-current={isCurrent}
                    data-locked={isLocked}
                    data-selected={isSelected}
                    aria-current={isCurrent ? "location" : undefined}
                    aria-label={`${location.name}. ${accessLabel}. Open atlas entry.`}
                    onClick={() => setSelectedLocationId(location.id)}
                  >
                    <span className="atlas-marker-pin" aria-hidden="true">
                      {isLocked ? <LockKeyhole /> : <MapPin />}
                    </span>
                    <span className="atlas-marker-plaque">
                      <strong>{location.name}</strong>
                      <small>{accessLabel}</small>
                    </span>
                  </button>
                );
              })}
            </MapCanvas>
          </DragScrollContainer>
        ) : (
          <p className="game-empty-state">
            The realm is being redrawn. No chart is available right now.
          </p>
        )}
      </div>

      <footer className="atlas-footer">
        <div className="atlas-present-location">
          <span aria-hidden="true">
            {activeTravel ? <Navigation /> : <MapPin />}
          </span>
          <div>
            <small>
              {activeTravel ? "Journey in progress" : "Present location"}
            </small>
            <strong>
              {activeTravel?.toLocation.name ??
                currentLocation?.name ??
                "Uncharted"}
            </strong>
          </div>
        </div>

        <p className="atlas-instruction">
          <BookOpen aria-hidden="true" />
          Select a landmark for field notes and travel.
        </p>

        <p className="atlas-route-count">
          <span>{reachableCount} within reach</span>
          <span aria-hidden="true">·</span>
          <span>{locatedDestinations.length} charted</span>
        </p>
      </footer>

      <TravelLocationDialog
        locations={locations}
        currentLocationId={currentLocationId}
        activeTravel={activeTravel}
        journeySeconds={journeySeconds}
        userLevel={userLevel}
        selectedLocationId={selectedLocationId}
        open={selectedLocationId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedLocationId(null);
        }}
      />
    </section>
  );
}
