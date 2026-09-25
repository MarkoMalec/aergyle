"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";
import {
  adminRequest,
  Field,
  inputClass,
  NumberInput,
  Panel,
} from "~/components/admin/fields";
import { Button } from "~/components/ui/button";
import {
  ActionButton,
  Empty,
  formatDate,
  formatGold,
  fromNow,
  Row,
  Tag,
  usePlayerEdit,
} from "./shared";

function AccountPanel() {
  const { player, run } = usePlayerEdit();
  const { account } = player;
  const [name, setName] = useState(account.name ?? "");
  const [email, setEmail] = useState(account.email ?? "");
  const [password, setPassword] = useState("");

  const changes = {
    ...(name.trim() !== (account.name ?? "") ? { name } : {}),
    ...(email.trim() !== (account.email ?? "") ? { email } : {}),
    ...(password ? { password } : {}),
  };
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    const result = await run("account", "", "PATCH", changes, "Account saved");
    if (result) setPassword("");
  };

  return (
    <Panel
      title="Account"
      description="How they sign in. A new password doesn't sign them out of devices already signed in; those sessions last up to 30 days."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Name">
          <input
            className={inputClass}
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field
          label="New password"
          hint={account.hasPassword ? "Leave empty to keep theirs." : "They have none; this adds email sign-in."}
        >
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          actionKey="account"
          variant="default"
          disabled={!dirty}
          onClick={save}
        >
          Save account
        </ActionButton>
        {dirty ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setName(account.name ?? "");
              setEmail(account.email ?? "");
              setPassword("");
            }}
          >
            Discard
          </Button>
        ) : null}
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Player ID", <code key="id" className="text-xs">{account.id}</code>],
          [
            "Sign-in",
            [
              account.hasPassword ? "Password" : null,
              ...account.providers.map(
                (provider) =>
                  `${provider.provider} (${provider.providerAccountId})`,
              ),
            ]
              .filter(Boolean)
              .join(" · ") || "None",
          ],
          ["Email verified", formatDate(account.emailVerified)],
          ["Last online", formatDate(account.lastOnline)],
          ["Last action", account.lastAction ?? "—"],
        ].map(([label, value]) => (
          <div key={label as string}>
            <dt className="text-xs text-white/45">{label}</dt>
            <dd className="mt-0.5 text-white/85">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** A label, an input and its own save button. */
function EditRow(props: {
  label: string;
  hint?: React.ReactNode;
  input: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 rounded-lg bg-black/25 px-4 py-3 md:grid-cols-[200px_minmax(0,360px)_1fr] md:items-center">
      <div>
        <div className="text-sm font-medium">{props.label}</div>
        {props.hint ? (
          <div className="text-[11px] leading-snug text-white/45">
            {props.hint}
          </div>
        ) : null}
      </div>
      {props.input}
      <div className="flex flex-wrap gap-2">{props.actions}</div>
    </div>
  );
}

function CharacterPanel() {
  const { player, options, run } = usePlayerEdit();
  const { character } = player;
  const [level, setLevel] = useState<number | null>(character.level);
  const [experience, setExperience] = useState(character.experience);
  const [gold, setGold] = useState<number | null>(character.gold);
  const [locationId, setLocationId] = useState(character.locationId);
  const [health, setHealth] = useState<number | null>(
    Math.round(character.health.current),
  );

  return (
    <Panel
      title="Character"
      description="The game derives the level from total XP, so setting a level starts them at its beginning, and setting XP moves the level to match."
    >
      <div className="space-y-2">
        <EditRow
          label="Level"
          hint={`${character.progress.currentXp.toLocaleString()} / ${character.progress.xpForNextLevel.toLocaleString()} XP into level ${character.level} · max ${character.maxLevel}`}
          input={
            <NumberInput
              className={inputClass}
              min={1}
              max={character.maxLevel}
              value={level}
              onValueChange={setLevel}
            />
          }
          actions={
            <ActionButton
              actionKey="level"
              disabled={level === null || level === character.level}
              onClick={() =>
                run("level", "", "PATCH", { level }, `Level set to ${level}`)
              }
            >
              Set level
            </ActionButton>
          }
        />
        <EditRow
          label="Total XP"
          input={
            <input
              className={inputClass}
              inputMode="numeric"
              value={experience}
              onChange={(event) =>
                setExperience(event.target.value.replace(/\D/g, ""))
              }
            />
          }
          actions={
            <ActionButton
              actionKey="experience"
              disabled={!experience || experience === character.experience}
              onClick={() =>
                run("experience", "", "PATCH", { experience }, "XP set")
              }
            >
              Set XP
            </ActionButton>
          }
        />
        <EditRow
          label="Gold"
          hint={`Now ${formatGold(character.gold)}`}
          input={
            <NumberInput
              className={inputClass}
              min={0}
              step={0.01}
              value={gold}
              onValueChange={setGold}
            />
          }
          actions={
            <ActionButton
              actionKey="gold"
              disabled={gold === null || gold === character.gold}
              onClick={() =>
                run("gold", "", "PATCH", { gold }, `Gold set to ${formatGold(gold ?? 0)}`)
              }
            >
              Set gold
            </ActionButton>
          }
        />
        <EditRow
          label="Location"
          hint="Moves them at once. A journey in progress still arrives where it was going."
          input={
            <select
              className={inputClass}
              value={locationId ?? ""}
              onChange={(event) =>
                setLocationId(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Nowhere</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          }
          actions={
            <ActionButton
              actionKey="location"
              disabled={locationId === character.locationId}
              onClick={() =>
                run("location", "", "PATCH", { locationId }, "Location changed")
              }
            >
              Move
            </ActionButton>
          }
        />
        <EditRow
          label="Health"
          hint={`${Math.round(character.health.current)} / ${Math.round(character.health.max)} · regenerates ${character.health.regen}/s`}
          input={
            <NumberInput
              className={inputClass}
              min={0}
              max={Math.round(character.health.max)}
              value={health}
              onValueChange={setHealth}
            />
          }
          actions={
            <>
              <ActionButton
                actionKey="health"
                disabled={health === null}
                onClick={() => run("health", "", "PATCH", { health }, "Health set")}
              >
                Set
              </ActionButton>
              <ActionButton
                actionKey="heal"
                onClick={() =>
                  run(
                    "heal",
                    "",
                    "PATCH",
                    { health: Math.ceil(character.health.max) },
                    "Fully healed",
                  )
                }
              >
                Heal fully
              </ActionButton>
            </>
          }
        />
      </div>
    </Panel>
  );
}

function ActivityPanel() {
  const { player, run } = usePlayerEdit();

  return (
    <Panel
      title="Activities"
      description="Complete now skips the wait: travel arrives, vocations and garden harvests pay out on the next tick, and expeditions and dungeon runs become ready to claim. Cancel ends it with nothing paid out."
    >
      {player.activities.length === 0 ? (
        <Empty>Idle.</Empty>
      ) : (
        <div className="space-y-2">
          {player.activities.map((activity) => {
            const ended = new Date(activity.endsAt).getTime() <= Date.now();
            return (
              <Row key={activity.kind}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {activity.label}
                    {activity.claimedAt ? (
                      <Tag>Claimed journal</Tag>
                    ) : ended ? (
                      <Tag tone="good">Finished</Tag>
                    ) : (
                      <Tag tone="info">Ends {fromNow(activity.endsAt)}</Tag>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-white/50">
                    {activity.detail} · started {formatDate(activity.startedAt)}
                  </div>
                </div>
                {!activity.claimedAt && !ended ? (
                  <ActionButton
                    actionKey={`complete-${activity.kind}`}
                    onClick={() =>
                      run(
                        `complete-${activity.kind}`,
                        "/activity",
                        "POST",
                        { kind: activity.kind, action: "complete" },
                        `${activity.label} completed`,
                      )
                    }
                  >
                    Complete now
                  </ActionButton>
                ) : null}
                <ActionButton
                  actionKey={`cancel-${activity.kind}`}
                  variant="destructive"
                  confirm={
                    activity.claimedAt
                      ? undefined
                      : `Cancel ${activity.label.toLowerCase()}? Nothing it earned so far is paid out.`
                  }
                  onClick={() =>
                    run(
                      `cancel-${activity.kind}`,
                      "/activity",
                      "POST",
                      { kind: activity.kind, action: "cancel" },
                      activity.claimedAt ? "Journal cleared" : `${activity.label} cancelled`,
                    )
                  }
                >
                  {activity.claimedAt ? "Clear" : "Cancel"}
                </ActionButton>
              </Row>
            );
          })}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Garden</h3>
        {player.gardenTiles.length === 0 ? (
          <Empty>Nothing planted.</Empty>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {player.gardenTiles.map((tile) => {
              const ready = new Date(tile.readyAt).getTime() <= Date.now();
              return (
                <Row key={tile.id} className="py-2">
                  <Image
                    src={tile.seed.sprite}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      Tile {tile.tileIndex + 1} · {tile.seed.name}
                    </div>
                    <div className="text-xs text-white/50">
                      {tile.yieldName} ·{" "}
                      {ready ? "ready" : `ready ${fromNow(tile.readyAt)}`}
                    </div>
                  </div>
                  {!ready ? (
                    <ActionButton
                      actionKey={`grow-${tile.id}`}
                      onClick={() =>
                        run(`grow-${tile.id}`, "/garden", "PATCH", { tileId: tile.id }, "Ready to harvest")
                      }
                    >
                      Grow now
                    </ActionButton>
                  ) : null}
                  <ActionButton
                    actionKey={`clear-${tile.id}`}
                    variant="ghost"
                    confirm="Clear this tile? The crop is destroyed."
                    onClick={() =>
                      run(`clear-${tile.id}`, "/garden", "DELETE", { tileId: tile.id }, "Tile cleared")
                    }
                  >
                    Clear
                  </ActionButton>
                </Row>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}

function DangerZone() {
  const { player } = usePlayerEdit();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const name = player.account.name ?? player.account.id;

  const remove = async () => {
    const typed = window.prompt(
      `This permanently deletes ${name} and everything they own: items, gold, progress, messages. It can't be undone.\n\nType their name to confirm:`,
    );
    if (typed === null) return;
    if (typed.trim() !== name) {
      toast.error("The name didn't match; nothing was deleted");
      return;
    }
    setDeleting(true);
    try {
      await adminRequest(`/api/admin/players/${player.account.id}`, "DELETE");
      toast.success(`${name} deleted`);
      router.push("/admin/players");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete");
      setDeleting(false);
    }
  };

  return (
    <Panel
      title="Delete account"
      description="Removes the player and everything they own. Other players keep their side of past trades, and reports about this player stay in Moderation."
    >
      <div>
        <Button
          type="button"
          variant="destructive"
          disabled={deleting}
          onClick={() => void remove()}
        >
          {deleting ? "Deleting…" : `Delete ${name}`}
        </Button>
      </div>
    </Panel>
  );
}

export function OverviewTab() {
  const { player } = usePlayerEdit();
  const { account, character } = player;
  // Drafts start from the saved values; a new key after each save resets them.
  return (
    <div className="space-y-6">
      <CharacterPanel
        key={[
          character.experience,
          character.gold,
          character.locationId,
          Math.round(character.health.current),
        ].join("|")}
      />
      <ActivityPanel />
      <AccountPanel key={[account.name, account.email].join("|")} />
      <DangerZone />
    </div>
  );
}
