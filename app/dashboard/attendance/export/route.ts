import { notFound } from "next/navigation";
import { parseExportParams } from "@/validation/attendance-export";
import { requireAttendanceAccess } from "../attendance-guard";
import { loadExportInput } from "../attendance-export";
import { buildExportWorkbook } from "../attendance-export-file";
import { buildExportModel, exportFileName, weekBounds } from "../attendance-export-rules";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// The printable attendance forms of one location for the Monday to Sunday week of a date. The access
// is checked here, not only by the button: a location outside it, or a URL that is not one location
// and one real date, is a 404.
export async function GET(request: Request) {
  const access = await requireAttendanceAccess();
  const parsed = parseExportParams(new URL(request.url).searchParams);

  if (!parsed) {
    notFound();
  }

  const { from, to } = weekBounds(parsed.date);
  const input = await loadExportInput(access, parsed.locationId, from, to);

  if (!input) {
    notFound();
  }

  const bytes = await buildExportWorkbook(buildExportModel(input));

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${exportFileName(input.locationName, from, to)}"`,
      "Cache-Control": "no-store",
    },
  });
}
