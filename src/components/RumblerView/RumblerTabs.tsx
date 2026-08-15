'use client';
import { Beer, BarChart3 } from 'lucide-react';

import { SectionTabs } from '@/components/SectionTabs';
import RumblerDataCards from './RumblerCards';
import { RumblerFrequencyChart } from './RumblerFrequencyChart';
import { RumblerGameweekData } from '@/interfaces/players';

/**
 * Client-side for the tab state; the data arrives as a prop, not a fetch.
 *
 * The strip itself is `SectionTabs`, shared with the standings page, so the
 * two look and behave identically rather than by coincidence.
 */
export function RumblerTabs({ data }: { data: RumblerGameweekData[] }) {
  return (
    <SectionTabs
      defaultValue='rumblers'
      tabs={[
        {
          value: 'rumblers',
          label: 'Victims',
          icon: Beer,
          content: <RumblerDataCards gameweekData={data} />,
        },
        {
          value: 'frequency',
          label: 'Frequency',
          icon: BarChart3,
          content: <RumblerFrequencyChart data={data} />,
        },
      ]}
    />
  );
}
