import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { workerAccessFor } from "./worker-access";

// Worker pages and actions: HO and admin site. Other roles get notFound().
export async function requireWorkerManager() {
  const access = workerAccessFor(await requireUser());

  if (!access) {
    notFound();
  }

  return access;
}
