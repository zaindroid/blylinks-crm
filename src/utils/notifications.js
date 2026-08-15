// Thin wrapper around the browser Notification API for desktop-side alerts.
// Only fires an OS notification when permission is granted and the tab is
// backgrounded — the in-app toast already covers the focused-tab case.

export function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function showDesktopNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;

  try {
    const notification = new Notification(title, {
      body,
      tag: 'blylinks-crm'
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some environments (e.g. blocked service workers) can throw; fail silently.
  }
}
