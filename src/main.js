import './styles/main.css';
import './styles/landing.css';
import './styles/pages.css';

import { renderLanding, initLanding } from './pages/landing.js';
import { renderLogin, initLogin, renderRegister, initRegister } from './pages/auth.js';
import { renderDashboard, initDashboard } from './pages/dashboard.js';
import { renderCourses, initCourses } from './pages/courses.js';
import { renderCourseDetail, initCourseDetail } from './pages/courseDetail.js';
import { renderLesson, initLesson } from './pages/lesson.js';
import { renderExams, initExams, renderExamTake, initExamTake, renderExamReview, initExamReview } from './pages/exams.js';
import { renderLeaderboard, initLeaderboard } from './pages/leaderboard.js';
import { renderMyResults, initMyResults } from './pages/myResults.js';
import { renderLive, initLive } from './pages/live.js';
import { renderWallet, initWallet } from './pages/wallet.js';
import { renderCertificates, initCertificates } from './pages/certificates.js';
import { renderPackages, initPackages } from './pages/packages.js';
import { renderLab, initLab } from './pages/lab.js';
import { renderParentPortal, initParentPortal } from './pages/parentPortal.js';
import {
  renderAdmin, initAdmin,
  renderAdminCourses, initAdminCourses,
  renderAdminCodes, initAdminCodes,
  renderAdminStudents, initAdminStudents,
  renderAdminExams, initAdminExams,
  renderAdminLive, initAdminLive,
  renderAdminNotifications, initAdminNotifications
} from './pages/admin.js';
import { renderAdminCourseDetail, initAdminCourseDetail } from './pages/adminCourseDetail.js';
import { renderAdminExamDetail, initAdminExamDetail } from './pages/adminExamDetail.js';
import { renderNavbar, initNavbar } from './components/navbar.js';
import { api } from './utils/api.js';
import { isLoggedIn, isTeacher, requireAuth, requireTeacher, getUser } from './utils/auth.js';
import { showToast } from './components/toast.js';
import { timeAgo, esc, gradesList } from './utils/helpers.js';

const app = document.getElementById('app');

let navigationId = 0;

function isDomMounted(elementId) {
  return !!document.getElementById(elementId);
}

window.__nav = { getId: () => navigationId, isDomMounted };

// Clean URL navigation helper (no '#' in URL)
export function navigateTo(rawTarget, replace = false) {
  let clean = String(rawTarget || '/').trim();
  if (clean.startsWith('#/')) clean = clean.slice(1);
  if (!clean.startsWith('/')) clean = '/' + clean;
  if (replace) {
    window.history.replaceState(null, '', clean);
  } else if (window.location.pathname + window.location.search !== clean) {
    window.history.pushState(null, '', clean);
  }
  navigate();
}

window.navigateTo = navigateTo;

