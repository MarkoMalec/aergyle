"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Upload, Download, FileText } from "lucide-react";

export default function ItemImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"add-new" | "update-all">("add-new");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);

      const response = await fetch("/api/admin/import-items", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: "Failed to upload file",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Create CSV template with base stats AND progressive stats + new stacking columns
    const template = [
      "name,price,sprite,equipTo,rarity,itemType,stackable,maxStackSize,minPhysicalDamage,maxPhysicalDamage,minMagicDamage,maxMagicDamage,armor,requiredLevel,statType,baseValue,unlocksAtRarity",
      "Iron Sword,100,/assets/items/weapons/iron-sword.jpg,weapon,COMMON,SWORD,false,1,5,10,0,0,0,5,STRENGTH,5,BASE",
      "Iron Sword,100,/assets/items/weapons/iron-sword.jpg,weapon,COMMON,SWORD,false,1,5,10,0,0,0,5,CRITICAL_CHANCE,2,RARE",
      "Leather Helmet,50,/assets/items/armor/leather-helmet.jpg,head,COMMON,HELMET,false,1,0,0,0,0,10,3,VITALITY,3,BASE",
      "Health Potion,25,/assets/items/consumables/potions/health-potion.jpg,,,POTION,true,99,0,0,0,0,0,1,HEALTH,50,BASE",
      "Iron Ore,10,/assets/items/resources/iron-ore.jpg,,,ORE,true,99,0,0,0,0,0,1,,,",
      "Small Backpack,150,/assets/items/storage/backpacks/small-backpack.jpg,backpack,COMMON,BACKPACK,false,1,0,0,0,0,0,1,CARRYING_CAPACITY,11,BASE",
      "Epic Sword,500,/assets/items/weapons/epic-sword.jpg,weapon,COMMON,SWORD,false,1,10,20,0,0,0,10,STRENGTH,10,BASE",
      "Epic Sword,500,/assets/items/weapons/epic-sword.jpg,weapon,COMMON,SWORD,false,1,10,20,0,0,0,10,CRITICAL_CHANCE,5,RARE",
      "Epic Sword,500,/assets/items/weapons/epic-sword.jpg,weapon,COMMON,SWORD,false,1,10,20,0,0,0,10,LIFESTEAL,3,EPIC",
    ].join("\n");

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "items-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCurrentItems = () => {
    // Trigger download from API
    window.location.href = "/api/admin/export-items";
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Items from CSV
        </CardTitle>
        <CardDescription>
          Upload a CSV file to bulk import or update items in the game database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Download Template Button */}
        <div className="flex justify-end">
                  <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={downloadTemplate}
            className="mb-4"
          >
            Download CSV Template
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={exportCurrentItems}
            className="mb-4"
          >
            Export Current Items
          </Button>
        </div>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Import Mode</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="add-new"
                  checked={mode === "add-new"}
                  onChange={(e) => setMode(e.target.value as "add-new")}
                  className="h-4 w-4"
                />
                <span className="text-sm">Add New Only (skip existing)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="update-all"
                  checked={mode === "update-all"}
                  onChange={(e) => setMode(e.target.value as "update-all")}
                  className="h-4 w-4"
                />
                <span className="text-sm">Update All (add + update)</span>
              </label>
            </div>
          </div>

          {/* File Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">CSV File</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="flex-1 text-sm"
              />
              {file && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <FileText className="h-4 w-4" />
                  {file.name}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!file || isLoading}
            className="w-full"
          >
            {isLoading ? "Importing..." : "Import Items"}
          </Button>
        </form>

        {/* Results */}
        {result && (
          <div
            className={`mt-4 rounded-lg p-4 ${
              result.success
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <h3
              className={`font-semibold mb-2 ${
                result.success ? "text-green-900" : "text-red-900"
              }`}
            >
              {result.success ? "✓ Import Successful" : "✗ Import Failed"}
            </h3>
            {result.success && result.results && (
              <div className="text-sm space-y-1 text-green-800">
                <p>• Added: {result.results.added} items</p>
                <p>• Updated: {result.results.updated} items</p>
                <p>• Skipped: {result.results.skipped} items</p>
                {result.results.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium text-orange-700">
                      {result.results.errors.length} errors occurred
                    </summary>
                    <ul className="mt-2 list-disc list-inside text-orange-600">
                      {result.results.errors.map((error: string, i: number) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            {result.error && (
              <p className="text-sm text-red-800">{result.error}</p>
            )}
          </div>
        )}

        {/* Instructions */}
                <div className="rounded-lg bg-muted p-4">
          <h3 className="mb-2 font-semibold">Instructions</h3>
          <ol className="list-inside list-decimal space-y-1 text-sm">
            <li>
              <strong>First time setup:</strong> Click &quot;Export Current
              Items&quot; to download your existing items, then import to Google
              Sheets
            </li>
            <li>
              Download the CSV template or use your exported items as reference
            </li>
            <li>Edit in Google Sheets or Excel</li>
            <li>Export as CSV from your spreadsheet tool</li>
            <li>
              Choose import mode:
              <ul className="ml-6 mt-1 list-disc">
                <li>
                  <strong>Add New Only:</strong> Only adds new items (skips
                  existing)
                </li>
                <li>
                  <strong>Update All:</strong> Adds new + updates existing items
                </li>
              </ul>
            </li>
            <li>Upload and import</li>
          </ol>
          <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3">
            <h4 className="mb-1 text-sm font-semibold text-blue-900">New Stacking Columns:</h4>
            <ul className="list-inside list-disc space-y-0.5 text-xs text-blue-800">
              <li>
                <strong>itemType:</strong> SWORD, AXE, POTION, ORE, etc. (optional)
              </li>
              <li>
                <strong>stackable:</strong> true/false (whether items can stack)
              </li>
              <li>
                <strong>maxStackSize:</strong> Number (1 for equipment, 99 for consumables/resources)
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
