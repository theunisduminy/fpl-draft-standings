import apiHelper from '@/utils/apiHelper';

export async function fetchWithDelay(
  endpoints: string[],
  minimumDuration = 300,
) {
  const start = Date.now();
  const data = await Promise.all(
    endpoints.map((endpoint) => apiHelper(endpoint)),
  );
  const duration = Date.now() - start;
  const delay = Math.max(minimumDuration - duration, 0);

  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
}
