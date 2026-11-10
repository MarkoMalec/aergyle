/**
 * The message a player may see for a failed request. Game services throw a
 * plain `Error` with player-facing text; anything else (Prisma, TypeError, …)
 * is internal, so it is logged and replaced by `fallback`. A unique-key clash
 * (Prisma P2002) is almost always a double click, so it gets its own text.
 */
export function playerErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name === "Error") return error.message;
  console.error("[api]", error);
  if ((error as { code?: unknown } | null)?.code === "P2002") {
    return "That is already in progress.";
  }
  return fallback;
}
