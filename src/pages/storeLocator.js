import { esc, formatWhatsAppPhone } from '../utils/helpers.js';
import { renderNavbar, initNavbar } from '../components/navbar.js';
import { renderPublicHeader, initPublicHeader } from '../components/publicHeader.js';
import { isLoggedIn, isTeacher } from '../utils/auth.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';


const EGYPT_GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الغربية', 'الشرقية', 
  'القليوبية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 
  'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 
  'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 
  'مطروح', 'شمال سيناء', 'جنوب سيناء'
];

function renderMainContent(logged, teacher) {
  return `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:24px;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <h1 class="page-title" style="display:flex;align-items:center;gap:10px;font-size:1.6rem;font-weight:900;margin:0;">
            <span class="material-symbols-rounded" style="color:var(--primary);font-size:2rem;">storefront</span>
            ${teacher ? 'إدارة وتحديث منافذ البيع والمكتبات المعتمدة' : 'دليل المكتبات ومنافذ الشحن المعتمدة'}
          </h1>
          ${teacher ? '<span class="badge badge-primary" style="font-size:0.75rem;padding:4px 8px;">لوحة المعلم</span>' : ''}
        </div>
        <p class="page-subtitle" style="color:var(--text-secondary);font-size:0.95rem;margin:0;">
          ${teacher 
            ? 'إضافة وتعديل بيانات منافذ بيع مذكرات كيمياوي وكروت شحن المنصة لجميع الطلاب بمحافظات مصر'
            : 'المكتبات والسناتر المعتمدة لشراء مذكرات كيمياوي وكروت شحن المنصة بجميع محافظات مصر'}
        </p>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${teacher ? `
          <button type="button" class="btn btn-primary" id="openAddStoreBtn" style="gap:6px;font-weight:700;">
            <span class="material-symbols-rounded">add_circle</span> إضافة منفذ معتمد جديد
          </button>
        ` : `
          <a href="#/wallet" class="btn btn-outline" style="gap:6px;font-weight:700;">
            <span class="material-symbols-rounded">account_balance_wallet</span> شحن المحفظة أونلاين
          </a>
        `}
      </div>
    </div>

    ${teacher ? `
      <!-- TEACHER QUICK NOTICE -->
      <div class="card" style="padding:14px 18px;margin-bottom:20px;border-radius:14px;border:1px solid rgba(5,150,105,0.25);background:rgba(5,150,105,0.04);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;font-size:0.9rem;font-weight:700;color:var(--primary);">
          <span class="material-symbols-rounded">verified</span>
          <span>أنت الآن في وضع إدارة المنافذ والمكتبات المعتمدة. يمكنك إضافة منافذ جديدة، أو تعديل وحذف المنافذ القائمة فوراً.</span>
        </div>
        <a href="#/store-locator" class="btn btn-sm btn-outline" style="font-size:0.78rem;gap:4px;">
          <span class="material-symbols-rounded">visibility</span> معاينة كطالب
        </a>
      </div>
    ` : ''}

    <!-- SEARCH & FILTER TOOLBAR -->
    <div class="card" style="padding:20px;margin-bottom:24px;border-radius:18px;border:1px solid var(--border-light);box-shadow:0 4px 20px rgba(0,0,0,0.03);">
      <div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;margin-bottom:16px;">
        <div style="position:relative;">
          <span class="material-symbols-rounded" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1.3rem;">search</span>
          <input 
            type="text" 
            id="storeSearchInput" 
            placeholder="ابحث باسم المكتبة، الشارع، أو المنطقة..." 
            style="width:100%;padding:12px 46px 12px 16px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-family:inherit;font-size:0.92rem;transition:all 0.2s ease;"
          />
        </div>
        <div id="resultsCountBadge" class="badge badge-info" style="font-size:0.85rem;padding:8px 14px;font-weight:700;">
          جاري التحميل...
        </div>
      </div>

      <div style="font-size:0.82rem;font-weight:800;color:var(--text-muted);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
        <span class="material-symbols-rounded" style="font-size:1.1rem;color:var(--primary);">location_on</span>
        تصفية المنافذ حسب المحافظة:
      </div>
      <div id="governoratePills" style="display:flex;gap:8px;flex-wrap:wrap;">
        <div class="skeleton-text skeleton" style="width:100px;height:34px;border-radius:20px;"></div>
        <div class="skeleton-text skeleton" style="width:90px;height:34px;border-radius:20px;"></div>
        <div class="skeleton-text skeleton" style="width:110px;height:34px;border-radius:20px;"></div>
      </div>
    </div>

    <!-- STORES GRID -->
    <div id="storesGrid">
      <div class="loading-spinner"><div class="spinner"></div></div>
    </div>
  `;
}

