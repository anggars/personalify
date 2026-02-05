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

  if (response.status === 401) {
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
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spotify_id: typeof window !== 'undefined' ? localStorage.getItem('spotify_id') : null,
        }),
        credentials: 'include',
      });

      if (refreshRes.ok) {
        console.log('[fetchWithAuth] Token refreshed successfully.');
        isRefreshing = false;
        onRefreshed(true);

        // Retry original request (recursively is safer to pick up cues)
        return fetchWithAuth(url, options);
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