import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import * as schema from "../database/schema/auth-schema";
import { db } from "./db";

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
      },
      locationId: {
        type: "string",
        required: false,
        input: false,
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
