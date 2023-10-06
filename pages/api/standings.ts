import { NextApiRequest, NextApiResponse } from 'next';
import { Player, StandingsData, PlayerDetails } from '@/interfaces/players';

async function fetchData(): Promise<{ league_entries: Player[]; standings: StandingsData[] }> {
  try {
    const res = await fetch('https://draft.premierleague.com/api/league/3681/details');
    // const res = await fetch('https://draft.premierleague.com/api/league/75278/details');
    return await res.json();
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
  }));
}

function sortPlayersObject(
  standingsData: StandingsData[],
  playerDetails: PlayerDetails[],
): PlayerDetails[] {
  const playerMap: { [id: number]: PlayerDetails } = {};

  playerDetails.forEach((player) => {
    playerMap[player.id] = player;
  });

  standingsData.forEach((rank) => {
    const thePlayer = playerMap[rank.league_entry];
    if (thePlayer) {
      thePlayer.head_to_head_rank = standingsData
        .filter((s) => s.total === rank.total)
        .sort((a, b) => b.rank - a.rank)[0].rank_sort;
      thePlayer.head_to_head_points = rank.total;
      thePlayer.total_points = rank.points_for;
      thePlayer.points_against = rank.points_against;
      thePlayer.head_to_head_total = rank.total;
    } else {
      throw new Error('Player not found');
    }
  });

  return rankingPlayer(playerDetails);
}

function rankingPlayer(playerData: PlayerDetails[]): PlayerDetails[] {
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

export default async function standings(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { league_entries, standings } = await fetchData();
    const playerDetails = createPlayersObject(league_entries);
    const rankedPlayers = sortPlayersObject(standings, playerDetails);
    const trimmedPlayerRankings = rankedPlayers.slice(0, 8);
    res.status(200).json(trimmedPlayerRankings);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
