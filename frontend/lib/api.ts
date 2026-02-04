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
      console.log('[fetchWithAuth] Token refreshed successfully, retrying...');

      // Backend already set new access_token cookie with domain="localhost"
      // Retry original request - new cookie will be automatically included
      return fetch(fullUrl, {
        ...options,
        credentials: 'include',  // Automatically includes the new access_token cookie
      });
    } else {
      console.error('[fetchWithAuth] Refresh failed, redirecting to login');
      window.location.href = '/?error=session_expired';
      throw new Error('Session expired');
    }
  }

  return response;
}