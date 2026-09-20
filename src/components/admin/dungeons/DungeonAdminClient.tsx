"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { CirclePlus, Save, Skull } from "lucide-react";
import toast from "react-hot-toast";
import {
  CreatureEditor,
  type AdminCreature,
  type AdminItemOption,
} from "~/components/admin/creatures/CreatureEditor";
import {
  TestCharacterPanel,
  testCharacterForLevel,
} from "~/components/admin/dungeons/BalancePreview";
import {
  DungeonCard,
  type AdminDungeon,
} from "~/components/admin/dungeons/DungeonCard";
import { adminRequest, NumberField, Panel } from "~/components/admin/fields";
import { Button } from "~/components/ui/button";
import type { StatType } from "~/generated/prisma/enums";
import type { StatGrowthRule } from "~/utils/stats";

type Config = {
  minimumHealthToStartPercent: number;
  deathLootKeepChance: number;
  deathLootQuantityPercent: number;
};

type LocationOption = { id: number; name: string };

function DungeonRules(props: {
  initial: Config;
  onSaved: (config: Config) => void;
}) {
  const [config, setConfig] = useState(props.initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(config) !== JSON.stringify(props.initial);
  const save = async () => {
    setSaving(true);
    try {
      await adminRequest("/api/admin/dungeons/config", "PATCH", config);
      props.onSaved(config);
      toast.success("Dungeon rules saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Panel
      title={
        <>
          <Skull className="h-4 w-4 text-amber-300" aria-hidden="true" />
          Rules for every dungeon
        </>
      }
      description={
        <>
          <strong className="text-white/70">Cleared:</strong> all loot and XP;
          damage taken is subtracted from health.{" "}
          <strong className="text-white/70">Defeated:</strong> health drops to
          0, no XP, and only part of the loot survives (below). Changes apply to
          runs started afterwards.
        </>
      }
      action={
        <Button onClick={() => void save()} disabled={saving || !dirty}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save rules"}
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <NumberField
          label="Health needed to enter"
          suffix="%"
          hint="Of maximum health. Below this, players must recover first."
          value={config.minimumHealthToStartPercent}
          min={0}
          max={100}
          onChange={(value) =>
            setConfig((row) => ({ ...row, minimumHealthToStartPercent: value }))
          }
        />
        <NumberField
          label="On defeat: chance to keep each loot stack"
          suffix="%"
          hint="Rolled separately for every item stack looted before falling."
          value={Math.round(config.deathLootKeepChance * 100)}
          min={0}
          max={100}
          onChange={(value) =>
            setConfig((row) => ({
              ...row,
              deathLootKeepChance: Math.min(100, Math.max(0, value)) / 100,
            }))
          }
        />
        <NumberField
          label="On defeat: quantity kept per stack"
          suffix="%"
          hint="A kept stack shrinks to this share, but never below 1."
          value={config.deathLootQuantityPercent}
          min={0}
          max={100}
          onChange={(value) =>
            setConfig((row) => ({ ...row, deathLootQuantityPercent: value }))
          }
        />
      </div>
    </Panel>
  );
}

export function DungeonAdminClient(props: {
  config: Config;
  dungeons: Array<AdminDungeon & { updatedAt: string }>;
  monsters: AdminCreature[];
  locations: LocationOption[];
  items: AdminItemOption[];
  statGrowth: Record<StatType, StatGrowthRule>;
}) {
  const router = useRouter();
  const [config, setConfig] = useState(props.config);
  const [monsters, setMonsters] = useState(props.monsters);
  const [character, setCharacter] = useState(() =>
    testCharacterForLevel(1, props.statGrowth),
  );
  const [createdId, setCreatedId] = useState<number | null>(null);
  const monstersById = useMemo(
    () => new Map(monsters.map((monster) => [monster.id, monster])),
    [monsters],
  );
  const rules = useMemo(
    () => ({
      keepChance: config.deathLootKeepChance,
      quantityPercent: config.deathLootQuantityPercent,
    }),
    [config.deathLootKeepChance, config.deathLootQuantityPercent],
  );

  const create = async () => {
    const location = props.locations[0];
    if (!location) return toast.error("Create a world location first");
    try {
      const result = await adminRequest("/api/admin/dungeons", "POST", {
        locationId: location.id,
        name: `New Dungeon ${props.dungeons.length + 1}`,
        description: null,
        difficulty: "NORMAL",
        requiredLevel: 1,
        durationSeconds: 30 * 60,
        packSize: 1,
        xpReward: 20,
        enabled: false,
        sortOrder: 100,
        monsters: [],
      });
      const dungeon = result?.dungeon as { id?: number } | undefined;
      setCreatedId(dungeon?.id ?? null);
      toast.success("Dungeon created (disabled). Set it up, then enable it.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create");
    }
  };

  return (
    <div className="space-y-8">
      <DungeonRules initial={config} onSaved={setConfig} />

      <Panel
        title="Dungeons"
        description="Open a dungeon to edit it. The balance preview beside the form updates as you type, so you can tune monsters, counts and pack size before saving."
        action={
          <Button variant="secondary" onClick={() => void create()}>
            <CirclePlus className="mr-2 h-4 w-4" />
            New dungeon
          </Button>
        }
      >
        <TestCharacterPanel
          value={character}
          onChange={setCharacter}
          statGrowth={props.statGrowth}
        />
        <div className="space-y-3">
          {props.dungeons.length === 0 ? (
            <p className="text-sm text-white/45">
              No dungeons yet. Create one to get started.
            </p>
          ) : null}
          {props.dungeons.map(({ updatedAt, ...dungeon }) => (
            <DungeonCard
              // Remount only when the saved row changes on the server, so
              // refreshing after create/delete keeps other unsaved drafts.
              key={`${dungeon.id}:${updatedAt}`}
              dungeon={dungeon}
              monsters={monsters}
              monstersById={monstersById}
              locations={props.locations}
              character={character}
              rules={rules}
              defaultOpen={dungeon.id === createdId}
            />
          ))}
        </div>
      </Panel>

      <CreatureEditor
        kind="MONSTER"
        initial={props.monsters}
        items={props.items}
        onChange={setMonsters}
      />
    </div>
  );
}
