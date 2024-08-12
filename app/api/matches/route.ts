import { NextResponse } from 'next/server';
import { Match } from '@/interfaces/match';
// import standing from '@/data/league-details.json';

async function fetchData(): Promise<{ matches: Match[] }> {
  try {
    const res = await fetch('https://draft.premierleague.com/api/league/5525/details');
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
