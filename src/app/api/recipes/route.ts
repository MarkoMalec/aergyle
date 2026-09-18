import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getLearnedRecipes, learnRecipeFromInventory } from "~/server/recipes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipes = await getLearnedRecipes(session.user.id);
  return NextResponse.json({
    recipes,
    learnedRecipeItemIds: recipes.map((recipe) => recipe.recipeItemId),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const userItemId = body?.userItemId;
  if (!Number.isInteger(userItemId) || userItemId <= 0) {
    return NextResponse.json(
      { error: "A valid userItemId is required" },
      { status: 400 },
    );
  }

  try {
    const result = await learnRecipeFromInventory({
      userId: session.user.id,
      userItemId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to learn recipe",
      },
      { status: 400 },
    );
  }
}
