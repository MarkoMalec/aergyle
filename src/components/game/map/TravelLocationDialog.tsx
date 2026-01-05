"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type LocationRow = {
  id: number;
  name: string;
};

export default function TravelLocationDialog(props: {
  locations: LocationRow[];
  currentLocationId: number | null;
  travelActive: boolean;
}) {
  const { locations, currentLocationId, travelActive } = props;
  const [open, setOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedLocation = useMemo(() => {
    if (selectedLocationId === null) return null;
    return locations.find((l) => l.id === selectedLocationId) ?? null;
  }, [locations, selectedLocationId]);

  const onOpenLocation = (locationId: number) => {
    setSelectedLocationId(locationId);
    setOpen(true);
  };

  const onTravel = async () => {
    if (!selectedLocation) return;
    if (selectedLocation.id === currentLocationId) {
      setOpen(false);
      return;
    }

    if (travelActive) {
      toast.error("You are already traveling");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/travel/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toLocationId: selectedLocation.id }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error ?? "Failed to travel");
        return;
      }

      // You asked for a full tab refresh.
      window.location.reload();
    } catch {
      toast.error("Failed to travel");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onCancelTravel = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/travel/cancel", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error ?? "Failed to cancel travel");
        return;
      }
      window.location.reload();
    } catch {
      toast.error("Failed to cancel travel");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        {locations.map((location) => (
          <Button
            key={location.id}
            variant={location.id === currentLocationId ? "secondary" : "default"}
            onClick={() => onOpenLocation(location.id)}
            className="w-full justify-start"
          >
            {location.name}
          </Button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedLocation?.name ?? "Location"}</DialogTitle>
            <DialogDescription>
              Location details coming soon.
            </DialogDescription>
          </DialogHeader>

          <Button onClick={onTravel} disabled={!selectedLocation || isSubmitting || travelActive}>
            {selectedLocation?.id === currentLocationId
              ? "You are here"
              : isSubmitting
                ? "Traveling..."
                : "Travel"}
          </Button>

          {travelActive ? (
            <Button variant="secondary" onClick={onCancelTravel} disabled={isSubmitting}>
              Cancel travel
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
