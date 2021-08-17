const { application } = require('express');
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const fetch = require('node-fetch');

const playerDetails = [];

const app = express();

const draftPath = 'https://draft.premierleague.com/api/league/25761/details';

function createPlayersObject(players) {
  for (const player of players) {
    let playerInfo = {
      player: `${player.player_first_name} ${player.player_last_name}`,
      id: player.id,
    };
    playerDetails.push(playerInfo);
  }
}

function addPlayerHtHStandings(standingsData) {
  let playerHtHStanding, player;

  for (const rank of standingsData) {
    const thePlayer = playerDetails.find((p) => p.id === rank.league_entry);
    thePlayer.head_to_head_rank = rank.rank_sort;
    thePlayer.total_points = rank.points_for;
  }
}

async function fetchData() {
  try {
    let res = await fetch(draftPath);
    return await res.json();
  } catch (err) {
    console.log(err);
  }
}

async function buildPlayerTable() {
  data = await fetchData();
  createPlayersObject(data.league_entries);
  addPlayerHtHStandings(data.standings);
}

buildPlayerTable();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`App running on port ${PORT}...`);
});
