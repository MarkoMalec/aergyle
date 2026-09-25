import { redirect } from "next/navigation";

type Param = string | string[] | undefined;

/** Old address; sign-in and registration both live on /play now. */
export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: Param; error?: Param };
}) {
  const params = new URLSearchParams({ mode: "register" });
  for (const key of ["callbackUrl", "error"] as const) {
    const value = searchParams?.[key];
    const single = Array.isArray(value) ? value[0] : value;
    if (single) params.set(key, single);
  }
  redirect(`/play?${params.toString()}`);
}
