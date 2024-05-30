import LeagueDetailTable from '@/components/LeagueDetailTable';
import { bgGradient } from '@/utils/tailwindVars';

export default function DetailView() {
  return (
    <div className={`flex flex-col items-center ${bgGradient} pt-10`}>
      <LeagueDetailTable />
    </div>
  );
}
