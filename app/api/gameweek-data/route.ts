import { NextResponse } from 'next/server';
import {
  PlayerDetails,
  GameweekPerformance,
  GameweekDataResponse,
  RumblerGameweekData,
} from '@/interfaces/players';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// League configuration
const LEAGUE_ID = 75224;

// F1 scoring system points
const F1_POINTS = [20, 15, 12, 10, 8, 6, 4, 2];

// Helper function to assign ranks with proper tie handling
function assignRanks(
  data: Array<{ event_total: number; league_entry: number }>,
): Array<{ rank: number; league_entry: number; event_total: number }> {
  // Sort by points descending
  const sorted = [...data].sort((a, b) => b.event_total - a.event_total);

  const rankedData = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    // If this player has the same score as the previous, give same rank
    if (i > 0 && sorted[i].event_total !== sorted[i - 1].event_total) {
      // New rank position
      currentRank = i + 1;
    }

    rankedData.push({
      ...sorted[i],
      rank: currentRank,
    });
  }

  return rankedData;
}

// Helper function to fetch real gameweek data from Premier League API
async function fetchAllGameweekData(
  maxCompletedGameweek: number,
  leagueEntries: any[],
) {
  const allGameweekData: GameweekPerformance[] = [];

  try {
    // Fetch data for each completed gameweek
    const gameweekPromises = [];

    for (let gw = 1; gw <= maxCompletedGameweek; gw++) {
      gameweekPromises.push(
        Promise.all([
          // Get live points data for this gameweek
          fetch(`https://draft.premierleague.com/api/event/${gw}/live`, {
            cache: 'no-store',
          }).then((res) => res.json()),
          // Get each player's team selection for this gameweek
          ...leagueEntries.map((entry) =>
            fetch(
              `https://draft.premierleague.com/api/entry/${entry.entry_id}/event/${gw}`,
              { cache: 'no-store' },
            )
              .then((res) => res.json())
              .then((data) => ({
                entry_id: entry.entry_id,
                league_entry: entry.id,
                picks: data.picks,
              }))
              .catch(() => ({
                entry_id: entry.entry_id,
                league_entry: entry.id,
                picks: [],
              })),
          ),
        ])
          .then(([liveData, ...playerPicks]) => ({
            gameweek: gw,
            liveData: liveData.elements,
            playerPicks,
          }))
          .catch((error) => {
            console.warn(`Failed to fetch gameweek ${gw} data:`, error);
            return { gameweek: gw, liveData: null, playerPicks: [] };
          }),
      );
    }

    const gameweekResults = await Promise.all(gameweekPromises);

    // Process each gameweek's data
    gameweekResults.forEach(({ gameweek, liveData, playerPicks }) => {
      if (!liveData || !playerPicks || playerPicks.length === 0) return;

      // Calculate points for each player in this gameweek
      const gameweekScores = playerPicks.map((playerData: any) => {
        // Get only the starting 11 players (positions 1-11)
        const startingPlayers = (playerData.picks || []).filter(
          (pick: any) => pick.position <= 11,
        );

        // Sum up the points from the live data for starting players only
        const totalPoints = startingPlayers.reduce((sum: number, pick: any) => {
          const elementId = pick.element.toString();
          const liveElement = liveData[elementId];
          const points = liveElement?.stats?.total_points || 0;
          return sum + points;
        }, 0);

        return {
          league_entry: playerData.league_entry,
          event_total: totalPoints,
        };
      });

      // Assign ranks for this gameweek
      const rankedData = assignRanks(gameweekScores);

      // Add to all gameweek data
      rankedData.forEach((player) => {
        allGameweekData.push({
          event: gameweek,
          league_entry: player.league_entry,
          event_total: player.event_total,
          rank: player.rank,
          finished: true,
        });
      });
    });

    return allGameweekData;
  } catch (error) {
    console.error('Error fetching historical gameweek data:', error);
    return [];
  }
}

