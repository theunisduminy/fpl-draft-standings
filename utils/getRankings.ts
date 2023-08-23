/**
 * Fetch the standings details
 * @returns
 */
export default async function getStandings() {
  const response = await fetch('/api/standings', {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'GET',
  });

  return response.json();
}
