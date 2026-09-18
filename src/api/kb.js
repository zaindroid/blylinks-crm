import { apiFetch } from './client';

export function fetchKbArticles() {
  return apiFetch('/kb-articles');
}

// Admin / Supervisor only. Payload: { title, category, summary, content } (summary optional).
export function createKbArticle(payload) {
  return apiFetch('/kb-articles', { method: 'POST', body: payload });
}

export function updateKbArticle(id, payload) {
  return apiFetch(`/kb-articles/${id}`, { method: 'PATCH', body: payload });
}

export function deleteKbArticle(id) {
  return apiFetch(`/kb-articles/${id}`, { method: 'DELETE' });
}
