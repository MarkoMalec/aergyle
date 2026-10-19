import type React from "react";
import { loadSkillArt } from "~/server/skills/art";
import SkillLayoutContent from "./SkillLayoutContent";

/** Finds the skill's painted icon on the server; the page itself is client-side. */
export default async function SkillsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { name: string };
}) {
  let skillName = params.name;
  try {
    skillName = decodeURIComponent(params.name);
  } catch {
    // A malformed name falls through to the page, which handles it.
  }
  const artFor = await loadSkillArt();

  return (
    <SkillLayoutContent params={params} icon={artFor(skillName).icon}>
      {children}
    </SkillLayoutContent>
  );
}
