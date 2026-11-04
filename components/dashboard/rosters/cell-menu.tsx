"use client";

import { CoffeeIcon, EraserIcon, MoonIcon, UserRoundPenIcon } from "lucide-react";
import type { CellMenuProps, CellTarget } from "@/types/rosters";
import { ShiftChip } from "@/components/dashboard/shift-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The radio value of a cell: the current choice gets the check.
function currentValue(cell: CellMenuProps["cell"]): string {
  if (cell === null) {
    return "";
  }

  return cell.kind === "work" ? `shift-${cell.shiftOrder}` : cell.kind;
}

// The cell of a draft roster as a button. It opens the menu of what the cell can become. Picking
// the value the cell already has changes nothing.
export function CellMenu({
  label,
  cell,
  shifts,
  disabled,
  onChoose,
  onReplace,
  children,
}: CellMenuProps) {
  function handleValueChange(value: string) {
    let to: CellTarget | null = null;

    if (value === "off") {
      to = { kind: "off" };
    } else if (value === "break") {
      to = { kind: "break" };
    } else {
      const picked = shifts.find((entry) => `shift-${entry.order}` === value);

      if (picked) {
        to = { kind: "work", shiftId: picked.id, shiftOrder: picked.order };
      }
    }

    if (to) {
      onChoose(to);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={label}
        className="relative inline-flex min-h-8 min-w-12 items-center justify-center rounded-md px-1 outline-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup value={currentValue(cell)} onValueChange={handleValueChange}>
            {shifts.map((entry) => (
              <DropdownMenuRadioItem key={entry.id} value={`shift-${entry.order}`} closeOnClick>
                <ShiftChip order={entry.order} />
                Shift {entry.order} · {entry.startTime} - {entry.endTime}
              </DropdownMenuRadioItem>
            ))}
            <DropdownMenuRadioItem value="off" closeOnClick>
              <MoonIcon />
              Day off
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="break" closeOnClick>
              <CoffeeIcon />
              Break
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuItem onClick={() => onChoose({ kind: "clear" })} disabled={cell === null}>
            <EraserIcon />
            Clear cell
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {cell?.kind === "work" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onReplace}>
                <UserRoundPenIcon />
                Replace worker…
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
