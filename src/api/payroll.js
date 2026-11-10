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

// For ONE agent over an arbitrary date range instead of a whole month (e.g. a new hire who
// joined mid-month). 409s if the range overlaps a payroll period that agent already has.
export function generateCustomPayroll({ agentId, periodStart, periodEnd }) {
  return apiFetch('/payroll/generate-custom', { method: 'POST', body: { agentId, periodStart, periodEnd } });
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
