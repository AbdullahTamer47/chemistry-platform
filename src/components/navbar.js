import { getUser, isTeacher, logout } from '../utils/auth.js';
import { getInitials, esc } from '../utils/helpers.js';
import { api } from '../utils/api.js';
import zraLogoFace from '../assets/zra-logo-face.png';
import zraLogoText from '../assets/zra-logo-text.png';

export function renderNavbar(currentPage) {
  const user = getUser();
  const teacher = isTeacher();
  const isDark = localStorage.getItem('darkMode') === 'true';

  const studentNav = `
    <div class="nav-section-title">لوحة الطالب</div>
    <a class="nav-item ${currentPage === 'dashboard' ? 'active' : ''}" href="/dashboard">
      <span class="material-symbols-rounded">home</span> الرئيسية التعليمية
    </a>
    <a class="nav-item ${currentPage === 'courses' ? 'active' : ''}" href="/courses">
      <span class="material-symbols-rounded">school</span> الكورسات والمحاضرات
    </a>
    <a class="nav-item ${currentPage === 'exams' ? 'active' : ''}" href="/exams">
      <span class="material-symbols-rounded">assignment</span> الامتحانات والتقييمات
    </a>
    <a class="nav-item ${currentPage === 'lab' ? 'active' : ''}" href="/lab">
      <span class="material-symbols-rounded">science</span> المختبر الكيميائي التفاعلي
    </a>
    <a class="nav-item ${currentPage === 'my-results' ? 'active' : ''}" href="/my-results">
      <span class="material-symbols-rounded">fact_check</span> نتائجي وتصحيحاتي
    </a>
    <a class="nav-item ${currentPage === 'certificates' ? 'active' : ''}" href="/certificates">
      <span class="material-symbols-rounded">workspace_premium</span> شهاداتي المعتمدة
    </a>
    <a class="nav-item ${currentPage === 'leaderboard' ? 'active' : ''}" href="/leaderboard">
      <span class="material-symbols-rounded">emoji_events</span> لوحة المتصدرين
    </a>
    <a class="nav-item ${currentPage === 'live' ? 'active' : ''}" href="/live">
      <span class="material-symbols-rounded">live_tv</span> الحصص اللايف
    </a>
    <div class="nav-section-title">حسابي والخدمات</div>
    <a class="nav-item ${currentPage === 'wallet' ? 'active' : ''}" href="/wallet">
      <span class="material-symbols-rounded">account_balance_wallet</span> المحفظة والشحن
    </a>
    <a class="nav-item ${currentPage === 'notifications' ? 'active' : ''}" href="/notifications" id="nav-notif">
      <span class="material-symbols-rounded">notifications</span> الإشعارات
      <span class="nav-badge" id="notifBadge" style="display:none">0</span>
    </a>
    <a class="nav-item ${currentPage === 'profile' ? 'active' : ''}" href="/profile">
      <span class="material-symbols-rounded">person</span> الملف الشخصي
    </a>
  `;

  const teacherNav = `
    <div class="nav-section-title">لوحة المعلم والإدارة</div>
    <a class="nav-item ${currentPage === 'admin' ? 'active' : ''}" href="/admin">
      <span class="material-symbols-rounded">admin_panel_settings</span> لوحة الإدارة العامة
    </a>
    <a class="nav-item ${currentPage === 'admin-courses' ? 'active' : ''}" href="/admin/courses">
      <span class="material-symbols-rounded">book</span> إدارة الكورسات
    </a>
    <a class="nav-item ${currentPage === 'admin-exams' ? 'active' : ''}" href="/admin/exams">
      <span class="material-symbols-rounded">assignment</span> إدارة الامتحانات
    </a>
    <a class="nav-item ${currentPage === 'admin-students' ? 'active' : ''}" href="/admin/students">
      <span class="material-symbols-rounded">group</span> سجل الطلاب
    </a>
    <a class="nav-item ${currentPage === 'admin-codes' ? 'active' : ''}" href="/admin/codes">
      <span class="material-symbols-rounded">key</span> أكواد التفعيل والشحن
    </a>
    <a class="nav-item ${currentPage === 'admin-live' ? 'active' : ''}" href="/admin/live">
      <span class="material-symbols-rounded">live_tv</span> بث الحصص اللايف
    </a>
    <a class="nav-item ${currentPage === 'admin-notifications' ? 'active' : ''}" href="/admin/notifications">
      <span class="material-symbols-rounded">notifications</span> إرسال الإشعارات
    </a>
    <div class="nav-section-title">معاينة واجهة الطلاب</div>
    <a class="nav-item ${currentPage === 'courses' ? 'active' : ''}" href="/courses">
      <span class="material-symbols-rounded">visibility</span> تصفح الكورسات كطالب
    </a>
    <a class="nav-item ${currentPage === 'lab' ? 'active' : ''}" href="/lab">
      <span class="material-symbols-rounded">science</span> المختبر الكيميائي التفاعلي
    </a>
    <a class="nav-item ${currentPage === 'leaderboard' ? 'active' : ''}" href="/leaderboard">
      <span class="material-symbols-rounded">emoji_events</span> لوحة المتصدرين
    </a>
    <a class="nav-item ${currentPage === 'parent-portal' ? 'active' : ''}" href="/parent-portal">
      <span class="material-symbols-rounded">family_restroom</span> بوابة ولي الأمر
    </a>
  `;

  const mobileBottomBar = teacher
    ? `
      <nav class="mobile-bottom-nav" aria-label="التنقل السريع">
        <a href="/admin" class="mobile-bottom-tab ${currentPage === 'admin' ? 'active' : ''}">
          <span class="material-symbols-rounded">dashboard</span>
          <span>الإدارة</span>
        </a>
        <a href="/admin/courses" class="mobile-bottom-tab ${currentPage === 'admin-courses' ? 'active' : ''}">
          <span class="material-symbols-rounded">book</span>
          <span>الكورسات</span>
        </a>
        <a href="/admin/exams" class="mobile-bottom-tab ${currentPage === 'admin-exams' ? 'active' : ''}">
          <span class="material-symbols-rounded">assignment</span>
          <span>الامتحانات</span>
        </a>
        <a href="/admin/students" class="mobile-bottom-tab ${currentPage === 'admin-students' ? 'active' : ''}">
          <span class="material-symbols-rounded">group</span>
          <span>الطلاب</span>
        </a>
        <button type="button" class="mobile-bottom-tab" id="mobileBottomMoreBtn">
          <span class="material-symbols-rounded">menu</span>
          <span>القائمة</span>
        </button>
      </nav>
    `
    : `
      <nav class="mobile-bottom-nav" aria-label="التنقل السريع">
        <a href="/dashboard" class="mobile-bottom-tab ${currentPage === 'dashboard' ? 'active' : ''}">
          <span class="material-symbols-rounded">home</span>
          <span>الرئيسية</span>
        </a>
        <a href="/courses" class="mobile-bottom-tab ${currentPage === 'courses' ? 'active' : ''}">
          <span class="material-symbols-rounded">school</span>
          <span>الكورسات</span>
        </a>
        <a href="/exams" class="mobile-bottom-tab ${currentPage === 'exams' ? 'active' : ''}">
          <span class="material-symbols-rounded">assignment</span>
          <span>الامتحانات</span>
        </a>
        <a href="/lab" class="mobile-bottom-tab ${currentPage === 'lab' ? 'active' : ''}">
          <span class="material-symbols-rounded">science</span>
          <span>المختبر</span>
        </a>
        <button type="button" class="mobile-bottom-tab" id="mobileBottomMoreBtn">
          <span class="material-symbols-rounded">menu</span>
          <span>القائمة</span>
        </button>
      </nav>
    `;

  return `
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
    <div class="mobile-header" id="mobileHeader">
      <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="فتح القائمة"><span class="material-symbols-rounded">menu</span></button>
      <a href="/${teacher ? 'admin' : 'dashboard'}" class="sidebar-logo" style="display: flex; align-items: center; gap: 6px; text-decoration:none;">
        <img src="${zraLogoFace}" alt="Z.R.A" class="logo-face-img" style="height: 32px;" />
        <img src="${zraLogoText}" alt="Z.R.A" class="logo-text-img" style="height: 22px;" />
      </a>
      <button class="mobile-menu-btn" id="mobileDarkToggle" title="الوضع الليلي">
        <span class="material-symbols-rounded">${isDark ? 'light_mode' : 'dark_mode'}</span>
      </button>
    </div>
    
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header" style="position:relative;">
        <button class="sidebar-close-btn" id="sidebarCloseBtn" aria-label="إغلاق القائمة">
          <span class="material-symbols-rounded">close</span>
        </button>
        <a href="/${teacher ? 'admin' : 'dashboard'}" class="sidebar-logo" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration:none;">
          <img src="${zraLogoFace}" alt="Z.R.A" class="logo-face-img" style="height: 36px;" />
          <img src="${zraLogoText}" alt="Z.R.A" class="logo-text-img" style="height: 26px;" />
        </a>
        <div class="sidebar-subtitle">د. زياد رمزي عياد</div>
      </div>
      
      <nav class="sidebar-nav">
        ${teacher ? teacherNav : studentNav}
      </nav>
      
      <!-- Dark Mode Toggle Button -->
      <div class="dark-mode-toggle" id="darkModeToggle" style="padding:4px 10px; margin:4px 0; cursor:pointer;">
        <div class="nav-item" style="margin:0;">
          <span class="material-symbols-rounded" id="sidebarDarkIcon">${isDark ? 'light_mode' : 'dark_mode'}</span>
          <span id="sidebarDarkText">${isDark ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
        </div>
      </div>
      
      ${user ? `
        <a href="/profile" class="sidebar-user" style="text-decoration:none; transition:var(--transition);">
          <div class="sidebar-user-avatar">${getInitials(user.name)}</div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${esc(user.name)}</div>
            <div class="sidebar-user-role">${teacher ? 'معلم / إدارة المنصة' : esc(user.grade || 'طالب')}</div>
          </div>
        </a>
        <div class="sidebar-logout" id="logoutBtn">
          <span class="material-symbols-rounded">logout</span> تسجيل خروج
        </div>
      ` : ''}
    </aside>

    ${mobileBottomBar}
  `;
}

