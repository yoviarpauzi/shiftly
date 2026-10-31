import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/database/schema/auth-schema";

export const db = drizzle(new Pool({ connectionString: process.env.DB_URL }), {
  schema,
});
