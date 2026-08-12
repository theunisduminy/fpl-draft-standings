import { NextResponse } from 'next/server';
import { GameWeekStatus } from '@/interfaces/match';
import { fplApi } from '@/utils/fpl-api';

/**
 * The draft game's per-gameweek processing status.
 *
 * Between seasons the upstream endpoint answers 404 with the bare string
 * "Game not started" rather than `{ status: [...] }`, so a 404 is reported as
 * "no gameweek yet" (`null`) instead of an error.
 */
async function fetchCurrentStatus(): Promise<GameWeekStatus | null> {
  const res = await fetch(fplApi.eventStatus(), {
    next: {
      revalidate: 3600, // 1 hour
    },
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Event status request failed with ${res.status}`);
  }

  const body = await res.json();
  const status: GameWeekStatus[] = Array.isArray(body?.status)
    ? body.status
    : [];

  return status[0] ?? null;
}

export const GET = async () => {
  try {
    return NextResponse.json(await fetchCurrentStatus());
  } catch (error) {
    console.error('Error in current-event API:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch current event',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};
