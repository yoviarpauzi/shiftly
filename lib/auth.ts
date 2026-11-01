import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { eq } from "drizzle-orm";
import * as schema from "../database/schema/auth-schema";
import { db } from "./db";
import { userScopeIsActive } from "./scope-status";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: "http://localhost:3000/",
  emailAndPassword: { enabled: true },
  databaseHooks: {
    session: {
      create: {
        // A user whose site or location was deleted cannot start a session.
        before: async (session) => {
          const [account] = await db
            .select({
              id: schema.user.id,
              role: schema.user.role,
              siteId: schema.user.siteId,
              locationId: schema.user.locationId,
            })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId));

          if (account && !(await userScopeIsActive(account))) {
            throw new APIError("FORBIDDEN", {
              message: "Your site or location is no longer active",
            });
          }
        },
      },
    },
  },
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
