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
      const processedData = transform ? transform(response as any[]) : response;

      setData(processedData);
    } catch (err) {
      const errorMessage = 'Failed to load data. Please try again later.';
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
