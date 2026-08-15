import { apiFetch, setToken } from './client';

export async function login(username, password) {
  const { token, user } = await apiFetch('/auth/login', { method: 'POST', body: { username, password } });
  setToken(token);
  return user;
}

// Bootstrap-only: only succeeds when the database has zero users.
export async function bootstrapFirstAdmin({ name, username, password }) {
  const { token, user } = await apiFetch('/auth/register', { method: 'POST', body: { name, username, password } });
  setToken(token);
  return user;
}

export function checkBootstrapStatus() {
  return apiFetch('/auth/bootstrap-status');
}

export function logout() {
  setToken(null);
}
