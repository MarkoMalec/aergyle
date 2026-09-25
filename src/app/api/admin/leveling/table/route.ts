import { NextResponse, type NextRequest } from "next/server";
import { generateXpTable } from "~/utils/leveling";
import { requireAdminApiAccess } from "~/server/admin/auth";

export async function GET(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  try {
    const table = await generateXpTable(70);
    return NextResponse.json(table);
  } catch (error) {
    console.error("Error generating XP table:", error);
    return NextResponse.json(
      { error: "Failed to generate XP table" },
      { status: 500 }
    );
  }
}
