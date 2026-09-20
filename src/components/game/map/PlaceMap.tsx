"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, LockKeyhole } from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import DragScrollContainer from "~/components/game/map/DragScrollContainer";
import { MAP_SIZE, type MapPoint } from "~/game/world/maps";

export type MapPinVariant = "place" | "settlement" | "person";

/** Something on a region or settlement map that leads to its own page. */
export type MapPlace = {
  key: string;
  name: string;
  /** Shown under the name in the list, such as a level requirement. */
  detail: string;
  /** The list heading it appears under. */
  group: string;
  href: string;
  /** Shown, but not open to the player yet. */
  locked?: boolean;
  /** Has something waiting for the player, such as a quest to hand in. */
  ready?: boolean;
  variant: MapPinVariant;
  /** An icon, or an NPC's head. */
  face: ReactNode;
  /** Shown on the pin and in the list, such as a new-quest dot. */
  indicator?: ReactNode;
  /** Unplaced places are only listed. */
  point: MapPoint | null;
};

/** The map artwork at its fixed size, with pins laid over it. */
export function MapCanvas(props: {
  image: string;
  alt: string;
  canvasRef?: RefObject<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div className="atlas-map-canvas" ref={props.canvasRef}>
      <Image
        src={props.image}
        alt={props.alt}
        width={MAP_SIZE.width}
        height={MAP_SIZE.height}
        priority
        className="atlas-map-image"
      />
      <div className="atlas-location-layer">{props.children}</div>
    </div>
  );
}

export function pinStyle(point: MapPoint): CSSProperties {
  return { left: `${point.x}%`, top: `${point.y}%` };
}

/** A pin's face and name. The element around it is placed at the point. */
export function MapPinContent(props: {
  face: ReactNode;
  name: string;
  indicator?: ReactNode;
}) {
  return (
    <>
      <span className="map-pin-face">{props.face}</span>
      {props.indicator ? (
        <span className="map-pin-indicator">{props.indicator}</span>
      ) : null}
      <span className="map-pin-label">{props.name}</span>
    </>
  );
}

/** A link to the place, or an inert element while it is locked. */
function PlaceLink(props: {
  place: MapPlace;
  className: string;
  active: boolean;
  onActive: (active: boolean) => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { place } = props;
  const shared = {
    className: props.className,
    style: props.style,
    "data-variant": place.variant,
    "data-locked": place.locked ?? false,
    "data-ready": place.ready ?? false,
    "data-active": props.active,
    onMouseEnter: () => props.onActive(true),
    onMouseLeave: () => props.onActive(false),
    onFocus: () => props.onActive(true),
    onBlur: () => props.onActive(false),
  };
  return place.locked ? (
    <span
      {...shared}
      aria-disabled="true"
      title={`${place.name}: ${place.detail}`}
    >
      {props.children}
    </span>
  ) : (
    <Link {...shared} href={place.href}>
      {props.children}
    </Link>
  );
}

/**
 * A map the player moves around by dragging, with a pin for every placed
 * place, beside a list of all of them. Without artwork it is just the list.
 */
export function PlaceMap(props: {
  image: string | null;
  alt: string;
  places: MapPlace[];
  emptyText: string;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const pinned = props.places.filter(
    (place): place is MapPlace & { point: MapPoint } => place.point !== null,
  );

  // Open on the middle of the pins.
  const focus = useMemo(() => {
    const points = props.places.flatMap((place) => place.point ?? []);
    if (points.length === 0) return { x: 0.5, y: 0.5 };
    const mean = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length / 100;
    return {
      x: mean(points.map((point) => point.x)),
      y: mean(points.map((point) => point.y)),
    };
  }, [props.places]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, MapPlace[]>();
    for (const place of props.places) {
      byGroup.set(place.group, [...(byGroup.get(place.group) ?? []), place]);
    }
    return [...byGroup];
  }, [props.places]);

  // Hovering a list row brings its pin into view.
  const reveal = (point: MapPoint | null) => {
    const view = canvasRef.current?.parentElement;
    if (!point || !view) return;
    const x = (point.x / 100) * MAP_SIZE.width;
    const y = (point.y / 100) * MAP_SIZE.height;
    const margin = 72;
    const visible =
      x > view.scrollLeft + margin &&
      x < view.scrollLeft + view.clientWidth - margin &&
      y > view.scrollTop + margin &&
      y < view.scrollTop + view.clientHeight - margin;
    if (visible) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    view.scrollTo({
      left: x - view.clientWidth / 2,
      top: y - view.clientHeight / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };
  const activate = (key: string) => (on: boolean) =>
    setActive((current) => (on ? key : current === key ? null : current));

  return (
    <section className="place-map" data-mapless={!props.image}>
      {props.image ? (
        <DragScrollContainer
          className="place-map-viewport"
          initialFocus={focus}
          focusAt={0.5}
          label={props.alt}
        >
          <MapCanvas image={props.image} alt={props.alt} canvasRef={canvasRef}>
            {pinned.map((place) => (
              <PlaceLink
                key={place.key}
                place={place}
                className="map-pin"
                style={pinStyle(place.point)}
                active={active === place.key}
                onActive={activate(place.key)}
              >
                <MapPinContent
                  face={place.locked ? <LockKeyhole /> : place.face}
                  name={place.name}
                  indicator={place.indicator}
                />
              </PlaceLink>
            ))}
          </MapCanvas>
        </DragScrollContainer>
      ) : null}

      <nav className="place-map-list" data-open={listOpen} aria-label="Places">
        <button
          type="button"
          className="place-map-list-toggle"
          aria-expanded={listOpen}
          onClick={() => setListOpen((open) => !open)}
        >
          <span>Places</span>
          <small>{props.places.length}</small>
          <ChevronDown aria-hidden="true" />
        </button>
        <div className="place-map-list-body">
          {props.places.length === 0 ? (
            <p className="place-map-empty">{props.emptyText}</p>
          ) : null}
          {groups.map(([group, places]) => (
            <div key={group}>
              <p className="place-map-list-heading">{group}</p>
              <ul>
                {places.map((place) => (
                  <li key={place.key}>
                    <PlaceLink
                      place={place}
                      className="place-map-row"
                      active={active === place.key}
                      onActive={(on) => {
                        activate(place.key)(on);
                        if (on) reveal(place.point);
                      }}
                    >
                      <span className="place-map-row-face">
                        {place.face}
                        {place.indicator}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong>{place.name}</strong>
                        <small>{place.detail}</small>
                      </span>
                      {place.locked ? (
                        <LockKeyhole aria-hidden="true" />
                      ) : (
                        <ChevronRight aria-hidden="true" />
                      )}
                    </PlaceLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </section>
  );
}
