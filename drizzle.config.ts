import { defineConfig } from "drizzle-kit";

process.loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./database/schema/*.ts",
  out: "./database/migration",
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    // Without this, drizzle-kit turns SSL on, and the compose Postgres has none. The app connects
    // the same way in lib/db.ts.
    ssl: false,
  },
});
