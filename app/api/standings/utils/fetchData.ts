import { Player } from '../../../../interfaces/players';
import { Match } from '../../../../interfaces/match';
import { StandingsData } from '../../../../interfaces/standings';
import standing from '@/data/league-details.json';

export async function fetchData(): Promise<{
  matches: Match[];
  league_entries: Player[];
  standings: StandingsData[];
}> {
  try {
    if (process.env.NODE_ENV === 'development') {
      const res = standing;
      return await res;
    } else {
      const res = await fetch('https://draft.premierleague.com/api/league/5525/details');
      return await res.json();
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}
