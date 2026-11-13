import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../database/schema/auth-schema";
import { auth } from "../lib/auth";

const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_PASSWORD;
const name = process.env.SUPERADMIN_NAME;

if (!email || !password || !name) {
  throw new Error(
    "SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, and SUPERADMIN_NAME must be set in .env",
  );
}

const pool = new Pool({ connectionString: process.env.DB_URL });
const db = drizzle(pool, { schema });

try {
  const existing = await db.query.user.findFirst({
    where: eq(schema.user.email, email),
  });

  if (existing) {
    await db
      .update(schema.user)
      .set({ role: "superadmin" })
      .where(eq(schema.user.id, existing.id));
    console.log(`User ${email} already exists. Role set to superadmin.`);
  } else {
    // createUser sets the role directly and starts no session. signUpEmail would sign the new
    // user in as admin_site, which has no location yet, so the session hook would refuse it.
    // Called without headers, it runs as the server and needs no admin session.
    await auth.api.createUser({
      body: { email, password, name, role: "superadmin" },
    });

    console.log(`Superadmin ${email} created.`);
  }
} catch (error) {
  // Exiting from finally would otherwise swallow the error and report success.
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
  // lib/auth.ts keeps its own pool open, so exit explicitly.
  process.exit();
}
