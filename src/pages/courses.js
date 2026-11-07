import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { isLoggedIn, getUser } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';
import { renderPublicHeader, initPublicHeader } from '../components/publicHeader.js';
import { renderBrandErrorIllustration, renderBrandLoader } from '../components/bedigitalBrand.js';
import { esc, formatFullArabicDate, getShortGradeBadge, gradesList, getCourseGrades, courseMatchesGrade, courseMatchesTrack, normalizeImageUrl, generateCourseFallbackSvg } from '../utils/helpers.js';
import { renderChemMarkdown } from '../utils/chemMarkdown.js';

const STAGE_GRADES_MAP = {
  primary: ['رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي'],
  prep: ['أولى إعدادي', 'ثانية إعدادي', 'ثالثة إعدادي'],
  secondary: ['أولى ثانوي', 'ثانية ثانوي', 'ثالثة ثانوي']
};

export function getCourseCover(c) {
  const thumb = normalizeImageUrl(c?.thumbnail);
  if (thumb && (thumb.startsWith('data:image/') || thumb.startsWith('/') || thumb.startsWith('http://') || thumb.startsWith('https://'))) {
    return thumb;
  }
  return generateCourseFallbackSvg(c);
}

export function renderCourseCardBassthalk(c, { isRecommended = false } = {}) {
  const coverImg = getCourseCover(c);
  const fallbackImg = generateCourseFallbackSvg(c);
  const courseGrades = getCourseGrades(c);
  const shortGrade = courseGrades.map(g => getShortGradeBadge(g)).join(' · ');
  const trackLabel = c.study_tracks === 'لغات' ? 'لغات' : c.study_tracks === 'عام' ? 'عام' : 'عام ولغات';
  const isFree = c.is_free || Number(c.price) === 0;
  const priceLabel = isFree ? 'مجاني' : `${c.price} جنيه`;
  const createdStr = formatFullArabicDate(c.created_at) || 'الثلاثاء، ٢٩ سبتمبر ٢٠٢٦';
  const updatedStr = formatFullArabicDate(c.updated_at || c.created_at) || createdStr;
  const descText = c.description || `هذا الكورس خاص بطلاب ${courseGrades.join(' و ')} (${trackLabel}) وشامل الشرح والتدريبات`;

  return `
    <div class="course-card-bassthalk ${isRecommended ? 'recommended-grade-card' : ''}">
      ${isRecommended ? `
        <div class="course-card-rec-ribbon">
          <span class="material-symbols-rounded" style="font-size:1rem;">recommend</span>
          <span>مرشح لمرحلتك (${esc(courseGrades.join(' + '))} · ${esc(trackLabel)})</span>
        </div>
      ` : ''}
      <a href="/courses/${c.id}" class="course-card-thumb-wrap" aria-label="${esc(c.title)}">
        <img src="${esc(coverImg)}" data-fallback="${esc(fallbackImg)}" onerror="if(this.src!==this.dataset.fallback){this.src=this.dataset.fallback;}" alt="${esc(c.title)}" loading="lazy" decoding="async">
      </a>

      <div class="course-card-body-bassthalk">
        <!-- Row 1: Title (Right in RTL) & Short Grade (Left in RTL) -->
        <div class="course-card-head-row">
          <a href="/courses/${c.id}" class="course-card-main-title">${esc(c.title)}</a>
          <span class="course-card-short-grade" title="${esc(courseGrades.join(' + '))} (${esc(trackLabel)})">${esc(shortGrade)} · ${esc(trackLabel)}</span>
        </div>

        <!-- Row 2: Price + Description + Details Link (Right in RTL) & Dates (Left in RTL) -->
        <div class="course-card-mid-row">
          <div class="course-card-mid-right">
            <div class="course-card-price-text">${esc(priceLabel)}</div>
            <div class="course-card-desc-snippet">${renderChemMarkdown(descText)}</div>
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
        <div class="page-header courses-page-header" style="display:flex; flex-direction: column; gap:14px; margin-bottom: 24px; align-items:stretch;">
          <div class="courses-page-top-row" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; width:100%;">
            <div style="min-width:0; flex:1;">
              <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">school</span> الكورسات والمحاضرات</h1>
              <p class="page-subtitle">جميع الكورسات المتاحة على المنصة مع ترشيح تلقائي لكورسات مرحلتك الدراسية</p>
            </div>
            
            <div class="courses-search-box" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; width:min(100%, 320px);">
              <div class="search-wrapper" style="width: 100%; max-width: 100%;">
                <span class="material-symbols-rounded search-icon">search</span>
                <input type="text" class="form-input" id="courseSearch" placeholder="ابحث عن كورس، مرحلة، أو Chemistry...">
              </div>
            </div>
          </div>

          <!-- DURATION / BUNDLE SCOPE + TRACK FILTER PILLS -->
          <div class="courses-filter-box" style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between; padding:12px 14px; background:var(--bg-secondary); border-radius:14px; border:1px solid var(--border-light); width:100%;">
            <div class="courses-filter-group">
              <span class="courses-filter-label">
                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--primary);">tune</span> نوع الكورس:
              </span>
              <button type="button" class="btn btn-sm type-filter-btn btn-primary" data-type="all" style="border-radius:20px; font-weight:700;">الكل</button>
              <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="monthly" style="border-radius:20px; font-weight:700;">كورسات الشهور والفصول</button>
              <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="quarterly" style="border-radius:20px; font-weight:700;">باقات الـ 3 شهور</button>
              <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="term" style="border-radius:20px; font-weight:700;">باقات الترم</button>
              <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="annual" style="border-radius:20px; font-weight:700;">منهج السنة الكامل</button>
            </div>

            <div class="courses-filter-group">
              <span class="courses-filter-label">
                <span class="material-symbols-rounded" style="font-size:1.05rem; color:var(--primary);">translate</span> الشعبة:
              </span>
              <button type="button" class="btn btn-sm track-filter-btn btn-primary" data-track="" style="border-radius:20px; font-weight:700;">الكل</button>
              <button type="button" class="btn btn-sm track-filter-btn btn-outline" data-track="عام" style="border-radius:20px; font-weight:700;">عام (عربي)</button>
              <button type="button" class="btn btn-sm track-filter-btn btn-outline" data-track="لغات" style="border-radius:20px; font-weight:700;">لغات (Chemistry)</button>
            </div>
          </div>

          <!-- SEQUENTIAL GRADE & STAGE TABS -->
          <div class="tabs courses-grade-tabs" id="gradeTabs" style="margin:0; width:100%;">
            <div class="tab active" data-grade="" data-stage="">جميع المراحل</div>
            <div class="tab" data-grade="" data-stage="primary">المرحلة الابتدائية</div>
            <div class="tab" data-grade="" data-stage="prep">المرحلة الإعدادية</div>
            <div class="tab" data-grade="" data-stage="secondary">المرحلة الثانوية</div>
            ${gradesList.map(g => `<div class="tab" data-grade="${esc(g)}" data-stage="">${esc(g)}</div>`).join('')}
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
  const studentTrack = user && user.role === 'student' ? (user.study_track || 'عام') : '';

  if (logged) {
    initNavbar();
  } else {
    initPublicHeader();
  }

  const params = new URLSearchParams(window.location.search);
  let currentGrade = params.get('grade') || '';
  let currentStage = params.get('stage') || '';
  let currentTrack = params.get('track') || '';
  let currentType = 'all';
  let allCourses = [];
  let allPackages = [];
  const grid = document.getElementById('coursesGrid');
  const recommendedSection = document.getElementById('recommendedGradeSection');
  const packagesContainer = document.getElementById('featuredPackagesSpotlight');
  const searchInput = document.getElementById('courseSearch');
  const countBadge = document.getElementById('coursesCountBadge');

  const initialQuery = params.get('q') || '';
  if (searchInput && initialQuery) {
    searchInput.value = initialQuery;
  }

  // Highlight active tab based on URL params
  if (currentStage || currentGrade) {
    document.querySelectorAll('#gradeTabs .tab').forEach(t => {
      const matchStage = currentStage && t.dataset.stage === currentStage;
      const matchGrade = currentGrade && t.dataset.grade === currentGrade;
      t.classList.toggle('active', Boolean(matchStage || matchGrade));
    });
  }

  if (currentTrack) {
    document.querySelectorAll('.track-filter-btn').forEach(b => {
      const active = b.dataset.track === currentTrack;
      b.classList.toggle('btn-primary', active);
      b.classList.toggle('btn-outline', !active);
    });
  }

  function courseMatchesCurrentStageOrGrade(c) {
    if (currentGrade) {
      return courseMatchesGrade(c, currentGrade);
    }
    if (currentStage && STAGE_GRADES_MAP[currentStage]) {
      return STAGE_GRADES_MAP[currentStage].some(g => courseMatchesGrade(c, g));
    }
    return true;
  }

  function renderPackagesSpotlight() {
    if (!packagesContainer) return;

    let filteredPkgs = allPackages;
    if (currentGrade) {
      filteredPkgs = filteredPkgs.filter(p => p.grade === currentGrade);
    } else if (currentStage && STAGE_GRADES_MAP[currentStage]) {
      filteredPkgs = filteredPkgs.filter(p => STAGE_GRADES_MAP[currentStage].includes(p.grade));
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

    // Recommended section for logged-in student's grade & track when viewing "جميع المراحل"
    if (recommendedSection) {
      if (studentGrade && !currentGrade && !currentStage) {
        const recCourses = coursesList.filter(c => courseMatchesGrade(c, studentGrade) && courseMatchesTrack(c, studentTrack));
        if (recCourses.length > 0) {
          recommendedSection.style.display = 'block';
          recommendedSection.innerHTML = `
            <div style="margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <h2 style="font-size:1.2rem; font-weight:900; color:var(--primary); margin:0; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded">recommend</span> كورسات مرشحة لمرحلتك الدراسية (${esc(studentGrade)} · ${esc(studentTrack)})
              </h2>
              <span class="badge badge-success" style="font-weight:800;">مخصصة لصفك وشعبتك</span>
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
        <div class="empty-state" style="grid-column: 1 / -1; padding: 50px 20px;">
          ${renderBrandErrorIllustration('empty')}
          <h3 style="font-weight:800; font-size:1.2rem; margin-top:12px;">لا توجد كورسات مطابقة لهذا التصنيف حالياً</h3>
          <p style="color:var(--text-secondary); font-size:0.9rem;">جرب اختيار مرحلة دراسية أخرى أو عرض جميع المراحل.</p>
        </div>
      `;
      return;
    }

    // Sort so student's grade & track courses appear first in the general grid too
    const sorted = [...coursesList].sort((a, b) => {
      if (studentGrade) {
        const aMatch = (courseMatchesGrade(a, studentGrade) && courseMatchesTrack(a, studentTrack)) ? 1 : 0;
        const bMatch = (courseMatchesGrade(b, studentGrade) && courseMatchesTrack(b, studentTrack)) ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
      }
      return 0;
    });

    grid.innerHTML = sorted.map(c => renderCourseCardBassthalk(c, {
      isRecommended: Boolean(studentGrade && courseMatchesGrade(c, studentGrade) && courseMatchesTrack(c, studentTrack) && (currentGrade || currentStage))
    })).join('');
  }

  function filterAndRender() {
    let list = [...allCourses];

    list = list.filter(courseMatchesCurrentStageOrGrade);

    if (currentTrack) {
      list = list.filter(c => courseMatchesTrack(c, currentTrack));
    }

    if (currentType !== 'all') {
      list = list.filter(c => c.course_type === currentType);
    }

    const query = (searchInput?.value || '').trim().toLowerCase();
    if (query) {
      list = list.filter(c => 
        c.title.toLowerCase().includes(query) || 
        (c.description && c.description.toLowerCase().includes(query)) ||
        getCourseGrades(c).some(g => g.toLowerCase().includes(query)) ||
        (c.study_tracks && c.study_tracks.toLowerCase().includes(query))
      );
    }

    renderPackagesSpotlight();
    renderList(list);
  }

  async function loadData() {
    grid.innerHTML = `<div style="grid-column: 1 / -1;">${renderBrandLoader('جاري تحميل الكورسات والمحاضرات...')}</div>`;
    
    try {
      const [coursesRes, packagesRes] = await Promise.all([
        api.getCourses(),
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

  document.querySelectorAll('.track-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.track-filter-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
      });
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
      currentTrack = btn.dataset.track || '';
      filterAndRender();
    });
  });

  searchInput?.addEventListener('input', filterAndRender);

  document.getElementById('gradeTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('#gradeTabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentGrade = tab.dataset.grade || '';
    currentStage = tab.dataset.stage || '';
    filterAndRender();
  });

  loadData();
}
