"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ACTIVITY_STOP_MESSAGES } from "~/realtime/events";
import type { VocationalCompletionSummary } from "~/server/vocations";

export function ActionCompletionDialog(props: {
  completions: VocationalCompletionSummary[] | undefined;
}) {
  const completions = useMemo(
    () => props.completions ?? [],
    [props.completions],
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (completions.length > 0) {
      setOpen(true);
    }
  }, [completions.length]);

  if (completions.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Action completed</DialogTitle>
          <DialogDescription>
            Here’s what finished while you were away.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {completions.map((c, idx) => (
            <div
              key={idx}
              className="rounded-md border border-border bg-surface-inset p-3"
            >
              <div className="font-medium text-foreground">
                {c.actionType} · {c.resourceName}
              </div>
              {c.stopReason && c.stopReason !== "COMPLETED" ? (
                <div className="text-warning">
                  {ACTIVITY_STOP_MESSAGES[c.stopReason]}
                </div>
              ) : null}
              <div className="text-muted-foreground">
                Yield: {c.grantedQuantity}× {c.itemName}
              </div>
              <div className="text-muted-foreground">
                XP gained: {c.userXpGained} (skill: {c.skillXpGained})
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => setOpen(false)}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