export function renderStoreLocator() {
  const logged = isLoggedIn();
  const isAdminRoute = window.location.hash.includes('admin/stores');
  const teacher = isTeacher() && isAdminRoute;

  if (!logged) {
    return `
      <div class="landing" style="min-height: 100vh; background: var(--bg-main);">
        ${renderPublicHeader('store-locator')}
        <main class="section-container" style="padding-top: 110px; padding-bottom: 60px; max-width: 1200px; margin: 0 auto; padding-inline: 20px;">
          ${renderMainContent(false, false)}
        </main>
      </div>
    `;
  }

  const activePage = teacher ? 'admin-stores' : 'store-locator';

  return `
    <div class="app-layout">
      ${renderNavbar(activePage)}
      <main class="main-content" style="max-width: 1200px; margin: 0 auto; padding: 32px 24px 60px;">
        ${isTeacher() && !isAdminRoute ? `
          <div class="card" style="padding:12px 18px;margin-bottom:18px;border-radius:12px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <span style="font-size:0.86rem;font-weight:700;color:var(--text-secondary);">👁️ أنت تشاهد الآن صفحة المنافذ بوضع معاينة الطالب.</span>
            <a href="#/admin/stores" class="btn btn-sm btn-primary" style="font-size:0.78rem;gap:4px;">
              <span class="material-symbols-rounded">edit_square</span> العودة لوضع الإدارة
            </a>
          </div>
        ` : ''}
        ${renderMainContent(true, teacher)}
      </main>
    </div>
  `;
}

