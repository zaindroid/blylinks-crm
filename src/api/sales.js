import { apiFetch } from './client';

export function fetchSales() {
  return apiFetch('/sales');
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
