import type { LeagueEntryId } from './fpl';

export interface StandingsData {
  league_entry: LeagueEntryId;
  total: number;
  rank: number;
  rank_sort: number;
  points_for: number;
  points_against: number;
}

export interface F1PlayerDetails {
  player_name: string;
  player_surname: string;
  id: LeagueEntryId;
  team_name: string;
  f1_score: number;
  f1_ranking: number;
  total_wins: number;
}