function renderErrorState(containerId, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="empty-state" style="padding:40px;">
      <span class="material-symbols-rounded" style="color:var(--danger,#ef4444);font-size:3rem;">error</span>
      <h3 style="margin:12px 0 6px;">حدث خطأ في التحميل</h3>
      <p style="color:var(--text-muted);margin-bottom:16px;">${esc(message)}</p>
      <button class="btn btn-primary btn-sm" onclick="window.location.reload()">
        <span class="material-symbols-rounded">refresh</span> إعادة المحاولة
      </button>
    </div>`;
}

// ===== Notifications Page =====
function renderNotifications() {
  return `<div class="app-layout">
    ${renderNavbar('notifications')}
    <main class="main-content">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--warning)">notifications</span> الإشعارات</h1>
          <p class="page-subtitle">آخر الأخبار والتحديثات على حسابك</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="markAllReadBtn" style="gap:6px;">
          <span class="material-symbols-rounded">done_all</span> تحديد الكل كمقروء
        </button>
      </div>
      <div id="notifsContent"><div class="loading-spinner"><div class="spinner"></div></div></div>
    </main>
  </div>`;
}

async function initNotifications(navId) {
  initNavbar();

  const markAllBtn = document.getElementById('markAllReadBtn');
  markAllBtn?.addEventListener('click', async () => {
    try {
      await api.markAllNotifsRead();
      document.querySelectorAll('[data-nid]').forEach(el => {
        el.style.opacity = '0.6';
        el.querySelector('.badge')?.remove();
      });
      showToast('تم تحديد الكل كمقروء', 'success');
      const badge = document.getElementById('notifBadge');
      if (badge) badge.style.display = 'none';
    } catch(e) { showToast(e.message, 'error'); }
  });

  try {
    const notifs = await api.getNotifications();
    const container = document.getElementById('notifsContent');
    if (!container) return;

    container.innerHTML = notifs.length === 0
      ? '<div class="empty-state"><span class="material-symbols-rounded">notifications_off</span><h3>لا توجد إشعارات</h3><p>ستظهر هنا إشعاراتك عند وصولها</p></div>'
      : `<div style="display:flex;flex-direction:column;gap:10px;">${notifs.map(n => `
        <div class="card" style="padding:18px;opacity:${n.is_read ? 0.65 : 1};cursor:pointer;border-right:4px solid ${n.type === 'success' ? 'var(--success)' : n.type === 'warning' ? 'var(--warning)' : 'var(--info)'}; transition: opacity 0.2s;" data-nid="${n.id}">
          <div style="display:flex;align-items:center;gap:14px;">
            <div class="stat-icon ${n.type === 'success' ? 'green' : n.type === 'warning' ? 'gold' : 'blue'}" style="width:44px;height:44px;font-size:1rem;flex-shrink:0;">
              <span class="material-symbols-rounded">${n.type === 'success' ? 'check_circle' : n.type === 'warning' ? 'warning' : 'info'}</span>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:0.92rem;display:flex;align-items:center;gap:8px;">
                ${esc(n.title)}
                ${!n.is_read ? '<span class="badge badge-info" style="font-size:0.65rem;">جديد</span>' : ''}
              </div>
              <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:4px;line-height:1.5;">${esc(n.message)}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:6px;display:flex;align-items:center;gap:4px;">
                <span class="material-symbols-rounded" style="font-size:0.85rem;">schedule</span>
                ${timeAgo(n.created_at)}
              </div>
            </div>
          </div>
        </div>
      `).join('')}</div>`;

    document.querySelectorAll('[data-nid]').forEach(el => {
      el.addEventListener('click', async () => {
        const nid = el.dataset.nid;
        try {
          await api.markNotifRead(nid);
          el.style.opacity = '0.65';
          el.querySelector('.badge')?.remove();
        } catch (e) {}
      });
    });
  } catch (err) {
    const container = document.getElementById('notifsContent');
    if (container) {
      renderErrorState('notifsContent', err.message || 'تعذّر تحميل الإشعارات');
    } else {
      showToast(err.message, 'error');
    }
  }
}

// ===== Profile Page =====
function renderProfile() {
  return `<div class="app-layout">
    ${renderNavbar('profile')}
    <main class="main-content">
      <div class="page-header"><h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">person</span> الملف الشخصي</h1></div>
      <div id="profileContent"><div class="loading-spinner"><div class="spinner"></div></div></div>
    </main>
  </div>`;
}

async function initProfile(navId) {
  initNavbar();
  try {
    const user = await api.getMe();
    const container = document.getElementById('profileContent');
    if (!container) return;

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:24px;max-width:850px">
        <div class="card">
          <h3 style="font-weight:700;margin-bottom:20px;display:flex;align-items:center;gap:8px;"><span class="material-symbols-rounded" style="color:var(--primary)">person</span> بياناتي</h3>
          <form id="profileForm">
            <div class="form-group"><label class="form-label">الاسم</label><input type="text" class="form-input" id="pName" value="${esc(user.name)}" required></div>
            <div class="form-group"><label class="form-label">رقم الهاتف</label><input type="tel" class="form-input" id="pPhone" value="${esc(user.phone)}" disabled dir="ltr" style="opacity:0.6"></div>
            <div class="form-group"><label class="form-label">المرحلة الدراسية</label>
              <select class="form-select" id="pGrade">
                ${gradesList.map(g => `<option value="${g}" ${user.grade===g?'selected':''}>${g}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label class="form-label">رقم هاتف ولي الأمر</label><input type="tel" class="form-input" id="pParent" value="${esc(user.parent_phone || '')}" dir="ltr" placeholder="01XXXXXXXXX" required></div>
            <button type="submit" class="btn btn-primary btn-block"><span class="material-symbols-rounded">save</span> حفظ التعديلات</button>
          </form>
        </div>
        <div class="card">
          <h3 style="font-weight:700;margin-bottom:20px;display:flex;align-items:center;gap:8px;"><span class="material-symbols-rounded" style="color:var(--accent)">lock</span> تغيير كلمة المرور</h3>
          <form id="passwordForm">
            <div class="form-group"><label class="form-label">كلمة المرور الحالية</label><input type="password" class="form-input" id="currentPass" required></div>
            <div class="form-group"><label class="form-label">كلمة المرور الجديدة</label><input type="password" class="form-input" id="newPass" required minlength="6"></div>
            <div class="form-group"><label class="form-label">تأكيد كلمة المرور</label><input type="password" class="form-input" id="confirmPass" required minlength="6"></div>
            <button type="submit" class="btn btn-accent btn-block"><span class="material-symbols-rounded">key</span> تغيير كلمة المرور</button>
          </form>
          <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border-light)">
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px">عضو منذ ${new Date(user.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('profileForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const updated = await api.updateProfile({
          name: document.getElementById('pName').value,
          grade: document.getElementById('pGrade').value,
          parent_phone: document.getElementById('pParent').value
        });
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        Object.assign(stored, {
          name: updated.name,
          grade: updated.grade,
          parent_phone: updated.parent_phone
        });
        localStorage.setItem('user', JSON.stringify(stored));
        const sbName = document.querySelector('.sidebar-user-name');
        const sbRole = document.querySelector('.sidebar-user-role');
        if (sbName) sbName.textContent = updated.name;
        if (sbRole && stored.role === 'student') sbRole.textContent = updated.grade || 'طالب';
        showToast('تم تحديث البيانات بنجاح', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });

    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPass = document.getElementById('newPass').value;
      const confirmPass = document.getElementById('confirmPass').value;
      if (newPass !== confirmPass) return showToast('كلمة المرور غير متطابقة', 'error');
      try {
        await api.changePassword({
          currentPassword: document.getElementById('currentPass').value,
          newPassword: newPass
        });
        showToast('تم تغيير كلمة المرور بنجاح', 'success');
        document.getElementById('passwordForm').reset();
      } catch (err) { showToast(err.message, 'error'); }
    });
  } catch (err) { showToast(err.message, 'error'); }
}

