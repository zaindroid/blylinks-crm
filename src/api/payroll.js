import { apiFetch } from './client';

export function fetchPayroll() {
  return apiFetch('/payroll');
}

export function togglePaymentStatus(id) {
  return apiFetch(`/payroll/${id}/toggle-payment`, { method: 'PATCH' });
}

export function generatePayroll(month) {
  return apiFetch('/payroll/generate', { method: 'POST', body: { month } });
}

export function updatePayrollAdjustments(id, { bonusPkr, deductionsPkr }) {
  return apiFetch(`/payroll/${id}`, { method: 'PATCH', body: { bonusPkr, deductionsPkr } });
}
