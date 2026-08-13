import { Card, CardContent } from '@/components/ui/card';

/**
 * "Nothing here yet", said calmly.
 *
 * Empty is not an error — pre-season the API legitimately returns no
 * gameweeks, and every view needs to say so in the same voice rather than
 * reaching for `ErrorDisplay`.
 */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Card className='w-full border-white/10 bg-[#2a0d33]'>
      <CardContent className='p-6 text-center text-sm text-white/60'>
        {children}
      </CardContent>
    </Card>
  );
}
