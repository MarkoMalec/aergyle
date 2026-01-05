"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import type { ItemRarity } from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface AddItemFormData {
  itemId: string;
  rarity: ItemRarity;
}

interface AddItemTestFormProps {
  items: Array<{ id: number; name: string; equipTo: string | null }>;
}

const RARITIES: ItemRarity[] = [
  "WORTHLESS",
  "BROKEN",
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EXQUISITE",
  "EPIC",
  "ELITE",
  "UNIQUE",
  "LEGENDARY",
  "MYTHIC",
  "DIVINE",
];

export function AddItemTestForm({ items }: AddItemTestFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AddItemFormData>({
    defaultValues: {
      itemId: "",
      rarity: "COMMON",
    },
  });

  const onSubmit = async (data: AddItemFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/test/add-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: parseInt(data.itemId),
          rarity: data.rarity,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add item");
      }

      alert(`✅ ${result.itemName} (${result.rarity}) added to slot ${result.slotIndex}`);

      form.reset();

      // Reload page to show new item
      window.location.reload();
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : "Failed to add item"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">🧪 Test: Add Item to Inventory</h3>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="itemId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Item</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an item..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id.toString()}>
                        {item.name} {item.equipTo ? `(${item.equipTo})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Select an item from the database
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rarity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Rarity</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose rarity..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RARITIES.map((rarity) => (
                      <SelectItem key={rarity} value={rarity}>
                        {rarity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose the rarity for this item instance
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Adding..." : "Add Item to Inventory"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
