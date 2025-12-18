import {
  PrismaClient,
  ItemRarity,
  ItemType,
  VocationalActionType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1) Create (or reuse) Oak Log item template
  const existingOakLog = await prisma.item.findFirst({
    where: {
      name: "Oak Log",
      itemType: ItemType.LOG,
    },
    select: { id: true },
  });

  const oakLog =
    existingOakLog ??
    (await prisma.item.create({
      data: {
        name: "Oak Log",
        price: 1,
        // Temporary: reuse an existing sprite until you add a logs folder.
        sprite: "/assets/items/weapons/wooden-axe.png",
        equipTo: null,
        rarity: ItemRarity.COMMON,
        requiredLevel: 1,
        itemType: ItemType.LOG,
        stackable: true,
        maxStackSize: 999,
        minPhysicalDamage: 0,
        maxPhysicalDamage: 0,
        minMagicDamage: 0,
        maxMagicDamage: 0,
        armor: 0,
      },
      select: { id: true },
    }));

  // 2) Create/Update vocational resource that yields Oak Logs
  await prisma.vocationalResource.upsert({
    where: { itemId: oakLog.id },
    update: {
      actionType: VocationalActionType.WOODCUTTING,
      name: "Oak",
      defaultSeconds: 10,
      yieldPerUnit: 1,
      rarity: ItemRarity.COMMON,
    },
    create: {
      actionType: VocationalActionType.WOODCUTTING,
      name: "Oak",
      itemId: oakLog.id,
      defaultSeconds: 10,
      yieldPerUnit: 1,
      rarity: ItemRarity.COMMON,
    },
  });

  console.log("✅ Seeded: Oak Log + WOODCUTTING resource (Oak)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
