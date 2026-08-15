import { apiFetch } from './client';

export function fetchAttendance() {
  return apiFetch('/attendance');
}

export function clockIn() {
  return apiFetch('/attendance/clock-in', { method: 'POST' });
}

export function clockOut() {
  return apiFetch('/attendance/clock-out', { method: 'POST' });
}

export function updateAttendanceStatus(id, status) {
  return apiFetch(`/attendance/${id}`, { method: 'PATCH', body: { status } });
}
