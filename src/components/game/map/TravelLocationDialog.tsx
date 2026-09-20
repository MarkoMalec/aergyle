"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  BookOpen,
  Compass,
  Hourglass,
  LoaderCircle,
  LockKeyhole,
  MapIcon,
  MapPin,
  Navigation,
  Route,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { formatDuration } from "~/components/game/actions/format";
import { getAtlasLocationMarker } from "~/game/world/atlasLocations";
import type {
  AtlasActiveTravel,
  AtlasLocationRow,
} from "~/components/game/map/WorldAtlas";

type TravelPhase = "idle" | "submitting" | "departing" | "cancelling";

function getApiError(payload: unknown, fallback: string) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("error" in payload)
  ) {
    return fallback;
  }

  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" ? error : fallback;
}

export default function TravelLocationDialog({
  locations,
  currentLocationId,
  activeTravel,
  journeySeconds,
  userLevel,
  selectedLocationId,
  open,
  onOpenChange,
}: {
  locations: AtlasLocationRow[];
  currentLocationId: number | null;
  activeTravel: AtlasActiveTravel | null;
  journeySeconds: Record<number, number>;
  userLevel: number;
  selectedLocationId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [phase, setPhase] = useState<TravelPhase>("idle");
  const reloadTimerRef = useRef<number | null>(null);

  const requestedLocation = useMemo(() => {
    if (selectedLocationId === null) return null;
    return (
      locations.find((location) => location.id === selectedLocationId) ?? null
    );
  }, [locations, selectedLocationId]);
  const [lastSelectedLocation, setLastSelectedLocation] =
    useState<AtlasLocationRow | null>(null);
  const selectedLocation = requestedLocation ?? lastSelectedLocation;
  const currentLocation =
    locations.find((location) => location.id === currentLocationId) ?? null;
  const atlasEntry = selectedLocation
    ? getAtlasLocationMarker(selectedLocation.name)
    : null;
  const isCurrent = selectedLocation?.id === currentLocationId;
  const isLocked = selectedLocation
    ? userLevel < Math.max(1, selectedLocation.requiredLevel)
    : false;
  const isBusy = phase !== "idle";
  const travelSeconds = selectedLocation
    ? journeySeconds[selectedLocation.id]
    : undefined;

  useEffect(() => {
    setPhase("idle");
  }, [selectedLocationId]);

  useEffect(() => {
    if (requestedLocation) setLastSelectedLocation(requestedLocation);
  }, [requestedLocation]);

  useEffect(
    () => () => {
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
      }
    },
    [],
  );

  const onTravel = async () => {
    if (!selectedLocation) return;
    if (isLocked) {
      toast.error(`Requires level ${selectedLocation.requiredLevel}`);
      return;
    }
    if (isCurrent) {
      onOpenChange(false);
      return;
    }
    if (activeTravel) {
      toast.error(
        `You are already traveling to ${activeTravel.toLocation.name}`,
      );
      return;
    }

    setPhase("submitting");
    try {
      const response = await fetch("/api/travel/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toLocationId: selectedLocation.id }),
      });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setPhase("idle");
        toast.error(getApiError(result, "Failed to begin the journey"));
        return;
      }

      setPhase("departing");
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      reloadTimerRef.current = window.setTimeout(
        () => window.location.reload(),
        reduceMotion ? 120 : 1050,
      );
    } catch {
      setPhase("idle");
      toast.error("Failed to begin the journey");
    }
  };

  const onCancelTravel = async () => {
    setPhase("cancelling");
    try {
      const response = await fetch("/api/travel/cancel", { method: "POST" });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setPhase("idle");
        toast.error(getApiError(result, "Failed to cancel travel"));
        return;
      }

      window.location.reload();
    } catch {
      setPhase("idle");
      toast.error("Failed to cancel travel");
    }
  };

  const travelButtonLabel = isCurrent
    ? "You are here"
    : isLocked
      ? `Requires level ${selectedLocation?.requiredLevel ?? 1}`
      : activeTravel
        ? "Journey already active"
        : phase === "submitting"
          ? "Charting route…"
          : "Begin journey";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="atlas-dialog">
        {phase === "departing" ? (
          <div className="atlas-departure" role="status" aria-live="polite">
            <DialogTitle className="sr-only">
              Journey underway to {selectedLocation?.name ?? "destination"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Your route has been accepted and the atlas is updating.
            </DialogDescription>

            <span className="atlas-departure-icon" aria-hidden="true">
              <Navigation />
            </span>
            <p className="game-eyebrow">Journey underway</p>
            <h2>{selectedLocation?.name}</h2>
            <p>
              The route is set. Your progress will remain visible while you
              travel.
            </p>

            <div className="atlas-departure-route" aria-hidden="true">
              <span />
            </div>
            <div className="atlas-departure-labels" aria-hidden="true">
              <span>{currentLocation?.name ?? "Here"}</span>
              <span>{selectedLocation?.name}</span>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="gap-4">
              <div className="atlas-dialog-heading">
                <span className="atlas-dialog-icon" aria-hidden="true">
                  {isLocked ? <LockKeyhole /> : <Compass />}
                </span>
                <div className="min-w-0">
                  <p className="game-eyebrow">
                    {atlasEntry?.region ?? "Atlas field entry"}
                  </p>
                  <DialogTitle className="mt-1">
                    {selectedLocation?.name ?? "Location"}
                  </DialogTitle>
                </div>
              </div>
              <DialogDescription className="text-text-secondary">
                {atlasEntry?.description ??
                  "A charted destination waiting to be explored."}
              </DialogDescription>
            </DialogHeader>

            <dl className="atlas-location-facts">
              <div>
                <dt>Terrain</dt>
                <dd>{atlasEntry?.terrain ?? "Unrecorded"}</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>
                  {selectedLocation && selectedLocation.requiredLevel > 1
                    ? `Player level ${selectedLocation.requiredLevel}`
                    : "Open from level 1"}
                </dd>
              </div>
            </dl>

            {atlasEntry ? (
              <div className="atlas-known-for">
                <p>Known for</p>
                <div>
                  {atlasEntry.knownFor.map((detail) => (
                    <span key={detail}>{detail}</span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="atlas-field-note">
              <BookOpen aria-hidden="true" />
              <div>
                <strong>Cartographer&apos;s note</strong>
                <p>
                  {atlasEntry?.fact ??
                    "Further details will be added as the realm is surveyed."}
                </p>
              </div>
            </div>

            {!isCurrent && !isLocked && !activeTravel ? (
              <div className="atlas-route-preview" aria-label="Planned route">
                <div>
                  <small>From</small>
                  <strong>{currentLocation?.name ?? "Your location"}</strong>
                </div>
                <span aria-hidden="true">
                  <Route />
                </span>
                <div>
                  <small>Destination</small>
                  <strong>{selectedLocation?.name}</strong>
                </div>
                {travelSeconds !== undefined ? (
                  <p className="atlas-route-duration">
                    <Hourglass aria-hidden="true" />
                    Travel time
                    <strong>{formatDuration(travelSeconds)}</strong>
                  </p>
                ) : null}
              </div>
            ) : null}

            {isLocked ? (
              <div className="atlas-access-message" data-state="locked">
                <LockKeyhole aria-hidden="true" />
                <p>
                  Reach player level {selectedLocation?.requiredLevel ?? 1} to
                  open this route. You can still keep its field notes in view.
                </p>
              </div>
            ) : isCurrent ? (
              <div className="atlas-access-message" data-state="current">
                <MapPin aria-hidden="true" />
                <p>This is your present location.</p>
              </div>
            ) : activeTravel ? (
              <div className="atlas-access-message" data-state="traveling">
                <Navigation aria-hidden="true" />
                <p>
                  You are already traveling to {activeTravel.toLocation.name}.
                </p>
              </div>
            ) : null}

            <DialogFooter className="atlas-dialog-actions">
              {activeTravel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancelTravel}
                  disabled={isBusy}
                >
                  <X aria-hidden="true" />
                  {phase === "cancelling"
                    ? "Cancelling…"
                    : "Cancel current journey"}
                </Button>
              ) : null}
              {isCurrent && !activeTravel ? (
                <Button asChild>
                  <Link href="/region">
                    <MapIcon aria-hidden="true" />
                    Explore {selectedLocation?.name}
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={isCurrent ? "secondary" : "default"}
                  onClick={onTravel}
                  disabled={
                    !selectedLocation ||
                    isCurrent ||
                    isLocked ||
                    isBusy ||
                    !!activeTravel
                  }
                >
                  {phase === "submitting" ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : isLocked ? (
                    <LockKeyhole aria-hidden="true" />
                  ) : isCurrent ? (
                    <MapPin aria-hidden="true" />
                  ) : (
                    <Navigation aria-hidden="true" />
                  )}
                  {travelButtonLabel}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
