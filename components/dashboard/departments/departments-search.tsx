"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

const SEARCH_DELAY_MS = 300;

// Copy of components/dashboard/locations/locations-search.tsx, with department wording.
export function DepartmentsSearch({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [value, setValue] = React.useState(query);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  function pushQuery(next: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (next) {
      params.set("q", next);
    } else {
      params.delete("q");
    }
    params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;

    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => pushQuery(next.trim()), SEARCH_DELAY_MS);
  }

  function clearSearch() {
    setValue("");
    clearTimeout(timer.current);
    pushQuery("");
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && value !== "") {
      clearSearch();
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          type="search"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search by department name"
          aria-label="Search departments"
          className="h-9 pr-10 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value !== "" && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
