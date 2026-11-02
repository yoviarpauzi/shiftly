import { requireWorkerManager } from "../../worker-guard";
import { buildImportTemplate } from "../../worker-import-file";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET() {
  await requireWorkerManager();

  const bytes = await buildImportTemplate();

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="worker-import-template.xlsx"',
    },
  });
}
