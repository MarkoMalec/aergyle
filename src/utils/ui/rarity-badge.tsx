"use client"

import { Badge } from "~/components/ui/badge"
import { ItemRarity } from "@prisma/client"
import { cn } from "~/lib/utils"
import { getRarityTailwindClass } from "~/utils/rarity-colors"
import { useRarityColors } from "~/hooks/use-rarity-colors"

interface RarityBadgeProps {
  rarity: ItemRarity
  className?: string
}

export function RarityBadge({ rarity, className }: RarityBadgeProps) {
  const { colors } = useRarityColors()
  const hexColor = colors[rarity]
  const colorClass = getRarityTailwindClass(rarity, hexColor, "badge")

  return <Badge className={cn(colorClass, className, "capitalize")}>{rarity.toLowerCase()}</Badge>
}
