"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp, RotateCcw, Save } from "lucide-react";
import { Button } from "~/components/ui/button";

export type VocationResourceRow = {
  id: number;
  name: string;
  itemId: number;
  itemName: string | null;
  itemSprite: string | null;
  requiredSkillLevel: number;
  defaultSeconds: number;
  yieldPerUnit: number;
  xpPerUnit: number;
  recipeName: string | null;
  requirementCount: number;
  enabledLocationIds: number[];
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function parseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

export function VocationResourcesTable(props: {
  actionType: string;
  resources: VocationResourceRow[];
  locationCount: number;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState(props.resources);
  const [isSavingOrder, setIsSavingOrder] = React.useState(false);
  const [pendingLocationsId, setPendingLocationsId] = React.useState<
    number | null
  >(null);

  // Re-sync when the server component sends a fresh list (after router.refresh).
  React.useEffect(() => {
    setRows(props.resources);
  }, [props.resources]);

  const savedOrder = props.resources.map((resource) => resource.id).join(",");
  const currentOrder = rows.map((resource) => resource.id).join(",");
  const orderChanged = savedOrder !== currentOrder;

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    setRows((current) => {
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved!);
      return next;
    });
  };

  const saveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const response = await fetch("/api/admin/vocations/resources/order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: props.actionType,
          resourceIds: rows.map((resource) => resource.id),
        }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "Unable to save order"));
      }
      toast.success(`${props.actionType} order saved`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save order"));
    } finally {
      setIsSavingOrder(false);
    }
  };

  const setAvailability = async (
    resource: VocationResourceRow,
    everywhere: boolean,
  ) => {
    if (
      !everywhere &&
      !window.confirm(
        `Remove ${resource.name} from every location? Nobody will be able to work it until a location is re-enabled.`,
      )
    ) {
      return;
    }

    setPendingLocationsId(resource.id);
    try {
      const response = await fetch(
        `/api/admin/vocations/resources/${resource.id}/locations`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            everywhere ? { allLocations: true } : { locationIds: [] },
          ),
        },
      );
      if (!response.ok) {
        throw new Error(
          await parseError(response, "Unable to save availability"),
        );
      }
      const body = (await response.json().catch(() => null)) as {
        locationIds?: number[];
      } | null;
      const enabledLocationIds = body?.locationIds ?? [];

      // Patched in place rather than through router.refresh(), so a reorder
      // that has not been saved yet survives the toggle.
      setRows((current) =>
        current.map((row) =>
          row.id === resource.id ? { ...row, enabledLocationIds } : row,
        ),
      );
      toast.success(
        everywhere
          ? `${resource.name} is available in every location`
          : `${resource.name} removed from every location`,
      );
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save availability"));
    } finally {
      setPendingLocationsId(null);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-white/60">
          Arrows set the order players see on the skill page. The locations
          checkbox makes a resource available everywhere in one click.
        </div>
        <div className="flex items-center gap-2">
          {orderChanged ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRows(props.resources)}
              disabled={isSavingOrder}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={saveOrder}
            disabled={!orderChanged || isSavingOrder}
          >
            <Save className="h-3.5 w-3.5" />
            {isSavingOrder ? "Saving..." : "Save order"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/50 text-white/80">
            <tr>
              <th className="w-0 p-3 text-left">#</th>
              <th className="w-0 p-3 text-left"></th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Output Item</th>
              <th className="p-3 text-right">Req Lvl</th>
              <th className="p-3 text-right">Sec</th>
              <th className="p-3 text-right">Yield</th>
              <th className="p-3 text-right">XP</th>
              <th className="p-3 text-left">Recipe</th>
              <th className="p-3 text-right">Reqs</th>
              <th className="p-3 text-center">All locations</th>
              <th className="p-3 text-right">ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => {
              const everywhere =
                props.locationCount > 0 &&
                r.enabledLocationIds.length >= props.locationCount;

              return (
                <tr key={r.id} className="border-t border-gray-800/60">
                  <td className="p-2 align-middle">
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        aria-label={`Move ${r.name} up`}
                        className="rounded p-0.5 text-white/60 hover:bg-gray-800/60 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
                        onClick={() => move(index, -1)}
                        disabled={index === 0 || isSavingOrder}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <span className="font-mono text-[11px] text-white/40">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        aria-label={`Move ${r.name} down`}
                        className="rounded p-0.5 text-white/60 hover:bg-gray-800/60 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
                        onClick={() => move(index, 1)}
                        disabled={index === rows.length - 1 || isSavingOrder}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="w-[56px]">
                    {r.itemSprite ? (
                      <Image
                        src={r.itemSprite}
                        alt={r.itemName ?? r.name}
                        width={48}
                        height={48}
                        className="ml-2 h-12 w-12 rounded-md object-contain"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-gray-800/60" />
                    )}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/admin/vocations/${r.id}`}
                      className="font-semibold text-white hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="p-3 text-white/80">
                    {r.itemName ?? "—"}{" "}
                    <span className="font-mono text-white/50">#{r.itemId}</span>
                  </td>
                  <td className="p-3 text-right text-white/80">
                    {r.requiredSkillLevel}
                  </td>
                  <td className="p-3 text-right text-white/80">
                    {r.defaultSeconds}
                  </td>
                  <td className="p-3 text-right text-white/80">
                    {r.yieldPerUnit}
                  </td>
                  <td className="p-3 text-right text-white/80">
                    {r.xpPerUnit}
                  </td>
                  <td className="p-3 text-left text-white/80">
                    {r.recipeName ?? "—"}
                  </td>
                  <td className="p-3 text-right text-white/80">
                    {r.requirementCount}
                  </td>
                  <td className="p-3">
                    <label className="flex cursor-pointer items-center justify-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-white"
                        checked={everywhere}
                        disabled={
                          pendingLocationsId !== null ||
                          props.locationCount === 0
                        }
                        onChange={(event) =>
                          void setAvailability(r, event.target.checked)
                        }
                      />
                      <span className="w-10 text-left text-xs text-white/60">
                        {pendingLocationsId === r.id
                          ? "..."
                          : `${r.enabledLocationIds.length}/${props.locationCount}`}
                      </span>
                    </label>
                  </td>
                  <td className="p-3 text-right font-mono text-white/60">
                    {r.id}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
