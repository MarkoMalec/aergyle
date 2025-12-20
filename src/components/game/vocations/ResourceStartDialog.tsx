"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import toast from "react-hot-toast";
import { dispatchActiveActionEvent } from "~/components/game/actions/activeActionEvents";

type ResourceStartDialogProps = {
  resource: {
    id: number;
    name: string;
    defaultSeconds: number;
    yieldPerUnit: number;
    xpPerUnit: number;
    item: { sprite: string };
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ResourceStartDialog({
  resource,
  open,
  onOpenChange,
}: ResourceStartDialogProps) {
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    if (!resource) return;

    setIsStarting(true);

    try {
      const res = await fetch("/api/vocations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: resource.id, replace: true }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error ?? "Failed to start");
        return;
      }

      toast.success("Started");
      dispatchActiveActionEvent({ kind: "changed" });
      onOpenChange(false);
    } catch {
      toast.error("Failed to start");
    } finally {
      setIsStarting(false);
    }
  };

  if (!resource) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="sr-only">Start Resource Action</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Resource Image and Name */}
          <div className="flex flex-col items-center gap-4">
            <Image
              src={resource.item.sprite}
              alt={resource.name}
              width={1080}
              height={1080}
              className="h-24 w-24"
            />
            <h3 className="text-2xl font-semibold text-white">
              {resource.name}
            </h3>
          </div>

          {/* Information Badges */}
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary" className="bg-gray-700/60 text-white">
              Lv. 1 Required
            </Badge>
            <Badge variant="secondary" className="bg-gray-700/60 text-white">
              {resource.defaultSeconds}s per resource
            </Badge>
            <Badge variant="secondary" className="bg-gray-700/60 text-white">
              +{resource.xpPerUnit} XP per resource
            </Badge>
          </div>

          {/* Start Button */}
          <Button
            onClick={handleStart}
            disabled={isStarting}
            className="w-full"
            size="lg"
          >
            {isStarting ? "Starting..." : "Start"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
