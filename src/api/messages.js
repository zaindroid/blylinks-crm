import { apiFetch, getToken } from './client';

export function fetchMessages(channel) {
  const query = channel ? `?channel=${encodeURIComponent(channel)}` : '';
  return apiFetch(`/messages${query}`);
}

// `file`, when supplied, is { fileName, fileType, fileData } where fileData is a base64 string
// (no data: URL prefix). A message needs text, a file, or both.
export function sendMessage(channel, text, recipientId, file) {
  return apiFetch('/messages', { method: 'POST', body: { channel, text, recipientId, ...(file || {}) } });
}

// Plain <a href> can't carry an Authorization header, so downloading/previewing an attachment
// goes through a real fetch for the blob, not a direct link to the API path.
export async function fetchAttachmentBlob(messageId) {
  const token = getToken();
  const res = await fetch(`/api/messages/${messageId}/attachment`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || res.statusText);
  }
  return res.blob();
}
