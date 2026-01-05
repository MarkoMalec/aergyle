import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run renameAxeToFellingAxe");
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(databaseUrl),
});

async function columnExists(tableName: string, columnName: string) {
  const rows = (await prisma.$queryRawUnsafe<
    Array<{ cnt: number }>
  >(
    `SELECT COUNT(*) as cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    tableName,
    columnName,
  )) as Array<{ cnt: number }>;

  return (rows?.[0]?.cnt ?? 0) > 0;
}

async function main() {
  // In Prisma schema the model is `Equipment`; default MySQL table name is `Equipment`.
  const table = "Equipment";

  const hasOld = await columnExists(table, "axeItemId");
  const hasNew = await columnExists(table, "fellingAxeItemId");

  if (!hasOld && hasNew) {
    console.log("✅ Column already renamed (fellingAxeItemId exists). Nothing to do.");
    return;
  }

  if (!hasOld && !hasNew) {
    console.log(
      "⚠️ Neither axeItemId nor fellingAxeItemId exists. Did you run the right DB / schema?",
    );
    return;
  }

  if (hasOld && hasNew) {
    console.log(
      "⚠️ Both axeItemId and fellingAxeItemId exist. Not renaming automatically.",
    );
    console.log(
      "If you want to migrate data, run: UPDATE Equipment SET fellingAxeItemId = axeItemId WHERE fellingAxeItemId IS NULL;",
    );
    return;
  }

  // hasOld && !hasNew
  console.log("🔧 Renaming Equipment.axeItemId -> Equipment.fellingAxeItemId...");
  await prisma.$executeRawUnsafe(
    `ALTER TABLE \`${table}\` CHANGE COLUMN \`axeItemId\` \`fellingAxeItemId\` INT NULL;`,
  );
  console.log("✅ Renamed column successfully.");
}

main()
  .catch((err) => {
    console.error("❌ Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
