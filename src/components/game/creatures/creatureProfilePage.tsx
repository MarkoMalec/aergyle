import { notFound } from "next/navigation";
import { cache } from "react";
import type { CreatureKind } from "~/generated/prisma/enums";
import CreatureProfile from "~/components/game/creatures/CreatureProfile";
import { getCreatureProfile } from "~/server/creatures/catalogue";

// Shared by /animals/[id] and /monsters/[id]; cached so metadata and the page
// share one query per request.
const loadProfile = cache(async (kind: CreatureKind, rawId: string) => {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (await getCreatureProfile(kind, id)) ?? notFound();
});

export async function creatureProfileMetadata(
  kind: CreatureKind,
  rawId: string,
) {
  const creature = await loadProfile(kind, rawId);
  return {
    title: creature.name,
    description: creature.description ?? undefined,
  };
}

export async function CreatureProfilePage(props: {
  kind: CreatureKind;
  id: string;
}) {
  const creature = await loadProfile(props.kind, props.id);
  return <CreatureProfile kind={props.kind} creature={creature} />;
}
