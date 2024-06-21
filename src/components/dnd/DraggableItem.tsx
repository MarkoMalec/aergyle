"use client";

import { Item } from "@prisma/client";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import Image from "next/image";
import { Skeleton } from "~/components/ui/skeleton";

export const DraggableItem = ({
  id,
  index,
  item,
  sprite,
  container,
}: {
  id: string;
  index: number;
  item: Item;
  sprite: string;
  container: string;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: {
      index,
      container,
      equipType: item.equipTo,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    boxShadow: isDragging ? "0px 5px 10px black" : undefined,
  };

  if (!item) {
    return <Skeleton className="h-[62px] w-[62px] rounded"></Skeleton>;
  }

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
        <h3 className="bold mb-3 text-xl">{item.name}</h3>
        <ul className="space-y-2">
          <li>{item.stat1}</li>
          <li>{item.stat2}</li>
        </ul>
      </PopoverContent>
    </Popover>
  );
};
