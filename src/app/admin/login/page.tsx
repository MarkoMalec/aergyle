import { redirect } from "next/navigation";
import { AdminLoginForm } from "~/components/admin/AdminLoginForm";
import { getAdminSession } from "~/server/admin/auth";

export const dynamic = "force-dynamic";

/** Where to go after signing in: another admin page, never somewhere else. */
function safeAdminPath(value: string | string[] | undefined) {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !/^\/admin(?:[/?#]|$)/.test(path) || path.includes("\\")) {
    return "/admin";
  }
  return path.startsWith("/admin/login") ? "/admin" : path;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const next = safeAdminPath(searchParams?.next);
  if (await getAdminSession()) redirect(next);

  return (
    <main className="admin-theme dark relative grid min-h-svh place-items-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,hsl(var(--primary)/0.14),transparent_70%)]"
      />
      <AdminLoginForm next={next} />
    </main>
  );
}
