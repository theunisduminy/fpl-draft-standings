import { loadEnvFile } from 'node:process';

import { defineConfig } from 'drizzle-kit';

// drizzle-kit is a plain CLI and does not read .env.local the way Next does.
// Load it here so `pnpm db:*` works without exporting anything by hand — and
// so the connection string never has to survive a trip through the shell.
try {
  loadEnvFile('.env.local');
} catch {
  // Fine: the variable may already be set in the environment (e.g. in CI).
}

/**
 * Migrations cover the `public` schema only. `neon_auth` is owned and migrated
 * by Neon Auth — drizzle-kit must never be pointed at it, or it will try to
 * "correct" tables it does not own.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['public'],
  dbCredentials: {
    // Same precedence as `src/server/db/client.ts`: the sandbox branch wins
    // when it is set. They must agree — migrating one database while the app
    // reads another is how you get a schema the running code cannot query.
    url: (process.env.NEON_CONNECTION_STRING_SANDBOX ||
      process.env.NEON_CONNECTION_STRING_PROD)!,
  },
  strict: true,
  verbose: true,
});
