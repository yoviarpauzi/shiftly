import { forbidden } from "next/navigation";

// The proxy rewrites requests that fail a superadmin-only check to this route.
// It sits outside the dashboard layout, so the 403 is sent before anything streams.
// No connection() or Suspense here: forbidden() runs during prerender, so the build
// stores a 403 shell and serves it with that status. connection() postpones the page,
// and the response then streams with 200.
export default function Page() {
  forbidden();
}
