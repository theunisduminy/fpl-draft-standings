export interface StandingsData {
  league_entry: number;
  total: number;
  rank: number;
  rank_sort: number;
  points_for: number;
  points_against: number;
}

export interface F1PlayerDetails {
  player_name: string;
  player_surname: string;
  id: number;
  team_name: string;
  f1_score: number;
  f1_ranking: number;
  total_wins: number;
}
