"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EllipsisIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { SitePage, SiteRow } from "@/app/dashboard/sites/sites";
import { TablePagination } from "@/components/dashboard/pagination";
import { DeleteSiteDialog } from "@/components/dashboard/sites/delete-site-dialog";
import { SiteFormDialog } from "@/components/dashboard/sites/site-form-dialog";
import { SitesSearch } from "@/components/dashboard/sites/sites-search";
import { Button } from "@/components/ui/button";
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

export function SitesDataTable({ data }: { data: SitePage }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [formOpen, setFormOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const [editingSite, setEditingSite] = React.useState<SiteRow | null>(null);
  const [deletingSite, setDeletingSite] = React.useState<SiteRow | null>(null);

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

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <SitesSearch total={data.total} />
        <Button onClick={() => openForm(null)}>
          <PlusIcon data-icon="inline-start" />
          Add site
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Locations</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length ? (
              data.rows.map((site) => (
                <TableRow key={site.id}>
                  <TableCell>{site.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {site.locationCount}
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
                            <DropdownMenuItem onClick={() => openForm(site)}>
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
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  {query ? `No sites match "${query}"` : "No sites yet"}
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
