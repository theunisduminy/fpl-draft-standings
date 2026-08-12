import apiHelper from '@/utils/apiHelper';

export async function fetchWithDelay(endpoints: string[]) {
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

  return data;
}
