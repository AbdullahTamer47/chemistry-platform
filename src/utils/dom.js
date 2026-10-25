/**
 * dom.js — Safe DOM Utilities
 *
 * Provides guard-wrapped versions of common DOM operations.
 * All page init() functions that write to the DOM after async API calls
 * should use these helpers to prevent the
 * "Cannot set properties of null (setting 'innerHTML')" crash.
 */

/**
 * Safely set innerHTML of an element by ID.
 * Returns true if the element was found, false if the user navigated away.
 */
export function safeSetHTML(id, html) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.innerHTML = html;
  return true;
}

/**
 * Safely append HTML to an element by ID.
 */
export function safeAppendHTML(id, html) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.insertAdjacentHTML('beforeend', html);
  return true;
}

/**
 * Safely get an element and run a callback with it.
 */
export function withEl(id, callback) {
  const el = document.getElementById(id);
  if (!el) return false;
  callback(el);
  return true;
}

/**
 * Standard loading skeleton HTML for list containers.
 */
export function skeletonRows(count = 3, height = '80px') {
  return Array.from({ length: count }, () =>
    `<div class="skeleton" style="height:${height};border-radius:var(--radius-lg);margin-bottom:12px;"></div>`
  ).join('');
}

/**
 * Standard empty-state HTML.
 */
export function emptyState(icon, title, subtitle, actionHtml = '') {
  return `
    <div class="empty-state">
      <span class="material-symbols-rounded">${icon}</span>
      <h3>${title}</h3>
      <p>${subtitle}</p>
      ${actionHtml}
    </div>`;
}

/**
 * Standard error state HTML with retry button.
 */
export function errorState(message) {
  return `
    <div class="empty-state" style="padding:40px;">
      <span class="material-symbols-rounded" style="color:var(--danger,#ef4444);font-size:3rem;">error</span>
      <h3 style="margin:12px 0 6px;">حدث خطأ في التحميل</h3>
      <p style="color:var(--text-muted);margin-bottom:16px;">${message || 'حاول مرة أخرى'}</p>
      <button class="btn btn-primary btn-sm" onclick="window.location.reload()">
        <span class="material-symbols-rounded">refresh</span> إعادة المحاولة
      </button>
    </div>`;
}
