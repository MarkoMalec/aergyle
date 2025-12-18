"use client";

import React from "react";
import { ActionFillBar } from "~/components/game/actions/ActionFillBar";
import { useVocationalActiveAction } from "~/components/game/actions/useVocationalActiveAction";

export default function ActiveActionHeaderWidget() {
  const { active, viewModel } = useVocationalActiveAction();

  if (!active || !viewModel) return null;

  return (
    <div className="hidden items-center gap-3 md:flex">
        <div className="mt-1">
          <ActionFillBar
            value={viewModel.progress}
            sessionAmount={viewModel.sessionAmount}
            title={viewModel.label}
            href={viewModel.href}
            sprite={viewModel.sprite}
            trackClassName="bg-white/10"
          />
        </div>
      {/* <ClaimStopButtons onClaim={claim} onStop={stop} /> */}
    </div>
  );
}
