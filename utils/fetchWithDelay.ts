import apiHelper from '@/utils/apiHelper';

export async function fetchWithDelay(
  endpoints: string[],
  minimumDuration = 300,
) {
  const start = Date.now();
  
  try {
    const data = await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          return await apiHelper(endpoint);
        } catch (error) {
          console.error(`Failed to fetch endpoint ${endpoint}:`, error);
          throw error;
        }
      }),
    );
    
    const duration = Date.now() - start;
    const delay = Math.max(minimumDuration - duration, 0);

    return new Promise((resolve) => {
      setTimeout(() => resolve(data), delay);
    });
  } catch (error) {
    console.error('Error in fetchWithDelay:', error);
    throw error;
  }
}
