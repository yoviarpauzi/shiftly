"use client";

import * as React from "react";
import type { WorkerPositionPickerProps } from "@/types/workers";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";

// Items are position ids, so the form keeps the same string[] value. Names are only for display and search.
export function WorkerPositionPicker({
  positions,
  value,
  onValueChange,
  id,
  disabled,
  invalid,
}: WorkerPositionPickerProps) {
  const anchor = useComboboxAnchor();
  const names = React.useMemo(
    () => new Map(positions.map((position) => [position.id, position.name])),
    [positions],
  );
  const ids = React.useMemo(() => positions.map((position) => position.id), [positions]);
  const nameOf = (positionId: string) => names.get(positionId) ?? positionId;

  return (
    <Combobox
      multiple
      autoHighlight
      items={ids}
      value={value}
      onValueChange={onValueChange}
      itemToStringLabel={nameOf}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor} className="max-h-32 overflow-y-auto" aria-invalid={invalid || undefined}>
        <ComboboxValue>
          {(selected: string[]) => (
            <>
              {selected.map((positionId) => (
                <ComboboxChip key={positionId}>{nameOf(positionId)}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                placeholder={selected.length === 0 ? "Search positions" : undefined}
                aria-invalid={invalid || undefined}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
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