// ===== Static Routes =====
const routes = {
  '/': { render: renderLanding, init: initLanding },
  '/login': { render: renderLogin, init: initLogin },
  '/register': { render: renderRegister, init: initRegister },
  '/parent-portal': { render: renderParentPortal, init: initParentPortal },
  '/lab': { render: renderLab, init: initLab },
  '/dashboard': { 
    render: () => {
      if (isTeacher()) {
        window.history.replaceState(null, '', '/admin');
        return renderAdmin();
      }
      return renderDashboard();
    }, 
    init: () => {
      if (isTeacher()) return initAdmin();
      return initDashboard();
    }, 
    auth: true 
  },
  '/courses': { render: renderCourses, init: initCourses },
  '/exams': { render: renderExams, init: initExams, auth: true },
  '/my-results': { render: renderMyResults, init: initMyResults, auth: true },
  '/leaderboard': { render: renderLeaderboard, init: initLeaderboard, auth: true },
  '/live': { render: renderLive, init: initLive, auth: true },
  '/wallet': { 
    render: () => {
      if (isTeacher()) {
        window.history.replaceState(null, '', '/admin');
        return renderAdmin();
      }
      return renderWallet();
    }, 
    init: () => {
      if (isTeacher()) return initAdmin();
      return initWallet();
    }, 
    auth: true 
  },
  '/certificates': { 
    render: () => {
      if (isTeacher()) {
        window.history.replaceState(null, '', '/admin');
        return renderAdmin();
      }
      return renderCertificates();
    }, 
    init: () => {
      if (isTeacher()) return initAdmin();
      return initCertificates();
    }, 
    auth: true 
  },
  '/packages': { render: renderPackages, init: initPackages },
  '/notifications': { render: renderNotifications, init: initNotifications, auth: true },
  '/profile': { render: renderProfile, init: initProfile, auth: true },
  '/admin': { render: renderAdmin, init: initAdmin, auth: true, teacher: true },
  '/admin/courses': { render: renderAdminCourses, init: initAdminCourses, auth: true, teacher: true },
  '/admin/codes': { render: renderAdminCodes, init: initAdminCodes, auth: true, teacher: true },
  '/admin/students': { render: renderAdminStudents, init: initAdminStudents, auth: true, teacher: true },
  '/admin/exams': { render: renderAdminExams, init: initAdminExams, auth: true, teacher: true },
  '/admin/live': { render: renderAdminLive, init: initAdminLive, auth: true, teacher: true },
  '/admin/notifications': { render: renderAdminNotifications, init: initAdminNotifications, auth: true, teacher: true },
};

