import { columnVisibilityFeature, createColumnHelper, tableFeatures } from "@tanstack/react-table";
import type { BillingLineView } from "@/types/billings";

// Row cells come from the column visibility feature in TanStack Table v9, so it is needed even
// though the columns never hide.
export const billingLineFeatures = tableFeatures({ columnVisibilityFeature });

const columnHelper = createColumnHelper<typeof billingLineFeatures, BillingLineView>();

export const billingLineColumns = columnHelper.columns([
  columnHelper.accessor("departmentName", {
    header: () => <span>Department</span>,
    cell: ({ row }) => row.original.departmentName,
  }),
  columnHelper.accessor("subDepartmentName", {
    header: () => <span>Sub-department</span>,
    cell: ({ row }) => row.original.subDepartmentName ?? "-",
  }),
  columnHelper.accessor("positionName", {
    header: () => <span>Position</span>,
    cell: ({ row }) => row.original.positionName,
  }),
  columnHelper.accessor("days", {
    header: () => <span className="block text-right">Days</span>,
    cell: ({ row }) => <span className="block text-right tabular-nums">{row.original.days}</span>,
  }),
]);
