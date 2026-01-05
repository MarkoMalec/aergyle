import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // main entry for your schema
  schema: "prisma/schema.prisma",

  // where migrations should be generated
  migrations: {
    path: "prisma/migrations",
    // what script to run for `prisma db seed`
    seed: "tsx prisma/seed.ts",
  },

  // database URL used by Prisma CLI commands (migrate, db push, etc.)
  datasource: {
    url: env("DATABASE_URL"),
  },
});
