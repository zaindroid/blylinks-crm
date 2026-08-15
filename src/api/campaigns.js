import { apiFetch } from './client';

export function fetchCampaigns() {
  return apiFetch('/campaigns');
}

export function createCampaign(campaign) {
  return apiFetch('/campaigns', { method: 'POST', body: campaign });
}

export function updateCampaign(id, updates) {
  return apiFetch(`/campaigns/${id}`, { method: 'PATCH', body: updates });
}

export function toggleCampaignStatus(id) {
  return apiFetch(`/campaigns/${id}/toggle-status`, { method: 'PATCH' });
}
