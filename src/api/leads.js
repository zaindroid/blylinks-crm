import { apiFetch } from './client';

export function fetchLeads() {
  return apiFetch('/leads');
}

export function addLead(lead) {
  return apiFetch('/leads', { method: 'POST', body: lead });
}

export function updateLeadStatus(id, status) {
  return apiFetch(`/leads/${id}/status`, { method: 'PATCH', body: { status } });
}
