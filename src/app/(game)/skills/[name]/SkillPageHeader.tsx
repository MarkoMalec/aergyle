
const SkillPageHeader = ({ skillName }: { skillName: string }) => {

    switch (skillName) {
    case "Fishing":
        return (
    <div>
        Fishing Skill Header
    </div>
  );
    case "Mining":
        return (
    <div>
        Mining Skill Header
    </div>
  );
    case "Woodcutting":
        return (
    <div className="bg-gray-400/20 px-4 py-5 rounded-md border border-gray-700/40 mb-5">
       
<strong>Roger The LumberJack</strong>

"Me ma said to always be careful with sharp objects. But if ye want to be a great woodcutter, ye gotta take some risks!"

    </div>
  );
    default:

  return (
    <div>
        kkk Skill Header
    </div>
  );
  }
};

export default SkillPageHeader;