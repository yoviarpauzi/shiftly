import { describe, expect, it } from "vitest";
import { workerSchema } from "./worker";

const SITE = "11111111-1111-4111-8111-111111111111";
const LOCATION = "22222222-2222-4222-8222-222222222222";
const POSITION = "33333333-3333-4333-8333-333333333333";

const valid = {
  employeeId: "EMP-001",
  name: "Budi",
  siteId: SITE,
  locationId: LOCATION,
  positionIds: [POSITION],
  endContract: "2026-12-31",
  workDays: "default",
};

const REQUIRED = "End of contract is required";
const NOT_A_DATE = "End of contract must be a real date like 2026-12-31";

function endContractErrors(input: unknown) {
  const parsed = workerSchema.safeParse(input);

  expect(parsed.success).toBe(false);

  return parsed.error!.issues.filter((issue) => issue.path[0] === "endContract");
}

describe("workerSchema", () => {
  it("accepts a complete worker", () => {
    expect(workerSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the employee ID and the name", () => {
    const parsed = workerSchema.parse({ ...valid, employeeId: "  EMP-001 ", name: " Budi " });

    expect(parsed.employeeId).toBe("EMP-001");
    expect(parsed.name).toBe("Budi");
  });

  it("rejects a blank employee ID", () => {
    const parsed = workerSchema.safeParse({ ...valid, employeeId: "   " });

    expect(parsed.success).toBe(false);
  });

  it("rejects a blank name", () => {
    expect(workerSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejects a site or location that is not a uuid", () => {
    expect(workerSchema.safeParse({ ...valid, siteId: "x" }).success).toBe(false);
    expect(workerSchema.safeParse({ ...valid, locationId: "" }).success).toBe(false);
  });

  it("allows a worker without positions", () => {
    expect(workerSchema.safeParse({ ...valid, positionIds: [] }).success).toBe(true);
  });

  it("drops repeated position ids", () => {
    const parsed = workerSchema.parse({ ...valid, positionIds: [POSITION, POSITION] });

    expect(parsed.positionIds).toEqual([POSITION]);
  });

  it("accepts an end of contract and trims it", () => {
    expect(workerSchema.parse(valid).endContract).toBe("2026-12-31");
    expect(workerSchema.parse({ ...valid, endContract: " 2026-12-31 " }).endContract).toBe(
      "2026-12-31",
    );
  });

  it("requires an end of contract", () => {
    const missing: Partial<typeof valid> = { ...valid };
    delete missing.endContract;

    for (const input of [missing, { ...valid, endContract: "" }, { ...valid, endContract: "   " }]) {
      const issues = endContractErrors(input);

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe(REQUIRED);
      expect(issues[0].path).toEqual(["endContract"]);
    }
  });

  it("rejects an end of contract that is not a real YYYY-MM-DD date", () => {
    for (const endContract of ["2026-02-30", "11/02/2026", "2026-1-5"]) {
      const issues = endContractErrors({ ...valid, endContract });

      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe(NOT_A_DATE);
      expect(issues[0].path).toEqual(["endContract"]);
    }
  });

  it("requires the working-days choice, so an update cannot clear the override by omission", () => {
    const { workDays: omitted, ...withoutWorkDays } = valid;
    const parsed = workerSchema.safeParse(withoutWorkDays);

    expect(omitted).toBe("default");
    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues).toHaveLength(1);
    expect(parsed.error!.issues[0].message).toBe("Choose working days");
    expect(parsed.error!.issues[0].path).toEqual(["workDays"]);
  });

  it("maps the working-days choice to null, 5 or 7", () => {
    expect(workerSchema.parse({ ...valid, workDays: "default" }).workDays).toBeNull();
    expect(workerSchema.parse({ ...valid, workDays: "5" }).workDays).toBe(5);
    expect(workerSchema.parse({ ...valid, workDays: "7" }).workDays).toBe(7);
  });

  it("rejects any other working-days value", () => {
    for (const workDays of ["6", "", 5]) {
      const parsed = workerSchema.safeParse({ ...valid, workDays });

      expect(parsed.success).toBe(false);
      expect(parsed.error!.issues).toHaveLength(1);
      expect(parsed.error!.issues[0].message).toBe("Choose working days");
      expect(parsed.error!.issues[0].path).toEqual(["workDays"]);
    }
  });
});
