import { apiFetch } from './client';

export function fetchUsers() {
  return apiFetch('/users');
}

export function createUser(payload) {
  return apiFetch('/users', { method: 'POST', body: payload });
}

export function deactivateUser(id) {
  return apiFetch(`/users/${id}`, { method: 'DELETE' });
}

export function updateUserCampaigns(id, campaignIds) {
  return apiFetch(`/users/${id}/campaigns`, { method: 'PATCH', body: { campaignIds } });
}
