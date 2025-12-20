"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardTitle } from "~/components/ui/card";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import Image from "next/image";
import ResourceStartDialog from "./ResourceStartDialog";

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

  const [selectedResource, setSelectedResource] =
    useState<SkillVocationalResource | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openResourceDialog = useCallback(
    (resource: SkillVocationalResource) => {
      setSelectedResource(resource);
      setDialogOpen(true);
    },
    [],
  );

  const cards = useMemo(() => {
    return resources.map((resource) => {
      const isActive = activeResourceId === resource.id;

      return (
        <Card
          key={resource.id}
          className="cursor-pointer border-gray-700/40 bg-gray-800/60"
          style={
            isActive ? { borderColor: "#656565ff", cursor: "not-allowed" } : {}
          }
          onClick={() => !isActive && openResourceDialog(resource)}
        >
          <CardContent className="flex items-center justify-between p-3">
            <div className="flex items-center gap-4">
              <Image
                src={resource.item.sprite}
                alt={resource.name}
                width={1080}
                height={1080}
                className="h-14 w-14"
              />
              <div className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">
                  {resource.name}
                </CardTitle>
                <div className="text-sm text-white/70">
                  {resource.defaultSeconds}s per item • +{resource.yieldPerUnit}{" "}
                  item
                  {resource.xpPerUnit > 0 ? ` • +${resource.xpPerUnit} XP` : ""}
                </div>
              </div>
            </div>
            {isActive || (isActive && isStopping) ? (
              <div className="h-4 w-4 animate-spin rounded-full border-[3px] border-gray-300 border-b-gray-700/60 border-l-gray-700/60 border-t-gray-700/50" />
            ) : null}
          </CardContent>
        </Card>
      );
    });
  }, [resources, activeResourceId, openResourceDialog]);

  return (
    <>
      <div className="space-y-4">{cards}</div>
      <ResourceStartDialog
        resource={selectedResource}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