export async function initStoreLocator() {
  const logged = isLoggedIn();
  const teacher = isTeacher() && window.location.hash.includes('admin/stores');

  if (logged) {
    initNavbar();
  } else {
    initPublicHeader();
  }

  const gridEl = document.getElementById('storesGrid');
  const pillsEl = document.getElementById('governoratePills');
  const searchInput = document.getElementById('storeSearchInput');
  const countBadge = document.getElementById('resultsCountBadge');
  const openAddStoreBtn = document.getElementById('openAddStoreBtn');

  if (!gridEl) return;

  let allStores = [];
  let availableGovs = ['الكل'];
  let currentGov = 'الكل';
  let searchQuery = '';

  // TEACHER: ADD STORE MODAL
  if (openAddStoreBtn && teacher) {
    openAddStoreBtn.addEventListener('click', () => {
      openStoreFormModal(null);
    });
  }

  function renderStores() {
    let filtered = allStores;

    if (currentGov !== 'الكل') {
      filtered = filtered.filter(s => s.governorate === currentGov);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.governorate && s.governorate.toLowerCase().includes(q))
      );
    }

    if (countBadge) {
      countBadge.textContent = `${filtered.length} منفذ معتمد`;
    }

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="card" style="text-align:center;padding:50px 20px;border-radius:18px;">
          <span class="material-symbols-rounded" style="font-size:3.5rem;color:var(--text-muted);margin-bottom:12px;">store_mall_directory</span>
          <h3 style="font-weight:800;margin-bottom:8px;color:var(--text-primary);">لا توجد منافذ مطابقة للبحث</h3>
          <p style="color:var(--text-secondary);max-width:440px;margin:0 auto 16px;font-size:0.9rem;">
            لم نعثر على مكتبة في محافظة "${currentGov}" بالاسم "${esc(searchQuery)}". 
            ${teacher ? 'يمكنك إضافة مكتبة جديدة الآن بالضغط على زر إضافة منفذ معتمد بالأعلى.' : 'يمكنك الشحن أونلاين عبر فودافون كاش أو إنستاباي بسهولة.'}
          </p>
          ${teacher ? `
            <button type="button" class="btn btn-primary" onclick="document.getElementById('openAddStoreBtn')?.click()" style="display:inline-flex;align-items:center;gap:6px;">
              <span class="material-symbols-rounded">add_circle</span> إضافة منفذ جديد هنا
            </button>
          ` : `
            <a href="#/wallet" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;">
              <span class="material-symbols-rounded">account_balance_wallet</span> شحن المحفظة أونلاين
            </a>
          `}
        </div>
      `;
      return;
    }

    gridEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(340px, 1fr));gap:20px;">
        ${filtered.map(store => {
          const mapQuery = encodeURIComponent(`${store.name} ${store.address} ${store.governorate}`);
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
          const cleanPhone = (store.phone || '').replace(/\D/g, '');
          const cleanWa = formatWhatsAppPhone(store.whatsapp || store.phone || '');
          const waMessage = encodeURIComponent(`السلام عليكم، هل مذكرات وكروت شحن منصة د. زياد رمزي عياد للكيمياء متوفرة لديكم الآن في ${store.name}؟`);
          const waUrl = `https://wa.me/${cleanWa}?text=${waMessage}`;
          const displayRating = typeof store.rating === 'number' ? store.rating.toFixed(1) : '4.9';
          const reviewCount = store.reviews_count || 0;

          return `
            <div class="card store-card" style="padding:22px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid var(--border-light);border-radius:16px;box-shadow:0 4px 18px rgba(0,0,0,0.03);transition:transform 0.2s, box-shadow 0.2s;">
              <div>
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;">
                  <h3 style="font-size:1.15rem;font-weight:900;color:var(--text-primary);margin:0;line-height:1.4;">
                    ${esc(store.name)}
                  </h3>
                  <span class="badge badge-primary" style="font-size:0.75rem;font-weight:800;padding:4px 10px;border-radius:8px;flex-shrink:0;">
                    ${esc(store.governorate)}
                  </span>
                </div>

                <div style="display:flex;align-items:flex-start;gap:8px;font-size:0.88rem;color:var(--text-secondary);margin:12px 0 14px;line-height:1.5;">
                  <span class="material-symbols-rounded" style="font-size:1.2rem;color:var(--primary);flex-shrink:0;margin-top:2px;">pin_drop</span>
                  <span>${esc(store.address)}</span>
                </div>

                <!-- Rating and crowd review badge -->
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;background:var(--bg-secondary);padding:10px 14px;border-radius:10px;border:1px solid var(--border-light);">
                  <div style="display:flex;align-items:center;color:#f59e0b;font-weight:900;font-size:0.95rem;gap:4px;">
                    <span class="material-symbols-rounded" style="font-size:1.2rem;color:#f59e0b;">star</span>
                    <span>${displayRating}</span>
                  </div>
                  <span style="font-size:0.78rem;color:var(--text-muted);font-weight:600;">(${reviewCount} تقييم)</span>
                  <span class="badge badge-success" style="font-size:0.68rem;margin-right:auto;font-weight:700;">منفذ معتمد ✅</span>
                </div>
              </div>

              <!-- Action buttons -->
              <div style="padding-top:16px;border-top:1px solid var(--border-light);display:flex;flex-direction:column;gap:10px;">
                ${teacher ? `
                  <!-- TEACHER ACTIONS -->
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <button type="button" class="btn btn-outline btn-sm edit-store-trigger-btn" data-store-id="${store.id}" style="font-size:0.82rem;gap:4px;justify-content:center;font-weight:700;">
                      <span class="material-symbols-rounded" style="font-size:1.1rem;color:var(--primary);">edit</span>
                      <span>تعديل البيانات</span>
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm delete-store-trigger-btn" data-store-id="${store.id}" data-store-name="${esc(store.name)}" style="font-size:0.82rem;gap:4px;justify-content:center;color:var(--error);font-weight:700;">
                      <span class="material-symbols-rounded" style="font-size:1.1rem;">delete</span>
                      <span>حذف المنفذ</span>
                    </button>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;">
                    <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="gap:4px;font-size:0.78rem;color:var(--primary);padding:4px 6px;">
                      <span class="material-symbols-rounded" style="font-size:1.1rem;">navigation</span>
                      <span>معاينة الموقع بالخريطة</span>
                    </a>
                    <a href="tel:${cleanPhone}" class="btn btn-ghost btn-sm" style="font-size:0.78rem;gap:4px;padding:4px 6px;">
                      <span class="material-symbols-rounded" style="font-size:1.1rem;">call</span>
                      <span>${cleanPhone}</span>
                    </a>
                  </div>
                ` : `
                  <!-- STUDENT ACTIONS -->
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <a href="tel:${cleanPhone}" class="btn btn-outline btn-sm" style="font-size:0.8rem;gap:4px;justify-content:center;padding:8px;" title="اتصال هاتفي">
                      <span class="material-symbols-rounded" style="font-size:1.1rem;">call</span>
                      <span>اتصال</span>
                    </a>
                    <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="font-size:0.8rem;color:#16a34a;border-color:#16a34a;gap:4px;justify-content:center;padding:8px;" title="محادثة واتساب">
                      <span class="material-symbols-rounded" style="font-size:1.1rem;">chat</span>
                      <span>واتساب</span>
                    </a>
                  </div>

                  <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;">
                    <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="gap:4px;font-size:0.78rem;color:var(--primary);justify-content:flex-start;padding:4px 6px;">
                      <span class="material-symbols-rounded" style="font-size:1.1rem;">navigation</span>
                      <span>فتح الموقع على الخريطة</span>
                    </a>

                    <button type="button" class="btn btn-sm btn-ghost rate-store-trigger-btn" data-store-id="${store.id}" data-store-name="${esc(store.name)}" style="color:#d97706;font-size:0.78rem;gap:3px;padding:4px 8px;">
                      <span class="material-symbols-rounded" style="font-size:1.05rem;">star_rate</span>
                      <span>${store.my_rating ? `تقييمك: ${store.my_rating}⭐` : 'تقييم'}</span>
                    </button>
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Bind Teacher Actions
    if (teacher) {
      gridEl.querySelectorAll('.edit-store-trigger-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const storeId = Number(btn.dataset.storeId);
          const store = allStores.find(s => s.id === storeId);
          if (store) openStoreFormModal(store);
        });
      });

      gridEl.querySelectorAll('.delete-store-trigger-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const storeId = Number(btn.dataset.storeId);
          const storeName = btn.dataset.storeName;
          if (!confirm(`هل أنت متأكد من حذف "${storeName}" من دليل المكتبات المعتمدة؟`)) return;

          try {
            const res = await api.deleteBookstore(storeId);
            showToast(res.message || 'تم حذف المنفذ بنجاح', 'success');
            allStores = allStores.filter(s => s.id !== storeId);
            renderStores();
          } catch (err) {
            showToast(err.message || 'تعذر حذف المكتبة', 'error');
          }
        });
      });
    }

    // Bind Student Rating triggers
    if (!teacher) {
      gridEl.querySelectorAll('.rate-store-trigger-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const storeId = btn.dataset.storeId;
          const storeName = btn.dataset.storeName;

          if (!isLoggedIn()) {
            showToast('يرجى تسجيل الدخول أولاً لتقييم المكتبة', 'warning');
            setTimeout(() => { window.location.hash = '#/login'; }, 1000);
            return;
          }

          openRatingDialog(storeId, storeName);
        });
      });
    }
  }

  // TEACHER MODAL: ADD / EDIT STORE
  function openStoreFormModal(store) {
    let existingDialog = document.getElementById('storeFormModal');
    if (existingDialog) existingDialog.remove();

    const isEdit = !!store;
    const modal = document.createElement('div');
    modal.id = 'storeFormModal';
    modal.className = 'modal-backdrop active';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;backdrop-filter:blur(5px);';
    modal.innerHTML = `
      <div class="card" style="max-width:520px;width:100%;padding:28px 24px;border-radius:20px;box-shadow:0 24px 50px rgba(0,0,0,0.25);position:relative;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;border-bottom:1px solid var(--border-light);padding-bottom:12px;">
          <h3 style="font-size:1.25rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;margin:0;">
            <span class="material-symbols-rounded" style="color:var(--primary);">${isEdit ? 'edit_square' : 'add_business'}</span>
            ${isEdit ? 'تعديل بيانات المنفذ المعتمد' : 'إضافة منفذ معتمد جديد'}
          </h3>
          <button type="button" id="closeStoreFormModalBtn" class="btn btn-ghost btn-sm" style="padding:4px;"><span class="material-symbols-rounded">close</span></button>
        </div>

        <form id="storeFormElement" style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label class="form-label" style="font-size:0.85rem;font-weight:700;margin-bottom:6px;display:block;">اسم المكتبة أو السنتر: *</label>
            <input type="text" id="sf_name" class="form-input" required value="${esc(store?.name || '')}" placeholder="مثال: سنتر ومكتبة الأوائل" />
          </div>

          <div>
            <label class="form-label" style="font-size:0.85rem;font-weight:700;margin-bottom:6px;display:block;">المحافظة: *</label>
            <select id="sf_gov" class="form-input" required>
              <option value="">اختر المحافظة</option>
              ${EGYPT_GOVERNORATES.map(g => `
                <option value="${g}" ${store?.governorate === g ? 'selected' : ''}>${g}</option>
              `).join('')}
            </select>
          </div>

          <div>
            <label class="form-label" style="font-size:0.85rem;font-weight:700;margin-bottom:6px;display:block;">العنوان التفصيلي: *</label>
            <input type="text" id="sf_address" class="form-input" required value="${esc(store?.address || '')}" placeholder="مثال: شارع كامل صدقي، الفجالة، بجوار المحطة" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label class="form-label" style="font-size:0.85rem;font-weight:700;margin-bottom:6px;display:block;">رقم الهاتف: *</label>
              <input type="tel" id="sf_phone" class="form-input" required value="${esc(store?.phone || '')}" placeholder="01xxxxxxxxx" dir="ltr" />
            </div>
            <div>
              <label class="form-label" style="font-size:0.85rem;font-weight:700;margin-bottom:6px;display:block;">رقم الواتساب:</label>
              <input type="tel" id="sf_whatsapp" class="form-input" value="${esc(store?.whatsapp || '')}" placeholder="01xxxxxxxxx" dir="ltr" />
            </div>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button type="button" id="cancelStoreFormBtn" class="btn btn-secondary">إلغاء</button>
            <button type="submit" id="saveStoreFormBtn" class="btn btn-primary" style="font-weight:800;">
              <span class="material-symbols-rounded">check</span>
              ${isEdit ? 'حفظ التعديلات' : 'إضافة المنفذ الآن'}
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#closeStoreFormModalBtn').addEventListener('click', () => modal.remove());
    modal.querySelector('#cancelStoreFormBtn').addEventListener('click', () => modal.remove());

    modal.querySelector('#storeFormElement').addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = modal.querySelector('#saveStoreFormBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الحفظ...';

      const body = {
        name: document.getElementById('sf_name').value.trim(),
        governorate: document.getElementById('sf_gov').value,
        address: document.getElementById('sf_address').value.trim(),
        phone: document.getElementById('sf_phone').value.trim(),
        whatsapp: document.getElementById('sf_whatsapp').value.trim() || document.getElementById('sf_phone').value.trim()
      };

      try {
        if (isEdit) {
          const res = await api.updateBookstore(store.id, body);
          showToast(res.message || 'تم تحديث المنفذ بنجاح ✅', 'success');
          const target = allStores.find(s => s.id === store.id);
          if (target) Object.assign(target, body);
        } else {
          const res = await api.createBookstore(body);
          showToast(res.message || 'تم إضافة المنفذ بنجاح ✅', 'success');
          allStores.unshift({
            id: res.store_id || Date.now(),
            ...body,
            rating: 5.0,
            reviews_count: 1,
            is_active: 1
          });
          if (!availableGovs.includes(body.governorate)) {
            availableGovs.push(body.governorate);
          }
        }

        modal.remove();
        renderStores();
      } catch (err) {
        showToast(err.message || 'حدث خطأ في حفظ بيانات المكتبة', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'حفظ التعديلات' : 'إضافة المنفذ الآن';
      }
    });
  }

  // STUDENT MODAL: RATING DIALOG
  function openRatingDialog(storeId, storeName) {
    let existingDialog = document.getElementById('storeRatingModal');
    if (existingDialog) existingDialog.remove();

    const modal = document.createElement('div');
    modal.id = 'storeRatingModal';
    modal.className = 'modal-backdrop active';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;backdrop-filter:blur(4px);';
    modal.innerHTML = `
      <div class="card" style="max-width:400px;width:100%;padding:28px 24px;border-radius:20px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.2);">
        <span class="material-symbols-rounded" style="font-size:3rem;color:#f59e0b;margin-bottom:12px;">star</span>
        <h3 style="font-size:1.2rem;font-weight:900;margin-bottom:6px;color:var(--text-primary);">تقييم منفذ البيع</h3>
        <p style="font-size:0.88rem;color:var(--text-secondary);margin-bottom:20px;">
          ${esc(storeName)}
        </p>

        <div id="starPickerContainer" style="display:flex;justify-content:center;gap:8px;margin-bottom:24px;">
          ${[1, 2, 3, 4, 5].map(star => `
            <button type="button" class="star-choice-btn" data-rating="${star}" style="background:none;border:none;cursor:pointer;padding:4px;color:#d1d5db;transition:all 0.15s ease;">
              <span class="material-symbols-rounded" style="font-size:2.2rem;">star</span>
            </button>
          `).join('')}
        </div>

        <div style="display:flex;gap:10px;justify-content:center;">
          <button type="button" id="cancelRatingBtn" class="btn btn-secondary btn-sm" style="flex:1;">إلغاء</button>
          <button type="button" id="confirmRatingBtn" class="btn btn-primary btn-sm" style="flex:1;">تأكيد التقييم</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let selectedStar = 5;
    const starBtns = modal.querySelectorAll('.star-choice-btn');
    const confirmBtn = modal.querySelector('#confirmRatingBtn');

    function updateStarUI(val) {
      selectedStar = val;
      starBtns.forEach(b => {
        const r = Number(b.dataset.rating);
        if (r <= val) {
          b.style.color = '#f59e0b';
          b.style.transform = 'scale(1.15)';
        } else {
          b.style.color = '#d1d5db';
          b.style.transform = 'scale(1)';
        }
      });
      if (confirmBtn) confirmBtn.disabled = false;
    }

    updateStarUI(5);

    starBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        updateStarUI(Number(btn.dataset.rating));
      });
    });

    modal.querySelector('#cancelRatingBtn').addEventListener('click', () => {
      modal.remove();
    });

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'جاري الحفظ...';
      try {
        const res = await api.rateBookstore(storeId, selectedStar);
        showToast(res.message || 'تم حفظ تقييمك بنجاح ⭐', 'success');
        modal.remove();

        const target = allStores.find(s => s.id === Number(storeId));
        if (target) {
          target.rating = res.new_rating;
          target.reviews_count = res.reviews_count;
          target.my_rating = res.user_rating;
        }
        renderStores();
      } catch (e) {
        showToast(e.message || 'تعذر تسجيل التقييم', 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'تأكيد التقييم';
      }
    });
  }

  // Load stores from API
  try {
    const data = await api.getBookstores();
    allStores = data.stores || [];
    availableGovs = data.governorates || ['الكل'];

    // Render Pills
    if (pillsEl) {
      pillsEl.innerHTML = availableGovs.map(g => `
        <button type="button" class="btn btn-sm gov-filter-btn ${g === currentGov ? 'btn-primary' : 'btn-outline'}" data-gov="${g}" style="border-radius:20px;font-weight:700;padding:6px 16px;">
          ${g}
        </button>
      `).join('');

      pillsEl.querySelectorAll('.gov-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentGov = btn.dataset.gov;
          pillsEl.querySelectorAll('.gov-filter-btn').forEach(b => {
            b.classList.toggle('btn-primary', b.dataset.gov === currentGov);
            b.classList.toggle('btn-outline', b.dataset.gov !== currentGov);
          });
          renderStores();
        });
      });
    }

    // Bind Search Input
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderStores();
      });
    }

    renderStores();

  } catch (err) {
    console.error('Failed to load bookstores:', err);
    gridEl.innerHTML = `
      <div class="card" style="text-align:center;padding:40px;color:var(--error);">
        <span class="material-symbols-rounded" style="font-size:3rem;margin-bottom:8px;">error</span>
        <p style="font-weight:800;">حدث خطأ في تحميل دليل المكتبات: ${esc(err.message)}</p>
        <button type="button" class="btn btn-secondary btn-sm" onclick="location.reload()" style="margin-top:12px;">إعادة المحاولة</button>
      </div>
    `;
  }
}
