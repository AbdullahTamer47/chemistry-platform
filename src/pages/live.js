import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { formatDateTime, esc, safeUrl } from '../utils/helpers.js';

export function renderLive() {
  return `<div class="app-layout">
    ${renderNavbar('live')}
    <main class="main-content">
      <div class="page-header"><h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--error)">live_tv</span> الحصص اللايف</h1><p class="page-subtitle">حصص مباشرة تفاعلية مع د. زياد</p></div>
      <div id="liveContent"><div class="loading-spinner"><div class="spinner"></div></div></div>
    </main>
  </div>`;
}

export async function initLive() {
  initNavbar();
  try {
    const sessions = await api.getLiveSessions();
    const upcoming = sessions.filter(s => s.status === 'upcoming' || s.status === 'live');
    const past = sessions.filter(s => s.status === 'completed');

    document.getElementById('liveContent').innerHTML = `
      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:16px"><span class="live-dot red" style="display:inline-block;margin-left:6px"></span> الحصص القادمة</h2>
      ${upcoming.length === 0 ? '<div class="card"><div class="empty-state" style="padding:30px"><span class="material-symbols-rounded">calendar_month</span><h3>لا توجد حصص قادمة حالياً</h3></div></div>' :
        upcoming.map(s => `
          <div class="live-card ${s.status === 'live' ? 'is-live' : ''}">
            <div class="stat-icon ${s.status === 'live' ? 'red' : 'purple'}" style="width:52px;height:52px;font-size:1.3rem;flex-shrink:0;background:${s.status === 'live' ? '#FEE2E2' : '#EDE9FE'};color:${s.status === 'live' ? 'var(--error)' : '#7C3AED'}">
              <span class="material-symbols-rounded">live_tv</span>
            </div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <h3 style="font-weight:700;font-size:0.95rem">${esc(s.title)}</h3>
                ${s.status === 'live' ? '<span class="badge badge-danger"><span class="live-dot red" style="display:inline-block;margin-left:4px"></span> مباشر الآن</span>' : ''}
              </div>
              <div style="display:flex;gap:14px;font-size:0.8rem;color:var(--text-muted)">
                <span><span class="material-symbols-rounded">calendar_month</span> ${formatDateTime(s.scheduled_at)}</span>
                <span><span class="material-symbols-rounded">schedule</span> ${s.duration_minutes} دقيقة</span>
                ${s.course_title ? `<span><span class="material-symbols-rounded">book</span> ${esc(s.course_title)}</span>` : ''}
              </div>
              ${s.description ? `<p style="font-size:0.82rem;color:var(--text-muted);margin-top:6px">${esc(s.description)}</p>` : ''}
            </div>
            ${s.meeting_link ? `<a href="${safeUrl(s.meeting_link)}" rel="noopener noreferrer" target="_blank" class="btn ${s.status === 'live' ? 'btn-danger' : 'btn-primary'} btn-sm"><span class="material-symbols-rounded">video_chat</span> ${s.status === 'live' ? 'انضم الآن' : 'رابط الحصة'}</a>` : ''}
          </div>
        `).join('')}
      ${past.length > 0 ? `
        <h2 style="font-size:1.1rem;font-weight:700;margin:30px 0 16px"><span class="material-symbols-rounded" style="color:var(--text-muted)">history</span> الحصص السابقة</h2>
        ${past.map(s => `
          <div class="live-card" style="opacity:0.7">
            <div class="stat-icon" style="width:52px;height:52px;font-size:1.3rem;flex-shrink:0;background:var(--bg-main);color:var(--text-muted)"><span class="material-symbols-rounded">videocam</span></div>
            <div style="flex:1"><h3 style="font-weight:700;font-size:0.95rem">${esc(s.title)}</h3><div style="font-size:0.8rem;color:var(--text-muted)">${formatDateTime(s.scheduled_at)}</div></div>
            ${s.replay_url ? `<a href="${safeUrl(s.replay_url)}" rel="noopener noreferrer" target="_blank" class="btn btn-ghost btn-sm"><span class="material-symbols-rounded">play_arrow</span> مشاهدة</a>` : '<span style="font-size:0.75rem;color:var(--text-muted)">لا يوجد تسجيل</span>'}
          </div>
        `).join('')}
      ` : ''}
    `;
  } catch (err) { showToast(err.message, 'error'); }
}
