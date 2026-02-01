/**
 * Fetch wrapper with automatic token refresh on 401 errors.
 * Handles silent token refresh for web clients.
 */

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Always send cookies
  });
  
  if (response.status === 401) {
    console.log('Token expired, attempting refresh...');
    
    // Try refresh
    const refreshRes = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include', // Browser sends cookie with spotify_id automatically
    });
    
    if (refreshRes.ok) {
      console.log('Token refreshed, retrying original request...');
      // Retry original request (backend already set new cookie)
      return fetch(url, {
        ...options,
        credentials: 'include',
      });
    } else {
      // Refresh failed, redirect to login
      console.error('Refresh failed, redirecting to login');
      window.location.href = '/?error=session_expired';
      throw new Error('Session expired');
    }
  }
  
  return response;
}
