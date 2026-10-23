import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { isLoggedIn } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { renderPublicHeader, initPublicHeader } from '../components/publicHeader.js';

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
              <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">school</span> الكورسات وباقات المنهج الشاملة</h1>
              <p class="page-subtitle">شروحات منهج الكيمياء كاملة، باقات الـ 3 شهور، وباقات الترم مع مذكرات الـ PDF وتدريبات الامتحانات الوزارية</p>
            </div>
            
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <div class="search-wrapper" style="max-width: 280px; width: 100%;">
                <span class="material-symbols-rounded search-icon">search</span>
                <input type="text" class="form-input" id="courseSearch" placeholder="ابحث عن كورس أو باقة...">
              </div>
              <a href="#/store-locator" class="btn btn-outline" style="gap:6px;">
                <span class="material-symbols-rounded">storefront</span> منافذ المذكرات
              </a>
            </div>
          </div>

          <!-- DURATION / BUNDLE SCOPE FILTER PILLS -->
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:12px 16px; background:var(--bg-secondary); border-radius:12px; border:1px solid var(--border-light);">
            <span style="font-size:0.85rem; font-weight:800; color:var(--text-primary); margin-left:8px; display:flex; align-items:center; gap:4px;">
              <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--primary);">tune</span> نطاق المحتوى:
            </span>
            <button type="button" class="btn btn-sm type-filter-btn btn-primary" data-type="all" style="border-radius:20px; font-weight:700;">الكل</button>
            <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="quarterly" style="border-radius:20px; font-weight:700;">🌟 باقات الـ 3 شهور (محتوى 3 شهور من المنهج)</button>
            <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="term" style="border-radius:20px; font-weight:700;">📚 باقات الترم الشاملة (محتوى ترم دراسي كامل)</button>
            <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="monthly" style="border-radius:20px; font-weight:700;">📅 كورسات الشهور (محتوى شهر دراسي)</button>
            <button type="button" class="btn btn-sm type-filter-btn btn-outline" data-type="annual" style="border-radius:20px; font-weight:700;">🎓 منهج السنة الكامل</button>
          </div>

          <!-- GRADE TABS -->
          <div class="tabs" id="gradeTabs" style="margin:0;">
            <div class="tab active" data-grade="">جميع المراحل</div>
            <div class="tab" data-grade="ثالثة ثانوي">ثالثة ثانوي</div>
            <div class="tab" data-grade="ثانية ثانوي">ثانية ثانوي</div>
            <div class="tab" data-grade="أولى ثانوي">أولى ثانوي</div>
            <div class="tab" data-grade="ثالثة إعدادي">إعدادي</div>
            <div class="tab" data-grade="سادسة ابتدائي">ابتدائي</div>
          </div>
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
  if (logged) {
    initNavbar();
  } else {
    initPublicHeader();
  }

  let currentGrade = '';
  let currentType = 'all';
  let allCourses = [];
  const grid = document.getElementById('coursesGrid');
  const searchInput = document.getElementById('courseSearch');

  function renderList(coursesList) {
    if (coursesList.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
          <span class="material-symbols-rounded" style="font-size:3.5rem; color:var(--text-muted); margin-bottom:12px;">search_off</span>
          <h3 style="font-weight:800; font-size:1.2rem;">لا توجد كورسات أو باقات مطابقة لهذا الفلتر</h3>
          <p style="color:var(--text-secondary); font-size:0.9rem;">جرب اختيار مرحلة دراسية أخرى أو تغيير نوع المحتوى.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = coursesList.map(c => {
      const isFree = c.is_free || c.price === 0;
      const hasDiscount = (c.original_price || 0) > c.price;
      const savings = hasDiscount ? (c.original_price - c.price) : 0;
      const isQuarterly = c.course_type === 'quarterly';
      const isTerm = c.course_type === 'term';
      const isAnnual = c.course_type === 'annual';

      const typeLabel = isQuarterly ? 'باقة 3 شهور' : isTerm ? 'باقة ترم كامل' : isAnnual ? 'باقة سنوية شاملة' : 'كورس شهري';
      const typeBadgeColor = isQuarterly ? '#f59e0b' : isTerm ? 'var(--primary)' : isAnnual ? '#8b5cf6' : 'var(--text-muted)';
      const scopeLabel = isQuarterly ? 'محتوى 3 شهور منهج' : isTerm ? 'محتوى ترم دراسي كامل' : isAnnual ? 'منهج العام كاملاً' : 'محتوى شهر دراسي';

      return `
        <div class="course-card" onclick="location.hash='#/courses/${c.id}'" style="border-radius:18px; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div class="course-thumb" style="position:relative;">
              <div class="course-thumb-inner" style="background: linear-gradient(135deg, ${isFree ? 'var(--green-400),var(--green-600)' : isQuarterly ? '#f59e0b, #d97706' : isTerm ? '#0284c7, #0369a1' : 'var(--emerald-600),var(--emerald-800)'})">
                <span class="material-symbols-rounded" style="font-size:3.5rem;color:rgba(255,255,255,0.3)">${isQuarterly || isTerm ? 'view_carousel' : 'science'}</span>
              </div>

              <!-- Badges -->
              <div style="position:absolute; top:12px; right:12px; display:flex; flex-direction:column; gap:6px; align-items:flex-end; z-index:2;">
                ${c.badge_text ? `
                  <span class="badge" style="background:#ef4444; color:#fff; font-weight:800; font-size:0.75rem; box-shadow:0 2px 6px rgba(0,0,0,0.2);">
                    ${c.badge_text}
                  </span>
                ` : ''}
                <span class="badge" style="background:${typeBadgeColor}; color:#fff; font-weight:800; font-size:0.75rem; box-shadow:0 2px 6px rgba(0,0,0,0.15);">
                  ${typeLabel}
                </span>
              </div>

              <div style="position:absolute; bottom:12px; right:12px; display:flex; gap:6px; z-index:2;">
                <span class="course-grade-badge" style="font-weight:700;">${c.grade}</span>
                <span class="badge" style="background:rgba(0,0,0,0.72); color:#fff; font-size:0.74rem; font-weight:800; backdrop-filter:blur(4px); display:inline-flex; align-items:center; gap:4px;">
                  <span class="material-symbols-rounded" style="font-size:0.95rem; color:#fde047;">menu_book</span> ${scopeLabel}
                </span>
              </div>
            </div>

            <div class="course-body" style="padding:18px;">
              <h3 class="course-title" style="font-size:1.15rem; font-weight:900; margin:0 0 8px 0; line-height:1.4;">${c.title}</h3>
              <p class="course-desc" style="font-size:0.85rem; color:var(--text-secondary); line-height:1.6; margin-bottom:10px;">
                ${c.description || 'شرح تفصيلي شامل لكافة أجزاء المنهج مع حل أسئلة الربط والتدريبات التفاعلية.'}
              </p>

              <!-- Permanent Access Guarantee -->
              <div style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:var(--emerald-700); font-weight:800; background:rgba(5, 150, 105, 0.08); padding:5px 9px; border-radius:8px; margin-bottom:12px; border:1px solid rgba(5, 150, 105, 0.2);">
                <span class="material-symbols-rounded" style="font-size:0.95rem; color:var(--emerald-600);">all_inclusive</span> متاح طوال العام الدراسي حتى الامتحانات (بدون انتهاء صلاحية)
              </div>

              <div class="course-meta" style="margin-bottom:14px; font-size:0.8rem;">
                <span><span class="material-symbols-rounded">play_circle</span> ${c.lesson_count || 0} محاضرة</span>
                <span><span class="material-symbols-rounded">assignment</span> ${c.exam_count || 0} امتحان</span>
                <span><span class="material-symbols-rounded">group</span> ${c.student_count || 0} طالب</span>
              </div>
            </div>
          </div>

          <!-- Price & Action Footer -->
          <div style="padding:14px 18px; border-top:1px solid var(--border-light); background:var(--bg-secondary); display:flex; align-items:center; justify-content:space-between;">
            <div>
              ${isFree ? `
                <span style="font-size:1.1rem; font-weight:900; color:var(--success);">مجاناً بالكامل</span>
              ` : `
                <div style="display:flex; align-items:baseline; gap:6px;">
                  <span style="font-size:1.25rem; font-weight:900; color:var(--primary);">${c.price} <small style="font-size:0.75rem;">ج.م</small></span>
                  ${hasDiscount ? `<s style="font-size:0.8rem; color:var(--text-muted);">${c.original_price} ج</s>` : ''}
                </div>
                ${hasDiscount ? `<div style="font-size:0.7rem; font-weight:800; color:var(--success);">وفرت ${savings} ج.م!</div>` : ''}
              `}
            </div>
            <button type="button" class="btn btn-primary btn-sm" style="font-weight:800; gap:4px;">
              تفاصيل والاشتراك <span class="material-symbols-rounded" style="font-size:1rem;">arrow_back</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function filterAndRender() {
    let list = [...allCourses];

    // Filter by type
    if (currentType !== 'all') {
      list = list.filter(c => c.course_type === currentType);
    }

    // Filter by search query
    const query = (searchInput?.value || '').trim().toLowerCase();
    if (query) {
      list = list.filter(c => 
        c.title.toLowerCase().includes(query) || 
        (c.description && c.description.toLowerCase().includes(query)) ||
        (c.badge_text && c.badge_text.toLowerCase().includes(query))
      );
    }

    renderList(list);
  }

  async function loadCourses() {
    grid.innerHTML = `
      <div class="skeleton-card skeleton" style="height: 320px;"></div>
      <div class="skeleton-card skeleton" style="height: 320px;"></div>
      <div class="skeleton-card skeleton" style="height: 320px;"></div>
    `;
    
    try {
      allCourses = await api.getCourses(currentGrade || undefined);
      filterAndRender();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Type filter buttons
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

  // Search input change
  searchInput?.addEventListener('input', filterAndRender);

  // Grade tabs click
  document.getElementById('gradeTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('#gradeTabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentGrade = tab.dataset.grade;
    loadCourses();
  });

  loadCourses();
}
