import { NextResponse } from 'next/server';
import { Player, StandingsData, PlayerDetails } from '@/interfaces/players';

interface Match {
  event: number;
  finished: boolean;
  league_entry_1: number;
  league_entry_1_points: number;
  league_entry_2: number;
  league_entry_2_points: number;
  started: boolean;
}

interface PlayerScores {
  rank_points: number;
  win_points: number;
  total: number;
  total_wins: number;
}

interface F1PlayerDetails {
  player_name: string;
  player_surname: string;
  id: number;
  team_name: string;
  f1_score: number;
  f1_ranking: number;
  total_wins: number;
}

async function fetchData(): Promise<{ matches: Match[]; league_entries: Player[] }> {
  try {
    const res = await fetch('https://draft.premierleague.com/api/league/5525/details');
    const data = await res.json();
    return {
      matches: data.matches,
      league_entries: data.league_entries,
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function createPlayersObject(players: Player[]): PlayerDetails[] {
  return players.map((player) => ({
    player_name: player.player_first_name,
    player_surname: player.player_last_name,
    id: player.id,
    team_name: player.entry_name,
    head_to_head_rank: 0,
    head_to_head_points: 0,
    total_points: 0,
    points_against: 0,
    head_to_head_total: 0,
    head_to_head_score: 0,
    total_points_rank: 0,
    total_points_score: 0,
    combined_score: 0,
  }));
}

function calculateCustomStandings(
  matches: Match[],
  playerDetails: PlayerDetails[],
): F1PlayerDetails[] {
  const playerMap: { [id: number]: PlayerScores } = {};

  playerDetails.forEach((player) => {
    playerMap[player.id] = { rank_points: 0, win_points: 0, total: 0, total_wins: 0 };
  });

  const events = Array.from(new Set(matches.map((match) => match.event)));

  // Define points for ranks 1 to 8
  const rankPoints = [20, 15, 12, 10, 8, 6, 4, 0];

  events.forEach((event) => {
    const eventMatches = matches.filter((match) => match.event === event);
    const points: [number, number][] = [];

    eventMatches.forEach((match) => {
      if (match.league_entry_1_points > match.league_entry_2_points) {
        playerMap[match.league_entry_1].win_points += 8;
        playerMap[match.league_entry_1].total_wins += 1;
        points.push([match.league_entry_1, match.league_entry_1_points]);
        points.push([match.league_entry_2, match.league_entry_2_points]);
      } else if (match.league_entry_1_points < match.league_entry_2_points) {
        playerMap[match.league_entry_2].win_points += 8;
        playerMap[match.league_entry_2].total_wins += 1;
        points.push([match.league_entry_1, match.league_entry_1_points]);
        points.push([match.league_entry_2, match.league_entry_2_points]);
      } else {
        points.push([match.league_entry_1, match.league_entry_1_points]);
        points.push([match.league_entry_2, match.league_entry_2_points]);
      }
    });

    points.sort((a, b) => b[1] - a[1]);

    let currentRank = 1;
    for (let i = 0; i < points.length; i++) {
      const [playerId, playerPoints] = points[i];
      if (i > 0 && playerPoints < points[i - 1][1]) {
        currentRank = i + 1;
      }
      if (currentRank <= rankPoints.length) {
        playerMap[playerId].rank_points += rankPoints[currentRank - 1];
      }
    }
  });

  Object.keys(playerMap).forEach((playerId) => {
    const scores = playerMap[+playerId];
    scores.total = scores.rank_points + scores.win_points;
  });

  const f1Details: F1PlayerDetails[] = playerDetails.map((player) => ({
    player_name: player.player_name,
    player_surname: player.player_surname,
    id: player.id,
    team_name: player.team_name,
    f1_score: playerMap[player.id].total,
    f1_ranking: 0,
    total_wins: playerMap[player.id].total_wins,
  }));

  // Sort by F1 score
  f1Details.sort((a, b) => b.f1_score - a.f1_score);

  // Assign ranking
  f1Details.forEach((player, index) => {
    player.f1_ranking = index + 1;
  });

  return f1Details;
}

export const GET = async (req: Request, res: Response) => {
  try {
    const { matches, league_entries } = await fetchData();
    const playerDetails = createPlayersObject(league_entries);
    const customStandings = calculateCustomStandings(matches, playerDetails);

    // Return the F1 standings with the top 8 players
    const topPlayers = customStandings.slice(0, 8);

    return NextResponse.json(topPlayers);
  } catch (error) {
    return NextResponse.json({ message: error }, { status: 500 });
  }
};
