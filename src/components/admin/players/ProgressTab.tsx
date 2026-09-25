"use client";

import Image from "next/image";
import React, { useMemo, useState } from "react";
import { Field, inputClass, Panel } from "~/components/admin/fields";
import { SearchSelect } from "~/components/admin/SearchSelect";
import {
  ActionButton,
  Empty,
  formatDate,
  humanize,
  Row,
  Tag,
  usePlayerEdit,
} from "./shared";

function Quests() {
  const { player, run } = usePlayerEdit();
  return (
    <Panel
      title="Quests"
      description="Quests they have taken, one row per period for daily and weekly ones. Marking one complete pays nothing; forgetting it lets them take it again."
    >
      {player.quests.length === 0 ? (
        <Empty>No quests taken.</Empty>
      ) : (
        <div className="space-y-2">
          {player.quests.map((quest) => (
            <Row key={quest.id} className="py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {quest.name}
                  {quest.completedAt ? (
                    <Tag tone="good">Completed</Tag>
                  ) : (
                    <Tag tone="info">In progress</Tag>
                  )}
                  {quest.repeat !== "ONCE" ? (
                    <Tag>
                      {humanize(quest.repeat)} · {quest.period}
                    </Tag>
                  ) : null}
                </div>
                <div className="text-xs text-white/50">
                  {quest.npc} · {quest.settlement} · taken{" "}
                  {formatDate(quest.acceptedAt)}
                  {quest.completedAt ? ` · done ${formatDate(quest.completedAt)}` : ""}
                </div>
              </div>
              <ActionButton
                actionKey={`quest-${quest.id}`}
                onClick={() =>
                  run(
                    `quest-${quest.id}`,
                    "/quests",
                    "PATCH",
                    { userQuestId: quest.id, completed: !quest.completedAt },
                    quest.completedAt ? "Back in progress" : "Marked complete",
                  )
                }
              >
                {quest.completedAt ? "Reopen" : "Mark complete"}
              </ActionButton>
              <ActionButton
                actionKey={`forget-${quest.id}`}
                variant="ghost"
                confirm={`Forget "${quest.name}"? Its progress is lost and they can take it again.`}
                onClick={() =>
                  run(
                    `forget-${quest.id}`,
                    "/quests",
                    "DELETE",
                    { userQuestId: quest.id },
                    "Quest forgotten",
                  )
                }
              >
                Forget
              </ActionButton>
            </Row>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Recipes() {
  const { player, options, run } = usePlayerEdit();
  const [itemId, setItemId] = useState<number | null>(null);
  const choices = useMemo(() => {
    const known = new Set(player.recipes.map((recipe) => recipe.itemId));
    return options.items
      .filter((item) => item.isRecipe && !known.has(item.id))
      .map((item) => ({ id: item.id, name: item.name, image: item.sprite }));
  }, [options.items, player.recipes]);

  return (
    <Panel
      title="Recipes"
      description="Recipes they learned by reading a recipe item. Teaching one here needs no item."
    >
      {player.recipes.length === 0 ? (
        <Empty>No recipes learned.</Empty>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {player.recipes.map((recipe) => (
            <Row key={recipe.itemId} className="py-2">
              <Image
                src={recipe.sprite}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{recipe.name}</div>
                <div className="text-xs text-white/50">
                  Learned {formatDate(recipe.learnedAt)}
                </div>
              </div>
              <ActionButton
                actionKey={`recipe-${recipe.itemId}`}
                variant="ghost"
                onClick={() =>
                  run(
                    `recipe-${recipe.itemId}`,
                    "/recipes",
                    "DELETE",
                    { itemId: recipe.itemId },
                    `${recipe.name} forgotten`,
                  )
                }
              >
                Forget
              </ActionButton>
            </Row>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Teach a recipe" className="w-full max-w-md">
          <SearchSelect
            options={choices}
            value={itemId}
            placeholder="Choose a recipe…"
            onChange={setItemId}
          />
        </Field>
        <ActionButton
          actionKey="teach"
          className="h-9"
          disabled={!itemId}
          onClick={async () => {
            const result = await run("teach", "/recipes", "POST", { itemId }, "Recipe learned");
            if (result) setItemId(null);
          }}
        >
          Teach
        </ActionButton>
      </div>
    </Panel>
  );
}

function Storages() {
  const { player, options, run } = usePlayerEdit();
  const rented = new Set(player.storages.map((storage) => storage.storageId));
  const available = options.storages.filter((storage) => !rented.has(storage.id));
  const [storageId, setStorageId] = useState<number | "">("");

  return (
    <Panel
      title="Storage"
      description="Settlement storages they rent. Their stored items are in the Items tab. Renting one here is free; removing one destroys what's inside."
    >
      {player.storages.length === 0 ? (
        <Empty>No storage rented.</Empty>
      ) : (
        <div className="space-y-2">
          {player.storages.map((storage) => (
            <Row key={storage.id} className="py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {storage.settlement} · {storage.name}
                </div>
                <div className="text-xs text-white/50">
                  {storage.used} of {storage.slots} slots used · rented{" "}
                  {formatDate(storage.unlockedAt)}
                </div>
              </div>
              <ActionButton
                actionKey={`storage-${storage.id}`}
                variant="destructive"
                confirm={`Remove their ${storage.settlement} storage?${storage.used > 0 ? ` The ${storage.used} stack${storage.used === 1 ? "" : "s"} inside are destroyed.` : ""}`}
                onClick={() =>
                  run(
                    `storage-${storage.id}`,
                    "/storages",
                    "DELETE",
                    { userStorageId: storage.id },
                    "Storage removed",
                  )
                }
              >
                Remove
              </ActionButton>
            </Row>
          ))}
        </div>
      )}
      {available.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Rent a storage for them" className="w-full max-w-md">
            <select
              className={inputClass}
              value={storageId}
              onChange={(event) =>
                setStorageId(event.target.value ? Number(event.target.value) : "")
              }
            >
              <option value="">Choose…</option>
              {available.map((storage) => (
                <option key={storage.id} value={storage.id}>
                  {storage.name}
                </option>
              ))}
            </select>
          </Field>
          <ActionButton
            actionKey="rent"
            className="h-9"
            disabled={storageId === ""}
            onClick={async () => {
              const result = await run("rent", "/storages", "POST", { storageId }, "Storage rented");
              if (result) setStorageId("");
            }}
          >
            Rent
          </ActionButton>
        </div>
      ) : null}
    </Panel>
  );
}

function Contributions() {
  const { player } = usePlayerEdit();
  return (
    <Panel
      title="Community projects"
      description="What they gave to settlement projects. Totals belong to the whole settlement, so they are shown here but changed on the settlement's page."
    >
      {player.contributions.length === 0 ? (
        <Empty>Nothing contributed.</Empty>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {player.contributions.map((row) => (
            <Row key={row.id} className="py-2">
              <Image
                src={row.item.sprite}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
              <div className="min-w-0 flex-1 text-sm">
                {row.quantity.toLocaleString()} × {row.item.name}
                <div className="text-xs text-white/50">
                  {row.project} · {row.settlement}
                </div>
              </div>
            </Row>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function ProgressTab() {
  return (
    <div className="space-y-6">
      <Quests />
      <Recipes />
      <Storages />
      <Contributions />
    </div>
  );
}
