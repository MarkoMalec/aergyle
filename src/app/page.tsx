import type { Metadata } from "next";
import { homepageArt } from "~/components/landing/art";
import { LandingHeader } from "~/components/landing/LandingHeader";
import {
  DawnHero,
  Dusk,
  Evening,
  FirstLight,
  LandingFooter,
  LastPage,
  Nightfall,
  Noon,
  Spoils,
  TheRoad,
} from "~/components/landing/scenes";

const DESCRIPTION =
  "A hand-painted idle MMO in your browser. Gather, craft, trade and fight your way across a living atlas, and come back to find your wayfarer still at work.";

export function generateMetadata(): Metadata {
  const share = homepageArt("og-aergyle-v1");
  return {
    // The page is rendered at build time, before NEXTAUTH_URL exists.
    metadataBase: new URL(
      process.env.NEXTAUTH_URL ?? "https://mmo.markomalec.com",
    ),
    title: "Aergyle · The world is wide. Your pack is empty.",
    description: DESCRIPTION,
    openGraph: {
      title: "Aergyle",
      description: DESCRIPTION,
      type: "website",
      images: share ? [{ url: share, width: 1200, height: 630 }] : undefined,
    },
  };
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      <LandingHeader />
      <DawnHero />
      <FirstLight />
      <Noon />
      <TheRoad />
      <Evening />
      <Dusk />
      <Spoils />
      <Nightfall />
      <LastPage />
      <LandingFooter />
    </main>
  );
}
