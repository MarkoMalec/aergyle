import { HeartPulse } from "lucide-react";

/**
 * Current health against the minimum an activity needs to start. Each
 * activity decides `ready` with the same rule its server check uses.
 */
export function HealthCard(props: {
  currentHealth: number;
  maxHealth: number;
  healthRegen: number;
  ready: boolean;
  readyLabel: string;
  recoverLabel: string;
}) {
  const percent =
    props.maxHealth > 0 ? (props.currentHealth / props.maxHealth) * 100 : 0;
  return (
    <div className="rounded-xl bg-secondary/25 p-4">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <HeartPulse className="h-4 w-4 text-danger" aria-hidden="true" />
          Current health
        </span>
        <strong className="tabular-nums">
          {Math.floor(props.currentHealth)} / {Math.floor(props.maxHealth)}
        </strong>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-black/25"
        role="progressbar"
        aria-label="Current health"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(percent)}
      >
        <div
          className="h-full rounded-full bg-danger transition-[width]"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
        <span>Regenerates {props.healthRegen.toFixed(1)} health/second</span>
        <span className={props.ready ? "text-success" : "text-warning"}>
          {props.ready ? props.readyLabel : props.recoverLabel}
        </span>
      </div>
    </div>
  );
}
