import type { NextApiRequest, NextApiResponse } from 'next';

async function fetchData() {
  try {
    let res = await fetch('https://draft.premierleague.com/api/league/39485/details');
    return await res.json();
  } catch (err) {
    console.log(err);
  }
}

let playerDetails: Array<Record<string, any>> = [];

function createPlayersObject(players: Array<Record<string, any>>) {
  for (const player of players) {
    let playerInfo = {
      player_name: player.player_first_name,
      player_surname: player.player_last_name,
      id: player.id,
      team_name: player.entry_name,
    };
    playerDetails.push(playerInfo);
  }
}

function sortPlayersObject(standingsData: Array<Record<string, any>>) {
  for (const rank of standingsData) {
    const thePlayer = playerDetails.find((p) => p.id === rank.league_entry);
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
  }
  rankingPlayer(playerDetails);
}

function rankingPlayer(playerData: Array<any>) {
  playerData.sort(function (a, b) {
    return a.head_to_head_rank - b.head_to_head_rank;
  });

  // Assign head to head score
  for (const player of playerData) {
    player.head_to_head_score = 8 - player.head_to_head_rank;
  }

  playerData.sort(function (a, b) {
    return b.total_points - a.total_points;
  });

  // Assign total point rank
  let i = 0;
  for (const player of playerData) {
    player.total_points_rank = 1 + i;
    i++;
  }

  playerData.sort(function (a, b) {
    return a.total_points_rank - b.total_points_rank;
  });

  // Assign total point score
  for (const player of playerData) {
    player.total_points_score = 8 - player.total_points_rank + (9 - player.total_points_rank) / 10;
  }

  // Assign combined score
  for (const player of playerData) {
    player.combined_score = player.head_to_head_score + player.total_points_score;
  }

  playerData.sort(function (a, b) {
    return b.combined_score - a.combined_score;
  });

  return playerData;
}

async function buildPlayerTable() {
  const data = await fetchData();
  createPlayersObject(data.league_entries);
  sortPlayersObject(data.standings);
  return playerDetails;
}

export default async function standings(req: NextApiRequest, res: NextApiResponse) {
  const playerRankings = await buildPlayerTable();
  const trimmedPlayerRankings = playerRankings.slice(0, 8);
  res.status(200).json(trimmedPlayerRankings);
}
