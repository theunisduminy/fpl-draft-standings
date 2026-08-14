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
/**
 * Which database `pnpm db:*` talks to.
 *
 * Default is the same precedence as `src/server/db/client.ts`: the sandbox
 * branch wins when it is set. They must agree — migrating one database while
 * the app reads another is how you get a schema the running code cannot query.
 *
 * `DRIZZLE_TARGET=prod` overrides that and is the **only** way to reach
 * production, because `loadEnvFile` above re-applies `.env.local` inside this
 * process: unsetting `NEON_CONNECTION_STRING_SANDBOX` in your shell cannot
 * reach it, so `pnpm db:migrate` would migrate the sandbox again and report
 * "migrations applied successfully" having done nothing to prod. That silent
 * success cost a real debugging session; hence an explicit switch rather than
 * a subtraction. Use `pnpm db:migrate:prod`.
 */
function connectionString(): string {
  const toProd = process.env.DRIZZLE_TARGET === 'prod';

  const url = toProd
    ? process.env.NEON_CONNECTION_STRING_PROD
    : process.env.NEON_CONNECTION_STRING_SANDBOX ||
      process.env.NEON_CONNECTION_STRING_PROD;

  if (!url) {
    throw new Error(
      toProd
        ? 'DRIZZLE_TARGET=prod, but NEON_CONNECTION_STRING_PROD is not set.'
        : 'No connection string. Set NEON_CONNECTION_STRING_PROD in .env.local.',
    );
  }

  // Say which one out loud. A migration that names its target cannot be the
  // kind you only discover went to the wrong database afterwards.
  console.log(
    `drizzle-kit → ${toProd ? 'PRODUCTION' : 'sandbox (default)'}: ${redact(url)}`,
  );

  return url;
}

/** Enough of the host to recognise, none of the credential. */
function redact(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);

    return `${hostname}${pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['public'],
  dbCredentials: { url: connectionString() },
  strict: true,
  verbose: true,
});
