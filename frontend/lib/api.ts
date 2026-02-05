// frontend/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

let isRefreshing = false;
let refreshSubscribers: ((token: boolean) => void)[] = [];

function onRefreshed(success: boolean) {
  refreshSubscribers.forEach((callback) => callback(success));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: boolean) => void) {
  refreshSubscribers.push(callback);
}

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const fullUrl = `${API_URL}${url}`;
  const response = await fetch(fullUrl, {
    ...options,
    credentials: 'include',
  });

  // Handle 401 (Unauthorized) OR 404 (Not Found) that suggests login
  // The backend returns 404 "Please login again" if cookies are missing and public cache is empty.
  // We should treat this as a session expiration to trigger auto-refresh.
  let isAuthError = response.status === 401;

  if (response.status === 404) {
    // Clone response to read body without consuming the original stream if we don't handle it
    const clone = response.clone();
    try {
      const errorBody = await clone.json();
      if (errorBody.detail && typeof errorBody.detail === 'string' && errorBody.detail.toLowerCase().includes('login')) {
        isAuthError = true;
        console.log('[fetchWithAuth] Detected 404 suggesting login -> Transforming to Auth Refresh flow.');
      }
    } catch (e) {
      // Not JSON or other error, ignore
    }
  }

  if (isAuthError) {
    if (isRefreshing) {
      // If already refreshing, return a promise that waits for the refresh to complete
      return new Promise<Response>((resolve, reject) => {
        addRefreshSubscriber((success: boolean) => {
          if (success) {
            // Retry the original request
            resolve(fetchWithAuth(url, options));
          } else {
            reject(new Error('Session expired'));
          }
        });
      });
    }

    isRefreshing = true;
    console.log('[fetchWithAuth] Token expired (401), attempting refresh...');

    try {
      // Robust retrieval of spotify_id:
      // 1. Try localStorage
      // 2. Try URL path (e.g. /dashboard/SPOTIFY_ID)
      let spotifyId = typeof window !== 'undefined' ? localStorage.getItem('spotify_id') : null;

      if (!spotifyId && typeof window !== 'undefined') {
        const pathParts = window.location.pathname.split('/');
        // Check if path is like /dashboard/[id]
        if (pathParts[1] === 'dashboard' && pathParts[2]) {
          spotifyId = pathParts[2];
          console.log('[fetchWithAuth] Found spotify_id in URL fallback:', spotifyId);
        }
      }

      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spotify_id: spotifyId,
        }),
        credentials: 'include',
      });

      if (refreshRes.ok) {
        console.log('[fetchWithAuth] Token refreshed successfully.');

        // FIX: Extract new access_token -> Send manually in header to bypass cookie issues
        const data = await refreshRes.json();
        const newAccessToken = data.access_token;

        isRefreshing = false;
        onRefreshed(true);

        // Retry original with explicit Header
        const newOptions = { ...options };
        if (newAccessToken) {
          const newHeaders = new Headers(newOptions.headers);
          newHeaders.set('Authorization', `Bearer ${newAccessToken}`);
          newOptions.headers = newHeaders;
        }

        return fetch(url, {
          ...newOptions,
          credentials: 'include'
        });
      } else {
        throw new Error('Refresh failed');
      }
    } catch (error) {
      console.error('[fetchWithAuth] Refresh failed, redirecting...');
      isRefreshing = false;
      onRefreshed(false);
      window.location.href = '/?error=session_expired';
      throw new Error('Session expired');
    }
  }

  return response;
}