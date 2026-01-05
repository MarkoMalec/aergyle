import { Prisma, PrismaClient } from "~/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "~/env";

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaMariaDb(env.DATABASE_URL),
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

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
