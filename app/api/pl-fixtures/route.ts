import { NextResponse } from 'next/server';

async function fetchData() {
  try {
    const res = await fetch('https://fantasy.premierleague.com/api/fixtures');
    return await res.json();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export const GET = async (req: Request, res: Response) => {
  try {
    const fixtures = await fetchData();
    return NextResponse.json(fixtures);
  } catch (error) {
    return NextResponse.json({ message: error }, { status: 500 });
  }
};
