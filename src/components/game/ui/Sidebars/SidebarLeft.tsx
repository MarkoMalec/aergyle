import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { getGameSkills } from "~/server/skills/list";
import { getSkillLevels } from "~/server/skills/levels";
import GameNavigation from "./GameNavigation";

export default async function SidebarLeft() {
  const session = await getServerSession(authOptions);
  const [skills, skillLevels] = await Promise.all([
    getGameSkills(),
    session?.user?.id ? getSkillLevels(session.user.id) : Promise.resolve({}),
  ]);
  return <GameNavigation skills={skills} initialSkillLevels={skillLevels} />;
}
