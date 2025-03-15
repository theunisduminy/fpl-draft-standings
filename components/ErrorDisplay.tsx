import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <div className='flex w-full flex-col items-center justify-center rounded-lg border-2 border-red-300 bg-red-50 p-8 text-red-600'>
      <AlertCircle className='mb-4 h-12 w-12' />
      <h3 className='mb-2 text-xl font-semibold'>Something went wrong</h3>
      <p className='mb-4 text-center'>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className='flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700'
        >
          <RefreshCw className='h-4 w-4' /> Try Again
        </button>
      )}
    </div>
  );
}
