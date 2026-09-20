"use client";

import Image from "next/image";
import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export type SearchOption = {
  id: number;
  name: string;
  image?: string | null;
  /** Secondary text, also searchable (e.g. a location or rarity). */
  detail?: string;
};

function OptionLabel({ option }: { option: SearchOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.image?.startsWith("/") ? (
        <Image
          src={option.image}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 shrink-0 object-contain"
        />
      ) : null}
      <span className="truncate">{option.name}</span>
      {option.detail ? (
        <span className="shrink-0 text-xs text-white/40">{option.detail}</span>
      ) : null}
    </span>
  );
}

/** A searchable picker for long lists such as every item in the game. */
export function SearchSelect(props: {
  options: SearchOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  /** Offers a "None" choice that clears the value. */
  noneLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = props.options.find((option) => option.id === props.value);
  const choose = (id: number | null) => {
    props.onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between border-white/10 bg-black/25 px-2.5 font-normal",
            props.className,
          )}
        >
          {selected ? (
            <OptionLabel option={selected} />
          ) : (
            <span className="truncate text-white/40">
              {props.noneLabel ?? props.placeholder ?? "Choose…"}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" className="h-9" />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup>
              {props.noneLabel ? (
                <CommandItem value="__none" onSelect={() => choose(null)}>
                  {props.noneLabel}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      props.value === null ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ) : null}
              {props.options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.name} ${option.detail ?? ""} #${option.id}`}
                  onSelect={() => choose(option.id)}
                >
                  <OptionLabel option={option} />
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4 shrink-0",
                      props.value === option.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
