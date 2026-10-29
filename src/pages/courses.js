import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { isLoggedIn, getUser } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';
import { renderPublicHeader, initPublicHeader } from '../components/publicHeader.js';
import { esc, formatFullArabicDate, getShortGradeBadge, gradesList } from '../utils/helpers.js';

import drZiadThumbs from '../assets/dr-ziad-pose-thumbs.jpg';
import drZiadFlask from '../assets/dr-ziad-pose-flask.jpg';
import drZiadPortrait from '../assets/dr-ziad-portrait.jpg';
import chemCurriculum from '../assets/chem-curriculum-3d.jpg';
import chemExam from '../assets/chem-exam-mastery-3d.jpg';

export function getCourseCover(c) {
  if (c.thumbnail && (c.thumbnail.startsWith('/') || c.thumbnail.startsWith('http'))) return c.thumbnail;
  if (c.course_type === 'quarterly') return chemCurriculum;
  if (c.course_type === 'term') return chemExam;
  if (c.is_free || c.price === 0) return drZiadPortrait;
  if (c.title && c.title.includes('انتقالية')) return drZiadFlask;
  return drZiadThumbs;
}

export function renderCourseCardBassthalk(c, { isRecommended = false } = {}) {
  const coverImg = getCourseCover(c);
  const shortGrade = getShortGradeBadge(c.grade);
  const isFree = c.is_free || Number(c.price) === 0;
  const priceLabel = isFree ? 'مجاني' : `${c.price} جنيه`;
  const createdStr = formatFullArabicDate(c.created_at) || 'الثلاثاء، ٢٩ سبتمبر ٢٠٢٦';
  const updatedStr = formatFullArabicDate(c.updated_at || c.created_at) || createdStr;
  const descText = c.description || `هذا الكورس خاص بطلاب ${c.grade || 'الثانوية العامة'} وشامل الشرح والتدريبات`;

  return `
    <div class="course-card-bassthalk ${isRecommended ? 'recommended-grade-card' : ''}">
      ${isRecommended ? `
        <div class="course-card-rec-ribbon">
          <span class="material-symbols-rounded" style="font-size:1rem;">recommend</span>
          <span>مرشح لمرحلتك الدراسية (${esc(c.grade)})</span>
        </div>
      ` : ''}
      <a href="/courses/${c.id}" class="course-card-thumb-wrap" aria-label="${esc(c.title)}">
        <img src="${coverImg}" alt="${esc(c.title)}" loading="lazy">
      </a>

      <div class="course-card-body-bassthalk">
        <!-- Row 1: Title (Right in RTL) & Short Grade (Left in RTL) -->
        <div class="course-card-head-row">
          <a href="/courses/${c.id}" class="course-card-main-title">${esc(c.title)}</a>
          <span class="course-card-short-grade">${esc(shortGrade)}</span>
        </div>

        <!-- Row 2: Price + Description + Details Link (Right in RTL) & Dates (Left in RTL) -->
        <div class="course-card-mid-row">
          <div class="course-card-mid-right">
            <div class="course-card-price-text">${esc(priceLabel)}</div>
            <p class="course-card-desc-snippet">${esc(descText)}</p>
            <a href="/courses/${c.id}" class="course-card-more-link">عرض باقي التفاصيل</a>
          </div>

          <div class="course-card-mid-dates">
            <div class="course-card-date-item" title="تاريخ الإضافة">
              <span>${esc(createdStr)}</span>
              <span class="material-symbols-rounded">folder</span>
            </div>
            <div class="course-card-date-item" title="تاريخ آخر تحديث">
              <span>${esc(updatedStr)}</span>
              <span class="material-symbols-rounded">schedule</span>
            </div>
          </div>
        </div>

        <!-- Bottom Stacked Action Buttons -->
        <div class="course-card-actions-stack">
          <a href="/courses/${c.id}" class="bassthalk-btn-enter">الدخول للكورس</a>
          <a href="/courses/${c.id}${c.is_enrolled ? '' : '?subscribe=1'}" class="bassthalk-btn-subscribe">
            ${c.is_enrolled ? 'متابعة المحاضرات' : 'الإشتراك في الكورس !'}
          </a>
        </div>
      </div>
    </div>
  `;
}

