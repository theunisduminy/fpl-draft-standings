import React from 'react';
import { RumblerFrequencyChart } from './RumblerFrequencyChart';
import { RumblerGameweekData } from '@/interfaces/players';

export default function RumblerDashboard({
  data,
}: {
  data: RumblerGameweekData[];
}) {
  return <RumblerFrequencyChart data={data} />;
}
