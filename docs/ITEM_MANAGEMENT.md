# Item Management System

This document describes how to manage game items using Google Sheets and CSV import/export.

## Overview

The item management system allows you to:
- **Export** existing items from the database to CSV
- Edit items in Google Sheets (familiar spreadsheet interface)
- Add new items in bulk
- **Import** items back into the game via CSV upload

This workflow provides bidirectional sync between your database and Google Sheets.

---

## Step 0: Export Current Items (Initial Setup)

If you're starting fresh with Google Sheets, first export your current database items:

### Using the Admin Panel

1. Go to `/admin` page
2. Click **"Export Current Items"** button
3. A CSV file will download: `items-export-YYYY-MM-DD.csv`
4. Import this CSV into Google Sheets (File → Import → Upload)

### What Gets Exported

All items from the database including:
- Basic fields: name, price, sprite, equipTo, rarity
- Damage stats: minPhysicalDamage, maxPhysicalDamage, minMagicDamage, maxMagicDamage
- Defensive: armor, requiredLevel
- Bonus stats: stat1Type, stat1Value, stat2Type, stat2Value (up to 2 per item)

**Note:** Once exported to Google Sheets, you can treat the spreadsheet as your master data source. Edit existing items, add new ones, then export from Sheets and import back to the game.

---

## Step 1: Set Up Google Sheets

Create a Google Sheet with the following columns:

| name | price | sprite | equipTo | rarity | minPhysicalDamage | maxPhysicalDamage | minMagicDamage | maxMagicDamage | armor | requiredLevel | stat1Type | stat1Value | stat2Type | stat2Value |
|------|-------|--------|---------|--------|-------------------|-------------------|----------------|----------------|-------|---------------|-----------|------------|-----------|------------|
| Iron Sword | 100 | /assets/items/weapons/iron-sword.jpg | weapon | COMMON | 5 | 10 | 0 | 0 | 0 | 5 | STRENGTH | 5 | CRITICAL_CHANCE | 2 |
| Leather Helmet | 50 | /assets/items/armor/leather-helmet.jpg | head | COMMON | 0 | 0 | 0 | 0 | 10 | 3 | VITALITY | 3 | | |

**Column Descriptions:**
- **name** (required): Item name (must be unique)
- **price** (required): Gold cost
- **sprite** (required): Path to item image
- **equipTo**: Equipment slot (weapon, head, chest, etc.) - leave empty for consumables
- **rarity**: WORTHLESS, COMMON, UNCOMMON, RARE, EPIC, UNIQUE, LEGENDARY, MYTHIC, ARTIFACT, DIVINE (default: COMMON)
- **minPhysicalDamage**: Minimum physical damage
- **maxPhysicalDamage**: Maximum physical damage
- **minMagicDamage**: Minimum magic damage
- **maxMagicDamage**: Maximum magic damage
- **armor**: Armor value
- **requiredLevel**: Level requirement (default: 1)
- **stat1Type/stat1Value**: First bonus stat (e.g., STRENGTH, VITALITY)
- **stat2Type/stat2Value**: Second bonus stat

### 2. **Adding New Items**

**To add 10 new items when you already have 50:**

1. Open your Google Sheets
2. Add the 10 new items to rows 51-60
3. Go to **File → Download → Comma Separated Values (.csv)**
4. Save the CSV file
5. Go to your game's Admin Panel: `/admin`
6. Select **"Add New Only"** mode (this skips existing items)
7. Upload the CSV file
8. Click **"Import Items"**

Result: Only the 10 new items will be added. The existing 50 items remain unchanged.

### 3. **Updating Existing Items**

**To update item properties (e.g., change prices, stats):**

1. Modify items in your Google Sheets
2. Export as CSV
3. Go to Admin Panel
4. Select **"Update All"** mode
5. Upload and import

Result: New items are added, existing items are updated with new values.

### 4. **Import Modes**

**Add New Only Mode:**
- ✅ Adds new items (items not in database)
- ⏭️ Skips existing items (based on name match)
- 🛡️ Safe mode - won't accidentally change existing items

**Update All Mode:**
- ✅ Adds new items
- 🔄 Updates existing items (overwrites with new CSV data)
- ⚠️ Use carefully - will modify all matching items

### 5. **Best Practices**

1. **Keep Your Master Sheet Updated**
   - Export current items from database regularly
   - Use Google Sheets as your "source of truth"
   - Keep a backup sheet

2. **Naming Convention**
   - Use unique, descriptive names
   - Names are case-sensitive
   - No special characters that break CSV parsing

3. **Asset Management**
   - Upload item sprites to `/public/assets/items/` first
   - Use correct paths in CSV
   - Organize by type: `/weapons/`, `/armor/`, `/consumables/`

4. **Testing**
   - Test with a small CSV (2-3 items) first
   - Verify in game before importing large batches
   - Check the import results for errors

### 6. **Troubleshooting**

**"Column count mismatch" error:**
- Check that all rows have the same number of commas
- Don't leave extra commas at the end

**"Missing required field" error:**
- Ensure name, price, and sprite are filled
- Check for empty cells in required columns

**Items not appearing in game:**
- Verify the sprite path is correct
- Check that the item was actually imported (check results)
- Refresh the game page

### 7. **Advanced: Google Sheets API (Future Enhancement)**

For even more automation, you can set up:
1. Google Sheets API integration
2. Scheduled sync (e.g., sync every hour)
3. Real-time updates without CSV export

This requires additional setup but eliminates the manual export/import step.

### 8. **Database Backup**

Before major imports:
```bash
# Backup your database
mysqldump -u username -p aergyle_game > backup_$(date +%Y%m%d).sql
```

## Example Workflow: Monthly Content Update

1. **Week 1-3**: Design new items in Google Sheets
2. **Week 4 Day 1**: Export CSV, test import on staging server
3. **Week 4 Day 2**: Fix any errors, re-import
4. **Week 4 Day 3**: Import to production using "Add New Only"
5. **Week 4 Day 4**: Verify items in game, make adjustments
6. **Week 4 Day 5**: If changes needed, modify sheet, use "Update All"

## Tips for Large Updates

**Adding 100+ items at once:**
1. Split into batches of 50 items
2. Import first batch, verify
3. Import second batch
4. Reduces risk of mass corruption

**Maintaining Item IDs:**
- Item IDs are auto-generated by database
- Names are the unique identifier for updates
- Don't worry about ID conflicts

## Support

If you encounter issues:
1. Check the import results for specific error messages
2. Verify CSV format matches template
3. Check server logs for detailed errors
4. Test with template CSV first
