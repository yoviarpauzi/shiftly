import { isNull, relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { location } from "./location-schema";

export const department = pgTable(
  "department",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("department_locationId_lowerName_active_unique")
      .on(table.locationId, sql`lower(${table.name})`)
      .where(isNull(table.deletedAt)),
  ],
);

export const subDepartment = pgTable(
  "sub_department",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => department.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("sub_department_departmentId_lowerName_active_unique")
      .on(table.departmentId, sql`lower(${table.name})`)
      .where(isNull(table.deletedAt)),
  ],
);

export const departmentRelations = relations(department, ({ one, many }) => ({
  location: one(location, {
    fields: [department.locationId],
    references: [location.id],
  }),
  subDepartments: many(subDepartment),
}));

export const subDepartmentRelations = relations(subDepartment, ({ one }) => ({
  department: one(department, {
    fields: [subDepartment.departmentId],
    references: [department.id],
  }),
}));
