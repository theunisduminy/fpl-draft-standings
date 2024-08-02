import { NextResponse } from 'next/server';
import { Matches } from '@/interfaces/players';

async function fetchData(): Promise<{ matches: Matches[] }> {
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
