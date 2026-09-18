import { apiFetch } from './client';

// IP allowlist for the whole portal (Admin only).
// Every call resolves to { enabled, overrideActive, yourIp, yourIpAllowed, entries: [{ id, cidr, label, createdAt }] }.
export function fetchAccess() {
  return apiFetch('/access');
}

export function addAccessEntry(cidr, label) {
  return apiFetch('/access/entries', { method: 'POST', body: { cidr, label } });
}

export function removeAccessEntry(id) {
  return apiFetch(`/access/entries/${id}`, { method: 'DELETE' });
}

export function setAccessEnabled(enabled) {
  return apiFetch('/access/settings', { method: 'PUT', body: { enabled } });
}
