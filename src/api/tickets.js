import { apiFetch } from './client';

export function fetchTickets() {
  return apiFetch('/tickets');
}

export function addTicket(ticket) {
  return apiFetch('/tickets', { method: 'POST', body: ticket });
}

export function resolveTicket(id) {
  return apiFetch(`/tickets/${id}/resolve`, { method: 'PATCH' });
}
