"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ItemRarity } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";

interface Item {
  id: number;
  name: string;
}

interface AddItemFormProps {
  items: Item[];
}

const RARITIES = [
  { value: "WORTHLESS", label: "Worthless", color: "#4a5568" },
  { value: "BROKEN", label: "Broken", color: "#718096" },
  { value: "COMMON", label: "Common", color: "#9ca3af" },
  { value: "UNCOMMON", label: "Uncommon", color: "#22c55e" },
  { value: "RARE", label: "Rare", color: "#3b82f6" },
  { value: "EXQUISITE", label: "Exquisite", color: "#8b5cf6" },
  { value: "EPIC", label: "Epic", color: "#a855f7" },
  { value: "ELITE", label: "Elite", color: "#d946ef" },
  { value: "UNIQUE", label: "Unique", color: "#f59e0b" },
  { value: "LEGENDARY", label: "Legendary", color: "#eab308" },
  { value: "MYTHIC", label: "Mythic", color: "#ef4444" },
  { value: "DIVINE", label: "Divine", color: "#fbbf24" },
];

export function AddItemTestForm({ items }: AddItemFormProps) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [selectedRarity, setSelectedRarity] = useState<string>("COMMON");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedItem) {
      setMessage("Please select an item");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/items/add-to-inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId: parseInt(selectedItem),
          rarity: selectedRarity,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ Added ${data.itemName} (${selectedRarity}) to inventory!`);
        setSelectedItem("");
        router.refresh();
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setMessage("❌ Failed to add item");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>🧪 Test: Add Item to Inventory</CardTitle>
        <CardDescription>
          Select an item and rarity to add to your inventory (for testing)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-select">Select Item</Label>
            <Select value={selectedItem} onValueChange={setSelectedItem}>
              <SelectTrigger id="item-select">
                <SelectValue placeholder="Choose an item..." />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id.toString()}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rarity-select">Select Rarity</Label>
            <Select value={selectedRarity} onValueChange={setSelectedRarity}>
              <SelectTrigger id="rarity-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RARITIES.map((rarity) => (
                  <SelectItem key={rarity.value} value={rarity.value}>
                    <span style={{ color: rarity.color }}>
                      {rarity.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Adding..." : "Add to Inventory"}
          </Button>

          {message && (
            <div className="rounded-md bg-slate-100 p-3 text-sm">
              {message}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
