import { PlayerDetails } from '../../../../interfaces/players';

export function rankingPlayer(playerData: PlayerDetails[]): PlayerDetails[] {
  playerData.sort(
    (a: Record<string, any>, b: Record<string, any>) => a.head_to_head_rank - b.head_to_head_rank,
  );

  playerData.forEach((player: Record<string, any>, index) => {
    player.head_to_head_score = 8 - player.head_to_head_rank;
  });

  playerData.sort(
    (a: Record<string, any>, b: Record<string, any>) => b.total_points - a.total_points,
  );

  playerData.forEach((player: Record<string, any>, index) => {
    player.total_points_rank = index + 1;
    player.total_points_score = 8 - player.total_points_rank + (9 - player.total_points_rank) / 10;
    player.combined_score = player.head_to_head_score + player.total_points_score;
  });

  playerData.sort(
    (a: Record<string, any>, b: Record<string, any>) => b.combined_score - a.combined_score,
  );

  return playerData;
}
