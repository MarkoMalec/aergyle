import Image from "next/image";
import { cn } from "~/lib/utils";

type SkillMentor = {
  name: string;
  quote: string;
  asset: string;
};

const mentors: Record<string, SkillMentor> = {
  woodcutting: {
    name: "Bram Ironbough",
    quote:
      "A tree gives twice: once to the canopy, once to the patient hand. Read the lean, clear the fall, and leave enough forest for spring.",
    asset: "/assets/npcs/bram-ironbough-woodcutter-v1.png",
  },
  mining: {
    name: "Dain Flintward",
    quote:
      "Stone keeps its riches for those who read the seams. Strike in anger and the mountain charges you for it.",
    asset: "/assets/npcs/dain-flintward-miner-v3.png",
  },
  fishing: {
    name: "Marek Driftwater",
    quote:
      "The river has no patience for noise. Mend your line, mind the current, and let the catch choose its moment.",
    asset: "/assets/npcs/marek-driftwater-angler-v1.png",
  },
  gardening: {
    name: "Lorn Thistlebank",
    quote:
      "Soil remembers every kindness. Give it water, give it time, and it will feed you through the hard months.",
    asset: "/assets/npcs/lorn-thistlebank-gardener-v2.png",
  },
  gathering: {
    name: "Elowen Briarwell",
    quote:
      "The wild hides nothing from a careful hand. Notice what grows together, then take only what has another season to spare.",
    asset: "/assets/npcs/elowen-briarwell-gatherer-v1.png",
  },
  hunting: {
    name: "Sella Pikebriar",
    quote:
      "Leave a clean trail, take a clean shot, and thank the creature that carries you through winter.",
    asset: "/assets/npcs/sella-pikebriar-hunter-v1.png",
  },
  alchemy: {
    name: "Orrin Quill",
    quote:
      "If a mixture glows before you ask it to, set it down. Curiosity is useful; keeping your eyebrows is useful too.",
    asset: "/assets/npcs/orrin-quill-alchemist-v2.png",
  },
  blacksmithing: {
    name: "Noll Graven",
    quote:
      "A good blade starts as stubborn metal. Your work is to persuade it, not punish it.",
    asset: "/assets/npcs/noll-graven-blacksmith-v3.png",
  },
  weaponsmithing: {
    name: "Aled Frostmark",
    quote:
      "Balance is the quiet half of every weapon. Miss it, and all the sharpness in Aergyle will not save the bearer.",
    asset: "/assets/npcs/aled-frostmark-weaponsmith-v2.png",
  },
  carpentry: {
    name: "Elric Oakrest",
    quote:
      "Wood tells you where it wants to bend. A true joiner listens before the blade makes the decision.",
    asset: "/assets/npcs/elric-oakrest-carpenter-v2.png",
  },
  cooking: {
    name: "Maelin Copperspoon",
    quote:
      "A full belly can turn a cold road into a story worth telling. Season with what the land has given.",
    asset: "/assets/npcs/maelin-copperspoon-chef-v1.png",
  },
  tailoring: {
    name: "Edrin Valeweft",
    quote:
      "Thread is humble until it holds against the storm. Mend what matters, and make the repair proud.",
    asset: "/assets/npcs/edrin-valeweft-tailor-v2.png",
  },
  forge: {
    name: "Ossa, Bridge-Smith",
    quote:
      "Fire is a tool, not a temper. Leave the anger at the bellows and the iron will listen.",
    asset: "/assets/npcs/ossa-blacksmith-v1.png",
  },
};

const headerArtwork: Record<string, string> = {
  alchemy: "game-page-heading--alchemy",
  cooking: "game-skill-page-heading game-page-heading--cooking",
  fishing: "game-skill-page-heading game-page-heading--fishing",
  gardening: "game-skill-page-heading game-page-heading--gardening",
  gathering: "game-skill-page-heading game-page-heading--gathering",
  hunting: "game-skill-page-heading game-page-heading--hunting",
  mining: "game-skill-page-heading game-page-heading--mining",
  blacksmithing: "game-skill-page-heading game-page-heading--blacksmithing",
  weaponsmithing: "game-skill-page-heading game-page-heading--weaponsmithing",
  carpentry: "game-skill-page-heading game-page-heading--carpentry",
  tailoring: "game-skill-page-heading game-page-heading--tailoring",
  woodcutting: "game-skill-page-heading game-page-heading--woodcutting",
};

export default function SkillPageHeader({ skillName }: { skillName: string }) {
  const skillSlug = skillName.trim().toLowerCase();
  const mentor = mentors[skillSlug];

  return (
    <header
      className={cn(
        "game-page-heading game-skill-page-heading",
        headerArtwork[skillSlug],
      )}
    >
      <div className="game-skill-page-heading__content">
        <h1 className="game-page-title">{skillName}</h1>
        {mentor ? (
          <blockquote className="game-skill-page-heading__quote">
            <p>“{mentor.quote}”</p>
            <cite>{mentor.name}</cite>
          </blockquote>
        ) : (
          <p className="game-page-description">
            Practice your craft and discover what the world has to offer.
          </p>
        )}
      </div>
      {mentor ? (
        <div className="game-skill-page-heading__mentor" aria-hidden="true">
          <Image
            src={mentor.asset}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 104px, (max-width: 900px) 180px, (max-width: 1300px) 20vw, 260px"
          />
        </div>
      ) : null}
    </header>
  );
}
