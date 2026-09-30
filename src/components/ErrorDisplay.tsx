import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <Card className='w-full border-negative/20 bg-card' role='alert'>
      <CardContent className='flex flex-col items-center gap-4 p-6 text-center'>
        <div className='flex h-12 w-12 items-center justify-center rounded-full bg-negative/20'>
          <AlertCircle className='h-6 w-6 text-negative' />
        </div>
        <div className='space-y-1'>
          <h3 className='text-lg font-semibold text-foreground'>
            Something went wrong
          </h3>
          <p className='text-sm leading-relaxed text-pretty break-words text-muted-foreground'>
            {message}
          </p>
        </div>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant='outline'
            className='border-negative/30 text-negative hover:bg-negative/10 hover:text-negative'
          >
            <RefreshCw className='mr-2 h-4 w-4' />
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
