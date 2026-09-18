import { CreatureKind } from "~/generated/prisma/enums";
import BestiaryIndex from "~/components/game/creatures/BestiaryIndex";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Animals",
  description:
    "Wildlife found in hunting grounds and the materials they yield.",
};

export default function AnimalsPage() {
  return <BestiaryIndex kind={CreatureKind.ANIMAL} />;
}
