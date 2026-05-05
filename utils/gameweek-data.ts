import {
  PlayerDetails,
  GameweekPerformance,
  GameweekDataResponse,
} from '@/interfaces/players';
import { getCache, setCache } from './cache';

const LEAGUE_ID = 75224;
const F1_POINTS = [20, 15, 12, 10, 8, 6, 4, 2];
const CACHE_KEY = 'gameweek-data';
const CACHE_TTL_SECONDS = 3600; // 1 hour — FPL data only changes once per gameweek
const BATCH_SIZE = 5; // fetch 5 gameweeks at a time to avoid flooding the API

function assignRanks(
  data: Array<{ event_total: number; league_entry: number }>,
): Array<{ rank: number; league_entry: number; event_total: number }> {
  const sorted = [...data].sort((a, b) => b.event_total - a.event_total);
  const rankedData = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].event_total !== sorted[i - 1].event_total) {
      currentRank = i + 1;
    }
    rankedData.push({ ...sorted[i], rank: currentRank });
  }
  return rankedData;
}

async function fetchGameweekBatch(
  startGw: number,
  endGw: number,
  leagueEntries: any[],
): Promise<GameweekPerformance[]> {
  const batchPromises = [];

  for (let gw = startGw; gw <= endGw; gw++) {
    batchPromises.push(
      Promise.all([
        fetch(`https://draft.premierleague.com/api/event/${gw}/live`, {
          next: { revalidate: 300 },
        }).then((res) => res.json()),
        ...leagueEntries.map((entry) =>
          fetch(
            `https://draft.premierleague.com/api/entry/${entry.entry_id}/event/${gw}`,
            { next: { revalidate: 300 } },
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
          liveData,
          playerPicks,
        }))
        .catch(() => ({ gameweek: gw, liveData: null, playerPicks: [] })),
    );
  }

  const results = await Promise.all(batchPromises);
  const performances: GameweekPerformance[] = [];

  results.forEach(({ gameweek, liveData, playerPicks }) => {
    if (!liveData?.elements || !playerPicks?.length) return;

    const gameweekScores = playerPicks.map((playerData: any) => {
      const startingPlayers = (playerData.picks || []).filter(
        (pick: any) => pick.position <= 11,
      );

      const totalPoints = startingPlayers.reduce((sum: number, pick: any) => {
        const elementId = pick.element.toString();
        const liveElement = liveData.elements[elementId];
        return sum + (liveElement?.stats?.total_points || 0);
      }, 0);

      return {
        league_entry: playerData.league_entry,
        event_total: totalPoints,
      };
    });

    const rankedData = assignRanks(gameweekScores);

    rankedData.forEach((player) => {
      performances.push({
        event: gameweek,
        league_entry: player.league_entry,
        event_total: player.event_total,
        rank: player.rank,
        finished: true,
      });
    });
  });

  return performances;
}

async function fetchAllGameweekData(
  maxCompletedGameweek: number,
  leagueEntries: any[],
) {
  const allGameweekData: GameweekPerformance[] = [];

  for (
    let batchStart = 1;
    batchStart <= maxCompletedGameweek;
    batchStart += BATCH_SIZE
  ) {
    const batchEnd = Math.min(
      batchStart + BATCH_SIZE - 1,
      maxCompletedGameweek,
    );
    const batchData = await fetchGameweekBatch(
      batchStart,
      batchEnd,
      leagueEntries,
    );
    allGameweekData.push(...batchData);
  }

  return allGameweekData;
}

export async function getGameweekData(): Promise<GameweekDataResponse> {
  const cached = getCache<GameweekDataResponse>(CACHE_KEY);
  if (cached) {
    return cached;
  }

  const [leagueRes, statusRes] = await Promise.all([
    fetch(`https://draft.premierleague.com/api/league/${LEAGUE_ID}/details`, {
      next: { revalidate: 300 },
    }),
    fetch('https://draft.premierleague.com/api/pl/event-status', {
      next: { revalidate: 300 },
    }),
  ]);

  if (!leagueRes.ok || !statusRes.ok) {
    throw new Error('Failed to fetch data from Premier League API');
  }

  const leagueData = await leagueRes.json();
  const statusData = await statusRes.json();

  const { league_entries, standings } = leagueData;
  const { status } = statusData;

  // Derive max gameweek from status array — instant, no extra HTTP calls
  const maxGameweek = Math.max(...status.map((s: any) => s.event), 0);
  const completedEvents = status.filter((s: any) => s.leagues_updated);
  const maxCompletedGameweek =
    completedEvents.length > 0
      ? Math.max(...completedEvents.map((s: any) => s.event))
      : 0;

  const currentEvent = maxGameweek;
  const isCurrentFinished = completedEvents.some(
    (s: any) => s.event === currentEvent,
  );

  const historicalData = await fetchAllGameweekData(
    maxCompletedGameweek || maxGameweek,
    league_entries,
  );

  if (isCurrentFinished && standings) {
    const hasCurrentGameweekData = historicalData.some(
      (gw) => gw.event === currentEvent,
    );

    if (!hasCurrentGameweekData) {
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
  }

  const playerMetrics: Record<number, PlayerDetails> = {};

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

  historicalData.forEach((gameweek) => {
    const player = playerMetrics[gameweek.league_entry];
    if (player) {
      const f1Points = F1_POINTS[gameweek.rank - 1] || 0;
      player.f1_score += f1Points;
      if (gameweek.rank === 1) player.total_wins++;

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

  standings?.forEach((standing: any) => {
    const player = playerMetrics[standing.league_entry];
    if (player) {
      player.total_points = standing.total;
    }
  });

  const players = Object.values(playerMetrics);
  players.sort((a, b) => b.f1_score - a.f1_score);
  players.forEach((player, index) => {
    player.f1_ranking = index + 1;
  });

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
      const worstRank = Math.max(...performances.map((p) => p.rank));
      const rumblers = performances.filter((p) => p.rank === worstRank);

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

  setCache(CACHE_KEY, response, CACHE_TTL_SECONDS);
  return response;
}
