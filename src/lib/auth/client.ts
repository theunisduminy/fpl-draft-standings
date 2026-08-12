'use client';

import { createAuthClient } from '@neondatabase/auth/next';

/**
 * Browser-side auth client. Handles sign-in, sign-out and session reads.
 *
 * This is the one sanctioned client-side auth import — it talks to
 * `/api/auth/**`, never to the database. Everything under `@/server/**` stays
 * off-limits to client components.
 */
export const authClient = createAuthClient();
