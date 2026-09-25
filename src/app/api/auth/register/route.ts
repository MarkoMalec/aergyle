import { NextResponse, type NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "~/lib/prisma";
import { PASSWORD_BCRYPT_ROUNDS, registerSchema } from "~/lib/auth-rules";
import { getClientIp, sharedRateLimiter } from "~/server/security/rateLimit";
import { provisionNewUser } from "~/server/userSetup";

const registrationsByIp = sharedRateLimiter("register-ip", {
  limit: 10,
  windowMs: 60 * 60_000,
});

const EMAIL_TAKEN = "An account with this email already exists. Sign in instead.";

export async function POST(req: NextRequest) {
  const limit = registrationsByIp.hit(getClientIp(req.headers));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many new accounts from your network. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: issue?.message ?? "Check the form and try again.",
        field: issue?.path[0],
      },
      { status: 400 },
    );
  }
  const { name, email, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: EMAIL_TAKEN, field: "email" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: await hash(password, PASSWORD_BCRYPT_ROUNDS),
      },
      select: { id: true },
    });

    await provisionNewUser(user.id);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    // Two sign-ups with the same email at once: the unique index decides.
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: EMAIL_TAKEN, field: "email" }, { status: 409 });
    }
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
