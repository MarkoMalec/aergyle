import { Prisma, PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ['info'],
});

export const handlePrismaError = (error: any) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      console.error(
        "There is a unique constraint violation, a new user cannot be created with this email",
      );
      return "Unique constraint violation";
    }
  }
  throw error;
};
