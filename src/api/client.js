const API_BASE = '/api';

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...opts.headers
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const err = new Error(payload.error || res.statusText);
    // Preserved so callers can react to specific server-side flags (e.g. a
    // forced password reset) rather than just the human-readable message.
    if (payload.mustChangePassword) err.mustChangePassword = true;
    throw err;
  }

  return res.status === 204 ? null : res.json();
}
