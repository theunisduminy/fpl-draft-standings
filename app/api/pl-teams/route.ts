import { NextResponse } from 'next/server';

async function fetchData() {
  try {
    const res = await fetch(
      'https://fantasy.premierleague.com/api/bootstrap-static',
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
    const { teams } = await fetchData();
    return NextResponse.json(teams);
  } catch (error) {
    return NextResponse.json({ message: error }, { status: 500 });
  }
};
