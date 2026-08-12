import { auth } from '@/server/auth/server';

/**
 * Neon Auth's callback surface — sign-in, sign-out, OAuth callbacks, session.
 *
 * This is a sanctioned exception to "no first-party API routes for data": it
 * serves the auth handshake, not application data.
 */
export const { GET, POST } = auth.handler();
