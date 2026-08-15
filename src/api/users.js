import { apiFetch } from './client';

export function fetchUsers() {
  return apiFetch('/users');
}
