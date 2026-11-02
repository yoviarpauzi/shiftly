import { isNull, relations, sql } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { location } from "./location-schema";
import { position } from "./position-schema";
import { site } from "./site-schema";

export const worker = pgTable(
  "worker",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: text("employee_id").notNull(),
    name: text("name").notNull(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("worker_lowerEmployeeId_active_unique")
      .on(sql`lower(${table.employeeId})`)
      .where(isNull(table.deletedAt)),
    index("worker_siteId_idx").on(table.siteId),
    index("worker_locationId_idx").on(table.locationId),
  ],
);

// Many to many between worker and position. A row is removed when the assignment is removed.
export const workerPosition = pgTable(
  "worker_position",
  {
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => position.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.workerId, table.positionId] }),
    index("worker_position_positionId_idx").on(table.positionId),
  ],
);

export const workerRelations = relations(worker, ({ one, many }) => ({
  site: one(site, { fields: [worker.siteId], references: [site.id] }),
  location: one(location, { fields: [worker.locationId], references: [location.id] }),
  workerPositions: many(workerPosition),
}));

export const workerPositionRelations = relations(workerPosition, ({ one }) => ({
  worker: one(worker, { fields: [workerPosition.workerId], references: [worker.id] }),
  position: one(position, { fields: [workerPosition.positionId], references: [position.id] }),
}));
