#!/usr/bin/env node
/**
 * Applies every SQL file in db/migrations, in filename order, over DATABASE_URL.
 *
 * Migrations are written to be idempotent, so this is safe to re-run; there is no
 * migration-state table to drift out of sync.
 *
 * After applying, it always issues `NOTIFY pgrst, 'reload schema'`. The Neon Data API
 * (PostgREST) keeps its own cache of the schema, so a table that Postgres can see is
 * still invisible over HTTP -- requests fail with `relation "public.contacts" does not
 * exist` -- until that cache is reloaded. This step is easy to forget and the failure
 * looks like a broken app rather than a stale cache, so the script does it for you.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import './load-env.mjs';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.error(`No .sql files found in ${migrationsDir}`);
    process.exit(1);
  }

  for (const file of files) {
    process.stdout.write(`applying ${file} ... `);
    await client.query(await readFile(join(migrationsDir, file), 'utf8'));
    console.log('ok');
  }

  // Belt and braces: the migration files end with this too, but re-issuing it here means
  // a hand-written migration that forgets it still leaves the Data API consistent.
  await client.query("notify pgrst, 'reload schema'");
  console.log("reloaded Data API schema cache (NOTIFY pgrst, 'reload schema')");

  console.log(`\n${files.length} migration(s) applied successfully.`);
} finally {
  await client.end();
}