let navbarKeyHandler = null;

export function initNavbar() {
  const btn = document.getElementById('mobileMenuBtn');
  const bottomMoreBtn = document.getElementById('mobileBottomMoreBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const closeBtn = document.getElementById('sidebarCloseBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  function toggleMobileSidebar() {
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
  }

  function closeMobileSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }

  if (btn && sidebar && overlay) {
    btn.addEventListener('click', toggleMobileSidebar);
    overlay.addEventListener('click', closeMobileSidebar);
  }

  if (bottomMoreBtn && sidebar && overlay) {
    bottomMoreBtn.addEventListener('click', toggleMobileSidebar);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeMobileSidebar);
  }

  // Close sidebar on link click on mobile/tablet (<= 1024px)
  if (sidebar) {
    sidebar.querySelectorAll('.sidebar-nav a, .sidebar-user, #darkModeToggle').forEach(el => {
      el.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          closeMobileSidebar();
        }
      });
    });
  }

  if (navbarKeyHandler) document.removeEventListener('keydown', navbarKeyHandler);
  navbarKeyHandler = (e) => {
    if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
      closeMobileSidebar();
    }
  };
  document.addEventListener('keydown', navbarKeyHandler);

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      closeMobileSidebar();
      logout();
    });
  }

  function toggleDark() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newDark = !isDark;

    if (newDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('darkMode', 'false');
    }

    const mobileDarkToggle = document.getElementById('mobileDarkToggle');
    const sidebarDarkIcon = document.getElementById('sidebarDarkIcon');
    const sidebarDarkText = document.getElementById('sidebarDarkText');

    if (mobileDarkToggle) {
      mobileDarkToggle.innerHTML = `<span class="material-symbols-rounded">${newDark ? 'light_mode' : 'dark_mode'}</span>`;
    }
    if (sidebarDarkIcon) {
      sidebarDarkIcon.textContent = newDark ? 'light_mode' : 'dark_mode';
    }
    if (sidebarDarkText) {
      sidebarDarkText.textContent = newDark ? 'الوضع النهاري' : 'الوضع الليلي';
    }
  }

  const darkToggle = document.getElementById('darkModeToggle');
  if (darkToggle) darkToggle.addEventListener('click', toggleDark);

  const mobileDarkToggle = document.getElementById('mobileDarkToggle');
  if (mobileDarkToggle) mobileDarkToggle.addEventListener('click', toggleDark);

  loadNotifBadge();
}

async function loadNotifBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  try {
    const res = await api.getUnreadCount();
    if (res.count > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = res.count > 99 ? '99+' : res.count;
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {}
}
