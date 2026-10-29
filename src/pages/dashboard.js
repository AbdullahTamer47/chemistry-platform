import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { getUser } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { getInitials, formatCurrency, esc } from '../utils/helpers.js';
import { safeSetHTML, errorState } from '../utils/dom.js';
import chemCurriculum from '../assets/chem-curriculum-3d.jpg';
import { openChemistryLabModal } from '../components/chemistryLabModal.js';

export function renderDashboard() {
  return `
  <div class="app-layout">
    ${renderNavbar('dashboard')}
    <main class="main-content">
      <!-- Welcome Banner -->
      <div id="dashWelcome" style="margin-bottom: 24px;">
        <div class="skeleton" style="height: 140px; border-radius: var(--radius-xl);"></div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid" id="dashStats" style="margin-bottom: 28px;">
        <div class="skeleton-card skeleton"></div>
        <div class="skeleton-card skeleton"></div>
        <div class="skeleton-card skeleton"></div>
        <div class="skeleton-card skeleton"></div>
      </div>

      <!-- Main Columns -->
      <div style="display: grid; grid-template-columns: 2fr 1.1fr; gap: 24px;" id="dashGrid">
        <!-- Courses Column -->
        <div>
          <div class="section-header" style="background: var(--bg-card); padding: 16px 20px; border-radius: var(--radius-lg); border: 1px solid var(--border-light); box-shadow: var(--shadow-sm); margin-bottom: 18px;">
            <h2 class="section-title-sm" style="font-size: 1.08rem;"><span class="material-symbols-rounded" style="color:var(--primary); font-size:1.4rem;">auto_stories</span> كورساتك المشترك بها</h2>
            <a href="#/courses" class="btn btn-primary btn-sm" style="border-radius: var(--radius-full);"><span class="material-symbols-rounded">explore</span> استكشف الكورسات</a>
          </div>
          <div id="dashCourses" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="skeleton-card skeleton" style="height: 110px; border-radius: var(--radius-lg);"></div>
            <div class="skeleton-card skeleton" style="height: 110px; border-radius: var(--radius-lg);"></div>
          </div>
        </div>

        <!-- Sidebar Column -->
        <div style="display: flex; flex-direction: column; gap: 22px;">
          <!-- Quick Actions -->
          <div class="card" style="border-radius: var(--radius-xl); box-shadow: var(--shadow-md);">
            <h3 class="card-title" style="margin-bottom: 16px; font-size: 1.05rem;"><span class="material-symbols-rounded" style="color:var(--accent); font-size:1.3rem;">offline_bolt</span> أدوات الطالب السريعة</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
              <button type="button" id="dash-open-chem-lab" class="quick-action-tile">
                <span class="material-symbols-rounded" style="font-size:1.75rem; color:#10b981;">science</span>
                <span>المختبر التفاعلي</span>
              </button>
              <a href="#/exams" class="quick-action-tile">
                <span class="material-symbols-rounded" style="font-size:1.75rem; color:#3b82f6;">quiz</span>
                <span>الامتحانات</span>
              </a>
              <a href="#/wallet" class="quick-action-tile">
                <span class="material-symbols-rounded" style="font-size:1.75rem; color:var(--accent);">account_balance_wallet</span>
                <span>شحن المحفظة</span>
              </a>
              <a href="#/leaderboard" class="quick-action-tile">
                <span class="material-symbols-rounded" style="font-size:1.75rem; color:#8b5cf6;">emoji_events</span>
                <span>لوحة المتصدرين</span>
              </a>
            </div>
          </div>

          <!-- Activity / Timeline -->
          <div class="card" style="border-radius: var(--radius-xl); box-shadow: var(--shadow-md);">
            <h3 class="card-title" style="margin-bottom: 16px; font-size: 1.05rem;"><span class="material-symbols-rounded" style="color:var(--info); font-size:1.3rem;">history</span> آخر نشاطاتك</h3>
            <div id="dashActivity">
              <div class="skeleton-text skeleton"></div>
              <div class="skeleton-text skeleton" style="width: 80%;"></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>`;
}

