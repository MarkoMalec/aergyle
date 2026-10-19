import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Names, without extension, of the WebP files in a folder under public/, so
 * art dropped into that folder shows up without a code change. Read on each
 * call: a directory listing is cheap and a missing folder is just empty.
 */
export async function listPublicArt(folder: string): Promise<string[]> {
  try {
    const files = await readdir(path.join(process.cwd(), "public", folder));
    return files
      .filter((file) => file.endsWith(".webp"))
      .map((file) => file.slice(0, -".webp".length));
  } catch {
    return [];
  }
}
