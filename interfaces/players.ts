export interface Player {
  player_first_name: string;
  player_last_name: string;
  id: number;
  entry_name: string;
}

// interfaces/players.ts
export interface PlayerDetails {
  player_name: string;
  player_surname: string;
  id: number;
  team_name: string;
  head_to_head_rank: number;
  head_to_head_points: number;
  total_points: number;
  points_against: number;
  head_to_head_total: number;
  total_points_rank: number;
  f1_score: number;
  f1_ranking: number;
  total_wins: number;
  total_losses: number;
  total_draws: number;
  position_placed: {
    [key: string]: number;
  };
}
