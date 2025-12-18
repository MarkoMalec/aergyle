"use client";

import React, { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { dispatchActiveActionEvent } from "~/components/game/actions/activeActionEvents";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import Image from "next/image";

export type SkillVocationalResource = {
  id: number;
  name: string;
  defaultSeconds: number;
  yieldPerUnit: number;
  xpPerUnit: number;
  item: { sprite: string };
};

export default function SkillVocationalResources(props: {
  resources: SkillVocationalResource[];
}) {
  const { resources } = props;
  const { activeResourceId, isStopping, stop } =
    useVocationalActiveActionContext();

  const [startingResourceId, setStartingResourceId] = useState<number | null>(
    null,
  );

  const start = useCallback(async (resourceId: number) => {
    setStartingResourceId(resourceId);

    try {
      const res = await fetch("/api/vocations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId, replace: true }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error ?? "Failed to start");
        return;
      }

      toast.success("Started");
      dispatchActiveActionEvent({ kind: "changed" });
    } catch {
      toast.error("Failed to start");
    } finally {
      setStartingResourceId(null);
    }
  }, []);

  const cards = useMemo(() => {
    return resources.map((resource) => {
      const isActive = activeResourceId === resource.id;

      return (
        <Card
          key={resource.id}
          className="cursor-pointer border-gray-700/40 bg-gray-800/60"
          style={
            startingResourceId === resource.id || isActive
              ? { borderColor: "#656565ff", cursor: "not-allowed" }
              : {}
          }
          onClick={() => void start(resource.id)}
        >
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center gap-4">
              <Image
                src={resource.item.sprite}
                alt={resource.name}
                width={1080}
                height={1080}
                className="h-14 w-14"
              />
              <div className="space-y-1">
                <CardTitle className="text-lg text-white font-medium">
                  {resource.name}
                </CardTitle>
                <div className="text-sm text-white/70">
                  {resource.defaultSeconds}s per item • +{resource.yieldPerUnit}{" "}
                  item
                  {resource.xpPerUnit > 0 ? ` • +${resource.xpPerUnit} XP` : ""}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    });
  }, [
    resources,
    activeResourceId,
    stop,
    isStopping,
    start,
    startingResourceId,
  ]);

  return <div className="space-y-4">{cards}</div>;
}
