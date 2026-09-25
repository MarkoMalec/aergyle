import { Panel } from "~/components/admin/fields";
import { AdminSessions } from "~/components/admin/security/AdminSessions";
import { prisma } from "~/lib/prisma";
import {
  ADMIN_SESSION_IDLE_SECONDS,
  requireAdminPageAccess,
} from "~/server/admin/auth";
import { cn } from "~/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const AUDIT_ENTRIES = 150;

function actionStyle(action: string) {
  if (action === "login") return "bg-emerald-400/15 text-emerald-300";
  if (action.startsWith("login.")) return "bg-red-400/15 text-red-300";
  if (action === "logout") return "bg-white/10 text-white/60";
  return "bg-sky-400/10 text-sky-200";
}

export default async function AdminSecurityPage() {
  const admin = await requireAdminPageAccess();
  const now = new Date();
  const [sessions, entries] = await Promise.all([
    prisma.adminSession.findMany({
      where: {
        adminId: admin.adminId,
        revokedAt: null,
        expiresAt: { gt: now },
        lastSeenAt: {
          gt: new Date(now.getTime() - ADMIN_SESSION_IDLE_SECONDS * 1000),
        },
      },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
      },
    }),
    prisma.adminAuditLog.findMany({
      orderBy: { id: "desc" },
      take: AUDIT_ENTRIES,
      select: {
        id: true,
        username: true,
        action: true,
        ip: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Security</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/70">
          Where you are signed in, and a log of every sign-in and every change
          made through /admin. Accounts are managed from the server with{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
            npm run admin
          </code>
          .
        </p>
      </header>

      <Panel
        title="Your sessions"
        description="Sessions end after 8 hours, or after an hour without activity. End any you don't recognise."
      >
        <AdminSessions
          currentSessionId={admin.sessionId}
          sessions={sessions.map((session) => ({
            ...session,
            createdAt: session.createdAt.toISOString(),
            lastSeenAt: session.lastSeenAt.toISOString(),
          }))}
        />
      </Panel>

      <Panel
        title="Audit log"
        description={`The latest ${AUDIT_ENTRIES} entries across all admin accounts.`}
      >
        {entries.length === 0 ? (
          <p className="text-sm text-white/45">Nothing recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Admin</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="odd:bg-black/20">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-white/60">
                      {entry.createdAt.toISOString().slice(0, 19).replace("T", " ")}{" "}
                      UTC
                    </td>
                    <td className="px-3 py-2 font-medium">{entry.username}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 font-mono text-xs",
                          actionStyle(entry.action),
                        )}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-white/50">
                      {entry.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
