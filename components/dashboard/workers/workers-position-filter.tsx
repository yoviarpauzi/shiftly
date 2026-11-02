"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { WorkersPositionFilterProps } from "@/types/workers";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

// A search box, since a site can have many positions. Clearing it removes the param, so the URL only
// carries filters that are set.
export function WorkersPositionFilter({ positions, value }: WorkersPositionFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const names = React.useMemo(
    () => new Map(positions.map((position) => [position.id, position.name])),
    [positions],
  );
  const ids = React.useMemo(() => positions.map((position) => position.id), [positions]);
  const nameOf = (positionId: string) => names.get(positionId) ?? positionId;

  function setPosition(next: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (next) {
      params.set("position", next);
    } else {
      params.delete("position");
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Combobox
      autoHighlight
      items={ids}
      value={value}
      onValueChange={setPosition}
      itemToStringLabel={nameOf}
    >
      <ComboboxInput
        placeholder="All positions"
        aria-label="Filter workers by position"
        showClear={value !== null}
        className="h-9 w-56"
      />
      <ComboboxContent>
        <ComboboxEmpty>No positions found</ComboboxEmpty>
        <ComboboxList>
          {(positionId: string) => (
            <ComboboxItem key={positionId} value={positionId}>
              {nameOf(positionId)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
