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

export function updateBaseSalary(id, baseSalaryPkr) {
  return apiFetch(`/users/${id}/base-salary`, { method: 'PATCH', body: { baseSalaryPkr } });
}

// Admin/Supervisor-mediated "forgot password" -- returns { id, tempPassword }.
// The temp password is shown exactly once by the caller; it is never stored
// or retrievable again after this response.
export function resetUserPassword(id) {
  return apiFetch(`/users/${id}/reset-password`, { method: 'PATCH' });
}
