export const PLAYER_AVATARS = [
  {
    id: "mirelda",
    name: "Mirelda",
    role: "Hedge wizard",
    tagline: "Old roads remember her name",
    src: "/assets/avatars/mirelda-hedge-wizard-v1.png",
    backdrop:
      "radial-gradient(circle at 50% 36%, hsl(37 92% 58% / 0.22), transparent 58%), linear-gradient(145deg, hsl(24 22% 15%), hsl(70 17% 10%))",
  },
  {
    id: "elian",
    name: "Elian Fen",
    role: "Woodland hunter",
    tagline: "Every trail leaves a story",
    src: "/assets/avatars/elian-woodland-hunter-v1.png",
    backdrop:
      "radial-gradient(circle at 50% 36%, hsl(184 45% 48% / 0.2), transparent 58%), linear-gradient(145deg, hsl(164 18% 13%), hsl(25 21% 10%))",
  },
  {
    id: "vey",
    name: "Vey Ashveil",
    role: "Smoke assassin",
    tagline: "Gone before the echo fades",
    src: "/assets/avatars/vey-smoke-assassin-v1.png",
    backdrop:
      "radial-gradient(circle at 50% 36%, hsl(267 78% 66% / 0.24), transparent 58%), linear-gradient(145deg, hsl(254 20% 14%), hsl(265 16% 8%))",
  },
  {
    id: "dagna",
    name: "Dagna Forgeheart",
    role: "Forge fighter",
    tagline: "Tempered, never tamed",
    src: "/assets/avatars/dagna-forge-fighter-v1.png",
    backdrop:
      "radial-gradient(circle at 50% 36%, hsl(28 90% 55% / 0.24), transparent 58%), linear-gradient(145deg, hsl(20 27% 14%), hsl(37 18% 9%))",
  },
  {
    id: "orren",
    name: "Orren Vale",
    role: "Traveling cleric",
    tagline: "A light for the long dark",
    src: "/assets/avatars/orren-traveling-cleric-v1.png",
    backdrop:
      "radial-gradient(circle at 50% 36%, hsl(42 88% 62% / 0.2), transparent 58%), linear-gradient(145deg, hsl(222 27% 15%), hsl(36 18% 10%))",
  },
  {
    id: "korr",
    name: "Korr Flinttusk",
    role: "Frontier fighter",
    tagline: "The horizon is his challenge",
    src: "/assets/avatars/korr-glaive-fighter-v1.png",
    backdrop:
      "radial-gradient(circle at 50% 36%, hsl(4 70% 51% / 0.2), transparent 58%), linear-gradient(145deg, hsl(91 14% 13%), hsl(12 18% 9%))",
  },
] as const;

export type PlayerAvatar = (typeof PLAYER_AVATARS)[number];

export const DEFAULT_PLAYER_AVATAR = PLAYER_AVATARS[0];

export function getPlayerAvatarById(id: string | null | undefined) {
  return PLAYER_AVATARS.find((avatar) => avatar.id === id);
}

export function getPlayerAvatarBySrc(src: string | null | undefined) {
  return PLAYER_AVATARS.find((avatar) => avatar.src === src);
}