// Dynamic routes
function matchDynamic(path) {
  let m = path.match(/^\/courses\/(\d+)$/);
  if (m) return { render: () => renderCourseDetail(m[1]), init: () => initCourseDetail(m[1]) };

  m = path.match(/^\/lessons\/(\d+)$/);
  if (m) return { render: () => renderLesson(m[1]), init: () => initLesson(m[1]), auth: true };

  m = path.match(/^\/exams\/([a-zA-Z0-9_-]+)\/take$/);
  if (m) return { render: () => renderExamTake(m[1]), init: () => initExamTake(m[1]), auth: true };

  m = path.match(/^\/exams\/(\d+)\/review$/);
  if (m) return { render: () => renderExamReview(m[1]), init: () => initExamReview(m[1]), auth: true };

  m = path.match(/^\/admin\/courses\/(\d+)$/);
  if (m) return { render: () => renderAdminCourseDetail(m[1]), init: () => initAdminCourseDetail(m[1]), auth: true, teacher: true };

  m = path.match(/^\/admin\/exams\/(\d+)$/);
  if (m) return { render: () => renderAdminExamDetail(m[1]), init: () => initAdminExamDetail(m[1]), auth: true, teacher: true };

  return null;
}

let isNavigating = false;

async function navigate() {
  const myNavId = ++navigationId;

  // If URL still has #/something, convert it immediately to a clean path without '#'
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    const cleanFromHash = window.location.hash.slice(1);
    window.history.replaceState(null, '', cleanFromHash);
  }

  let path = window.location.pathname || '/';
  let targetSection = null;

  const sectionIds = ['reviews', 'faq', 'features', 'grades', 'why-us', 'about'];
  const rawHash = window.location.hash ? window.location.hash.replace(/^#\/?/, '') : '';
  if (rawHash && sectionIds.includes(rawHash)) {
    targetSection = rawHash;
  }

  // Normalize trailing slash (except '/')
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  // Logged-in student/teacher visiting '/' goes directly to their dashboard as their home page
  if (path === '/' && isLoggedIn() && !targetSection) {
    const dest = isTeacher() ? '/admin' : '/dashboard';
    window.history.replaceState(null, '', dest);
    path = dest;
  }

  const route = routes[path] || matchDynamic(path);

  if (!route) {
    if (navigationId !== myNavId) return;
    app.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;flex-direction:column;gap:16px">
      <div style="font-size:5rem; color: var(--primary); display: flex; justify-content: center; align-items: center;"><span class="material-symbols-rounded" style="font-size: 5rem;">science</span></div>
      <h1 style="font-size:2rem;font-weight:800">404</h1>
      <p style="color:var(--text-muted)">الصفحة غير موجودة</p>
      <a href="/" class="btn btn-primary">الرئيسية</a>
    </div>`;
    return;
  }

  if (route.auth && !isLoggedIn()) {
    window.history.replaceState(null, '', '/login');
    return navigate();
  }

  if (route.teacher && !requireTeacher()) {
    return;
  }

  if (!targetSection) {
    window.scrollTo(0, 0);
  }

  if (navigationId !== myNavId) return;

  isNavigating = true;
  try {
    const root = document.getElementById('app') || app;
    if (!root) return;
    root.innerHTML = route.render();
    if (route.init) await route.init(myNavId);
  } catch (err) {
    if (navigationId === myNavId) {
      console.error('Navigation error:', err);
      showToast('حدث خطأ في تحميل الصفحة — ' + (err.message || ''), 'error');
    }
  } finally {
    isNavigating = false;
  }

  if (targetSection && navigationId === myNavId) {
    setTimeout(() => {
      const el = document.getElementById(targetSection);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
}

// Global click interceptor for internal SPA links (both '/path' and legacy '#/path')
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const anchor = e.target.closest('a[href]');
  if (!anchor) return;
  if (anchor.hasAttribute('download') || anchor.getAttribute('target') === '_blank') return;

  const href = anchor.getAttribute('href') || '';
  if (!href || href === '#') return;

  // In-page section scroll (e.g. #faq)
  if (href.startsWith('#') && !href.startsWith('#/')) {
    return;
  }

  // Convert '#/path' or internal '/path' to clean History API navigation
  if (href.startsWith('#/')) {
    e.preventDefault();
    navigateTo(href.slice(1));
    return;
  }

  if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/uploads/') && !href.startsWith('/api/')) {
    e.preventDefault();
    navigateTo(href);
  }
});

// Listen for popstate and legacy hashchange
window.addEventListener('popstate', navigate);
window.addEventListener('hashchange', () => {
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    const target = window.location.hash.slice(1);
    window.history.replaceState(null, '', target);
    navigate();
  }
});

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', navigate);
} else {
  navigate();
}

if (localStorage.getItem('darkMode') === 'true') {
  document.documentElement.setAttribute('data-theme', 'dark');
}

console.log('كيمياوي - منصة د. زياد رمزي عياد للكيمياء');
