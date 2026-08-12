import { NextResponse } from 'next/server';
import { getGameweekData } from '@/utils/gameweek-data';

export const dynamic = 'force-dynamic';

export const GET = async () => {
  try {
    const data = await getGameweekData();
    return NextResponse.json(data.rumblerData);
  } catch (error) {
    console.error('Error in rumbler API:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch rumbler data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};
