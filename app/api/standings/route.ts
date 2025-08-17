import { NextResponse } from 'next/server';

// Simplified standings API built from first principles
export const GET = async (req: Request, res: Response) => {
  try {
    // 1. Get raw FPL data directly
    const fplRes = await fetch(
      'https://draft.premierleague.com/api/league/75224/details',
      {
        cache: 'no-store',
      },
    );
    const fplData = await fplRes.json();

    const { league_entries, standings } = fplData;

    // 2. Build standings directly from current gameweek performance
    const results = standings.map((standing: any) => {
      const player = league_entries.find(
        (entry: any) => entry.id === standing.league_entry,
      );

      // Calculate F1 points directly from current rank
      const rankPoints = [20, 15, 12, 10, 8, 6, 4, 2];
      const f1Points = rankPoints[standing.rank - 1] || 0;

      return {
        id: standing.league_entry,
        player_name: player?.player_first_name || 'Unknown',
        player_surname: player?.player_last_name || 'Unknown',
        team_name: player?.entry_name || 'Unknown',
        total_points: standing.total,
        f1_score: f1Points,
        f1_ranking: 0, // Will be set after sorting
        total_wins: standing.rank === 1 ? 1 : 0,
        position_placed: {
          first: standing.rank === 1 ? 1 : 0,
          second: standing.rank === 2 ? 1 : 0,
          third: standing.rank === 3 ? 1 : 0,
          fourth: standing.rank === 4 ? 1 : 0,
          fifth: standing.rank === 5 ? 1 : 0,
          sixth: standing.rank === 6 ? 1 : 0,
          seventh: standing.rank === 7 ? 1 : 0,
          eighth: standing.rank === 8 ? 1 : 0,
        },
      };
    });

    // 3. Sort by F1 score and assign final rankings
    results.sort(
      (a: Record<string, any>, b: Record<string, any>) =>
        b.f1_score - a.f1_score,
    );
    results.forEach((player: Record<string, any>, index: number) => {
      player.f1_ranking = index + 1;
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in standings API:', error);
    return NextResponse.json({ message: error }, { status: 500 });
  }
};
