import { apiFetch } from './client';

export function fetchPayroll() {
  return apiFetch('/payroll');
}

export function togglePaymentStatus(id) {
  return apiFetch(`/payroll/${id}/toggle-payment`, { method: 'PATCH' });
}
