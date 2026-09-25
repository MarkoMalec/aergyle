"use client";

import { Diamond } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { MessagesPanel } from "./MessagesPanel";
import { NotificationsPanel } from "./NotificationsPanel";

export type HubTab = "notifications" | "messages";

const TABS: { id: HubTab; label: string }[] = [
  { id: "notifications", label: "Notifications" },
  { id: "messages", label: "Messages" },
];

/**
 * Everything the game and other players send the player, in one window: the
 * notifications the bell counts and the private messages the envelope does.
 * Opening it from either sidebar button lands on that tab.
 */
export function CommunicationHub({
  tab,
  onTabChange,
  onClose,
  onNavigate,
}: {
  /** The open tab, or null while the window is closed. */
  tab: HubTab | null;
  onTabChange: (tab: HubTab) => void;
  onClose: () => void;
  /** Closes the window and, on phones, the sidebar behind it. */
  onNavigate: () => void;
}) {
  return (
    <Dialog open={tab !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-3 border-0 p-0">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Diamond size={14} className="text-primary" aria-hidden="true" />
          <DialogTitle className="text-sm font-semibold">
            Communication Hub
          </DialogTitle>
        </div>
        <DialogDescription className="sr-only">
          Your notifications and your private messages.
        </DialogDescription>

        <div className="flex gap-4 border-b border-border/60 px-4">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onTabChange(entry.id)}
              className={cn(
                "-mb-px border-b-2 pb-2.5 pt-0.5 text-[13px] font-semibold transition-colors",
                tab === entry.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          {tab === "messages" ? (
            <MessagesPanel />
          ) : (
            <NotificationsPanel onNavigate={onNavigate} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
