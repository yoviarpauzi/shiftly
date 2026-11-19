import "server-only";
import { sql } from "drizzle-orm";
import type { Transaction } from "@/types/requests";

// Issues the next sequence for a site and month in one statement, so two issues at once never get the same number.
export async function nextBillingSequence(
  tx: Transaction,
  siteId: string,
  period: string,
): Promise<number> {
  const result = await tx.execute<{ last_value: number }>(sql`
    insert into billing_counter (site_id, period, last_value)
    values (${siteId}, ${period}, 1)
    on conflict (site_id, period)
    do update set last_value = billing_counter.last_value + 1
    returning last_value
  `);

  return result.rows[0].last_value;
}
