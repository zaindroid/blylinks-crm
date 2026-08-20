import { apiFetch } from './client';

export function fetchMessages(channel) {
  const query = channel ? `?channel=${encodeURIComponent(channel)}` : '';
  return apiFetch(`/messages${query}`);
}

export function sendMessage(channel, text, recipientId) {
  return apiFetch('/messages', { method: 'POST', body: { channel, text, recipientId } });
}
