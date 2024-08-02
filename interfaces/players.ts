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

export interface Matches {
  event: number;
  finished: boolean;
  league_entry_1: number | null;
  league_entry_1_points: number | null;
  league_entry_2: number | null;
  league_entry_2_points: number | null;
  started: boolean;
  winning_league_entry: null;
  winning_method: null;
}

export interface GameWeekStatus {
  bonus_added: boolean;
  date: string;
  event: number;
  leagues_updated: boolean;
  points: string;
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
