import { NextResponse } from 'next/server';
import { Match } from '@/interfaces/match';

async function fetchData(): Promise<{ matches: Match[] }> {
  try {
    const res = await fetch(
      'https://draft.premierleague.com/api/league/21646/details',
      {
        next: {
          revalidate: 3600, // 1 hour
        },
      },
    );
    return await res.json();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export const GET = async (req: Request, res: Response) => {
  try {
    const { matches } = await fetchData();
    return NextResponse.json(matches);
  } catch (error) {
    return NextResponse.json({ message: error }, { status: 500 });
  }
};
