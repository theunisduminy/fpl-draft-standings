// Some helper funcitons to keep app.js clean

function replaceScoringTable(tableTemplate, playerData) {
  let output = tableTemplate.replace(/{%PLAYER_NAME%}/g, playerData.player_name);
  output = output.replace(/{%TOTAL_POINTS%}/g, playerData.total_points);
  output = output.replace(/{%H2H_SCORE%}/g, `${playerData.head_to_head_rank}(${playerData.head_to_head_points})`);
  output = output.replace(/{%SCORE%}/g, playerData.combined_score);

  return output;
}

function replaceDetailTable(tableTemplate, playerData) {
  let output = tableTemplate.replace(/{%PLAYER_NAME%}/g, `${playerData.player_name} ${playerData.player_surname}`);
  output = output.replace(/{%TEAM_NAME%}/g, playerData.team_name);

  output = output.replace(/{%TOTAL_POINTS%}/g, playerData.total_points);
  output = output.replace(/{%POINTS_AGAINST%}/g, playerData.points_against);
  output = output.replace(/{%TP_RANK%}/g, playerData.total_points_rank);
  output = output.replace(/{%TP_SCORE%}/g, playerData.total_points_score);

  output = output.replace(/{%H2H_POINT%}/g, playerData.head_to_head_points);
  output = output.replace(/{%H2H_SCORE%}/g, playerData.head_to_head_score);
  output = output.replace(/{%H2H_RANK%}/g, playerData.head_to_head_rank);
  output = output.replace(/{%SCORE%}/g, playerData.combined_score);

  return output;
}

module.exports = { replaceScoringTable, replaceDetailTable };
