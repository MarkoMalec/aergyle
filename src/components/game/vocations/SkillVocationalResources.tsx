"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardTitle } from "~/components/ui/card";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import Image from "next/image";
import ResourceStartDialog from "./ResourceStartDialog";
import { Badge } from "~/components/ui/badge";
import { Clock } from "lucide-react";
import { VocationalActionType } from "~/generated/prisma/enums";
import { useSkillProgress } from "~/components/game/skills/SkillProgressContext";

const formatSeconds = (seconds: number) => {
  const rounded = seconds % 1 === 0 ? seconds.toFixed(0) : seconds.toFixed(2);
  return rounded.replace(/\.0+$/, "").replace(/(\.\d+?)0+$/, "$1");
};

export type SkillVocationalResource = {
  id: number;
  actionType: VocationalActionType;
  name: string;
  requiredSkillLevel: number;
  defaultSeconds: number;
  effectiveSeconds: number;
  appliedEfficiency: number;
  yieldPerUnit: number;
  xpPerUnit: number;
  item: { sprite: string };
  requirements: {
    quantityPerUnit: number;
    item: { id: number; name: string; sprite: string };
  }[];
};

export default function SkillVocationalResources(props: {
  resources: SkillVocationalResource[];
}) {
  const { resources } = props;
  const skillProgressState = useSkillProgress();
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
    const userLevel = skillProgressState?.skillProgress?.level ?? null;
    const progressLoading = skillProgressState?.progressLoading ?? false;

    return resources.map((resource) => {
      const isActive = activeResourceId === resource.id;
      const isLockedByLevel =
        !progressLoading &&
        userLevel !== null &&
        userLevel < resource.requiredSkillLevel;

      return (
        <Card
          key={resource.id}
          className="cursor-pointer border-gray-700/40 bg-gray-800/90"
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
                className="h-12 w-12"
              />
              <div className="space-y-2">
                <CardTitle className="text-sm font-bold text-white">
                  {resource.name}
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant={isLockedByLevel ? "destructive" : "default"}>
                    Lv. {resource.requiredSkillLevel}
                  </Badge>
                  <Badge>{resource.xpPerUnit} XP</Badge>
                  <Badge className="flex gap-1">
                    <Clock size={12} />{" "}
                    {formatSeconds(resource.effectiveSeconds)}s
                  </Badge>
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
  }, [resources, activeResourceId, openResourceDialog, skillProgressState]);

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
