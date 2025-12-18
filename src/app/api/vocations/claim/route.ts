import { NextResponse } from "next/server";

// Manual claiming is intentionally disabled.
export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
