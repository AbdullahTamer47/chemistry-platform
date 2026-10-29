const icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };

export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  const safeType = icons[type] ? type : 'info';
  const toast = document.createElement('div');
  toast.className = `toast ${safeType}`;
  toast.setAttribute('role', 'status');
  // Build with DOM APIs: the message is always treated as plain text, never HTML.
  const icon = document.createElement('span');
  icon.className = 'material-symbols-rounded';
  icon.textContent = icons[safeType];
  const text = document.createElement('span');
  text.textContent = String(message ?? '');
  toast.append(icon, text);
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-100%)'; setTimeout(() => toast.remove(), 300); }, duration);
}
