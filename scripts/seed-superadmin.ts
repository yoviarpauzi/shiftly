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
    const { user } = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    await db
      .update(schema.user)
      .set({ role: "superadmin" })
      .where(eq(schema.user.id, user.id));

    // signUpEmail signs the new user in. The seed does not need that session.
    await db.delete(schema.session).where(eq(schema.session.userId, user.id));

    console.log(`Superadmin ${email} created.`);
  }
} finally {
  await pool.end();
  // lib/auth.ts keeps its own pool open, so exit explicitly.
  process.exit(0);
}
