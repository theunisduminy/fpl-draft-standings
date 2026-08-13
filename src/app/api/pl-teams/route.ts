import { NextResponse } from 'next/server';
import { fplApi } from '@/utils/fpl-api';

/** The 20 Premier League clubs, lifted out of the classic-FPL static dataset. */
export const GET = async () => {
  try {
    const res = await fetch(fplApi.bootstrapStatic(), {
      next: {
        revalidate: 3600, // 1 hour
      },
    });

    if (!res.ok) {
      throw new Error(`Bootstrap-static request failed with ${res.status}`);
    }

    const { teams } = await res.json();
    return NextResponse.json(teams);
  } catch (error) {
    console.error('Error in pl-teams API:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Premier League teams',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};
