import { apiFetch } from './client';

// What agents use: is this number on this campaign's Do-Not-Call list? -> { found, campaignId, campaignName }
export function checkDnc(campaignId, phone) {
  return apiFetch('/dnc/check', { method: 'POST', body: { campaignId, phone } });
}

// Admin / Supervisor list management
export function fetchDncSummary() {
  return apiFetch('/dnc/summary');
}

export function fetchDncEntries(campaignId, { q = '', limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({ campaignId, limit: String(limit), offset: String(offset) });
  if (q) params.set('q', q);
  return apiFetch(`/dnc?${params.toString()}`);
}

export function addDncEntry(campaignId, phone, note) {
  return apiFetch('/dnc', { method: 'POST', body: { campaignId, phone, note } });
}

// `rows` is one chunk of an uploaded file: [{ phone, note, fields }]. The caller splits a large file into
// chunks and sends them one after another, which is what removes any cap on the size of a file.
export function bulkAddDnc(campaignId, rows) {
  return apiFetch('/dnc/bulk', { method: 'POST', body: { campaignId, rows } });
}

export function updateDncEntry(id, phone, note) {
  return apiFetch(`/dnc/${id}`, { method: 'PUT', body: { phone, note } });
}

export function deleteDncEntry(id) {
  return apiFetch(`/dnc/${id}`, { method: 'DELETE' });
}
