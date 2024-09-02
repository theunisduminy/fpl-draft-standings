import { Match } from '@/interfaces/match';
import { F1PlayerDetails } from '@/interfaces/standings';

export function formatMatches(matches: Match[], standings: F1PlayerDetails[]) {
  return matches.map((match) => {
    const homePlayer = standings.find((player) => player.id === match.league_entry_1);
    const awayPlayer = standings.find((player) => player.id === match.league_entry_2);

    return {
      home_player_name: homePlayer ? `${homePlayer.player_name}` : 'Unknown',
      away_player_name: awayPlayer ? `${awayPlayer.player_name}` : 'Unknown',
      home_player_points: match.league_entry_1_points,
      away_player_points: match.league_entry_2_points,
      event: match.event,
      home_wins: match.league_entry_1_points > match.league_entry_2_points,
      away_wins: match.league_entry_2_points > match.league_entry_1_points,
    };
  });
}