export const GET = async (req: Request) => {
  try {
    // 1. Fetch current league and status data
    const [leagueRes, statusRes] = await Promise.all([
      fetch(`https://draft.premierleague.com/api/league/${LEAGUE_ID}/details`, {
        cache: 'no-store',
      }),
      fetch('https://draft.premierleague.com/api/pl/event-status', {
        cache: 'no-store',
      }),
    ]);

    if (!leagueRes.ok || !statusRes.ok) {
      throw new Error('Failed to fetch data from Premier League API');
    }

    const leagueData = await leagueRes.json();
    const statusData = await statusRes.json();

    const { league_entries, standings } = leagueData;
    const { status } = statusData;

    // 2. Determine current gameweek - find the latest gameweek with completed data
    // Since the event-status API might not be reliable, we'll check for actual data
    let currentEvent = 1;
    let isCurrentFinished = false;

    // First try to detect from the current standings data
    if (standings && standings.length > 0) {
      // If event_total is 0, it means current gameweek hasn't been played
      // So we need to find how many gameweeks have actually been played
      const hasCurrentData = standings[0].event_total > 0;
      if (hasCurrentData) {
        // Current gameweek has data, check if it's finished
        isCurrentFinished =
          status.find((s: any) => s.event === currentEvent)?.leagues_updated ||
          true;
      }
    }

    // Try to determine the actual number of completed gameweeks with real data
    let maxGameweek = 0;
    for (let gw = 1; gw <= 10; gw++) {
      // Check up to 10 gameweeks
      try {
        const gwTest = await fetch(
          `https://draft.premierleague.com/api/event/${gw}/live`,
          { cache: 'no-store' },
        );
        if (gwTest.ok) {
          const gwData = await gwTest.json();
          // Check if this gameweek has any real data by checking if ANY element has points
          const elements = Object.values(gwData.elements || {}) as any[];
          const hasRealData = elements.some(
            (el: any) => (el?.stats?.total_points || 0) > 0,
          );
          if (hasRealData) {
            maxGameweek = gw;
          } else {
            // If we find a gameweek with no points, stop looking further
            break;
          }
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    // If event_total is 0, current gameweek hasn't been played
    if (standings[0]?.event_total === 0) {
      currentEvent = maxGameweek + 1;
    } else {
      currentEvent = maxGameweek;
      isCurrentFinished = true;
    }

    // 3. Fetch real historical gameweek data
    const historicalData = await fetchAllGameweekData(
      maxGameweek, // Fetch actual completed gameweeks
      league_entries,
    );

    // 4. Add current gameweek data if available
    if (isCurrentFinished && standings) {
      const currentGameweekData = standings.map((standing: any) => ({
        league_entry: standing.league_entry,
        event_total: standing.event_total,
      }));

      const rankedCurrentData = assignRanks(currentGameweekData);

      rankedCurrentData.forEach((player) => {
        historicalData.push({
          event: currentEvent,
          league_entry: player.league_entry,
          event_total: player.event_total,
          rank: player.rank,
          finished: true,
        });
      });
    }

    // 5. Calculate player statistics
    const playerMetrics: Record<number, PlayerDetails> = {};

    // Initialize player data
    league_entries.forEach((entry: any) => {
      playerMetrics[entry.id] = {
        id: entry.id,
        player_name: entry.player_first_name || 'Unknown',
        player_surname: entry.player_last_name || 'Unknown',
        team_name: entry.entry_name || 'Unknown',
        total_points: 0,
        f1_score: 0,
        f1_ranking: 0,
        total_wins: 0,
        position_placed: {
          first: 0,
          second: 0,
          third: 0,
          fourth: 0,
          fifth: 0,
          sixth: 0,
          seventh: 0,
          eighth: 0,
        },
      };
    });

    // Accumulate statistics from all gameweeks
    historicalData.forEach((gameweek) => {
      const player = playerMetrics[gameweek.league_entry];
      if (player) {
        // Add F1 points for this gameweek
        const f1Points = F1_POINTS[gameweek.rank - 1] || 0;
        player.f1_score += f1Points;

        // Count wins
        if (gameweek.rank === 1) player.total_wins++;

        // Update position counts
        const positions = [
          'first',
          'second',
          'third',
          'fourth',
          'fifth',
          'sixth',
          'seventh',
          'eighth',
        ] as const;
        if (gameweek.rank >= 1 && gameweek.rank <= 8) {
          player.position_placed[positions[gameweek.rank - 1]]++;
        }
      }
    });

    // Set total points from current standings
    standings?.forEach((standing: any) => {
      const player = playerMetrics[standing.league_entry];
      if (player) {
        player.total_points = standing.total;
      }
    });

    // 6. Sort players by F1 score and assign rankings
    const players = Object.values(playerMetrics);
    players.sort((a, b) => b.f1_score - a.f1_score);
    players.forEach((player, index) => {
      player.f1_ranking = index + 1;
    });

    // 7. Generate rumbler data
    const gameweeksByEvent: Record<number, GameweekPerformance[]> = {};
    historicalData.forEach((gw) => {
      if (!gameweeksByEvent[gw.event]) {
        gameweeksByEvent[gw.event] = [];
      }
      gameweeksByEvent[gw.event].push(gw);
    });

    const rumblerData = Object.entries(gameweeksByEvent).map(
      ([eventStr, performances]) => {
        const event = parseInt(eventStr, 10);

        // Find the worst rank (highest number = 8th place)
        const worstRank = Math.max(...performances.map((p) => p.rank));

        // Get all players with the worst rank
        const rumblers = performances.filter((p) => p.rank === worstRank);

        // Get player details
        const rumblerDetails = rumblers.map((rumbler) => {
          const player = league_entries.find(
            (entry: any) => entry.id === rumbler.league_entry,
          );
          return {
            points: rumbler.event_total,
            entry_name: player?.entry_name || 'Unknown',
            player_name: player?.player_first_name || 'Unknown',
          };
        });

        return {
          gameweek: event,
          points: rumblerDetails[0]?.points || 0,
          entry_names: rumblerDetails.map((r) => r.entry_name),
          player_names: rumblerDetails.map((r) => r.player_name),
        };
      },
    );

    // 8. Determine completed gameweeks
    const completedGameweeks = Array.from(
      new Set(historicalData.map((gw) => gw.event)),
    ).sort((a, b) => b - a);

    const response: GameweekDataResponse = {
      players,
      gameweekPerformances: historicalData,
      currentGameweek: currentEvent,
      completedGameweeks,
      rumblerData: rumblerData.sort((a, b) => b.gameweek - a.gameweek),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in gameweek-data API:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch gameweek data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
};
