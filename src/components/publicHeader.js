import zraLogoFace from '../assets/zra-logo-face.png';
import zraLogoText from '../assets/zra-logo-text.png';
import { isLoggedIn, isTeacher, logout } from '../utils/auth.js';

export function renderPublicHeader(activeNav = 'home') {
  const logged = isLoggedIn();
  const teacher = isTeacher();

  return `
    <header class="landing-header" id="landingHeader">
      <!-- Right Side Actions (RTL Start) -->
      <div class="landing-header-right">
        <!-- Mobile hamburger toggle button (shown on <= 992px) -->
        <button class="landing-menu-btn" id="landingMenuBtn" aria-label="فتح القائمة الرئيسية" title="القائمة">
          <span class="material-symbols-rounded">menu</span>
        </button>

        ${logged
          ? `<a href="#/${teacher ? 'admin' : 'dashboard'}" class="btn-sakr-solid header-auth-btn"><span class="material-symbols-rounded" style="font-size:1.15rem;">dashboard</span> ${teacher ? 'لوحة المعلم' : 'لوحة الطالب'}</a>
             <button class="btn-sakr-outline header-logout-btn" id="landingLogoutBtn"><span class="material-symbols-rounded" style="font-size:1.15rem;">logout</span> خروج</button>`
          : `<a href="#/register" class="btn-sakr-solid header-auth-btn">حساب جديد</a>
             <a href="#/login" class="btn-sakr-outline header-login-btn">دخول</a>`
        }
      </div>

      <!-- Center Navigation Links (Desktop) -->
      <nav class="landing-nav">
        <a href="#/" class="landing-nav-link ${activeNav === 'home' ? 'active' : ''}" data-nav="hero">الرئيسية</a>
        <a href="#/courses" class="landing-nav-link ${activeNav === 'courses' ? 'active' : ''}">الكورسات وباقات المنهج</a>
        <a href="#/store-locator" class="landing-nav-link ${activeNav === 'store-locator' ? 'active' : ''}">دليل المكتبات</a>
        <a href="#reviews" class="landing-nav-link ${activeNav === 'reviews' ? 'active' : ''}" data-scroll="reviews">آراء الطلاب</a>
        <a href="#faq" class="landing-nav-link ${activeNav === 'faq' ? 'active' : ''}" data-scroll="faq">الأسئلة الشائعة</a>
      </nav>

      <!-- Left Side: Logo & Theme Toggle (RTL End) -->
      <div class="landing-header-left">
        <button class="theme-toggle-pill" id="landingDarkToggle" title="تبديل المظهر">
          <span class="material-symbols-rounded sun-icon">light_mode</span>
          <span class="material-symbols-rounded moon-icon">dark_mode</span>
        </button>
        <a href="#/" class="landing-logo">
          <img src="${zraLogoFace}" alt="Z.R.A" class="logo-face-img" style="height: 38px;" />
          <img src="${zraLogoText}" alt="Z.R.A" class="logo-text-img" style="height: 28px; margin-right: 6px;" />
        </a>
      </div>
    </header>

    <!-- Mobile Slide-out Drawer & Overlay -->
    <div class="landing-drawer-overlay" id="landingDrawerOverlay"></div>
    <aside class="landing-mobile-drawer" id="landingMobileDrawer" aria-hidden="true">
      <div class="landing-drawer-header">
        <div class="landing-logo">
          <img src="${zraLogoFace}" alt="Z.R.A" class="logo-face-img" style="height: 34px;" />
          <img src="${zraLogoText}" alt="Z.R.A" class="logo-text-img" style="height: 24px; margin-right: 6px;" />
        </div>
        <button class="landing-drawer-close" id="landingDrawerClose" aria-label="إغلاق القائمة">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <nav class="landing-drawer-nav">
        <a href="#/" class="landing-drawer-link ${activeNav === 'home' ? 'active' : ''}" data-drawer-nav="hero">
          <span class="material-symbols-rounded">home</span> الرئيسية
        </a>
        <a href="#/courses" class="landing-drawer-link ${activeNav === 'courses' ? 'active' : ''}">
          <span class="material-symbols-rounded">school</span> الكورسات وباقات المنهج
        </a>
        <a href="#/store-locator" class="landing-drawer-link ${activeNav === 'store-locator' ? 'active' : ''}">
          <span class="material-symbols-rounded">storefront</span> دليل المكتبات ومنافذ الشحن
        </a>
        <a href="#reviews" class="landing-drawer-link ${activeNav === 'reviews' ? 'active' : ''}" data-scroll="reviews">
          <span class="material-symbols-rounded">reviews</span> آراء وتكريمات الطلاب
        </a>
        <a href="#faq" class="landing-drawer-link ${activeNav === 'faq' ? 'active' : ''}" data-scroll="faq">
          <span class="material-symbols-rounded">help</span> الأسئلة الشائعة
        </a>
      </nav>

      <div class="landing-drawer-actions">
        ${logged
          ? `<a href="#/${teacher ? 'admin' : 'dashboard'}" class="btn-sakr-solid" style="width:100%;justify-content:center;">
               <span class="material-symbols-rounded">dashboard</span> ${teacher ? 'لوحة المعلم والإدارة' : 'لوحة الطالب التعليمية'}
             </a>
             <button class="btn-sakr-outline" id="drawerLogoutBtn" style="width:100%;justify-content:center;margin-top:8px;">
               <span class="material-symbols-rounded">logout</span> تسجيل الخروج
             </button>`
          : `<a href="#/register" class="btn-sakr-solid" style="width:100%;justify-content:center;">
               <span class="material-symbols-rounded">person_add</span> إنشاء حساب جديد
             </a>
             <a href="#/login" class="btn-sakr-outline" style="width:100%;justify-content:center;margin-top:8px;">
               <span class="material-symbols-rounded">login</span> تسجيل الدخول
             </a>`
        }
      </div>
    </aside>
  `;
}

