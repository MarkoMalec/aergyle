"use client";

import React from "react";
import { ActionFillBar } from "~/components/game/actions/ActionFillBar";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import { Button } from "~/components/ui/button";
import { X } from "lucide-react";

export default function ActiveActionHeaderWidget() {
  const { active, viewModel, stop, activeActionType } =
    useVocationalActiveActionContext();

  if (!active || !viewModel) return null;

  return (
    <div className="flex min-w-0 items-center gap-2 py-3">
      <ActionFillBar
        value={viewModel.progress}
        previewValue={viewModel.previewProgress}
        sessionAmount={viewModel.sessionAmount}
        title={viewModel.label}
        href={viewModel.href}
        sprite={viewModel.sprite}
        remainingTravelTime={
          activeActionType === "TRAVEL" ||
          activeActionType === "GATHERING" ||
          activeActionType === "HUNTING" ||
          activeActionType === "DUNGEON"
            ? viewModel.remainingSeconds
            : null
        }
      />
      {activeActionType === "TRAVEL" ? (
        <Button
          size="icon"
          variant="ghost"
          onClick={stop}
          aria-label="Cancel travel"
        >
          <X size={13} />
        </Button>
      ) : null}
    </div>
  );
}
