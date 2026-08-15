import { apiFetch, setToken } from './client';

export async function login(email, password) {
  const { token, user } = await apiFetch('/auth/login', { method: 'POST', body: { email, password } });
  setToken(token);
  return user;
}

export async function register({ name, email, password, phone, cnic, shift }) {
  const { token, user } = await apiFetch('/auth/register', { method: 'POST', body: { name, email, password, phone, cnic, shift } });
  setToken(token);
  return user;
}

export function logout() {
  setToken(null);
}
