/**
 * Loads local environment variables for the Node scripts in this folder.
 *
 * Next.js reads .env.local automatically; plain `node` does not, and dotenv's default
 * entrypoint only looks at `.env`. Import this first from any script that needs
 * DATABASE_URL or the test-account credentials.
 *
 * Precedence: a variable already set in the real environment (e.g. in CI) always wins;
 * then .env.local; then .env.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const file of ['.env.local', '.env']) {
  const path = join(root, file);
  if (existsSync(path)) dotenv.config({ path, override: false });
}
