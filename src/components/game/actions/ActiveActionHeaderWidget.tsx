"use client";

import React from "react";
import { ActionFillBar } from "~/components/game/actions/ActionFillBar";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import { Badge } from "~/components/ui/badge";
import { X } from "lucide-react";

export default function ActiveActionHeaderWidget() {
  const { active, viewModel, stop, activeActionType } = useVocationalActiveActionContext();

  if (!active || !viewModel) return null;

  return (
    <div className="hidden items-center gap-3 md:flex">
          <ActionFillBar
            value={viewModel.progress}
            previewValue={viewModel.previewProgress}
            sessionAmount={viewModel.sessionAmount}
            title={viewModel.label}
            href={viewModel.href}
            sprite={viewModel.sprite}
            remainingTravelTime={activeActionType === "TRAVEL" ? viewModel.remainingSeconds : null}
            trackClassName="bg-white/10"
          />
        {activeActionType === "TRAVEL" ? (
          <Badge
            onClick={stop}
            className="cursor-pointer bg-gray-700/60 p-1"
            title="Cancel travel"
          >
            <X size={13} />
          </Badge>
        ) : null}
      {/* <ClaimStopButtons onClaim={claim} onStop={stop} /> */}
    </div>
  );
}
