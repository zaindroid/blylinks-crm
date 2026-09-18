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

// Any subset of { commissionPkr, bonusPkr, deductionsPkr, workingDays }.
export function updatePayrollAdjustments(id, adjustments) {
  return apiFetch(`/payroll/${id}`, { method: 'PATCH', body: adjustments });
}

// Salary advances (Admin only). Outstanding advances are deducted automatically when payroll is calculated.
export function fetchAdvances() {
  return apiFetch('/payroll/advances');
}

export function addAdvance({ agentId, amountPkr, givenOn, note }) {
  return apiFetch('/payroll/advances', { method: 'POST', body: { agentId, amountPkr, givenOn, note } });
}

export function deleteAdvance(id) {
  return apiFetch(`/payroll/advances/${id}`, { method: 'DELETE' });
}
