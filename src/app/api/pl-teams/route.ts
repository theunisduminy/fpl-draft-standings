import { NextResponse } from 'next/server';

import { getPremierLeagueTeams } from '@/utils/pl-teams';

/** The 20 Premier League clubs, lifted out of the classic-FPL static dataset. */
export const GET = async () => {
  try {
    return NextResponse.json(await getPremierLeagueTeams());
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