export function renderCourses() {
  const logged = isLoggedIn();
  const headerHtml = logged ? renderNavbar('courses') : renderPublicHeader('courses');
  const wrapperClass = logged ? 'app-layout' : 'landing';
  const mainStyle = logged ? '' : 'padding-top: 110px; padding-bottom: 60px; min-height: 80vh;';
  const containerClass = logged ? 'main-content' : 'section-container';

  return `
    <div class="${wrapperClass}" style="min-height: 100vh;">
      ${headerHtml}
      <main class="${containerClass}" style="${mainStyle}">
        <div class="page-header" style="display:flex; flex-direction: column; gap:16px; margin-bottom: 24px;">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
            <div>
              <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">school</span> الكورسات والمحاضرات</h1>
              <p class="page-subtitle">جميع الكورسات المتاحة على المنصة مع ترشيح تلقائي لكورسات مرحلتك الدراسية</p>
            </div>
            
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <div class="search-wrapper" style="max-width: 300px; width: 100%;">
                <span class="material-symbols-rounded search-icon">search</span>
                <input type="text" class="form-input" id="courseSearch" placeholder="ابحث عن كورس...">
              </div>
            </div>
          </div>

          <!-- DURATION / BUNDLE SCOPE FILTER PILLS -->
          <div class="filter-pills" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:12px 16px; background:var(--bg-secondary); border-radius:12px; border:1px solid var(--border-light); overflow-x:auto;">
            <span style="font-size:0.85rem; font-weight:800; color:var(--text-primary); margin-left:8px; display:flex; align-items:center; gap:4px; flex-shrink:0;">
              <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--primary);">tune</span> نوع الكورس:
            </span>
            <button type="button" class="btn btn-sm type-filter-btn btn-primary" data-type="all" style="border-radius:20px; font-weight:700;">الكل</button>
            <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="monthly" style="border-radius:20px; font-weight:700;">
              <span class="material-symbols-rounded" style="font-size:1rem;">calendar_month</span> كورسات الشهور والفصول
            </button>
            <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="quarterly" style="border-radius:20px; font-weight:700;">
              <span class="material-symbols-rounded" style="font-size:1rem;">layers</span> باقات الـ 3 شهور
            </button>
            <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="term" style="border-radius:20px; font-weight:700;">
              <span class="material-symbols-rounded" style="font-size:1rem;">library_books</span> باقات الترم
            </button>
            <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="annual" style="border-radius:20px; font-weight:700;">
              <span class="material-symbols-rounded" style="font-size:1rem;">workspace_premium</span> منهج السنة الكامل
            </button>
          </div>

          <!-- SEQUENTIAL GRADE TABS -->
          <div class="tabs" id="gradeTabs" style="margin:0;">
            <div class="tab active" data-grade="">جميع المراحل</div>
            ${gradesList.map(g => `<div class="tab" data-grade="${esc(g)}">${esc(g)}</div>`).join('')}
          </div>
        </div>

        <!-- RECOMMENDED FOR STUDENT GRADE SECTION -->
        <section id="recommendedGradeSection" style="display:none; margin-bottom: 34px;"></section>

        <!-- FEATURED PACKAGES SPOTLIGHT -->
        <section id="featuredPackagesSpotlight" style="display:none; margin-bottom: 32px;"></section>
        
        <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
          <h2 style="font-size:1.2rem; font-weight:900; color:var(--text-primary); margin:0; display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-rounded" style="color:var(--primary)">menu_book</span> جميع الكورسات المتاحة
          </h2>
          <span id="coursesCountBadge" style="font-size:0.85rem; font-weight:700; color:var(--text-muted);"></span>
        </div>

        <div class="courses-grid" id="coursesGrid">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </main>
    </div>
  `;
}

