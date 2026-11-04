import { prisma } from "~/lib/prisma";
import { DEFAULT_MAX_VOCATION_DURATION_SECONDS } from "./constants";

/** The admin's vocation run length, or the code default before one is saved. */
export async function getMaxVocationDurationSeconds(): Promise<number> {
  const row = await prisma.vocationConfig.findUnique({
    where: { id: 1 },
    select: { maxDurationSeconds: true },
  });
  return row?.maxDurationSeconds ?? DEFAULT_MAX_VOCATION_DURATION_SECONDS;
}
