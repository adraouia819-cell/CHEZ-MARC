const ACCESS_KEY = 'cs_access_token';
const REFRESH_KEY = 'cs_refresh_token';

export function getStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
  try {
    return {
      accessToken: sessionStorage.getItem(ACCESS_KEY),
      refreshToken: sessionStorage.getItem(REFRESH_KEY),
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

export function saveStoredTokens(accessToken: string, refreshToken: string): void {
  try {
    sessionStorage.setItem(ACCESS_KEY, accessToken);
    sessionStorage.setItem(REFRESH_KEY, refreshToken);
  } catch {
    // Ignore storage quota issues
  }
}

export function clearStoredTokens(): void {
  try {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  } catch {
    // Ignore
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getStoredTokens();
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
    if (!res.ok) {
      clearStoredTokens();
      return null;
    }
    const data = await res.json();
    if (data.accessToken && data.refreshToken) {
      saveStoredTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const { accessToken } = getStoredTokens();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retryOn401 && !path.includes('/auth/')) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      headers.set('Authorization', `Bearer ${newAccess}`);
      const retryRes = await fetch(path, { ...options, headers, credentials: 'include' });
      if (!retryRes.ok) {
        const errData = await retryRes.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur HTTP ${retryRes.status}`);
      }
      return retryRes.json();
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Erreur HTTP ${res.status}`);
  }

  return res.json();
}

export function formatMad(amount: number): string {
  return `${new Intl.NumberFormat('fr-MA', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)} MAD`;
}