export async function initDashboard() {
  initNavbar();
  const chemLabBtn = document.getElementById('dash-open-chem-lab');
  if (chemLabBtn) {
    chemLabBtn.addEventListener('click', () => openChemistryLabModal());
  }
  const user = getUser();
  if (!user) return;

  try {
    const data = await api.getDashboard();

    // 1. Welcome Banner
    const hour = new Date().getHours();
    let greeting = 'مساء الخير';
    if (hour < 12) greeting = 'صباح الخير';
    else if (hour < 17) greeting = 'طاب يومك';
    else greeting = 'مساء النور';

    const welcomeOk = safeSetHTML('dashWelcome', `
      <div style="background: linear-gradient(135deg, #065f46 0%, #059669 60%, #10b981 100%); border-radius: var(--radius-xl); padding: clamp(18px, 3.5vw, 28px) clamp(18px, 4vw, 32px); color: white; display: flex; align-items: center; justify-content: space-between; gap: 18px; box-shadow: 0 12px 28px rgba(5, 150, 105, 0.22); position: relative; overflow: hidden; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 16px; min-width: 0; flex: 1;">
          <div style="width: clamp(50px, 6vw, 64px); height: clamp(50px, 6vw, 64px); border-radius: 50%; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; font-size: clamp(1.2rem, 2.5vw, 1.5rem); font-weight: 800; border: 2px solid rgba(255,255,255,0.35); flex-shrink: 0;">
            ${getInitials(data.user?.name || user.name)}
          </div>
          <div style="min-width: 0; flex: 1;">
            <h1 style="font-size: clamp(1.15rem, 3vw, 1.55rem); font-weight: 900; line-height: 1.35; color: #ffffff;">${greeting}، ${esc(data.user?.name || user.name)} 👋</h1>
            <p style="opacity: 0.95; font-size: 0.85rem; margin-top: 6px; font-weight: 600; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="badge" style="background: rgba(255,255,255,0.22); color: #ffffff; font-size:0.75rem; padding: 4px 10px;">${esc(data.user?.grade || user.grade)}</span>
              <span>جاهز لمحاضرة جديدة في الكيمياء؟</span>
            </p>
          </div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <a href="#/courses" class="btn btn-sm" style="background:#ffffff; color:#065f46 !important; font-weight:800; border-radius:12px; padding:9px 16px; box-shadow:0 4px 12px rgba(0,0,0,0.12);">
            <span class="material-symbols-rounded" style="color:#059669 !important;">play_circle</span> ابدأ المذاكرة
          </a>
        </div>
      </div>
    `);
    if (!welcomeOk) return;

    // 2. Stats Grid
    safeSetHTML('dashStats', `
      <div class="stat-card">
        <div class="stat-icon gold"><span class="material-symbols-rounded">payments</span></div>
        <div class="stat-info">
          <div class="stat-value" style="font-size: 1.35rem;">${formatCurrency(data.user?.balance || 0)}</div>
          <div class="stat-label">رصيد المحفظة</div>
        </div>
        <a href="#/wallet" class="btn btn-ghost btn-sm" style="min-width: 0; padding: 6px;" title="شحن المحفظة"><span class="material-symbols-rounded" style="font-size:1.35rem; color:var(--primary);">add_circle</span></a>
      </div>

      <div class="stat-card">
        <div class="stat-icon green"><span class="material-symbols-rounded">emoji_events</span></div>
        <div class="stat-info">
          <div class="stat-value">#${data.stats?.rank || '-'}</div>
          <div class="stat-label">ترتيبك بالمنصة</div>
        </div>
        <a href="#/leaderboard" class="btn btn-ghost btn-sm" style="min-width: 0; padding: 6px;" title="المتصدرين"><span class="material-symbols-rounded" style="font-size:1.35rem; color:var(--primary);">chevron_left</span></a>
      </div>

      <div class="stat-card">
        <div class="stat-icon blue"><span class="material-symbols-rounded">leaderboard</span></div>
        <div class="stat-info">
          <div class="stat-value">${data.stats?.avg_score || 0}%</div>
          <div class="stat-label">متوسط درجاتك</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon purple"><span class="material-symbols-rounded">assignment_turned_in</span></div>
        <div class="stat-info">
          <div class="stat-value">${data.stats?.exams_taken || 0}</div>
          <div class="stat-label">امتحانات مكتملة</div>
        </div>
      </div>
    `);

    // 3. Active Courses
    const courses = data.activeCourses || [];
    safeSetHTML('dashCourses', courses.length === 0
      ? `
        <div class="card" style="padding: 36px 24px; text-align: center; display:flex; flex-direction:column; align-items:center; border: 1.5px dashed var(--border);">
          <span class="material-symbols-rounded" style="font-size: 3.2rem; color: var(--primary); margin-bottom:12px;">school</span>
          <h3 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 6px; color: var(--text-primary);">ابدأ رحلتك التعليمية الآن</h3>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px; max-width: 380px;">يمكنك الاشتراك في الكورس التأسيسي المجاني فوراً أو تفعيل أي كورس من كورسات المنهج</p>
          <a href="#/courses" class="btn btn-primary"><span class="material-symbols-rounded">school</span> تصفح الكورسات المتاحة</a>
        </div>
      `
      : courses.map(c => `
        <div class="dash-course-card" onclick="window.location.hash='#/courses/${c.id}'">
          <div style="display:flex; align-items:center; gap:16px; flex:1; min-width:0;">
            <div style="width: 76px; height: 76px; border-radius: 12px; overflow: hidden; flex-shrink: 0; position: relative; box-shadow: var(--shadow-sm);">
              <img src="${c.thumbnail || chemCurriculum}" alt="${esc(c.title)}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
                <span class="badge badge-success" style="font-size:0.7rem; padding:3px 10px;">مفعل</span>
                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${esc(c.grade || 'ثانوية عامة')}</span>
              </div>
              <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 10px;">${esc(c.title)}</h3>
              <div style="display: flex; align-items: center; gap: 12px;">
                <div class="progress-bar" style="max-width: 200px; height: 8px; flex: 1; border-radius: 4px;">
                  <div class="progress-fill" style="width: ${c.progress || 0}%"></div>
                </div>
                <span style="font-size: 0.75rem; font-weight: 800; color: var(--primary);">${c.progress || 0}% مكتمل</span>
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-primary dash-course-btn" style="gap:4px; padding:9px 18px; font-size:0.85rem; flex-shrink:0; border-radius: 10px;">
            متابعة <span class="material-symbols-rounded" style="font-size:1.1rem;">arrow_left</span>
          </button>
        </div>
      `).join(''));

    // 4. Recent Activity Timeline
    const activities = data.recentActivity || [];
    safeSetHTML('dashActivity', activities.length === 0
      ? '<p style="font-size: 0.82rem; color: var(--text-muted); text-align: center; padding: 14px 0;">لا توجد نشاطات مسجلة بعد — ابدأ بحضور أول محاضرة!</p>'
      : `<div style="display: flex; flex-direction: column; gap: 14px; position: relative; padding-right: 12px; border-right: 2px solid var(--border-light); margin-right: 6px;">
          ${activities.map(act => {
            let icon = 'info';
            let color = 'var(--text-muted)';
            if (act.action.includes('امتحان')) { icon = 'assignment_turned_in'; color = 'var(--primary)'; }
            else if (act.action.includes('شحن') || act.action.includes('محفظة')) { icon = 'payments'; color = 'var(--accent)'; }
            else if (act.action.includes('تفعيل') || act.action.includes('كورس') || act.action.includes('فعّلت')) { icon = 'auto_stories'; color = 'var(--info)'; }
            return `
              <div style="position: relative;">
                <div style="position: absolute; right: -19px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: ${color}; border: 3px solid var(--bg-card); box-shadow: 0 0 0 1px var(--border);"></div>
                <div style="display: flex; gap: 10px; align-items: flex-start;">
                  <span class="material-symbols-rounded" style="font-size:1.1rem; color:${color}; margin-top:2px;">${icon}</span>
                  <div>
                    <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary); line-height: 1.4;">${esc(act.action)}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${new Date(act.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>`);

  } catch (err) {
    if (!safeSetHTML('dashWelcome', errorState(err.message))) {
      showToast(err.message, 'error');
    }
  }
}
