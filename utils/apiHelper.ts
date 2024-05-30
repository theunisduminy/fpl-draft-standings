export default async function apiHelper(endpoint: string) {
  const response = await fetch(`/api/${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'GET',
  });

  return response.json();
}
