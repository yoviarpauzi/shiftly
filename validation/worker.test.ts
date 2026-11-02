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
};

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
});
