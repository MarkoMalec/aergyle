import React from "react";
import { Button } from "~/components/ui/button";

export function ClaimStopButtons({
  onClaim,
  onStop,
  disabled,
  size = "sm",
  variant = "secondary",
  className,
}: {
  onClaim: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
  disabled?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive" | "menu";
  className?: string;
}) {
  return (
    <div className={className ?? "flex items-center gap-2"}>
      <Button size={size} variant={variant} onClick={onClaim} disabled={disabled}>
        Claim
      </Button>
      <Button size={size} variant={variant} onClick={onStop} disabled={disabled}>
        Stop
      </Button>
    </div>
  );
}
