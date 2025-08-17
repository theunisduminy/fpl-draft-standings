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
  total_points: number;
  f1_score: number;
  f1_ranking: number;
  total_wins: number;
  position_placed: {
    [key: string]: number;
  };
}
