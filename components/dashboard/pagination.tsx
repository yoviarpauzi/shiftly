import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PAGE_SIZES } from "@/lib/pagination"
import type { TablePaginationProps } from "@/types/pagination"

export function TablePagination({
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const canPreviousPage = page > 1
  const canNextPage = page < pageCount

  return (
    <div className="flex w-full items-center gap-8 lg:w-fit">
      <div className="hidden items-center gap-2 lg:flex">
        <Label htmlFor="rows-per-page" className="text-sm font-medium">
          Rows per page
        </Label>
        <Select
          value={`${pageSize}`}
          onValueChange={(value) => {
            onPageSizeChange(Number(value))
          }}
          items={PAGE_SIZES.map((size) => ({
            label: `${size}`,
            value: `${size}`,
          }))}
        >
          <SelectTrigger size="sm" className="w-20" id="rows-per-page">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectGroup>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex w-fit items-center justify-center text-sm font-medium">
        Page {page} of {pageCount}
      </div>
      <div className="ml-auto flex items-center gap-2 lg:ml-0">
        <Button
          variant="outline"
          className="hidden h-8 w-8 p-0 lg:flex"
          onClick={() => onPageChange(1)}
          disabled={!canPreviousPage}
        >
          <span className="sr-only">Go to first page</span>
          <ChevronsLeftIcon />
        </Button>
        <Button
          variant="outline"
          className="size-8"
          size="icon"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPreviousPage}
        >
          <span className="sr-only">Go to previous page</span>
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          className="size-8"
          size="icon"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNextPage}
        >
          <span className="sr-only">Go to next page</span>
          <ChevronRightIcon />
        </Button>
        <Button
          variant="outline"
          className="hidden size-8 lg:flex"
          size="icon"
          onClick={() => onPageChange(pageCount)}
          disabled={!canNextPage}
        >
          <span className="sr-only">Go to last page</span>
          <ChevronsRightIcon />
        </Button>
      </div>
    </div>
  )
}
