"use client";

import Image from "next/image";
import {
  BookOpen,
  Compass,
  LockKeyhole,
  MapPin,
  Navigation,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  getAtlasLocationMarker,
  WORLD_ATLAS_MAP_SIZE,
} from "~/game/world/atlasLocations";
import DragScrollContainer from "~/components/game/map/DragScrollContainer";
import TravelLocationDialog from "~/components/game/map/TravelLocationDialog";

export type AtlasLocationRow = {
  id: number;
  name: string;
  requiredLevel: number;
};

export type AtlasActiveTravel = {
  fromLocation: { id: number; name: string } | null;
  toLocation: { id: number; name: string };
};

function percentageToUnit(value: `${number}%`) {
  return Number.parseFloat(value) / 100;
}

export default function WorldAtlas({
  locations,
  currentLocationId,
  userLevel,
  activeTravel,
  journeySeconds,
}: {
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
      locations.flatMap((location) => {
        const marker = getAtlasLocationMarker(location.name);
        return marker ? [{ location, marker }] : [];
      }),
    [locations],
  );

  const currentLocation =
    locations.find((location) => location.id === currentLocationId) ?? null;
  const currentMarker = currentLocation
    ? getAtlasLocationMarker(currentLocation.name)
    : null;
  const initialFocus = currentMarker
    ? {
        x: percentageToUnit(currentMarker.left),
        y: percentageToUnit(currentMarker.top),
      }
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
        <DragScrollContainer
          className="game-atlas-viewport"
          initialFocus={initialFocus}
        >
          <div className="atlas-map-canvas">
            <Image
              src="/assets/world/world-map-v1.png"
              alt="Illustrated terrain map of Aergyle"
              width={WORLD_ATLAS_MAP_SIZE.width}
              height={WORLD_ATLAS_MAP_SIZE.height}
              priority
              className="atlas-map-image"
            />

            <div className="atlas-location-layer">
              {locatedDestinations.map(({ location, marker }) => {
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
                    style={{ left: marker.left, top: marker.top }}
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
            </div>
          </div>
        </DragScrollContainer>
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
