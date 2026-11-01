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

export type UserFilterOption = { value: string; label: string };

// The "all" option removes the param, so the URL only carries filters that are set.
const ALL = "all";

// resets lists other params to drop when this filter changes, such as a location that belongs to the old site.
export function UsersSelectFilter({
  param,
  value,
  options,
  ariaLabel,
  className,
  resets = [],
}: {
  param: string;
  value: string;
  options: UserFilterOption[];
  ariaLabel: string;
  className: string;
  resets?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setValue(next: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (next === ALL) {
      params.delete(param);
    } else {
      params.set(param, next);
    }
    for (const name of resets) {
      params.delete(name);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next) {
          setValue(next);
        }
      }}
      items={options}
    >
      <SelectTrigger aria-label={ariaLabel} className={className}>
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
