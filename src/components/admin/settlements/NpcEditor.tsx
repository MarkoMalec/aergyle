"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  adminRequest,
  EnabledField,
  Field,
  inputClass,
  NumberField,
  NumberInput,
  Panel,
} from "~/components/admin/fields";
import { SearchSelect, type SearchOption } from "~/components/admin/SearchSelect";
import { HeadCropField } from "~/components/admin/settlements/HeadCropField";
import { Button } from "~/components/ui/button";
import type { NpcProfession } from "~/generated/prisma/enums";
import { NPC_PROFESSION_LABELS } from "~/game/settlements";
import { headCrop } from "~/game/world/maps";
import { cn } from "~/lib/utils";

const UNIT_MS = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
} as const;
type Unit = keyof typeof UNIT_MS;

type AdminOffer = {
  id: number;
  itemId: number;
  price: number;
  availableFrom: string | null;
  availableUntil: string | null;
  requiredProjectId: number | null;
  enabled: boolean;
};

type AdminNpc = {
  id: number;
  settlementId: number;
  name: string;
  description: string | null;
  portrait: string | null;
  headX: number | null;
  headY: number | null;
  headSize: number | null;
  profession: NpcProfession | null;
  requiredProjectId: number | null;
  enabled: boolean;
  sortOrder: number;
  offers: AdminOffer[];
};

/** A rare find is on sale from `start` for `amount` `unit`s. */
type RareWindow = { start: string; amount: number; unit: Unit };

type OfferDraft = {
  key: string;
  id?: number;
  itemId: number;
  price: number;
  rare: RareWindow | null;
  requiredProjectId: number | null;
  enabled: boolean;
};

function toWindow(offer: AdminOffer): RareWindow | null {
  if (!offer.availableFrom || !offer.availableUntil) return null;
  const length =
    new Date(offer.availableUntil).getTime() -
    new Date(offer.availableFrom).getTime();
  const unit: Unit =
    length % UNIT_MS.days === 0
      ? "days"
      : length % UNIT_MS.hours === 0
        ? "hours"
        : "minutes";
  return {
    start: offer.availableFrom,
    amount: Math.max(1, Math.round(length / UNIT_MS[unit])),
    unit,
  };
}

function windowEnd(window: RareWindow) {
  return new Date(
    new Date(window.start).getTime() + window.amount * UNIT_MS[window.unit],
  );
}

