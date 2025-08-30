export default async function apiHelper(endpoint: string) {
  try {
    const response = await fetch(`/api/${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if the response contains error information
    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error((data as any).message || (data as any).error);
    }
    
    return data;
  } catch (error) {
    console.error(`API call failed for endpoint ${endpoint}:`, error);
    throw error;
  }
}
