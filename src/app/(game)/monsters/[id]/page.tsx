import { CreatureKind } from "~/generated/prisma/enums";
import {
  CreatureProfilePage,
  creatureProfileMetadata,
} from "~/components/game/creatures/creatureProfilePage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: { id: string } };

export function generateMetadata({ params }: Props) {
  return creatureProfileMetadata(CreatureKind.MONSTER, params.id);
}

export default function MonsterProfilePage({ params }: Props) {
  return <CreatureProfilePage kind={CreatureKind.MONSTER} id={params.id} />;
}
