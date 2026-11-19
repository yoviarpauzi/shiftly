import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingAccess, BillingDetail } from "@/types/billings";

const ACCESS: BillingAccess = { siteId: null, locationId: null };

const ID = "44444444-4444-4444-8444-444444444441";

const loaded = vi.hoisted(() => ({ billing: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("../../billing-guard", () => ({ requireBillingUser: async () => ({ user: {}, access: ACCESS }) }));
vi.mock("../../billings", () => ({
  getBilling: vi.fn(async () => loaded.billing),
}));

const { GET } = await import("./route");
const { getBilling } = await import("../../billings");

const issued: BillingDetail = {
  id: ID,
  number: "BL-JKT-202611-0001",
  status: "issued",
  mode: "monthly",
  periodStart: "2026-11-01",
  periodEnd: "2026-11-30",
  siteId: "s-1",
  locationId: "l-1",
  locationName: "Kejayan",
  siteName: "Jakarta",
  version: "2026-11-30T00:00:00.000Z",
  createdByName: "Ani",
  issuedByName: "Ani",
  issuedAt: "2026-11-30T00:00:00.000Z",
  voidedByName: null,
  voidedAt: null,
  voidReason: null,
  groups: {
    pos: [
      {
        requestId: "r1",
        poNumber: "PO-JKT-202611-0001",
        lines: [
          {
            requestId: "r1",
            poNumber: "PO-JKT-202611-0001",
            departmentId: "d1",
            departmentName: "Produksi",
            subDepartmentId: null,
            subDepartmentName: null,
            positionId: "p1",
            positionName: "Operator",
            days: 4,
          },
        ],
        subtotal: 4,
      },
    ],
    totalDays: 4,
  },
  excludedDays: null,
};

const call = (id: string = ID) =>
  GET(new Request(`http://localhost/dashboard/billings/${id}/export`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.mocked(getBilling).mockClear();
  loaded.billing = issued;
});

describe("GET /dashboard/billings/[id]/export", () => {
  it("answers with an xlsx attachment named for the number, never cached", async () => {
    const response = await call();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="billing-bl-jkt-202611-0001.xlsx"',
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getBilling).toHaveBeenCalledWith(ACCESS, ID);
  });

  it("returns a workbook with the billing's period and total", async () => {
    const response = await call();
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as ArrayBuffer);

    const sheet = workbook.getWorksheet("Billing")!;
    const texts: unknown[] = [];

    sheet.eachRow((row) => texts.push(...(row.values as unknown[])));

    expect(texts).toContain("1 Nov 2026 to 30 Nov 2026");
    expect(sheet.getRow(sheet.rowCount).getCell(5).value).toBe(4);
  });

  it("gives a 404 for a Draft", async () => {
    loaded.billing = { ...issued, status: "draft", number: null };

    await expect(call()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("gives a 404 for a Void", async () => {
    loaded.billing = { ...issued, status: "void" };

    await expect(call()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("gives a 404 for an issued billing without a number", async () => {
    loaded.billing = { ...issued, number: null };

    await expect(call()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("gives a 404 for a missing or out-of-scope billing", async () => {
    loaded.billing = null;

    await expect(call()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("gives a 404 for a malformed id, before reading anything", async () => {
    await expect(call("abc")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getBilling).not.toHaveBeenCalled();
  });
});
