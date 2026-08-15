import { apiFetch } from './client';

export function fetchKbArticles() {
  return apiFetch('/kb-articles');
}
