import zraLogoFace from '../assets/zra-logo-face.png';
import zraLogoText from '../assets/zra-logo-text.png';
import { isLoggedIn, isTeacher, logout } from '../utils/auth.js';

export function renderPublicHeader(activeNav = 'home') {
  return `
    <header class="landing-header" id="landingHeader">
      <!-- Right Side Actions (RTL Start) -->
      <div class="landing-header-right">
        ${isLoggedIn()
          ? `<a href="#/${isTeacher() ? 'admin' : 'dashboard'}" class="btn-sakr-solid"><span class="material-symbols-rounded" style="font-size:1.15rem;">dashboard</span> ${isTeacher() ? 'لوحة المعلم والإدارة' : 'لوحة الطالب'}</a>
             <button class="btn-sakr-outline" id="landingLogoutBtn"><span class="material-symbols-rounded" style="font-size:1.15rem;">logout</span> خروج</button>`
          : `<a href="#/register" class="btn-sakr-solid">حساب جديد</a>
             <a href="#/login" class="btn-sakr-outline">تسجيل الدخول</a>`
        }
      </div>

      <!-- Center Navigation Links -->
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

  // Handle in-page scroll links
  document.querySelectorAll('.landing-nav-link[data-scroll]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('data-scroll');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth' });
        document.querySelectorAll('.landing-nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });

  const homeNavLink = document.querySelector('.landing-nav-link[data-nav="hero"]');
  homeNavLink?.addEventListener('click', (e) => {
    if (window.location.hash === '#/' || window.location.hash === '') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelectorAll('.landing-nav-link').forEach(l => l.classList.remove('active'));
      homeNavLink.classList.add('active');
    }
  });
}
