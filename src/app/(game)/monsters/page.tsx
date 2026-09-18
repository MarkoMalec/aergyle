import { CreatureKind } from "~/generated/prisma/enums";
import BestiaryIndex from "~/components/game/creatures/BestiaryIndex";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Monsters",
  description: "Dungeon monsters, their strengths, and the loot they carry.",
};

export default function MonstersPage() {
  return <BestiaryIndex kind={CreatureKind.MONSTER} />;
}
