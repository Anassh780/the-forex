import { createClient } from "@libsql/client/web";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";

const databaseUrl = process.env.TURSO_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
const isRemote = databaseUrl?.startsWith("libsql://") || databaseUrl?.startsWith("https://");

if (!isRemote) {
  console.log("[Turso migrate] Skipping: no remote Turso/libSQL database URL is configured.");
  process.exit(0);
}

const migrationsRoot = resolve(process.cwd(), "prisma", "migrations");
if (!existsSync(migrationsRoot)) {
  throw new Error(`[Turso migrate] Missing migrations directory: ${migrationsRoot}`);
}

const client = createClient({ url: databaseUrl, authToken });

async function tableExists(name) {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [name],
  });
  return result.rows.length > 0;
}

try {
  const hasMigrationHistory = await tableExists("__edgeledger_migrations");
  const hasUserTable = await tableExists("User");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "__edgeledger_migrations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  if (!hasMigrationHistory && hasUserTable) {
    console.log("[Turso migrate] Existing app tables detected; recording migrations as already applied.");
    for (const migration of migrations) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO "__edgeledger_migrations" ("id") VALUES (?)',
        args: [migration],
      });
    }
    process.exit(0);
  }

  for (const migration of migrations) {
    const applied = await client.execute({
      sql: 'SELECT "id" FROM "__edgeledger_migrations" WHERE "id" = ?',
      args: [migration],
    });
    if (applied.rows.length) {
      console.log(`[Turso migrate] Skipping already applied migration: ${migration}`);
      continue;
    }

    const sqlPath = join(migrationsRoot, migration, "migration.sql");
    if (!existsSync(sqlPath)) continue;

    console.log(`[Turso migrate] Applying migration: ${migration}`);
    const sql = readFileSync(sqlPath, "utf8");
    await client.executeMultiple(sql);
    await client.execute({
      sql: 'INSERT INTO "__edgeledger_migrations" ("id") VALUES (?)',
      args: [migration],
    });
  }

  console.log("[Turso migrate] Complete.");
} finally {
  client.close();
}
