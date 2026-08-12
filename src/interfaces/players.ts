// Legacy Player interface - kept for backwards compatibility
export interface Player {
  player_first_name: string;
  player_last_name: string;
  id: number;
  entry_name: string;
}

// Main PlayerDetails interface - standardized structure
export interface PlayerDetails {
  id: number;
  player_name: string;
  player_surname: string;
  team_name: string;
  total_points: number;
  f1_score: number;
  f1_ranking: number;
  total_wins: number;
  position_placed: {
    first: number;
    second: number;
    third: number;
    fourth: number;
    fifth: number;
    sixth: number;
    seventh: number;
    eighth: number;
  };
}

// Gameweek performance data
export interface GameweekPerformance {
  event: number;
  league_entry: number;
  event_total: number;
  rank: number;
  finished: boolean;
}

// Complete gameweek data response
export interface GameweekDataResponse {
  players: PlayerDetails[];
  gameweekPerformances: GameweekPerformance[];
  currentGameweek: number;
  completedGameweeks: number[];
  rumblerData: RumblerGameweekData[];
}

// Rumbler data structure
export interface RumblerGameweekData {
  gameweek: number;
  points: number;
  entry_names: string[];
  player_names: string[];
}
