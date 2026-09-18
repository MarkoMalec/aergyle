"use client";

import type { ItemRarity } from "~/generated/prisma/enums";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { SellItemForm } from "./SellItemForm";

interface ListItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  returnFocus?: () => void;
  userItemId: number;
  itemId: number;
  itemName: string;
  sprite: string;
  rarity: ItemRarity;
  maxQuantity: number;
  stackable: boolean;
}

export function ListItemDialog({
  isOpen,
  onClose,
  returnFocus,
  userItemId,
  itemId,
  itemName,
  sprite,
  rarity,
  maxQuantity,
  stackable,
}: ListItemDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={
          returnFocus
            ? (event) => {
                event.preventDefault();
                returnFocus();
              }
            : undefined
        }
      >
        <DialogHeader>
          <DialogTitle>Sell on the marketplace</DialogTitle>
          <DialogDescription>
            Choose immediate certainty or set your own unit price.
          </DialogDescription>
        </DialogHeader>
        <SellItemForm
          item={{
            userItemId,
            itemId,
            itemName,
            sprite,
            rarity,
            maxQuantity,
            stackable,
          }}
          onCompleted={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
