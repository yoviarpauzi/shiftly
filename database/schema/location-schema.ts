import { isNull, relations } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { site } from "./site-schema";

export const location = pgTable(
  "location",
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
    uniqueIndex("location_siteId_name_active_unique")
      .on(table.siteId, table.name)
      .where(isNull(table.deletedAt)),
  ],
);

export const locationRelations = relations(location, ({ one }) => ({
  site: one(site, {
    fields: [location.siteId],
    references: [site.id],
  }),
}));

export const siteRelations = relations(site, ({ many }) => ({
  locations: many(location),
}));
