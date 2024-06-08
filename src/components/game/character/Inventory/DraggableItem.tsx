"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { InventoryItem } from "./Inventory";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import Image from "next/image";

export const DraggableItem = ({
  id,
  index,
  item,
  sprite,
}: {
  id: string;
  index: number;
  item: InventoryItem;
  sprite: string;
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: {
      index,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  return (
    <Popover>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="flex h-[62px] w-[62px] items-center justify-center rounded bg-[grey] text-center text-sm shadow"
      >
        <PopoverTrigger>
          <Image
            alt={item.name}
            src={sprite}
            width={62}
            height={62}
            className="rounded"
          />
        </PopoverTrigger>
      </div>
      <PopoverContent>
        <h3 className="bold text-xl mb-3">{item.name}</h3>
        <ul className="space-y-2">
          <li>{item.stat1}</li>
          <li>{item.stat2}</li>
        </ul>
      </PopoverContent>
    </Popover>
  );
};
