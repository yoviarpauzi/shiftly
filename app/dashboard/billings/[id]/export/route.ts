import { notFound } from "next/navigation";
import { parseBillingId } from "@/validation/billings";
import { requireBillingUser } from "../../billing-guard";
import { billingExportFileName, buildBillingWorkbook } from "../../billing-export-file";
import { formatBillingPeriod } from "../../billing-rules";
import { getBilling } from "../../billings";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// The Excel file of one issued billing. The access is checked here, not only by the button: a
// malformed id, a billing outside the access, and a Draft or Void billing are all a 404.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { access } = await requireBillingUser();
  const id = parseBillingId((await context.params).id);

  if (!id) {
    notFound();
  }

  const billing = await getBilling(access, id);

  if (!billing || billing.status !== "issued" || !billing.number) {
    notFound();
  }

  const bytes = await buildBillingWorkbook({
    number: billing.number,
    locationName: billing.locationName,
    siteName: billing.siteName,
    periodLabel: formatBillingPeriod(billing.periodStart, billing.periodEnd),
    groups: billing.groups,
  });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${billingExportFileName(billing.number)}"`,
      "Cache-Control": "no-store",
    },
  });
}
