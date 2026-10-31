"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { restoreSite } from "@/app/dashboard/sites/actions";
import type { SitePage, SiteRow } from "@/app/dashboard/sites/sites";
import { TablePagination } from "@/components/dashboard/pagination";
import { BulkDeleteSitesDialog } from "@/components/dashboard/sites/bulk-delete-sites-dialog";
import { DeleteSiteDialog } from "@/components/dashboard/sites/delete-site-dialog";
import { SiteFormDialog } from "@/components/dashboard/sites/site-form-dialog";
import { SitesSearch } from "@/components/dashboard/sites/sites-search";
import { SitesStatusFilter } from "@/components/dashboard/sites/sites-status-filter";
import type { SiteStatus } from "@/app/dashboard/sites/site-rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SitesDataTable({
  data,
  status,
}: {
  data: SitePage;
  status: SiteStatus;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [formOpen, setFormOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const [editingSite, setEditingSite] = React.useState<SiteRow | null>(null);
  const [deletingSite, setDeletingSite] = React.useState<SiteRow | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  // A new key remounts the dialog, so each open starts from the right defaults.
  function openForm(site: SiteRow | null) {
    setEditingSite(site);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  function goToPage(page: number, pageSize: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", `${page}`);
    params.set("pageSize", `${pageSize}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  // Deleted sites cannot be selected. Only rows on the current page count, so a stale id is ignored.
  const activeRows = data.rows.filter((site) => site.deletedAt === null);
  const selectedSites = activeRows.filter((site) =>
    selectedIds.includes(site.id),
  );
  const allSelected =
    activeRows.length > 0 && selectedSites.length === activeRows.length;
  const someSelected = selectedSites.length > 0 && !allSelected;

  function toggleSite(id: string, checked: boolean) {
    setSelectedIds((ids) =>
      checked
        ? [...ids.filter((value) => value !== id), id]
        : ids.filter((value) => value !== id),
    );
  }

  async function handleRestore(site: SiteRow) {
    const result = await restoreSite(site.id);

    if (result.ok) {
      toast.success(`${site.name} restored`);
    } else {
      toast.error(result.formError ?? "Could not restore the site");
    }
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? activeRows.map((site) => site.id) : []);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SitesSearch total={data.total} />
          <SitesStatusFilter status={status} />
        </div>
        <Button onClick={() => openForm(null)}>
          <PlusIcon data-icon="inline-start" />
          Add site
        </Button>
      </div>
      {selectedSites.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted px-4 py-2">
          <p className="text-sm font-medium">{selectedSites.length} selected</p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleting(true)}
          >
            <Trash2Icon data-icon="inline-start" />
            Delete selected
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all sites on this page"
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(checked) => toggleAll(checked)}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Locations</TableHead>
              <TableHead className="pl-8">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length ? (
              data.rows.map((site) => (
                <TableRow
                  key={site.id}
                  className={
                    site.deletedAt ? "text-muted-foreground" : undefined
                  }
                >
                  <TableCell>
                    {site.deletedAt === null && (
                      <Checkbox
                        aria-label={`Select ${site.name}`}
                        checked={selectedIds.includes(site.id)}
                        onCheckedChange={(checked) =>
                          toggleSite(site.id, checked)
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell>{site.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {site.locationCount}
                  </TableCell>
                  <TableCell className="pl-8">
                    <Badge variant="outline">
                      <span
                        aria-hidden
                        className={`size-2 rounded-full ${site.deletedAt ? "bg-destructive" : "bg-accent-text"}`}
                      />
                      {site.deletedAt ? "Deleted" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Actions for ${site.name}`}
                            />
                          }
                        >
                          <EllipsisIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            {site.deletedAt === null ? (
                              <>
                                <DropdownMenuItem
                                  onClick={() => openForm(site)}
                                >
                                  <PencilIcon />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeletingSite(site)}
                                >
                                  <Trash2Icon />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleRestore(site)}
                              >
                                <RotateCcwIcon />
                                Restore
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  {query
                    ? `No sites match "${query}"`
                    : status === "deleted"
                      ? "No deleted sites"
                      : "No sites yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "site" : "sites"}
        </div>
        <TablePagination
          page={data.page}
          pageCount={pageCount}
          pageSize={data.pageSize}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
      <SiteFormDialog
        key={formKey}
        site={editingSite}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      <BulkDeleteSitesDialog
        sites={selectedSites}
        open={bulkDeleting}
        onOpenChange={setBulkDeleting}
      />
      <DeleteSiteDialog
        site={deletingSite}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingSite(null);
          }
        }}
      />
    </div>
  );
}
