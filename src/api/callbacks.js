import { apiFetch } from './client';

export function fetchCallbacks() {
  return apiFetch('/callbacks');
}

export function addCallback(callback) {
  return apiFetch('/callbacks', { method: 'POST', body: callback });
}

export function completeCallback(id) {
  return apiFetch(`/callbacks/${id}/complete`, { method: 'PATCH' });
}
