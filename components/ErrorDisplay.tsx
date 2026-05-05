import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <Card className='w-full border-red-500/20 bg-[#2a0d33]'>
      <CardContent className='flex flex-col items-center gap-4 p-6 text-center'>
        <div className='flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20'>
          <AlertCircle className='h-6 w-6 text-red-400' />
        </div>
        <div className='space-y-1'>
          <h3 className='text-lg font-semibold text-white'>
            Something went wrong
          </h3>
          <p className='text-sm text-white/70'>{message}</p>
        </div>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant='outline'
            className='border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300'
          >
            <RefreshCw className='mr-2 h-4 w-4' />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
