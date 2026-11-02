import "server-only";
import { eq } from "drizzle-orm";
import { workerPosition } from "@/database/schema/worker-schema";
import type { db } from "@/lib/db";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Lives outside actions.ts because every async export of a "use server" file becomes a callable endpoint.
export async function replacePositions(
  tx: Transaction,
  workerId: string,
  positionIds: string[],
) {
  await tx.delete(workerPosition).where(eq(workerPosition.workerId, workerId));

  if (positionIds.length > 0) {
    await tx
      .insert(workerPosition)
      .values(positionIds.map((positionId) => ({ workerId, positionId })));
  }
}
