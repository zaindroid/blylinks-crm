import { apiFetch } from './client';

export function fetchMessageGroups({ all } = {}) {
  return apiFetch(`/message-groups${all ? '?all=true' : ''}`);
}

export function createMessageGroup(payload) {
  return apiFetch('/message-groups', { method: 'POST', body: payload });
}

export function updateMessageGroupMembers(id, memberIds) {
  return apiFetch(`/message-groups/${id}/members`, { method: 'PATCH', body: { memberIds } });
}

export function deleteMessageGroup(id) {
  return apiFetch(`/message-groups/${id}`, { method: 'DELETE' });
}
