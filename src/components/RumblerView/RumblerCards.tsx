'use client';
import React, { useState, useMemo } from 'react';
import { GameweekSelector } from '@/components/GameweekSelector';
import { getBlurbForGameweek } from '@/utils/lossBlurb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { RumblerGameweekData } from '@/interfaces/players';
import { Beer, TrendingDown, Calendar, Quote } from 'lucide-react';

export default function RumblerDataCards({
  gameweekData,
}: {
  gameweekData: RumblerGameweekData[];
}): React.JSX.Element {
  // `null` means "the reader hasn't chosen yet", so we fall back to the most
  // recent gameweek. Deriving the default beats storing it: setting state from
  // inside useMemo triggers a cascading render, which React 19 flags.
  const [selectedGameweek, setSelectedGameweek] = useState<number | null>(null);

  const gameweeks = useMemo(
    () => gameweekData.map((item) => item.gameweek).sort((a, b) => b - a),
    [gameweekData],
  );

  const activeGameweek = selectedGameweek ?? gameweeks[0] ?? 0;

  // Picked from the gameweek rather than at random, so a given gameweek always
  // carries the same jab — clicking away and back no longer reshuffles it.
  const currentBlurb = getBlurbForGameweek(activeGameweek);

  if (gameweekData.length === 0) {
    return (
      <Card className='w-full border-white/10 bg-[#2a0d33]'>
        <CardHeader>
          <CardTitle className='text-white'>Rumbler Victim</CardTitle>
          <CardDescription className='text-white/60'>
            No rumbler data available yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selectedData = gameweekData.find(
    (gw) => gw.gameweek === activeGameweek,
  );

  const rumblerFrequency: Record<string, number> = {};
  gameweekData.forEach((gw) => {
    gw.player_names.forEach((playerName) => {
      rumblerFrequency[playerName] = (rumblerFrequency[playerName] || 0) + 1;
    });
  });

  const getCurrentRumblerCount = (playerName: string): number => {
    return rumblerFrequency[playerName] || 0;
  };

  const rumblerAverage =
    gameweekData.reduce((sum, gw) => sum + gw.points, 0) / gameweekData.length;

  if (!selectedData) {
    return (
      <div className='w-full space-y-4'>
        <GameweekSelector
          gameweeks={gameweeks}
          selectedGameweek={activeGameweek}
          onSelectGameweek={setSelectedGameweek}
        />
        <Card className='w-full border-white/10 bg-[#2a0d33]'>
          <CardHeader>
            <CardTitle className='text-white'>
              Gameweek {activeGameweek}
            </CardTitle>
            <CardDescription className='text-white/60'>
              No rumbler data for this gameweek
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className='w-full space-y-4'>
      <GameweekSelector
        gameweeks={gameweeks}
        selectedGameweek={activeGameweek}
        onSelectGameweek={setSelectedGameweek}
      />

      <Card className='w-full overflow-hidden border-white/10 bg-[#2a0d33]'>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Calendar className='h-4 w-4 text-white/60' />
              <CardTitle className='text-base text-white md:text-lg'>
                Gameweek {selectedData.gameweek}
              </CardTitle>
            </div>
            <Badge
              variant='outline'
              className='border-amber-500/30 bg-amber-500/10 text-amber-400'
            >
              {selectedData.points} pts
            </Badge>
          </div>
          <div className='mt-1 flex items-center gap-2'>
            <TrendingDown className='h-3 w-3 text-white/40' />
            <CardDescription className='text-xs text-white/50'>
              {selectedData.points < rumblerAverage
                ? `${(rumblerAverage - selectedData.points).toFixed(1)} pts below average`
                : `${(selectedData.points - rumblerAverage).toFixed(1)} pts above average`}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className='p-4 pt-0'>
          <div className='space-y-3'>
            {selectedData.entry_names.map((entry, index) => {
              const playerName = selectedData.player_names[index];
              const count = getCurrentRumblerCount(playerName);
              return (
                <div
                  key={index}
                  className='flex items-center justify-between rounded-lg bg-[#1a0520] p-3 transition-colors hover:bg-[#1a0520]/80'
                >
                  <div className='flex items-center gap-3'>
                    <Avatar className='h-10 w-10 border border-amber-500/30'>
                      <AvatarFallback className='bg-amber-500/10 text-sm font-bold text-amber-400'>
                        {playerName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className='flex items-center gap-2'>
                        <span className='text-sm font-bold text-white'>
                          {playerName}
                        </span>
                        <Beer className='h-4 w-4 text-amber-400' />
                      </div>
                      <span className='text-xs text-white/50'>{entry}</span>
                    </div>
                  </div>
                  <Badge
                    variant='outline'
                    className='border-white/10 bg-[#1a0520] text-xs text-white/60'
                  >
                    {count} rumblers
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>

        <Separator className='bg-white/10' />

        <CardFooter className='p-4'>
          <div className='flex items-start gap-2'>
            <Quote className='mt-0.5 h-4 w-4 flex-shrink-0 text-white/30' />
            <p className='text-sm text-white/60 italic'>
              &ldquo;{currentBlurb}&rdquo;
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
