import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { isLoggedIn } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';
import { renderPublicHeader, initPublicHeader } from '../components/publicHeader.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
          <div class="filter-pills" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:12px 16px; background:var(--bg-secondary); border-radius:12px; border:1px solid var(--border-light); overflow-x:auto; -webkit-overflow-scrolling:touch;">
            <span style="font-size:0.85rem; font-weight:800; color:var(--text-primary); margin-left:8px; display:flex; align-items:center; gap:4px; flex-shrink:0;">
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

        <!-- FEATURED 3-MONTH & TERM PACKAGES SPOTLIGHT -->
        <section id="featuredPackagesSpotlight" style="margin-bottom: 32px;">
          <div class="skeleton-card skeleton" style="height: 200px; border-radius:18px;"></div>
        </section>
        
        <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
          <h2 style="font-size:1.25rem; font-weight:900; color:var(--text-primary); margin:0; display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-rounded" style="color:var(--primary)">menu_book</span> فهرس الكورسات والوحدات التعليمية
          </h2>
          <span id="coursesCountBadge" style="font-size:0.82rem; font-weight:700; color:var(--text-muted);"></span>
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
  let allPackages = [];
  const grid = document.getElementById('coursesGrid');
  const packagesContainer = document.getElementById('featuredPackagesSpotlight');
  const searchInput = document.getElementById('courseSearch');
  const countBadge = document.getElementById('coursesCountBadge');

  // Render Packages Spotlight Section
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
      <div style="background: linear-gradient(135deg, rgba(5, 150, 105, 0.05) 0%, rgba(245, 158, 11, 0.05) 100%); border: 1.5px solid rgba(5, 150, 105, 0.2); border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom: 20px;">
          <div>
            <div style="display:inline-flex; align-items:center; gap:6px; background:#fef3c7; color:#92400e; padding:4px 12px; border-radius:20px; font-size:0.78rem; font-weight:800; border:1px solid #fde68a; margin-bottom:6px;">
              <span class="material-symbols-rounded" style="font-size:1rem; color:#d97706;">stars</span> باقات المنهج المجمعة (وفر حتى 30%)
            </div>
            <h2 style="font-size:1.3rem; font-weight:900; margin:0; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span class="material-symbols-rounded" style="color:var(--primary)">view_carousel</span> باقات الـ 3 شهور وباقات الترم الشاملة
            </h2>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin:4px 0 0 0;">
              محتوى 3 شهور كاملة من المنهج مجمعة باشتراك واحد موفر، ومتاحة طوال العام الدراسي حتى الامتحانات بدون انتهاء صلاحية.
            </p>
          </div>
          <a href="#/store-locator" class="btn btn-outline btn-sm" style="font-size:0.8rem; gap:4px;">
            <span class="material-symbols-rounded">storefront</span> منافذ كروت الشحن
          </a>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 18px;">
          ${filteredPkgs.map(pkg => {
            const discountPercent = pkg.discount_percent || 0;
            const savings = (pkg.original_price || pkg.price) - pkg.price;

            return `
              <div class="card" style="padding:0; overflow:hidden; border:1px solid var(--border-light); border-radius:16px; background:var(--bg-primary); display:flex; flex-direction:column; justify-content:space-between; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
                <div style="padding: 22px;">
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
                    <span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.75rem; font-weight:800; border:1px solid #fde68a;">محتوى 3 شهور منهج</span>
                    <span class="badge" style="background:#ecfdf5; color:#065f46; font-size:0.75rem; font-weight:800; border:1px solid #a7f3d0; display:inline-flex; align-items:center; gap:3px;">
                      <span class="material-symbols-rounded" style="font-size:0.85rem;">all_inclusive</span> متاح طوال العام الدراسي
                    </span>
                    ${discountPercent > 0 ? `<span class="badge badge-success" style="font-size:0.75rem; font-weight:800;">وفر ${savings} ج (${discountPercent}%)</span>` : ''}
                  </div>

                  <h3 style="font-size:1.15rem; font-weight:900; color:var(--text-primary); margin:0 0 8px 0; line-height:1.4;">
                    ${esc(pkg.title)}
                  </h3>
                  <p style="color:var(--text-secondary); font-size:0.82rem; line-height:1.6; margin-bottom:14px;">
                    ${esc(pkg.description)}
                  </p>

                  <div style="background:var(--bg-secondary); padding:12px; border-radius:10px; border:1px solid var(--border-light); margin-bottom:14px;">
                    <div style="font-weight:800; font-size:0.8rem; margin-bottom:8px; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                      <span class="material-symbols-rounded" style="font-size:1rem; color:var(--primary);">library_books</span>
                      الكورسات المشمولة في الباقة (${pkg.courses?.length || 0}):
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                      ${(pkg.courses || []).map(c => `
                        <div style="font-size:0.78rem; display:flex; justify-content:space-between; align-items:center; color:var(--text-secondary);">
                          <span>• ${esc(c.title)}</span>
                          <span style="font-weight:700; color:var(--text-muted); font-size:0.72rem;">${c.lessons_count} محاضرة</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>

                <div style="padding:16px 22px; border-top:1px solid var(--border-light); background:var(--bg-secondary); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
                  <div>
                    <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">سعر الباقة المجمعة:</div>
                    <div style="display:flex; align-items:baseline; gap:6px;">
                      <span style="font-size:1.4rem; font-weight:900; color:var(--primary);">${pkg.price} <small style="font-size:0.8rem;">ج.م</small></span>
                      ${pkg.original_price > pkg.price ? `<span style="font-size:0.85rem; color:var(--text-muted); text-decoration:line-through;">${pkg.original_price} ج</span>` : ''}
                    </div>
                  </div>

                  ${pkg.is_enrolled ? `
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span class="badge badge-success" style="padding:8px 12px; font-size:0.82rem; gap:4px;">
                        <span class="material-symbols-rounded" style="font-size:1rem;">verified</span> مفعّل بحسابك
                      </span>
                      <a href="#/courses/${pkg.course_ids[0] || ''}" class="btn btn-primary btn-sm" style="font-weight:800; font-size:0.82rem;">
                        ابدأ المشاهدة
                      </a>
                    </div>
                  ` : `
                    <button type="button" class="btn btn-primary btn-sm subscribe-pkg-btn" data-pkg-id="${pkg.id}" data-pkg-title="${esc(pkg.title)}" data-pkg-price="${pkg.price}" style="font-weight:800; font-size:0.85rem; padding:10px 18px; gap:6px;">
                      <span class="material-symbols-rounded" style="font-size:1.05rem;">shopping_cart_checkout</span> اشترك الآن في الباقة
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    bindPackageSubscriptionEvents();
  }

  // Bind Package Subscription Modal Events
  function bindPackageSubscriptionEvents() {
    document.querySelectorAll('.subscribe-pkg-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!isLoggedIn()) {
          showToast('يرجى تسجيل الدخول أولاً للاشتراك في الباقة', 'warning');
          window.location.hash = '#/login';
          return;
        }

        const pkgId = btn.dataset.pkgId;
        const title = btn.dataset.pkgTitle;
        const price = Number(btn.dataset.pkgPrice);

        let balance = 0;
        try {
          const w = await api.getWalletBalance();
          balance = w.balance || 0;
        } catch (e) {}

        showModal(`الاشتراك في: ${title}`, `
          <div style="margin-bottom:16px;">
            <div style="background:var(--bg-secondary);padding:14px;border-radius:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:0.8rem;color:var(--text-muted);">سعر الباقة المطلوب:</div>
                <strong style="font-size:1.25rem;color:var(--primary);">${price} ج.م</strong>
              </div>
              <div style="text-align:left;">
                <div style="font-size:0.8rem;color:var(--text-muted);">رصيد محفظتك المتاح:</div>
                <strong style="font-size:1.25rem;color:${balance >= price ? 'var(--success)' : 'var(--error)'};">${balance} ج.م</strong>
              </div>
            </div>

            ${balance < price ? `
              <div class="notice notice-warning" style="margin-bottom:16px;">
                <span class="material-symbols-rounded">warning</span>
                <div>
                  <strong>رصيدك الحالي غير كافٍ للاشتراك المباشر!</strong>
                  <div>يمكنك شحن محفظتك أولاً بفوري أو إدخال كود كارت شحن الباقة أدناه.</div>
                </div>
              </div>
            ` : `
              <div class="notice notice-success" style="margin-bottom:16px;">
                <span class="material-symbols-rounded">check_circle</span>
                <div>رصيد محفظتك يغطي الاشتراك بالكامل. يمكنك الخصم والتفعيل فوراً!</div>
              </div>
            `}

            <div style="display:flex;flex-direction:column;gap:12px;">
              <button type="button" class="btn btn-primary btn-block" id="modalPayWalletBtn" ${balance < price ? 'disabled' : ''} style="padding:12px;font-weight:800;gap:6px;">
                <span class="material-symbols-rounded">account_balance_wallet</span> الدفع المباشر وخصم ${price} ج من المحفظة
              </button>

              <div style="text-align:center;font-size:0.8rem;color:var(--text-muted);position:relative;margin:8px 0;">
                <span style="background:var(--bg-primary);padding:0 12px;position:relative;z-index:1;">أو تفعيل بكود كارت الشحن</span>
                <hr style="border:0;border-top:1px solid var(--border-light);position:absolute;top:50%;left:0;right:0;margin:0;">
              </div>

              <div class="input-group">
                <span class="material-symbols-rounded input-icon">key</span>
                <input type="text" class="form-input" id="modalVoucherCode" placeholder="كود كارت السنتر (مثال: KEM-350-PKG90)" dir="ltr">
              </div>

              <button type="button" class="btn btn-outline btn-block" id="modalPayVoucherBtn" style="padding:10px;font-weight:800;gap:6px;">
                <span class="material-symbols-rounded">qr_code</span> تفعيل الباقة بكود الكارت
              </button>

              <a href="#/wallet" class="btn btn-ghost btn-block" style="font-size:0.82rem;gap:4px;color:var(--primary);">
                <span class="material-symbols-rounded">bolt</span> التوجه لشحن المحفظة
              </a>
            </div>
          </div>
        `);

        // Handle Direct Wallet Pay
        document.getElementById('modalPayWalletBtn')?.addEventListener('click', async () => {
          const mBtn = document.getElementById('modalPayWalletBtn');
          mBtn.disabled = true;
          mBtn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري خصم وتفعيل الباقة...';
          try {
            const res = await api.subscribePackage(pkgId, { payment_method: 'wallet' });
            showToast(res.message, 'success');
            document.querySelector('.modal-overlay')?.remove();
            await loadData();
          } catch (err) {
            showToast(err.message, 'error');
            mBtn.disabled = false;
            mBtn.innerHTML = '<span class="material-symbols-rounded">account_balance_wallet</span> الدفع المباشر وخصم من المحفظة';
          }
        });

        // Handle Voucher Pay
        document.getElementById('modalPayVoucherBtn')?.addEventListener('click', async () => {
          const code = document.getElementById('modalVoucherCode').value.trim();
          if (!code) return showToast('اكتب كود الكارت أولاً', 'warning');

          const vBtn = document.getElementById('modalPayVoucherBtn');
          vBtn.disabled = true;
          vBtn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري التحقق من الكارت...';
          try {
            const res = await api.subscribePackage(pkgId, { payment_method: 'voucher', voucher_code: code });
            showToast(res.message, 'success');
            document.querySelector('.modal-overlay')?.remove();
            await loadData();
          } catch (err) {
            showToast(err.message, 'error');
            vBtn.disabled = false;
            vBtn.innerHTML = '<span class="material-symbols-rounded">qr_code</span> تفعيل الباقة بكود الكارت';
          }
        });

      });
    });
  }

  function renderList(coursesList) {
    if (countBadge) {
      countBadge.textContent = `${coursesList.length} كورس متاح`;
    }

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
        <div class="course-card" onclick="location.hash='#/courses/${c.id}'" style="border-radius:18px; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;">
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

    renderPackagesSpotlight();
    renderList(list);
  }

  async function loadData() {
    grid.innerHTML = `
      <div class="skeleton-card skeleton" style="height: 320px;"></div>
      <div class="skeleton-card skeleton" style="height: 320px;"></div>
      <div class="skeleton-card skeleton" style="height: 320px;"></div>
    `;
    
    try {
      const [coursesRes, packagesRes] = await Promise.all([
        api.getCourses(currentGrade || undefined),
        api.getPackages().catch(() => [])
      ]);
      allCourses = coursesRes;
      allPackages = packagesRes || [];
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

      if (currentType === 'quarterly' && packagesContainer) {
        packagesContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

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
    loadData();
  });

  loadData();
}

