import { StandingsData } from '@/interfaces/standings';
import { PlayerDetails } from '@/interfaces/players';
import { rankingPlayer } from './rankingPlayer';

export function sortPlayersObject(
  standingsData: StandingsData[],
  playerDetails: PlayerDetails[],
): PlayerDetails[] {
  const playerMap: { [id: number]: PlayerDetails } = {};

  playerDetails.forEach((player) => {
    playerMap[player.id] = player;
  });

  standingsData.forEach((rank) => {
    const thePlayer = playerMap[rank.league_entry];
    if (thePlayer) {
      thePlayer.head_to_head_rank = standingsData
        .filter((s) => s.total === rank.total)
        .sort((a, b) => b.rank - a.rank)[0].rank_sort;
      thePlayer.head_to_head_points = rank.total;
      // In Classic format, use 'total' field for total points (no points_for field)
      thePlayer.total_points = rank.total || rank.points_for || 0;
      thePlayer.points_against = rank.points_against || 0;
      thePlayer.head_to_head_total = rank.total;
    } else {
      throw new Error('Player not found');
    }
  });

  return rankingPlayer(playerDetails);
}
