'use client';
import { useState, useEffect } from 'react';
import { fetchWithDelay } from '@/utils/fetchWithDelay';

export interface UseTableDataOptions {
  endpoints: string[];
  dependencies?: any[];
  transform?: (data: any[]) => any;
  onError?: (error: string) => void;
}

export interface UseTableDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTableData<T = any>({
  endpoints,
  dependencies = [],
  transform,
  onError,
}: UseTableDataOptions): UseTableDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWithDelay(endpoints);
      
      // Check if response contains error information
      if (Array.isArray(response)) {
        for (const item of response) {
          if (item && typeof item === 'object' && 'error' in item) {
            throw new Error((item as any).message || (item as any).error);
          }
        }
      } else if (response && typeof response === 'object' && 'error' in response) {
        throw new Error((response as any).message || (response as any).error);
      }
      
      const processedData = transform ? transform(response as any[]) : response;

      setData(processedData);
    } catch (err) {
      let errorMessage = 'Failed to load data. Please try again later.';
      
      if (err instanceof Error) {
        // Use the actual error message if it's informative
        if (err.message && !err.message.includes('fetch')) {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      console.error('Table data fetch error:', err);

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
