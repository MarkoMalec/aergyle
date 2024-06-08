import { NextRequest, NextResponse } from "next/server";
import { hash } from 'bcryptjs';
import { prisma } from '~/lib/prisma';

export async function POST(req: NextRequest, res: NextResponse) {

  const { email, password, name } = await req.json();

  const hashedPassword = await hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    });
    return NextResponse.json({
      status: 201,
      json: {
        message: `User registered ${user}`,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({
      status: 500,
      json: { message: "Internal server error" },
    });
  }
}
