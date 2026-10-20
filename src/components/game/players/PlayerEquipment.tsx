"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Popover, PopoverTrigger } from "~/components/ui/popover";
import { EquipmentLayout } from "~/components/game/character/Equipment/EquipmentLayout";
import { EquipmentSlotIcon } from "~/components/game/character/Equipment/EquipmentSlotIcon";
import {
  ItemDetails,
  ItemDetailsPopoverContent,
} from "~/components/game/items/ItemDetails";
import { ItemCompareButton } from "~/components/game/items/ItemCompare";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import type { EquipmentSlotsWithItems } from "~/types/inventory";
import type { ItemWithStats } from "~/types/stats";
import { EQUIPMENT_SLOTS } from "~/utils/itemEquipTo";
import { rarityStyle } from "~/utils/rarity-colors";
import { ItemRarityMark } from "~/utils/ui/rarity-mark";

/** A worn item that opens its card on click; it can't be moved or used. */
function WornSlot({
  item,
  ghost,
  label,
  emptyIcon,
}: {
  item: ItemWithStats | null;
  /** The main hand's two-handed weapon, shown dimmed in the empty off hand. */
  ghost: ItemWithStats | null;
  label: string;
  emptyIcon: ReactNode;
}) {
  const { colors } = useRarityColors();
  const shown = item ?? ghost;

  return (
    <div
      style={
        shown ? rarityStyle(shown.rarity, colors[shown.rarity]) : undefined
      }
      className={`game-slot${shown ? " rarity-frame" : ""}`}
      data-rarity={shown?.rarity}
      data-equipped={!!shown}
      data-two-handed-copy={!item && !!ghost}
      aria-label={
        item
          ? undefined
          : ghost
            ? `${label}: held by two-handed ${ghost.name}`
            : `Empty ${label} slot`
      }
    >
      {item ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="game-item-trigger"
              aria-label={`${label}: ${item.name}, ${item.rarity.toLowerCase()}. Item details`}
            >
              <Image
                alt={item.name}
                src={item.sprite}
                width={102}
                height={102}
                className="object-contain"
              />
              <ItemRarityMark rarity={item.rarity} />
            </button>
          </PopoverTrigger>
          <ItemDetailsPopoverContent name={item.name} rarity={item.rarity}>
            <ItemDetails item={item} />
            <ItemCompareButton
              item={item}
              instanceId={item.id}
              className="mt-5 w-full"
            />
          </ItemDetailsPopoverContent>
        </Popover>
      ) : ghost ? (
        <span className="game-item-trigger" aria-hidden="true">
          <Image
            alt=""
            src={ghost.sprite}
            width={102}
            height={102}
            className="object-contain"
          />
          <ItemRarityMark rarity={ghost.rarity} />
        </span>
      ) : (
        emptyIcon
      )}
    </div>
  );
}

/** Another player's equipment, laid out like the owner's but read-only. */
export function PlayerEquipment({
  equipment,
}: {
  equipment: EquipmentSlotsWithItems;
}) {
  const equippedCount = EQUIPMENT_SLOTS.filter(
    ({ slot }) => equipment[slot],
  ).length;

  return (
    <section
      className="game-panel min-w-0 border-0"
      aria-labelledby="equipment-heading"
    >
      <div className="game-panel-header">
        <div>
          <p className="game-eyebrow">Loadout</p>
          <h2 className="game-section-title" id="equipment-heading">
            Equipment
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {equippedCount} / {EQUIPMENT_SLOTS.length} equipped
        </span>
      </div>
      <div className="game-panel-body game-equipment-content">
        <EquipmentLayout
          renderSlot={({ slot, label, side }) => (
            <WornSlot
              item={equipment[slot]}
              ghost={
                slot === "offhand" && equipment.weapon?.twoHanded
                  ? equipment.weapon
                  : null
              }
              label={side ? `${side} ${label.toLowerCase()}` : label}
              emptyIcon={<EquipmentSlotIcon slot={slot} />}
            />
          )}
        />
      </div>
    </section>
  );
}
