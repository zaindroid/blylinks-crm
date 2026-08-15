import { apiFetch } from './client';

export function fetchTargets() {
  return apiFetch('/targets');
}

export function updateTarget(agentId, updates) {
  return apiFetch(`/targets/${agentId}`, { method: 'PATCH', body: updates });
}
