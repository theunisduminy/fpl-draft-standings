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

const CONNECTION_STRING_VAR = 'NEON_CONNECTION_STRING_PROD';

function connectionString(): string {
  const url = process.env[CONNECTION_STRING_VAR];

  if (!url) {
    throw new Error(
      `${CONNECTION_STRING_VAR} is not set. Copy it from your Neon project's ` +
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
