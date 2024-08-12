export interface Match {
  event: number;
  finished: boolean;
  league_entry_1: number;
  league_entry_1_points: number;
  league_entry_2: number;
  league_entry_2_points: number;
  started: boolean;
}

export interface PlayerScores {
  rank_points: number;
  win_points: number;
  total: number;
  total_wins: number;
  total_losses: number;
  total_draws: number;
}

export interface GameWeekStatus {
  bonus_added: boolean;
  date: string;
  event: number;
  leagues_updated: boolean;
  points: string;
}
