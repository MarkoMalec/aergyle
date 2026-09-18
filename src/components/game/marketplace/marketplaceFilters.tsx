"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { MARKET_DEFAULT_MAX_PRICE } from "~/lib/marketplace";

interface ItemFiltersProps {
  priceRange: { min: number; max: number };
  onPriceRangeChange: (range: { min: number; max: number }) => void;
}

export function ItemFilters({
  priceRange,
  onPriceRangeChange,
}: ItemFiltersProps) {
  const priceId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [minValue, setMinValue] = useState(priceRange.min.toString());
  const [maxValue, setMaxValue] = useState(priceRange.max.toString());

  useEffect(() => {
    setMinValue(priceRange.min.toString());
    setMaxValue(priceRange.max.toString());
  }, [priceRange.max, priceRange.min]);

  const handleApply = () => {
    const parsedMin = Number.parseFloat(minValue);
    const parsedMax = Number.parseFloat(maxValue);
    const min = Math.max(0, Number.isFinite(parsedMin) ? parsedMin : 0);
    const max = Math.max(
      min,
      Number.isFinite(parsedMax) ? parsedMax : MARKET_DEFAULT_MAX_PRICE,
    );
    onPriceRangeChange({
      min,
      max,
    });
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="border bg-secondary hover:bg-secondary"
        >
          Price Range
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Filter by Price</h4>
          <div className="space-y-3">
            <div>
              <label
                htmlFor={`${priceId}-min`}
                className="mb-1 block text-xs text-muted-foreground"
              >
                Minimum Price
              </label>
              <Input
                type="number"
                id={`${priceId}-min`}
                min="0"
                step="0.01"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </div>
            <div>
              <label
                htmlFor={`${priceId}-max`}
                className="mb-1 block text-xs text-muted-foreground"
              >
                Maximum Price
              </label>
              <Input
                type="number"
                id={`${priceId}-max`}
                min="0"
                step="0.01"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                placeholder={String(MARKET_DEFAULT_MAX_PRICE)}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