export function initPublicHeader() {
  const header = document.getElementById('landingHeader');
  if (header) {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  // Mobile drawer controls
  const menuBtn = document.getElementById('landingMenuBtn');
  const drawer = document.getElementById('landingMobileDrawer');
  const overlay = document.getElementById('landingDrawerOverlay');
  const closeBtn = document.getElementById('landingDrawerClose');

  function openDrawer() {
    drawer?.classList.add('open');
    drawer?.setAttribute('aria-hidden', 'false');
    overlay?.classList.add('active');
  }

  function closeDrawer() {
    drawer?.classList.remove('open');
    drawer?.setAttribute('aria-hidden', 'true');
    overlay?.classList.remove('active');
  }

  menuBtn?.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  drawer?.querySelectorAll('.landing-drawer-link, .landing-drawer-actions a').forEach(link => {
    link.addEventListener('click', closeDrawer);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer?.classList.contains('open')) {
      closeDrawer();
    }
  });

  const darkToggle = document.getElementById('landingDarkToggle');
  if (darkToggle) {
    darkToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('darkMode', 'false');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('darkMode', 'true');
      }
    });
  }

  const logoutBtn = document.getElementById('landingLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  const drawerLogoutBtn = document.getElementById('drawerLogoutBtn');
  if (drawerLogoutBtn) {
    drawerLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeDrawer();
      logout();
    });
  }

  // Handle in-page scroll links
  document.querySelectorAll('[data-scroll]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('data-scroll');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        e.preventDefault();
        closeDrawer();
        targetEl.scrollIntoView({ behavior: 'smooth' });
        document.querySelectorAll('.landing-nav-link, .landing-drawer-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });

  const homeNavLink = document.querySelector('[data-nav="hero"], [data-drawer-nav="hero"]');
  homeNavLink?.addEventListener('click', (e) => {
    if (window.location.hash === '#/' || window.location.hash === '') {
      e.preventDefault();
      closeDrawer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelectorAll('.landing-nav-link, .landing-drawer-link').forEach(l => l.classList.remove('active'));
      homeNavLink.classList.add('active');
    }
  });
}
