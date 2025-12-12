import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { ItemRarity, StatType, ItemType } from "@prisma/client";

/**
 * Import items from CSV data with stat progressions
 * 
 * Expected CSV format (one row per stat progression):
 * name,price,sprite,equipTo,rarity,itemType,stackable,maxStackSize,minPhysicalDamage,maxPhysicalDamage,minMagicDamage,maxMagicDamage,armor,requiredLevel,statType,baseValue,unlocksAtRarity
 * 
 * Example:
 * Iron Sword,100,/assets/items/weapons/iron-sword.jpg,weapon,COMMON,SWORD,false,1,5,10,0,0,0,5,STRENGTH,5,BASE
 * Iron Sword,100,/assets/items/weapons/iron-sword.jpg,weapon,COMMON,SWORD,false,1,5,10,0,0,0,5,CRITICAL_CHANCE,2,RARE
 * Health Potion,25,/assets/items/consumables/potions/health-potion.jpg,,,POTION,true,99,0,0,0,0,0,1,,,
 * 
 * Items with multiple stats will have multiple rows with the same name
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const mode = formData.get("mode") as string; // "add-new" or "update-all"

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Read CSV file
    const text = await file.text();
    const lines = text.split("\n").filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV file is empty or has no data rows" },
        { status: 400 }
      );
    }

    // Parse header
    const headers = lines[0]!.split(",").map(h => h.trim());
    
    // Validate required columns
    const requiredColumns = ["name", "price", "sprite"];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missingColumns.join(", ")}` },
        { status: 400 }
      );
    }

    const results = {
      added: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Group rows by item name (since one item can have multiple stat rows)
    const itemGroups = new Map<string, any[]>();
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      const values = line.split(",").map(v => v.trim());
      
      if (values.length !== headers.length) {
        results.errors.push(`Row ${i + 1}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
        continue;
      }

      // Map values to object
      const rowData: Record<string, string> = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index] || "";
      });

      const itemName = rowData.name;
      if (!itemName) {
        results.errors.push(`Row ${i + 1}: Missing item name`);
        continue;
      }

      if (!itemGroups.has(itemName)) {
        itemGroups.set(itemName, []);
      }
      itemGroups.get(itemName)!.push(rowData);
    }

    console.log(`[Import] Grouped ${lines.length - 1} rows into ${itemGroups.size} items`);

    // Process each item (which may have multiple stat rows)
    for (const [itemName, rows] of itemGroups) {
      try {
        // Use first row for item base data
        const firstRow = rows[0]!;

        // Validate required fields
        if (!firstRow.price || !firstRow.sprite) {
          results.errors.push(`Item "${itemName}": Missing required field (price or sprite)`);
          continue;
        }

        // Check if item already exists
        const existingItem = await prisma.item.findFirst({
          where: { name: itemName },
          include: { statProgressions: true }
        });

        if (existingItem && mode === "add-new") {
          results.skipped++;
          continue; // Skip existing items in "add-new" mode
        }

        // Parse stackable boolean
        const isStackable = firstRow.stackable?.toLowerCase() === "true";
        const maxStack = isStackable ? parseInt(firstRow.maxStackSize || "99") : 1;

        // Prepare item base data
        const itemData = {
          name: itemName,
          price: parseInt(firstRow.price || "0"),
          sprite: firstRow.sprite,
          equipTo: firstRow.equipTo || null,
          rarity: (firstRow.rarity as ItemRarity) || "COMMON",
          itemType: firstRow.itemType ? (firstRow.itemType as ItemType) : null,
          stackable: isStackable,
          maxStackSize: maxStack,
          minPhysicalDamage: parseInt(firstRow.minPhysicalDamage || "0"),
          maxPhysicalDamage: parseInt(firstRow.maxPhysicalDamage || "0"),
          minMagicDamage: parseInt(firstRow.minMagicDamage || "0"),
          maxMagicDamage: parseInt(firstRow.maxMagicDamage || "0"),
          armor: parseInt(firstRow.armor || "0"),
          requiredLevel: parseInt(firstRow.requiredLevel || "1"),
        };

        let itemId: number;

        if (existingItem) {
          // Update existing item
          await prisma.item.update({
            where: { id: existingItem.id },
            data: itemData,
          });
          itemId = existingItem.id;

          // Delete old stats and stat progressions (we'll recreate them)
          await prisma.itemStat.deleteMany({
            where: { itemId: existingItem.id }
          });
          await prisma.itemStatProgression.deleteMany({
            where: { itemId: existingItem.id }
          });

          console.log(`[Import] Updated item "${itemName}" (id: ${itemId})`);
          results.updated++;
        } else {
          // Create new item
          const newItem = await prisma.item.create({
            data: itemData,
          });
          itemId = newItem.id;

          console.log(`[Import] Created item "${itemName}" (id: ${itemId})`);
          results.added++;
        }

        // Add stats from all rows for this item
        let baseStatCount = 0;
        let progressionStatCount = 0;
        
        for (const row of rows) {
          if (row.statType && row.baseValue) {
            try {
              if (row.unlocksAtRarity === "BASE") {
                // Base stat (ItemStat) - always active
                await prisma.itemStat.create({
                  data: {
                    itemId,
                    statType: row.statType as StatType,
                    value: parseFloat(row.baseValue),
                  },
                });
                baseStatCount++;
              } else if (row.unlocksAtRarity) {
                // Progressive stat (ItemStatProgression) - unlocks at specific rarity
                await prisma.itemStatProgression.create({
                  data: {
                    itemId,
                    statType: row.statType as StatType,
                    baseValue: parseFloat(row.baseValue),
                    unlocksAtRarity: row.unlocksAtRarity as ItemRarity,
                  },
                });
                progressionStatCount++;
              }
            } catch (error) {
              results.errors.push(`Item "${itemName}": Failed to add stat ${row.statType} - ${error}`);
            }
          }
        }

        console.log(`[Import] Added ${baseStatCount} base stats and ${progressionStatCount} progressive stats to "${itemName}"`);

      } catch (error) {
        console.error(`Error processing item "${itemName}":`, error);
        results.errors.push(`Item "${itemName}": ${error}`);
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Import completed: ${results.added} added, ${results.updated} updated, ${results.skipped} skipped`,
    });

  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import items", details: String(error) },
      { status: 500 }
    );
  }
}
