'use client';

import React, { useState, useEffect } from 'react';
import { fetchWithDelay } from '@/utils/fetchWithDelay';
import { SkeletonCard } from '@/components/SkeletonTable';
import { RumblerFrequencyChart } from './RumblerFrequencyChart';
import { AlertCircle } from 'lucide-react';
import { GameweekData } from '@/interfaces/match';

export default function RumblerDashboard() {
  const [gameweekData, setGameweekData] = useState<GameweekData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData(): Promise<void> {
      try {
        const [data] = (await fetchWithDelay(['rumbler'])) as [GameweekData[]];
        setGameweekData(data);
      } catch (err) {
        setError('Failed to fetch data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <SkeletonCard />;

  if (error) {
    return (
      <div className='flex items-center justify-center p-4 text-red-500'>
        <AlertCircle className='mr-2' />
        <span>{error}</span>
      </div>
    );
  }

  return <RumblerFrequencyChart data={gameweekData} />;
}
