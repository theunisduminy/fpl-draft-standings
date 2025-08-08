import { Player } from '@/interfaces/players';
import { Match } from '@/interfaces/match';
import { StandingsData } from '@/interfaces/standings';
// import standing from '@/data/league-details.json';

export async function fetchData(): Promise<{
  matches: Match[];
  league_entries: Player[];
  standings: StandingsData[];
}> {
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
