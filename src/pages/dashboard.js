import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { getUser } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { getInitials, formatCurrency } from '../utils/helpers.js';
import chemCurriculum from '../assets/chem-curriculum-3d.jpg';
import { openChemistryLabModal } from '../components/chemistryLabModal.js';

export function renderDashboard() {
  const user = getUser();
  return `
  <div class="app-layout">
    ${renderNavbar('dashboard')}
    <main class="main-content">
      <!-- Welcome Banner -->
      <div id="dashWelcome" style="margin-bottom: 28px;">
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
          <div class="section-header">
            <h2 class="section-title-sm"><span class="material-symbols-rounded" style="color:var(--primary)">auto_stories</span> كورساتك المستمرة</h2>
            <a href="#/courses" class="btn btn-ghost btn-sm" style="font-weight:700">تصفح الكورسات الجديدة <span class="material-symbols-rounded">arrow_left</span></a>
          </div>
          <div id="dashCourses" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="skeleton-card skeleton" style="height: 100px;"></div>
            <div class="skeleton-card skeleton" style="height: 100px;"></div>
          </div>
        </div>

        <!-- Sidebar Column -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Quick Actions -->
          <div class="card">
            <h3 class="card-title" style="margin-bottom: 16px;"><span class="material-symbols-rounded" style="color:var(--accent)">offline_bolt</span> وصول سريع</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
              <a href="#/wallet" class="btn btn-secondary btn-sm" style="flex-direction:column; gap:8px; padding:14px 6px;">
                <span class="material-symbols-rounded" style="font-size:1.5rem; color:var(--accent);">wallet</span>
                <span style="font-size:0.75rem;">المحفظة</span>
              </a>
              <a href="#/leaderboard" class="btn btn-secondary btn-sm" style="flex-direction:column; gap:8px; padding:14px 6px;">
                <span class="material-symbols-rounded" style="font-size:1.5rem; color:var(--primary);">emoji_events</span>
                <span style="font-size:0.75rem;">المتصدرين</span>
              </a>
              <button id="dash-open-chem-lab" class="btn btn-secondary btn-sm" style="flex-direction:column; gap:8px; padding:14px 6px; border:1px solid rgba(16,185,129,0.3); background:rgba(16,185,129,0.06); cursor:pointer;">
                <span class="material-symbols-rounded" style="font-size:1.5rem; color:#10b981;">science</span>
                <span style="font-size:0.75rem; color:#10b981; font-weight:700;">المختبر</span>
              </button>
            </div>
          </div>

          <!-- Activity / Timeline -->
          <div class="card">
            <h3 class="card-title" style="margin-bottom: 16px;"><span class="material-symbols-rounded" style="color:var(--info)">history</span> آخر النشاطات</h3>
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
    else if (hour < 17) greeting = 'طاب ظهرك';
    else greeting = 'مساء النور';
    
    document.getElementById('dashWelcome').innerHTML = `
      <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); border-radius: var(--radius-xl); padding: clamp(16px, 3.5vw, 28px) clamp(16px, 4vw, 32px); color: white; display: flex; align-items: center; gap: clamp(12px, 3vw, 24px); box-shadow: var(--shadow-lg); position: relative; overflow: hidden; flex-wrap: wrap;">
        <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 30%; background: radial-gradient(circle at center left, rgba(255,255,255,0.08) 0%, transparent 70%); pointer-events: none;"></div>
        <div style="width: clamp(48px, 6vw, 64px); height: clamp(48px, 6vw, 64px); border-radius: 50%; background: rgba(255,255,255,0.18); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; font-size: clamp(1.2rem, 2.5vw, 1.5rem); font-weight: 800; border: 2px solid rgba(255,255,255,0.3); flex-shrink: 0;">
          ${getInitials(data.user?.name || user.name)}
        </div>
        <div style="min-width: 0; flex: 1;">
          <h1 style="font-size: clamp(1.2rem, 3vw, 1.55rem); font-weight: 900; line-height: 1.3;">${greeting}، ${data.user?.name || user.name}</h1>
          <p style="opacity: 0.9; font-size: 0.85rem; margin-top: 4px; font-weight: 600;">
            <span class="badge" style="background: rgba(255,255,255,0.15); color: white;">${data.user?.grade || user.grade}</span> 
            · مستعد لحصة جديدة من المتعة والتعلم؟
          </p>
        </div>
      </div>
    `;

    // 2. Stats Grid
    document.getElementById('dashStats').innerHTML = `
      <!-- Balance Card -->
      <div class="stat-card">
        <div class="stat-icon gold"><span class="material-symbols-rounded">payments</span></div>
        <div class="stat-info">
          <div class="stat-value" style="font-size: 1.45rem;">${formatCurrency(data.user?.balance || 0)}</div>
          <div class="stat-label">رصيد المحفظة</div>
        </div>
        <a href="#/wallet" class="btn btn-ghost btn-sm" style="min-width: 0; padding: 4px;" title="شحن المحفظة"><span class="material-symbols-rounded" style="font-size:1.3rem; color:var(--primary);">add_circle</span></a>
      </div>

      <!-- Rank Card -->
      <div class="stat-card">
        <div class="stat-icon green"><span class="material-symbols-rounded">emoji_events</span></div>
        <div class="stat-info">
          <div class="stat-value">#${data.stats?.rank || '-'}</div>
          <div class="stat-label">ترتيبك بالمنصة</div>
        </div>
        <a href="#/leaderboard" class="btn btn-ghost btn-sm" style="min-width: 0; padding: 4px;" title="المتصدرين"><span class="material-symbols-rounded" style="font-size:1.3rem; color:var(--primary);">chevron_left</span></a>
      </div>

      <!-- Exam Score Card -->
      <div class="stat-card">
        <div class="stat-icon blue"><span class="material-symbols-rounded">leaderboard</span></div>
        <div class="stat-info">
          <div class="stat-value">${data.stats?.avg_score || 0}%</div>
          <div class="stat-label">متوسط درجاتك</div>
        </div>
      </div>

      <!-- Exams Count Card -->
      <div class="stat-card">
        <div class="stat-icon purple"><span class="material-symbols-rounded">assignment_turned_in</span></div>
        <div class="stat-info">
          <div class="stat-value">${data.stats?.exams_taken || 0}</div>
          <div class="stat-label">امتحانات تم حلها</div>
        </div>
      </div>
    `;

    // 3. Active Courses
    const courses = data.activeCourses || [];
    document.getElementById('dashCourses').innerHTML = courses.length === 0
      ? `
        <div class="card" style="padding: 40px; text-align: center; display:flex; flex-direction:column; align-items:center;">
          <span class="material-symbols-rounded" style="font-size: 3.2rem; color: var(--text-muted); margin-bottom:12px;">school</span>
          <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 6px;">لا توجد كورسات مفعلة</h3>
          <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 20px;">تقدر تتصفح الكورسات المتاحة وتفعلها بكود الاشتراك</p>
          <a href="#/courses" class="btn btn-primary"><span class="material-symbols-rounded">school</span> تصفح الكورسات المتاحة</a>
        </div>
      `
      : courses.map(c => `
        <div class="card" style="padding: 14px 18px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: all 0.2s ease; border-radius: 16px;" onclick="window.location.hash='#/courses/${c.id}'">
          <div style="width: 72px; height: 72px; border-radius: 12px; overflow: hidden; flex-shrink: 0; position: relative; border:1px solid var(--border-light);">
            <img src="${c.thumbnail || chemCurriculum}" alt="${c.title}" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <span class="badge" style="background:rgba(5, 150, 105, 0.1); color:var(--primary); font-size:0.68rem; padding:1px 6px; font-weight:700;">مفتوح طوال العام</span>
              <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">${c.grade || 'ثانوية عامة'}</span>
            </div>
            <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px;">${c.title}</h3>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="progress-bar" style="max-width: 160px; height: 6px; flex: 1;">
                <div class="progress-fill" style="width: ${c.progress || 0}%"></div>
              </div>
              <span style="font-size: 0.74rem; font-weight: 800; color: var(--primary);">${c.progress || 0}% مكتمل</span>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" style="gap:4px; padding:6px 14px; font-size:0.8rem; flex-shrink:0;">
            متابعة <span class="material-symbols-rounded" style="font-size:1rem;">arrow_left</span>
          </button>
        </div>
      `).join('');

    // 4. Recent Activity Timeline
    const activities = data.recentActivity || [];
    document.getElementById('dashActivity').innerHTML = activities.length === 0
      ? '<p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 12px 0;">لا توجد نشاطات مؤخراً</p>'
      : `<div style="display: flex; flex-direction: column; gap: 14px; position: relative; padding-right: 12px; border-right: 2px solid var(--border-light); margin-right: 6px;">
          ${activities.map(act => {
            let icon = 'info';
            let color = 'var(--text-muted)';
            if (act.action.includes('امتحان')) { icon = 'assignment_turned_in'; color = 'var(--primary)'; }
            else if (act.action.includes('شحن') || act.action.includes('محفظة')) { icon = 'payments'; color = 'var(--accent)'; }
            else if (act.action.includes('تفعيل') || act.action.includes('كورس')) { icon = 'auto_stories'; color = 'var(--info)'; }
            
            return `
              <div style="position: relative;">
                <!-- Timeline dot -->
                <div style="position: absolute; right: -19px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: ${color}; border: 3px solid var(--bg-card); box-shadow: 0 0 0 1px var(--border);"></div>
                <div style="display: flex; gap: 10px; align-items: flex-start;">
                  <span class="material-symbols-rounded" style="font-size:1.1rem; color:${color}; margin-top:2px;">${icon}</span>
                  <div>
                    <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary); line-height: 1.4;">${act.action}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${new Date(act.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>`;

  } catch (err) {
    showToast(err.message, 'error');
  }
}
