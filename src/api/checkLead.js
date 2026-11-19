import { apiFetch } from './client';

// Any authenticated role. Cross-campaign, no scoping -- "has this number already been worked
// anywhere in the org" is the whole point. Returns { sales, leads, callbacks }.
export function checkLead(phone) {
  return apiFetch(`/check-lead?phone=${encodeURIComponent(phone)}`);
}
