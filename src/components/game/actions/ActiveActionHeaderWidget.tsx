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
    // Holds the free space left of the header icons. The bar keeps its natural
    // width at the right edge and only shrinks when that space runs out; the
    // space is a size container, so the bar's title steps aside when it is tight.
    <div className="flex min-w-0 flex-1 items-center gap-2 py-3">
      <div className="flex min-w-0 flex-1 justify-end [container-type:inline-size]">
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
      </div>
      {activeActionType === "TRAVEL" ? (
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0"
          onClick={stop}
          aria-label="Cancel travel"
        >
          <X size={13} />
        </Button>
      ) : null}
    </div>
  );
}
