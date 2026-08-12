import { NextResponse } from 'next/server';
import { fplApi } from '@/utils/fpl-api';

/** All 380 Premier League fixtures for the season. */
export const GET = async () => {
  try {
    const res = await fetch(fplApi.fixtures(), {
      next: {
        revalidate: 3600, // 1 hour
      },
    });

    if (!res.ok) {
      throw new Error(`Fixtures request failed with ${res.status}`);
    }

    return NextResponse.json(await res.json());
  } catch (error) {
    console.error('Error in pl-fixtures API:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Premier League fixtures',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};
