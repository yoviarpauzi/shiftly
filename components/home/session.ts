import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

// Whether the visitor has a session. Everything on the landing page that depends on the visitor
// asks here, so the lookup and its failure handling are in one place. `getCurrentUser` is cached
// for the request, so asking twice costs one lookup.
export async function isSignedIn(): Promise<boolean> {
  try {
    return Boolean(await getCurrentUser());
  } catch (error) {
    // Let Next's own signals (prerender postpone, redirects) pass through. A real failure, such
    // as the database being down, must not turn the whole public page into the error view: the
    // visitor is treated as signed out.
    unstable_rethrow(error);
    return false;
  }
}