export async function initCourses() {
  const logged = isLoggedIn();
  const user = getUser();
  const studentGrade = user && user.role === 'student' ? user.grade : '';

  if (logged) {
    initNavbar();
  } else {
    initPublicHeader();
  }

  let currentGrade = '';
  let currentType = 'all';
  let allCourses = [];
  let allPackages = [];
  const grid = document.getElementById('coursesGrid');
  const recommendedSection = document.getElementById('recommendedGradeSection');
  const packagesContainer = document.getElementById('featuredPackagesSpotlight');
  const searchInput = document.getElementById('courseSearch');
  const countBadge = document.getElementById('coursesCountBadge');

  function renderPackagesSpotlight() {
    if (!packagesContainer) return;

    let filteredPkgs = allPackages;
    if (currentGrade) {
      filteredPkgs = filteredPkgs.filter(p => p.grade === currentGrade);
    }

    if (filteredPkgs.length === 0) {
      packagesContainer.style.display = 'none';
      return;
    }

    packagesContainer.style.display = 'block';
    packagesContainer.innerHTML = `
      <div style="background: var(--bg-secondary); border: 1.5px solid var(--border-light); border-radius: 20px; padding: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom: 20px;">
          <div>
            <h2 style="font-size:1.25rem; font-weight:900; margin:0; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span class="material-symbols-rounded" style="color:var(--primary)">view_carousel</span> الباقات المجمعة المتاحة
            </h2>
          </div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 18px;">
          ${filteredPkgs.map(pkg => `
            <div class="card" style="padding:20px; border-radius:16px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <h3 style="font-size:1.1rem; font-weight:800; color:var(--primary); margin:0 0 8px;">${esc(pkg.title)}</h3>
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:14px;">${esc(pkg.description || '')}</p>
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid var(--border-light); padding-top:12px;">
                <strong style="font-size:1.2rem; color:var(--primary);">${pkg.price} جنيه</strong>
                <button type="button" class="btn btn-primary btn-sm subscribe-pkg-btn" data-pkg-id="${pkg.id}" data-pkg-title="${esc(pkg.title)}" data-pkg-price="${pkg.price}">
                  اشترك في الباقة
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderList(coursesList) {
    if (countBadge) {
      countBadge.textContent = `${coursesList.length} كورس`;
    }

    // Recommended section for logged-in student's grade when viewing "جميع المراحل"
    if (recommendedSection) {
      if (studentGrade && !currentGrade) {
        const recCourses = coursesList.filter(c => c.grade === studentGrade);
        if (recCourses.length > 0) {
          recommendedSection.style.display = 'block';
          recommendedSection.innerHTML = `
            <div style="margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <h2 style="font-size:1.2rem; font-weight:900; color:var(--primary); margin:0; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded">recommend</span> كورسات مرشحة لمرحلتك الدراسية (${esc(studentGrade)})
              </h2>
              <span class="badge badge-success" style="font-weight:800;">مخصصة لصفك الدراسي</span>
            </div>
            <div class="courses-grid">
              ${recCourses.map(c => renderCourseCardBassthalk(c, { isRecommended: true })).join('')}
            </div>
          `;
        } else {
          recommendedSection.style.display = 'none';
          recommendedSection.innerHTML = '';
        }
      } else {
        recommendedSection.style.display = 'none';
        recommendedSection.innerHTML = '';
      }
    }

    if (coursesList.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
          <span class="material-symbols-rounded" style="font-size:3.5rem; color:var(--text-muted); margin-bottom:12px;">school</span>
          <h3 style="font-weight:800; font-size:1.2rem;">لا توجد كورسات مضافة حالياً</h3>
          <p style="color:var(--text-secondary); font-size:0.9rem;">سيقوم المعلم بإضافة الكورسات والمحاضرات قريباً.</p>
        </div>
      `;
      return;
    }

    // Sort so student's grade courses appear first in the general grid too
    const sorted = [...coursesList].sort((a, b) => {
      if (studentGrade) {
        const aMatch = a.grade === studentGrade ? 1 : 0;
        const bMatch = b.grade === studentGrade ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
      }
      return 0;
    });

    grid.innerHTML = sorted.map(c => renderCourseCardBassthalk(c, {
      isRecommended: Boolean(studentGrade && c.grade === studentGrade && currentGrade)
    })).join('');
  }

  function filterAndRender() {
    let list = [...allCourses];

    if (currentType !== 'all') {
      list = list.filter(c => c.course_type === currentType);
    }

    const query = (searchInput?.value || '').trim().toLowerCase();
    if (query) {
      list = list.filter(c => 
        c.title.toLowerCase().includes(query) || 
        (c.description && c.description.toLowerCase().includes(query)) ||
        (c.grade && c.grade.toLowerCase().includes(query))
      );
    }

    renderPackagesSpotlight();
    renderList(list);
  }

  async function loadData() {
    grid.innerHTML = `
      <div class="skeleton-card skeleton" style="height: 380px; border-radius:22px;"></div>
      <div class="skeleton-card skeleton" style="height: 380px; border-radius:22px;"></div>
      <div class="skeleton-card skeleton" style="height: 380px; border-radius:22px;"></div>
    `;
    
    try {
      const [coursesRes, packagesRes] = await Promise.all([
        api.getCourses(currentGrade || undefined),
        api.getPackages().catch(() => [])
      ]);
      allCourses = coursesRes || [];
      allPackages = packagesRes || [];
      filterAndRender();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  document.querySelectorAll('.type-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-filter-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
      });
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
      currentType = btn.dataset.type;
      filterAndRender();
    });
  });

  searchInput?.addEventListener('input', filterAndRender);

  document.getElementById('gradeTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('#gradeTabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentGrade = tab.dataset.grade;
    loadData();
  });

  loadData();
}
