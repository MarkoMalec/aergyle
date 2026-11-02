/**
 * The travelling cooks and pantry merchants that keep staple seasonings
 * available throughout Aergyle.  NPC-specific data lives here rather than in
 * an ad-hoc database edit so it can be reapplied consistently to every world.
 */
export interface CookingNpcDefinition {
  name: string;
  description: string;
  portrait: string;
}

export const COOKING_VENDOR_STAPLES = ["Salt", "Pepper", "Sugar"] as const;

export const COOKING_NPCS = [
  {
    name: "Vesa Emberladle",
    description:
      "A 132-year-old dwarven smokehouse cook: broad-shouldered, stocky and meticulously formal in a charcoal overdress, copper-riveted indigo apron and smoked-glass spectacles. Vesa's dry precision makes even a pinch of seasoning feel like a binding contract.",
    portrait: "/assets/npcs/vesa-emberladle-cook-v1.png",
  },
  {
    name: "Tillo Saffronwhistle",
    description:
      "A very short, reed-thin young halfling baker of twenty-seven, all restless elbows and quick smiles beneath a pumpkin-checked waistcoat, flour-dusted teal shirt and many-pocketed mustard apron. Tillo chatters through every sale and remembers every customer's favorite sweet.",
    portrait: "/assets/npcs/tillo-saffronwhistle-cook-v1.png",
  },
  {
    name: "Aurelith Moonbroth",
    description:
      "A 210-year-old high-elven broth maker, tall and willow-slender, who wears layered moss-green wraps, an ivory half-apron and a silver tasting chain. Soft-spoken, meditative and unnervingly exact, Aurelith treats a simmering pot like a patient argument.",
    portrait: "/assets/npcs/aurelith-moonbroth-cook-v1.png",
  },
  {
    name: "Tamsin Rook",
    description:
      "A generously built, broad-faced human roast cook in her late forties, with chestnut curls under a red kerchief, a plum wool dress and a sun-gold apron patched at the pockets. Boisterous, practical and fiercely generous, Tamsin feeds strangers before she asks their names.",
    portrait: "/assets/npcs/tamsin-rook-cook-v1.png",
  },
  {
    name: "Grukk Cracked-Pot",
    description:
      "A towering, powerfully built orc in his mid-thirties, with olive-grey skin, a broken tusk, a brick-red cook's coat and a battered leather apron over striped trousers. Grukk sounds thunderous but is tender-hearted; his spotless ladle and carefully repaired pot are his pride.",
    portrait: "/assets/npcs/grukk-cracked-pot-cook-v1.png",
  },
  {
    name: "Sable Fen",
    description:
      "A seventy-three-year-old human widow, gaunt and silver-haired, dressed in a narrow dark-teal coat, fingerless gloves and a slate linen apron tied with eel-cord. Sable's measured silence unnerves loud patrons, though her wry jokes and river stews have a devoted following.",
    portrait: "/assets/npcs/sable-fen-cook-v1.png",
  },
  {
    name: "Fizzik Sootwhistle",
    description:
      "A nineteen-year-old goblin street cook: tiny, lanky and green-skinned, with one oversized ear ring, a brass-buttoned saffron vest, patched violet trousers and a soot-black apron. Fizzik is mischievous, inventive and forever testing improbable sauces on willing friends.",
    portrait: "/assets/npcs/fizzik-sootwhistle-cook-v1.png",
  },
  {
    name: "Odo Embercask",
    description:
      "A round-bellied dwarven pickler of fifty-five with a magnificent ginger beard, kind hazel eyes and a violet tunic beneath a cream-striped apron. Odo laughs first and bargains second, carrying a cedar cask of preserved fruit everywhere he goes.",
    portrait: "/assets/npcs/odo-embercask-cook-v1.png",
  },
  {
    name: "Cyra Sunspice",
    description:
      "A lean, dark-skinned human spice blender of thirty-one, with a shaved temple, bright saffron headwrap, cobalt vest, white sleeves and a long cinnamon-brown apron. Charismatic and fearlessly competitive, Cyra can identify a seasoning with her eyes closed.",
    portrait: "/assets/npcs/cyra-sunspice-cook-v1.png",
  },
  {
    name: "Pip Tallowtop",
    description:
      "A ninety-five-year-old gnomish confectioner, compact and pot-bellied, with rosy cheeks, enormous round goggles, a faded lilac cap and a pistachio-green apron over a russet coat. Pip is absent-minded about everything except sugar work, which he approaches with delighted scientific rigor.",
    portrait: "/assets/npcs/pip-tallowtop-cook-v1.png",
  },
  {
    name: "Hroth Riverstone",
    description:
      "A half-ogre soup maker nearing fifty: immense, heavyset and gentle-eyed, wearing a sleeveless blue-grey tunic, wool wrist wraps and a dark brown apron stretched over his wide middle. Hroth speaks quietly, listens deeply and makes every bowl as if it were for family.",
    portrait: "/assets/npcs/hroth-riverstone-cook-v1.png",
  },
  {
    name: "Mirelle Vant",
    description:
      "A petite thirty-year-old tiefling pastry seller with dusky plum skin, slim swept-back horns, a neat black braid, ink-blue linen layers and a pale rose apron. Reserved and observant, Mirelle makes delicate candied fruit and has a surprisingly wicked sense of humor.",
    portrait: "/assets/npcs/mirelle-vant-cook-v1.png",
  },
] as const satisfies readonly CookingNpcDefinition[];
