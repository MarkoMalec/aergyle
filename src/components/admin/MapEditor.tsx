"use client";

import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { MapPinned, RotateCcw, Save, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  adminRequest,
  Field,
  inputClass,
  Panel,
} from "~/components/admin/fields";
import DragScrollContainer from "~/components/game/map/DragScrollContainer";
import {
  MapCanvas,
  MapPinContent,
  pinStyle,
  type MapPinVariant,
} from "~/components/game/map/PlaceMap";
import { Button } from "~/components/ui/button";
import { MAP_SIZE, type MapPinKind, type MapPoint } from "~/game/world/maps";
import { cn } from "~/lib/utils";

export type EditorPin = {
  kind: MapPinKind;
  id: number;
  name: string;
  detail: string;
  variant: MapPinVariant;
  face: React.ReactNode;
  point: MapPoint | null;
};

type Draft = { image: string | null; points: Record<string, MapPoint | null> };

const pinKey = (pin: { kind: MapPinKind; id: number }) =>
  `${pin.kind}-${pin.id}`;
const toPercent = (value: number) =>
  Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
const samePoint = (a: MapPoint | null, b: MapPoint | null) =>
  a?.x === b?.x && a?.y === b?.y;

/**
 * A map's artwork and its pins, shown exactly as players see them. Drag a
 * pin to move it; drag the map itself to look around.
 */
export function MapEditor(props: {
  map: "location" | "settlement";
  id: number;
  title: string;
  description: React.ReactNode;
  imageHint: string;
  image: string | null;
  pins: EditorPin[];
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: string; dx: number; dy: number } | null>(null);
  const [saved, setSaved] = useState<Draft>(() => ({
    image: props.image,
    points: Object.fromEntries(
      props.pins.map((pin) => [pinKey(pin), pin.point]),
    ),
  }));
  const [draft, setDraft] = useState(saved);
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const moved = props.pins.filter(
    (pin) =>
      !samePoint(
        draft.points[pinKey(pin)] ?? null,
        saved.points[pinKey(pin)] ?? null,
      ),
  );
  const dirty = draft.image !== saved.image || moved.length > 0;
  const image = draft.image?.startsWith("/") ? draft.image : null;

  const setPoint = (key: string, point: MapPoint | null) =>
    setDraft((current) => ({
      ...current,
      points: { ...current.points, [key]: point },
    }));
  /** The pointer's spot on the map, less the offset it grabbed the pin at. */
  const pointAt = (event: React.PointerEvent, dx: number, dy: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: toPercent(((event.clientX - dx - rect.left) / rect.width) * 100),
      y: toPercent(((event.clientY - dy - rect.top) / rect.height) * 100),
    };
  };
  /** Puts a pin in the middle of what the map shows right now. */
  const place = (key: string) => {
    const view = canvasRef.current?.parentElement;
    if (!view) return;
    setPoint(key, {
      x: toPercent(
        ((view.scrollLeft + view.clientWidth / 2) / MAP_SIZE.width) * 100,
      ),
      y: toPercent(
        ((view.scrollTop + view.clientHeight / 2) / MAP_SIZE.height) * 100,
      ),
    });
    setActive(key);
  };

  const save = async () => {
    setBusy(true);
    try {
      await adminRequest("/api/admin/maps", "PATCH", {
        map: props.map,
        id: props.id,
        mapImage: draft.image,
        pins: moved.map((pin) => ({
          kind: pin.kind,
          id: pin.id,
          point: draft.points[pinKey(pin)] ?? null,
        })),
      });
      setSaved(draft);
      toast.success("Map saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={props.title}
      description={props.description}
      action={
        <div className="flex gap-2">
          {dirty ? (
            <Button
              variant="ghost"
              onClick={() => setDraft(saved)}
              disabled={busy}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Revert
            </Button>
          ) : null}
          <Button onClick={() => void save()} disabled={busy || !dirty}>
            <Save className="mr-2 h-4 w-4" />
            {busy ? "Saving…" : dirty ? "Save map" : "Saved"}
          </Button>
        </div>
      }
    >
      <Field label="Map image" hint={props.imageHint} className="max-w-xl">
        <input
          className={inputClass}
          value={draft.image ?? ""}
          maxLength={191}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              image: event.target.value.trim() || null,
            }))
          }
        />
      </Field>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        {image ? (
          <DragScrollContainer
            className="h-[600px] rounded-lg bg-black/30"
            label="Map"
          >
            <MapCanvas image={image} alt="" canvasRef={canvasRef}>
              {props.pins.map((pin) => {
                const key = pinKey(pin);
                const point = draft.points[key];
                if (!point) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    className="map-pin cursor-move touch-none"
                    style={pinStyle(point)}
                    data-variant={pin.variant}
                    data-active={active === key}
                    aria-label={`Move ${pin.name}`}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      const rect = canvasRef.current!.getBoundingClientRect();
                      // Keep the pin under the spot it was grabbed at.
                      drag.current = {
                        key,
                        dx:
                          event.clientX -
                          rect.left -
                          (point.x / 100) * rect.width,
                        dy:
                          event.clientY -
                          rect.top -
                          (point.y / 100) * rect.height,
                      };
                      setActive(key);
                    }}
                    onPointerMove={(event) => {
                      const grab = drag.current;
                      if (grab?.key === key) {
                        setPoint(key, pointAt(event, grab.dx, grab.dy));
                      }
                    }}
                    onPointerUp={() => (drag.current = null)}
                    onPointerCancel={() => (drag.current = null)}
                  >
                    <MapPinContent face={pin.face} name={pin.name} />
                  </button>
                );
              })}
            </MapCanvas>
          </DragScrollContainer>
        ) : (
          <div className="grid h-[240px] place-items-center rounded-lg bg-black/30 px-6 text-center text-sm text-white/45">
            Set a map image to place pins on it.
          </div>
        )}

        <ul className="space-y-1 xl:max-h-[600px] xl:overflow-y-auto">
          {props.pins.length === 0 ? (
            <li className="text-sm text-white/45">Nothing to pin yet.</li>
          ) : null}
          {props.pins.map((pin) => {
            const key = pinKey(pin);
            const placed = Boolean(draft.points[key]);
            return (
              <li
                key={key}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-1.5",
                  active === key ? "bg-white/10" : "bg-black/20",
                )}
                onMouseEnter={() => setActive(key)}
              >
                <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-black/40 text-amber-300 [&_svg]:h-4 [&_svg]:w-4">
                  {pin.face}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{pin.name}</strong>
                  <small className="block truncate text-xs text-white/45">
                    {placed ? pin.detail : `${pin.detail} · not on the map`}
                  </small>
                </span>
                {placed ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Take ${pin.name} off the map`}
                    onClick={() => setPoint(key, null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Place ${pin.name} on the map`}
                    disabled={!image}
                    onClick={() => place(key)}
                  >
                    <MapPinned className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
