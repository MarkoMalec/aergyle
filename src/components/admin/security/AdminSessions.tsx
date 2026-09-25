"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { adminRequest } from "~/components/admin/fields";
import { Button } from "~/components/ui/button";

type SessionRow = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
};

/** A short, readable name for the browser behind a user agent string. */
function describeAgent(userAgent: string | null) {
  if (!userAgent) return "Unknown browser";
  const browser =
    /Edg\//.test(userAgent)
      ? "Edge"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const os = /Mac OS X/.test(userAgent)
    ? "macOS"
    : /Windows/.test(userAgent)
      ? "Windows"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

export function AdminSessions({
  sessions,
  currentSessionId,
}: {
  sessions: SessionRow[];
  currentSessionId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const others = sessions.filter((session) => session.id !== currentSessionId);

  const revoke = async (sessionId?: string) => {
    setBusy(sessionId ?? "all");
    try {
      await adminRequest(
        "/api/admin/security/sessions",
        "DELETE",
        sessionId ? { sessionId } : {},
      );
      toast.success(sessionId ? "Session ended" : "Other sessions ended");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {sessions.map((session) => {
          const current = session.id === currentSessionId;
          return (
            <li
              key={session.id}
              className="flex flex-wrap items-center gap-3 rounded-lg bg-black/25 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {describeAgent(session.userAgent)}
                  {current ? (
                    <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                      This device
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-xs text-white/45">
                  {session.ip ?? "Unknown IP"} · signed in{" "}
                  {new Date(session.createdAt).toLocaleString()} · last active{" "}
                  {new Date(session.lastSeenAt).toLocaleTimeString()}
                </div>
              </div>
              {current ? null : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => void revoke(session.id)}
                >
                  End session
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {others.length > 0 ? (
        <Button
          size="sm"
          variant="destructive"
          disabled={busy !== null}
          onClick={() => void revoke()}
        >
          End all other sessions
        </Button>
      ) : (
        <p className="text-xs text-white/45">
          You are not signed in anywhere else.
        </p>
      )}
    </div>
  );
}
