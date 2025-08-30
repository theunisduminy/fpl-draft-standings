import { NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Simplified rumbler API - delegates to centralized gameweek-data endpoint
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

    // Return rumbler data for backwards compatibility
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