/** The value a datetime-local input shows for an instant, in local time. */
function toLocalInput(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function formatSpan(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function windowStatus(window: RareWindow, now: number) {
  const start = new Date(window.start).getTime();
  const end = windowEnd(window).getTime();
  if (now < start) {
    return { text: `Appears in ${formatSpan(start - now)}`, tone: "text-sky-300" };
  }
  if (now < end) {
    return {
      text: `For sale now, gone in ${formatSpan(end - now)}`,
      tone: "text-emerald-300",
    };
  }
  return { text: `Ended ${formatSpan(now - end)} ago`, tone: "text-white/40" };
}

function toDraft(offer: AdminOffer): OfferDraft {
  return {
    key: `offer-${offer.id}`,
    id: offer.id,
    itemId: offer.itemId,
    price: offer.price,
    rare: toWindow(offer),
    requiredProjectId: offer.requiredProjectId,
    enabled: offer.enabled,
  };
}

function toPayload(npc: Omit<AdminNpc, "offers">, offers: OfferDraft[]) {
  const { id: _id, ...profile } = npc;
  return {
    ...profile,
    // The list order is the shop order.
    offers: offers.map((offer, index) => ({
      ...(offer.id ? { id: offer.id } : {}),
      itemId: offer.itemId,
      price: offer.price,
      availableFrom: offer.rare?.start ?? null,
      availableUntil: offer.rare ? windowEnd(offer.rare).toISOString() : null,
      requiredProjectId: offer.requiredProjectId,
      enabled: offer.enabled,
      sortOrder: index * 10,
    })),
  };
}

function OfferRow(props: {
  offer: OfferDraft;
  items: SearchOption[];
  projects: SearchOption[];
  /** Null until mounted: local times and "now" only exist in the browser. */
  now: number | null;
  onChange: (patch: Partial<OfferDraft>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { offer, now } = props;
  const status = offer.rare && now !== null ? windowStatus(offer.rare, now) : null;
  const setRare = (patch: Partial<RareWindow>) => {
    if (offer.rare) props.onChange({ rare: { ...offer.rare, ...patch } });
  };

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,2fr)_140px_minmax(0,1.5fr)_150px_auto]">
        <Field label="Item">
          <SearchSelect
            options={props.items}
            value={offer.itemId}
            onChange={(itemId) => {
              if (itemId) props.onChange({ itemId });
            }}
          />
        </Field>
        <Field label="Price (gold each)">
          <NumberInput
            className={inputClass}
            min={0}
            step={0.01}
            value={offer.price}
            onValueChange={(price) => {
              if (price !== null) props.onChange({ price: Math.max(0, price) });
            }}
          />
        </Field>
        <Field label="Hidden until project">
          <SearchSelect
            options={props.projects}
            value={offer.requiredProjectId}
            noneLabel="Always visible"
            onChange={(requiredProjectId) => props.onChange({ requiredProjectId })}
          />
        </Field>
        <EnabledField
          value={offer.enabled}
          onChange={(enabled) => props.onChange({ enabled })}
        />
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => props.onMove(-1)}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => props.onMove(1)}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Remove item" onClick={props.onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-white/70">
          <input
            type="checkbox"
            checked={offer.rare !== null}
            onChange={(event) =>
              props.onChange({
                rare: event.target.checked
                  ? {
                      // Starts at the next full hour, for one day.
                      start: new Date(
                        Math.ceil(Date.now() / UNIT_MS.hours) * UNIT_MS.hours,
                      ).toISOString(),
                      amount: 1,
                      unit: "days",
                    }
                  : null,
              })
            }
          />
          Rare find (only for sale during a time window)
        </label>
        {offer.rare && now !== null ? (
          <>
            <span className="text-white/45">from</span>
            <input
              type="datetime-local"
              className={cn(inputClass, "w-auto")}
              value={toLocalInput(offer.rare.start)}
              onChange={(event) => {
                const start = new Date(event.target.value);
                if (!Number.isNaN(start.getTime())) {
                  setRare({ start: start.toISOString() });
                }
              }}
            />
            <span className="text-white/45">for</span>
            <NumberInput
              className={cn(inputClass, "w-20")}
              min={1}
              value={offer.rare.amount}
              onValueChange={(amount) => {
                if (amount !== null) setRare({ amount: Math.max(1, Math.floor(amount)) });
              }}
            />
            <select
              className={cn(inputClass, "w-auto")}
              value={offer.rare.unit}
              onChange={(event) => setRare({ unit: event.target.value as Unit })}
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
            {status ? <span className={`text-xs ${status.tone}`}>{status.text}</span> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function NpcEditor(props: {
  npc: AdminNpc;
  settlements: SearchOption[];
  projects: SearchOption[];
  items: SearchOption[];
}) {
  const router = useRouter();
  const { offers: initialOffers, ...initialProfile } = props.npc;
  const [profile, setProfile] = useState(initialProfile);
  const [offers, setOffers] = useState(() => initialOffers.map(toDraft));
  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [nextKey, setNextKey] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // The editor remounts after every save, so this is the stored NPC.
  const [initialPayload] = useState(() =>
    JSON.stringify(toPayload(initialProfile, initialOffers.map(toDraft))),
  );
  const payload = toPayload(profile, offers);
  const dirty = JSON.stringify(payload) !== initialPayload;
  const update = (patch: Partial<typeof profile>) =>
    setProfile((current) => ({ ...current, ...patch }));
  const updateOffer = (key: string, patch: Partial<OfferDraft>) =>
    setOffers((current) =>
      current.map((offer) => (offer.key === key ? { ...offer, ...patch } : offer)),
    );
  const moveOffer = (index: number, direction: -1 | 1) =>
    setOffers((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const revert = () => {
    setProfile(initialProfile);
    setOffers(initialOffers.map(toDraft));
  };
  const save = async () => {
    setBusy(true);
    try {
      await adminRequest(`/api/admin/npcs/${props.npc.id}`, "PATCH", payload);
      toast.success(`${profile.name} saved`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !window.confirm(
        `Delete ${initialProfile.name}? Its shop and quests are deleted too, including every player's progress on those quests.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await adminRequest(`/api/admin/npcs/${props.npc.id}`, "DELETE");
      toast.success(`${initialProfile.name} deleted`);
      router.push(`/admin/settlements/${initialProfile.settlementId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <Panel
        title="Profile"
        description="Players know NPCs by name. A profession is optional and only adds services: blacksmiths will offer rarity upgrades and, later, repairs."
        action={
          <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete NPC
          </Button>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[160px_1fr]">
          <HeadCropField
            portrait={profile.portrait}
            crop={headCrop(profile)}
            onChange={(crop) =>
              update({ headX: crop.x, headY: crop.y, headSize: crop.size })
            }
          />
          <div className="grid content-start gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Name">
              <input
                className={inputClass}
                value={profile.name}
                maxLength={120}
                onChange={(event) => update({ name: event.target.value })}
              />
            </Field>
            <Field label="Settlement" hint="Move the NPC by choosing another.">
              <SearchSelect
                options={props.settlements}
                value={profile.settlementId}
                onChange={(settlementId) => {
                  if (settlementId) update({ settlementId });
                }}
              />
            </Field>
            <Field label="Profession">
              <select
                className={inputClass}
                value={profile.profession ?? ""}
                onChange={(event) =>
                  update({
                    profession: (event.target.value || null) as NpcProfession | null,
                  })
                }
              >
                <option value="">None</option>
                {Object.entries(NPC_PROFESSION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <EnabledField
              value={profile.enabled}
              onChange={(enabled) => update({ enabled })}
              hint="Disabled NPCs are hidden from players."
            />
            <Field
              label="Portrait path"
              hint="A tall 2:3 image, e.g. /assets/npcs/ossa-blacksmith-v1.png. Drag the circle on it to choose the head shown on the settlement map."
              className="md:col-span-2"
            >
              <input
                className={inputClass}
                value={profile.portrait ?? ""}
                maxLength={191}
                onChange={(event) =>
                  update({ portrait: event.target.value.trim() || null })
                }
              />
            </Field>
            <Field
              label="Hidden until project"
              hint="The NPC appears once this community project is completed."
            >
              <SearchSelect
                options={props.projects}
                value={profile.requiredProjectId}
                noneLabel="Always visible"
                onChange={(requiredProjectId) => update({ requiredProjectId })}
              />
            </Field>
            <NumberField
              label="Sort order"
              hint="Lower numbers are shown first in the settlement."
              value={profile.sortOrder}
              onChange={(sortOrder) => update({ sortOrder })}
            />
            <Field
              label="Description"
              hint="A greeting or short bio shown to players."
              className="md:col-span-2 xl:col-span-4"
            >
              <textarea
                className={inputClass}
                rows={3}
                maxLength={4_000}
                value={profile.description ?? ""}
                onChange={(event) =>
                  update({ description: event.target.value || null })
                }
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel
        title="Shop"
        description="Any item, at this NPC's own price. Players receive it at the item's rarity. Rare finds look like any other item to players; they are simply only for sale inside their time window. The list order is the order players see."
      >
        <div className="space-y-3">
          {offers.length === 0 ? (
            <p className="text-sm text-white/45">This NPC sells nothing yet.</p>
          ) : null}
          {offers.map((offer, index) => (
            <OfferRow
              key={offer.key}
              offer={offer}
              items={props.items}
              projects={props.projects}
              now={now}
              onChange={(patch) => updateOffer(offer.key, patch)}
              onMove={(direction) => moveOffer(index, direction)}
              onRemove={() =>
                setOffers((current) => current.filter((row) => row.key !== offer.key))
              }
            />
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              const item = props.items[0];
              if (!item) return toast.error("Create an item first");
              setOffers((current) => [
                ...current,
                {
                  key: `new-${nextKey}`,
                  itemId: item.id,
                  price: 10,
                  rare: null,
                  requiredProjectId: null,
                  enabled: true,
                },
              ]);
              setNextKey((key) => key + 1);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add item for sale
          </Button>
        </div>
      </Panel>

      {dirty ? (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-gray-950/95 p-3 shadow-lg">
          <span className="text-sm text-amber-200">
            Unsaved changes to {profile.name || "this NPC"}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={revert} disabled={busy}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Revert
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              <Save className="mr-2 h-4 w-4" />
              {busy ? "Saving…" : "Save NPC"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
