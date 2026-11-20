import "server-only";
import { sql } from "drizzle-orm";
import type { Transaction } from "@/types/requests";

export type { Transaction };

// Issues the next sequence for a month in one statement, so two saves at once never get the same number.
export async function nextPoSequence(tx: Transaction, period: string): Promise<number> {
  const result = await tx.execute<{ last_value: number }>(sql`
    insert into po_counter (period, last_value)
    values (${period}, 1)
    on conflict (period)
    do update set last_value = po_counter.last_value + 1
    returning last_value
  `);

  return result.rows[0].last_value;
}
