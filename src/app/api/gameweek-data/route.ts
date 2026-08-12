import { NextResponse } from 'next/server';
import { getGameweekData } from '@/utils/gameweek-data';

export const dynamic = 'force-dynamic';

export const GET = async () => {
  try {
    const data = await getGameweekData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in gameweek-data API:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch gameweek data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};
