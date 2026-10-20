import { NextResponse } from "next/server";
import { ProfileCommentError } from "./comments";

/** Answers a comment action, showing only refusals meant for the player. */
export async function respond(action: () => Promise<unknown>) {
  try {
    return NextResponse.json(await action());
  } catch (error) {
    if (error instanceof ProfileCommentError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[players/comments]", error);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 },
    );
  }
}
