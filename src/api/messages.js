import { apiFetch } from './client';

export function fetchMessages(channel) {
  const query = channel ? `?channel=${encodeURIComponent(channel)}` : '';
  return apiFetch(`/messages${query}`);
}

export function sendMessage(channel, text) {
  return apiFetch('/messages', { method: 'POST', body: { channel, text } });
}
