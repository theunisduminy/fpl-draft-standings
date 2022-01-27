const { application } = require('express');
const express = require('express');
const fs = require('fs');
const { builtinModules } = require('module');
const fetch = require('node-fetch');

const { replaceScoringTable, replaceDetailTable } = require('./helpers');

const app = express();
app.use(express.static(__dirname + '/public'));

let playerDetails = [];

const draftPath = 'https://draft.premierleague.com/api/league/25761/details';
const homePage = fs.readFileSync(`${__dirname}/public/templates/home.html`, 'utf-8');
const tableInfo = fs.readFileSync(`${__dirname}/public/templates/standings-table.html`, 'utf-8');
const scoringRules = fs.readFileSync(`${__dirname}/public/templates/scoring.html`, 'utf-8');
const detailView = fs.readFileSync(`${__dirname}/public/templates/detailed-view.html`, 'utf-8');
const playerDetailView = fs.readFileSync(`${__dirname}/public/templates/player-detail-view.html`, 'utf-8');
const scoringTable = fs.readFileSync(`${__dirname}/public/templates/scoring-table.html`, 'utf-8');

async function fetchData() {
  try {
    let res = await fetch(draftPath);
    return await res.json();
  } catch (err) {
    console.log(err);
  }
}

function createPlayersObject(players) {
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

function sortPlayersObject(standingsData) {
  for (const rank of standingsData) {
    const thePlayer = playerDetails.find((p) => p.id === rank.league_entry);
    thePlayer.head_to_head_rank = standingsData
      .filter((s) => s.total === rank.total)
      .sort((a, b) => b.rank - a.rank)[0].rank_sort;
    thePlayer.head_to_head_points = rank.total;
    thePlayer.total_points = rank.points_for;
    thePlayer.points_against = rank.points_against;
    thePlayer.head_to_head_total = rank.total;
  }
  rankingPlayer(playerDetails);
}

function rankingPlayer(playerData) {
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

  return playerDetails;
}

async function buildPlayerTable() {
  data = await fetchData();
  createPlayersObject(data.league_entries);
  sortPlayersObject(data.standings);
}

buildPlayerTable();

app.get('/', (req, res) => {
  const pointsTables = playerDetails.map((el) => replaceScoringTable(tableInfo, el)).join('');
  const output = homePage.replace('{%STANDINGS_TABLE%}', pointsTables);
  res.send(output);
});

app.get('/scoring', (req, res) => {
  const output = scoringRules.replace('{%SCORING_TABLE%}', scoringTable);
  res.send(output);
});

app.get('/detail', (req, res) => {
  const detailTables = playerDetails.map((el) => replaceDetailTable(playerDetailView, el)).join('');
  const output = detailView.replace('{%DETAIL_TABLE%}', detailTables);
  res.send(output);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App running on port ${PORT}...`);
});
