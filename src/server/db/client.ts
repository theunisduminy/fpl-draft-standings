import 'server-only';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

/**
 * The only file that constructs a database client.
 *
 * Everything else goes through the domain modules in `src/server/data/**`.
 * The connection string is server-only and must never be `NEXT_PUBLIC_`.
 */

/**
 * `NEON_CONNECTION_STRING_SANDBOX` wins when it is set.
 *
 * It points at a Neon branch holding seeded gameweeks, so the app can be built
 * against a season that has actually been played while the real one is still
 * pre-season. Set it in `.env.local` only — production has just the prod
 * string, so the override is inert there.
 *
 * Precedence is this way round on purpose: a sandbox that has to be opted into
 * *and* have prod removed would be forgotten, and the failure mode of
 * accidentally reading the sandbox locally is a wrong-looking table, while the
 * reverse is writing test data into the real season.
 */
const SANDBOX_VAR = 'NEON_CONNECTION_STRING_SANDBOX';
const PROD_VAR = 'NEON_CONNECTION_STRING_PROD';

function connectionString(): string {
  const url = process.env[SANDBOX_VAR] || process.env[PROD_VAR];

  if (!url) {
    throw new Error(
      `${PROD_VAR} is not set. Copy it from your Neon project's ` +
        'connection details into .env.local.',
    );
  }

  return url;
}

/**
 * Created lazily so a missing connection string fails the request that needs
 * the database, not `next build` — the same rule `getLeagueId()` follows.
 */
let client: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!client) {
    client = drizzle(neon(connectionString()), { schema });
  }
  return client;
}

export { schema };
