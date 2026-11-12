import type { EngineHistory, EngineLine } from "@/types/rosters";

// How well a line fits where a worker worked last: 2 for the same department and the same
// sub-department (neither counts as the same), 1 for the same department only, 0 for anything else
// or no previous placement. A department belongs to one location, so a worker who moved to another
// location never matches a line of this one.
export function placementTier(
  previous: EngineHistory["lastPlacement"],
  line: Pick<EngineLine, "departmentId" | "subDepartmentId">,
): 0 | 1 | 2 {
  if (!previous || previous.departmentId !== line.departmentId) {
    return 0;
  }

  return previous.subDepartmentId === line.subDepartmentId ? 2 : 1;
}
