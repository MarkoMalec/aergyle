import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "~/components/ui/button";

/** Shown instead of settlement content when the player isn't there. */
export function PresenceNotice(props: {
  traveling: boolean;
  locationName: string | null;
}) {
  return (
    <div className="game-panel game-panel-body flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Compass className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <strong className="block">
            {props.traveling
              ? "You are on the road"
              : props.locationName
                ? `You are not in ${props.locationName}`
                : "You are not in any location"}
          </strong>
          <p className="text-sm text-muted-foreground">
            {props.traveling
              ? "Settlements open to you once you arrive."
              : "Travel there to meet its people, trade and help with its projects."}
          </p>
        </div>
      </div>
      <Button asChild variant="secondary">
        <Link href="/map">Open the world atlas</Link>
      </Button>
    </div>
  );
}
