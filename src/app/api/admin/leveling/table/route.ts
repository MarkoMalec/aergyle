import { NextResponse } from "next/server";
import { generateXpTable } from "~/utils/leveling";

export async function GET() {
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
