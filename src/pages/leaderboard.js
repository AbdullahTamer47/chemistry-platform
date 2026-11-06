import { renderNavbar, initNavbar } from '../components/navbar.js';
import { renderBrandErrorIllustration, renderBrandLoader } from '../components/bedigitalBrand.js';
import { api } from '../utils/api.js';
import { getUser, isTeacher } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { getInitials, esc, gradesList } from '../utils/helpers.js';

export function renderLeaderboard() {
  const user = getUser();
  const teacher = isTeacher();
  const studentScopeLabel = user && !teacher ? `${user.grade || ''} (${user.study_track || 'عام'})` : '';

  return `<div class="app-layout">
    ${renderNavbar('leaderboard')}
    <main class="main-content">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--accent)">emoji_events</span> لوحة الشرف والمتصدرين</h1>
          <p class="page-subtitle">
            ${teacher
              ? 'قائمة أوائل المنصة (أعلى 10 طلاب وفق معادلة التفوق التراكمي لعدد الامتحانات والمعدل)'
              : `أعلى 10 طلاب متفوقين في مرحلتك الدراسية وشعبتك: ${esc(studentScopeLabel)}`}
          </p>
        </div>
        ${!teacher && studentScopeLabel ? `
          <span class="badge badge-success" style="font-size:0.82rem;padding:6px 14px;">
            <span class="material-symbols-rounded" style="font-size:1rem;">verified</span>
            مخصصة لطلاب ${esc(studentScopeLabel)}
          </span>
        ` : ''}
      </div>
      ${teacher ? `
        <div class="tabs" id="lbTabs">
          <div class="tab active" data-filter="">جميع المراحل</div>
          ${gradesList.map(g => `<div class="tab" data-filter="${esc(g)}">${esc(g)}</div>`).join('')}
        </div>
      ` : ''}
      <div class="card" id="lbMyRank" style="margin-bottom:20px">${renderBrandLoader('جاري حساب ترتيبك ونقاطك...')}</div>
      <div class="card" id="lbContent">${renderBrandLoader('جاري تحميل قائمة المتصدرين...')}</div>
    </main>
  </div>`;
}

export async function initLeaderboard() {
  initNavbar();
  const user = getUser();
  const teacher = isTeacher();

  async function load(grade) {
    try {
      const targetGrade = teacher ? grade : (user?.grade || '');
      const targetTrack = teacher ? '' : (user?.study_track || 'عام');
      const queryParams = {};
      if (targetGrade) queryParams.grade = targetGrade;
      if (targetTrack) queryParams.track = targetTrack;

      const [students, myRank] = await Promise.all([
        api.getLeaderboard(queryParams),
        api.getMyRank()
      ]);

      const badgeIcon = (badge) => {
        if (!badge) return 'explore';
        if (badge.badge === 'crown') return 'military_tech';
        if (badge.badge === 'flask') return 'science';
        if (badge.badge === 'atom') return 'blur_on';
        return 'explore';
      };

      document.getElementById('lbMyRank').innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="stat-icon gold" style="width:52px;height:52px;font-size:1.4rem"><span class="material-symbols-rounded">workspace_premium</span></div>
            <div>
              <div style="font-size:0.82rem;color:var(--text-muted)">ترتيبك في دفعتك (${esc(myRank.grade || user?.grade || '')} · ${esc(myRank.study_track || user?.study_track || 'عام')})</div>
              <div style="font-size:1.8rem;font-weight:900;color:var(--accent)">#${myRank.rank || '-'}</div>
            </div>
          </div>
          ${myRank.badge ? `
          <div style="background:${myRank.badge.color}15;border:1px solid ${myRank.badge.color}40;padding:6px 14px;border-radius:20px;display:flex;align-items:center;gap:6px">
            <span class="material-symbols-rounded" style="color:${myRank.badge.color};font-size:1.2rem">${badgeIcon(myRank.badge)}</span>
            <span style="font-weight:800;color:${myRank.badge.color};font-size:0.95rem">${myRank.badge.title}</span>
          </div>` : ''}
          <div style="display:flex;gap:20px;flex-wrap:wrap;">
            <div><div style="font-size:0.82rem;color:var(--text-muted)">نقاط التفوق</div><div style="font-size:1.4rem;font-weight:800;color:var(--accent)">${myRank.mastery_points || myRank.total_score || 0}</div></div>
            <div><div style="font-size:0.82rem;color:var(--text-muted)">المعدل العام</div><div style="font-size:1.4rem;font-weight:800;color:var(--primary)">${myRank.avg_score || 0}%</div></div>
            <div><div style="font-size:0.82rem;color:var(--text-muted)">الامتحانات المنجزة</div><div style="font-size:1.4rem;font-weight:800">${myRank.total_exams || 0}</div></div>
          </div>
        </div>
      `;

      document.getElementById('lbContent').innerHTML = students.length === 0
        ? `<div class="empty-state">${renderBrandErrorIllustration('empty')}<h3>لا يوجد متصدرون في هذه المرحلة حتى الآن</h3><p>يظهر في لوحة المتصدرين أعلى 10 طلاب متفوقين حسب مجموع النقاط التراكمي وعدد الامتحانات المجتازة.</p></div>`
        : `<ul class="leaderboard-list">${students.slice(0, 10).map(s => `
          <li class="leaderboard-item ${s.id === user?.id ? 'current-user' : ''}">
            <div class="leaderboard-rank ${s.rank <= 3 ? `rank-${s.rank}` : ''}" style="${s.rank > 3 ? 'background:var(--bg-main);color:var(--text-muted)' : ''}">${s.rank <= 3 ? `<span class="material-symbols-rounded" style="color:${s.rank===1 ? '#EAB308' : s.rank===2 ? '#94A3B8' : '#D97706'}; font-size:1.3rem;">workspace_premium</span>` : s.rank}</div>
            <div class="leaderboard-avatar">${getInitials(s.name)}</div>
            <div class="leaderboard-info">
              <div class="leaderboard-name" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span>${esc(s.name)} ${s.id === user?.id ? '(أنت)' : ''}</span>
                ${s.badge ? `<span style="background:${esc(s.badge.color)}15;color:${esc(s.badge.color)};border:1px solid ${esc(s.badge.color)}35;font-size:0.75rem;padding:2px 8px;border-radius:12px;display:inline-flex;align-items:center;gap:4px">
                  <span class="material-symbols-rounded" style="font-size:0.85rem">${badgeIcon(s.badge)}</span>
                  <span>${esc(s.badge.title)}</span>
                </span>` : ''}
              </div>
              <div class="leaderboard-grade">${esc(s.grade || '')} (${esc(s.study_track || 'عام')}) · ${s.exams_taken || 1} امتحانات · مجموع الدرجات: ${s.total_score || 0}</div>
            </div>
            <div style="text-align:left;">
              <div class="leaderboard-score">${s.avg_score || s.score || 0}%</div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">${s.mastery_points || s.total_score || 0} نقطة</div>
            </div>
          </li>
        `).join('')}</ul>`;
    } catch (err) { showToast(err.message, 'error'); }
  }

  document.getElementById('lbTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('#lbTabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    load(tab.dataset.filter);
  });

  load('');
}
