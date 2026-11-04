import { isNull, relations, sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { location } from "./location-schema";

export const shift = pgTable(
  "shift",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    // The rule engine orders shifts by this value, so it is unique within a location.
    order: integer("order").notNull(),
    name: text("name").notNull(),
    // A shift whose end is earlier than its start crosses midnight.
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("shift_locationId_order_active_unique")
      .on(table.locationId, table.order)
      .where(isNull(table.deletedAt)),
    uniqueIndex("shift_locationId_lowerName_active_unique")
      .on(table.locationId, sql`lower(${table.name})`)
      .where(isNull(table.deletedAt)),
  ],
);

export const shiftRelations = relations(shift, ({ one }) => ({
  location: one(location, {
    fields: [shift.locationId],
    references: [location.id],
  }),
}));
