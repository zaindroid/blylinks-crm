import { apiFetch } from './client';

export function fetchSales() {
  return apiFetch('/sales');
}

// Visible to every role. Aggregate counts/revenue only -- no customer PII.
export function fetchLeaderboard() {
  return apiFetch('/sales/leaderboard');
}

export function submitSale(sale) {
  return apiFetch('/sales', { method: 'POST', body: sale });
}

export function approveSale(id, qaNote) {
  return apiFetch(`/sales/${id}/approve`, { method: 'PATCH', body: { qaNote } });
}

export function rejectSale(id, qaNote) {
  return apiFetch(`/sales/${id}/reject`, { method: 'PATCH', body: { qaNote } });
}

export function updateSale(id, patch) {
  return apiFetch(`/sales/${id}`, { method: 'PATCH', body: patch });
}
