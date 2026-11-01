import { isNull, relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { site } from "./site-schema";

export const position = pgTable(
  "position",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("position_siteId_lowerName_active_unique")
      .on(table.siteId, sql`lower(${table.name})`)
      .where(isNull(table.deletedAt)),
  ],
);

export const positionRelations = relations(position, ({ one }) => ({
  site: one(site, {
    fields: [position.siteId],
    references: [site.id],
  }),
}));
