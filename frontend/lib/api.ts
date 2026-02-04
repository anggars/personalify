// frontend/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const fullUrl = `${API_URL}${url}`;
  const response = await fetch(fullUrl, {
    ...options,
    credentials: 'include',
  });

  if (response.status === 401) {
    console.log('[fetchWithAuth] Token expired (401), attempting refresh...');

    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      const newToken = data.access_token;
      console.log('[fetchWithAuth] Token refreshed successfully, retrying...');

      // Retry with new token
      return fetch(fullUrl, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`
        },
        credentials: 'include',
      });
    } else {
      console.error('[fetchWithAuth] Refresh failed, redirecting to login');
      window.location.href = '/?error=session_expired';
      throw new Error('Session expired');
    }
  }

  return response;
}