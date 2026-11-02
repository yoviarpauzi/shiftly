import { isNull, sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const site = pgTable(
  "site",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    code: text("code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("site_name_lower_active_unique")
      .on(sql`lower(${table.name})`)
      .where(isNull(table.deletedAt)),
    uniqueIndex("site_code_lower_active_unique")
      .on(sql`lower(${table.code})`)
      .where(isNull(table.deletedAt)),
  ],
);
