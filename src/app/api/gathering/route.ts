import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getGatheringPageData } from "~/server/gathering";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await getGatheringPageData(session.user.id));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load Gathering",
      },
      { status: 500 },
    );
  }
}
