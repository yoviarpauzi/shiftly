import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../database/schema/auth-schema";

const db = drizzle(new Pool({ connectionString: process.env.DB_URL }), {
  schema,
});

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: "http://localhost:3000/",
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      siteId: {
        type: "string",
        required: false,
        input: false,
        references: { model: "site", field: "id", onDelete: "restrict" },
      },
      locationId: {
        type: "string",
        required: false,
        input: false,
        references: { model: "location", field: "id", onDelete: "restrict" },
      },
    },
  },
  plugins: [
    admin({
      defaultRole: "admin_site",
      adminRoles: ["superadmin"],
      roles: {
        superadmin: adminAc,
        ho: userAc,
        admin_site: userAc,
      },
    }),
  ],
});
