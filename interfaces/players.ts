export interface Player {
  player_first_name: string;
  player_last_name: string;
  id: number;
  entry_name: string;
}

export interface StandingsData {
  league_entry: number;
  total: number;
  rank: number;
  rank_sort: number;
  points_for: number;
  points_against: number;
}

export interface PlayerDetails {
  player_name: string;
  player_surname: string;
  id: number;
  team_name: string;
  head_to_head_rank?: number;
  head_to_head_points?: number;
  total_points?: number;
  points_against?: number;
  head_to_head_total?: number;
  head_to_head_score?: number;
  total_points_rank?: number;
  total_points_score?: number;
  combined_score?: number;
}
