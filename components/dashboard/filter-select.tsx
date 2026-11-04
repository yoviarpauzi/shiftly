"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ALL_OPTION = "all";

type FilterSelectProps = {
  // The URL parameter this filter writes.
  param: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
  className: string;
  // Parameters to drop when this one changes.
  resets?: string[];
  disabled?: boolean;
};

// One filter in the URL. The "all" option removes the parameter, and any change goes back to page 1.
export function FilterSelect({
  param,
  value,
  options,
  label,
  className,
  resets = [],
  disabled = false,
}: FilterSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function change(next: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (next === ALL_OPTION) {
      params.delete(param);
    } else {
      params.set(param, next);
    }
    for (const reset of resets) {
      params.delete(reset);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next) {
          change(next);
        }
      }}
      items={options}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
