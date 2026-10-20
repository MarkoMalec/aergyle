import { PLAYER_NAME_MAX } from "~/lib/auth-rules";
import { playerTag } from "~/game/players";
import { prisma } from "~/lib/prisma";

/**
 * The player whose name has this tag (the /@Name part of a profile URL).
 * Matching ignores case and accents (the column's collation) and treats a
 * space and a hyphen as the same; the LIKE on the part before the first
 * hyphen lets the unique name index narrow the search.
 */
export async function findPlayerByTag(
  tag: string,
): Promise<{ id: string; name: string } | null> {
  const wanted = playerTag(tag);
  const prefix = wanted.split("-")[0] ?? wanted;
  const escaped = prefix.replace(/[\\%_]/g, (char) => `\\${char}`);
  const rows = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM User
    WHERE name LIKE ${`${escaped}%`} AND REPLACE(name, ' ', '-') = ${wanted}
    LIMIT 1`;
  return rows[0] ?? null;
}

/**
 * Whether another player already has this name, or one that would share its
 * profile URL ("Test name" and "test-name" are the same player).
 */
export async function isNameTaken(name: string, exceptUserId?: string) {
  const owner = await findPlayerByTag(playerTag(name));
  return owner !== null && owner.id !== exceptUserId;
}

/** `name` when it's free, else with a number on the end ("Wayfarer482"). */
export async function freeName(name: string) {
  if (!(await isNameTaken(name))) return name;
  for (let attempt = 0; attempt < 20; attempt++) {
    const digits = attempt < 10 ? 3 : 5;
    const suffix = String(Math.floor(Math.random() * 10 ** digits));
    const candidate = `${name.slice(0, PLAYER_NAME_MAX - suffix.length)}${suffix}`;
    if (!(await isNameTaken(candidate))) return candidate;
  }
  throw new Error("Could not find a free player name");
}
