import { forbidden } from "next/navigation";
import { connection } from "next/server";

// The proxy rewrites requests that fail a superadmin-only check to this route.
// It sits outside the dashboard layout, so the 403 is sent before anything streams.
export default async function Page() {
  await connection();
  forbidden();
}
