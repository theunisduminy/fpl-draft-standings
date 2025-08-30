import { NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Simplified standings API - delegates to centralized gameweek-data endpoint
export const GET = async (req: Request) => {
  try {
    // Fetch data from our centralized endpoint
    const baseUrl = new URL(req.url).origin;
    const response = await fetch(`${baseUrl}/api/gameweek-data`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch gameweek data');
    }

    const data = await response.json();

    // Return just the players array for backwards compatibility
    return NextResponse.json(data.players);
  } catch (error) {
    console.error('Error in standings API:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch standings data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};
