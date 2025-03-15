// components/PlayerView/HeadToHeadRecord.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Trophy, Slash, CircleDot } from 'lucide-react';

interface HeadToHeadData {
  opponentId: number;
  opponentName: string;
  opponentTeam: string;
  wins: number;
  losses: number;
  draws: number;
  totalPoints: number;
  againstPoints: number;
}

interface HeadToHeadRecordProps {
  records: HeadToHeadData[];
}

export function HeadToHeadRecord({ records }: HeadToHeadRecordProps) {
  // Sort records by win percentage (highest first)
  const sortedRecords = [...records].sort((a, b) => {
    const totalA = a.wins + a.losses + a.draws;
    const totalB = b.wins + b.losses + b.draws;

    const winPctA = totalA > 0 ? a.wins / totalA : 0;
    const winPctB = totalB > 0 ? b.wins / totalB : 0;

    return winPctB - winPctA;
  });

  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Head-to-Head Records</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-white'>
            <thead>
              <tr className='border-b border-white'>
                <th className='pb-2 pl-2 text-left font-medium'>Opponent</th>
                <th className='pb-2 text-center font-medium'>Record</th>
                <th className='pb-2 text-center font-medium'>Win %</th>
                <th className='pb-2 text-center font-medium'>Diff</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((record, index) => {
                const totalMatches = record.wins + record.losses + record.draws;
                const winPercentage =
                  totalMatches > 0
                    ? ((record.wins / totalMatches) * 100).toFixed(1)
                    : '0.0';

                const pointsDiff = record.totalPoints - record.againstPoints;

                return (
                  <tr
                    key={record.opponentId}
                    className={index % 2 === 0 ? '' : 'bg-ruddyBlue'}
                  >
                    <td className='py-3 pl-2 font-medium'>
                      {record.opponentName}
                    </td>
                    <td className='py-3 text-center'>
                      <div className='flex items-center justify-center space-x-1'>
                        <span className='flex items-center text-green-300'>
                          <Trophy className='mr-1 h-3 w-3' /> {record.wins}
                        </span>
                        <span className='flex items-center text-red-300'>
                          <Slash className='mr-1 h-3 w-3' /> {record.losses}
                        </span>
                        <span className='flex items-center text-gray-300'>
                          <CircleDot className='mr-1 h-3 w-3' /> {record.draws}
                        </span>
                      </div>
                    </td>
                    <td className='py-3 text-center'>{winPercentage}%</td>
                    <td
                      className={`py-3 text-center ${pointsDiff > 0 ? 'text-green-300' : pointsDiff < 0 ? 'text-red-300' : ''}`}
                    >
                      {pointsDiff > 0 ? '+' : ''}
                      {pointsDiff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
