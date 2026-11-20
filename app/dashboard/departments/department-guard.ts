import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { departmentAccessFor } from "./department-access";

// Department pages and actions: HO and admin site. Other roles get notFound().
export async function requireDepartmentManager() {
  const access = departmentAccessFor(await requireUser());

  if (!access) {
    notFound();
  }

  return access;
}
