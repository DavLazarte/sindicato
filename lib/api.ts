const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://soem-api.test';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('soem_token');
}

async function request<T = Record<string, unknown>>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    sessionStorage.removeItem('soem_token');
    window.location.href = '/login';
    throw new Error('No autorizado');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error del servidor');
  return data;
}

export const api = {
  get: <T = Record<string, unknown>>(endpoint: string) =>
    request<T>(endpoint),
  post: <T = Record<string, unknown>>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T = Record<string, unknown>>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T = Record<string, unknown>>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};
