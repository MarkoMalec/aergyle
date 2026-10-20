import { NextResponse } from "next/server";
import { ProfileCommentError } from "./comments";
import { FriendError } from "./friends";

/** Answers a comment or friend action, showing only refusals meant for the player. */
export async function respond(action: () => Promise<unknown>) {
  try {
    return NextResponse.json(await action());
  } catch (error) {
    if (error instanceof ProfileCommentError || error instanceof FriendError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[players]", error);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 },
    );
  }
}
