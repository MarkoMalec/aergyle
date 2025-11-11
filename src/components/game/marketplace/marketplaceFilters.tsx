"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"

interface ItemFiltersProps {
  priceRange: { min: number; max: number }
  onPriceRangeChange: (range: { min: number; max: number }) => void
}

export function ItemFilters({ priceRange, onPriceRangeChange }: ItemFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [minValue, setMinValue] = useState(priceRange.min.toString())
  const [maxValue, setMaxValue] = useState(priceRange.max.toString())

  const handleApply = () => {
    onPriceRangeChange({
      min: Math.max(0, Number.parseInt(minValue) || 0),
      max: Math.max(0, Number.parseInt(maxValue) || 100000),
    })
    setIsOpen(false)
  }

  const isFiltered = Number.parseInt(minValue) !== 0 || Number.parseInt(maxValue) !== 100000

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isFiltered ? "default" : "outline"}
          size="sm"
          className="gap-2 bg-secondary/50 text-foreground hover:bg-secondary"
        >
          Price Range
          <ChevronDown className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">Filter by Price</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Minimum Price</label>
              <Input
                type="number"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Maximum Price</label>
              <Input
                type="number"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                placeholder="100000"
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
