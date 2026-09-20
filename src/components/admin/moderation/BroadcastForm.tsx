"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import {
  adminRequest,
  Field,
  inputClass,
  Panel,
} from "~/components/admin/fields";
import { Button } from "~/components/ui/button";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
} from "~/game/communication";
import type { NotificationCategory } from "~/generated/prisma/enums";

type Kind = "NOTIFICATION" | "MESSAGE";

/**
 * Writes to players from the admin panel: a notification (one player, or
 * everyone) or a system message in their Messages, which they can't reply to.
 */
export function BroadcastForm() {
  const [kind, setKind] = useState<Kind>("NOTIFICATION");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState<NotificationCategory>("SYSTEM");
  const [title, setTitle] = useState("");
  const [href, setHref] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    try {
      const result = await adminRequest("/api/admin/communication", "POST", {
        kind,
        to: to.trim(),
        category,
        title,
        href,
        body,
      });
      toast.success(`Sent to ${result?.sent as number} player(s)`);
      setTitle("");
      setBody("");
      setHref("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Panel
      title="Write to players"
      description="A notification lands behind the bell; a system message lands in the player's Messages and can't be answered."
    >
      <form
        onSubmit={(event) => void send(event)}
        className="grid gap-3 md:grid-cols-2"
      >
        <Field label="Kind">
          <select
            className={inputClass}
            value={kind}
            onChange={(event) => setKind(event.target.value as Kind)}
          >
            <option value="NOTIFICATION">Notification</option>
            <option value="MESSAGE">System message</option>
          </select>
        </Field>

        <Field
          label="To (player name)"
          hint={
            kind === "MESSAGE"
              ? "A system message needs a player."
              : "Leave empty to notify every player."
          }
        >
          <input
            className={inputClass}
            value={to}
            required={kind === "MESSAGE"}
            maxLength={120}
            placeholder={kind === "MESSAGE" ? "Exact name" : "Everyone"}
            onChange={(event) => setTo(event.target.value)}
          />
        </Field>

        {kind === "NOTIFICATION" ? (
          <>
            <Field label="Category">
              <select
                className={inputClass}
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as NotificationCategory)
                }
              >
                {NOTIFICATION_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {NOTIFICATION_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input
                className={inputClass}
                value={title}
                required
                maxLength={191}
                placeholder="e.g. Shrine tier reached"
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field
              label="Read more link"
              hint="Optional path inside the game, e.g. /settlements/3."
              className="md:col-span-2"
            >
              <input
                className={inputClass}
                value={href}
                maxLength={191}
                placeholder="/region"
                onChange={(event) => setHref(event.target.value)}
              />
            </Field>
          </>
        ) : null}

        <Field label="Message" className="md:col-span-2">
          <textarea
            className={inputClass}
            value={body}
            required
            rows={3}
            maxLength={1000}
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>

        <div className="md:col-span-2">
          <Button type="submit" size="sm" disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
