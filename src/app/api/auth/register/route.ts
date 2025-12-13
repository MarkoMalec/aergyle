import { NextRequest, NextResponse } from "next/server";
import { hash } from 'bcryptjs';
import { prisma } from '~/lib/prisma';
import { provisionNewUser } from "~/server/userSetup";

export async function POST(req: NextRequest, res: NextResponse) {
  const body = await req.json();
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : null;

  if (!email || !email.includes("@") || password.length < 6) {
    return NextResponse.json(
      { error: "Invalid registration data" },
      { status: 400 },
    );
  }

  const hashedPassword = await hash(password, 10);

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
      select: { id: true, email: true },
    });

    await provisionNewUser(user.id);

    return NextResponse.json(
      { success: true, userId: user.id },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
