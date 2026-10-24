import { renderNavbar, initNavbar } from '../components/navbar.js';
import { renderPublicHeader, initPublicHeader } from '../components/publicHeader.js';
import { isLoggedIn } from '../utils/auth.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderMainContent(logged) {
  return `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:24px;">
      <div>
        <h1 class="page-title" style="display:flex;align-items:center;gap:10px;font-size:1.6rem;font-weight:900;">
          <span class="material-symbols-rounded" style="color:var(--primary);font-size:2rem;">storefront</span>
          دليل المكتبات ومنافذ الشحن المعتمدة
        </h1>
        <p class="page-subtitle" style="color:var(--text-secondary);font-size:0.95rem;margin-top:6px;">
          المكتبات والسناتر المعتمدة لشراء مذكرات كيمياوي وكروت شحن المنصة بجميع محافظات مصر
        </p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="#/wallet" class="btn btn-outline" style="gap:6px;font-weight:700;">
          <span class="material-symbols-rounded">account_balance_wallet</span> شحن المحفظة أونلاين
        </a>
      </div>
    </div>

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

  if (!logged) {
    return `
      <div class="landing" style="min-height: 100vh; background: var(--bg-main);">
        ${renderPublicHeader('store-locator')}
        <main class="section-container" style="padding-top: 110px; padding-bottom: 60px; max-width: 1200px; margin: 0 auto; padding-inline: 20px;">
          ${renderMainContent(false)}
        </main>
      </div>
    `;
  }

  return `
    <div class="app-layout">
      ${renderNavbar('store-locator')}
      <main class="main-content" style="max-width: 1200px; margin: 0 auto; padding: 32px 24px 60px;">
        ${renderMainContent(true)}
      </main>
    </div>
  `;
}

export async function initStoreLocator() {
  const logged = isLoggedIn();
  if (logged) {
    initNavbar();
  } else {
    initPublicHeader();
  }

  const gridEl = document.getElementById('storesGrid');
  const pillsEl = document.getElementById('governoratePills');
  const searchInput = document.getElementById('storeSearchInput');
  const countBadge = document.getElementById('resultsCountBadge');

  if (!gridEl) return;

  let allStores = [];
  let availableGovs = ['الكل'];
  let currentGov = 'الكل';
  let searchQuery = '';

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
            لم نعثر على مكتبة في محافظة "${currentGov}" بالاسم "${esc(searchQuery)}". يمكنك الشحن أونلاين عبر فودافون كاش أو إنستاباي بسهولة.
          </p>
          <a href="#/wallet" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;">
            <span class="material-symbols-rounded">account_balance_wallet</span> شحن المحفظة أونلاين
          </a>
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
          const cleanWa = (store.whatsapp || store.phone || '').replace(/\D/g, '');
          const waMessage = encodeURIComponent(`السلام عليكم، هل مذكرات وكروت شحن منصة د. زياد رمزي عياد للكيمياء متوفرة لديكم الآن في ${store.name}؟`);
          const waUrl = `https://wa.me/2${cleanWa.replace(/^0+/, '')}?text=${waMessage}`;
          const displayRating = typeof store.rating === 'number' ? store.rating.toFixed(1) : '4.9';
          const reviewCount = store.reviews_count || 50;

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
                  <span style="font-size:0.78rem;color:var(--text-muted);font-weight:600;">(${reviewCount} تقييم طالب)</span>
                  <span class="badge badge-success" style="font-size:0.68rem;margin-right:auto;font-weight:700;">منفذ معتمد ✅</span>
                </div>
              </div>

              <!-- Action buttons -->
              <div style="padding-top:16px;border-top:1px solid var(--border-light);display:flex;flex-direction:column;gap:10px;">
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
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Bind rating triggers
    document.querySelectorAll('.rate-store-trigger-btn').forEach(btn => {
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
          <button type="button" id="confirmRatingBtn" class="btn btn-primary btn-sm" style="flex:1;" disabled>تأكيد التقييم</button>
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
        const icon = b.querySelector('.material-symbols-rounded');
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

        // Update local store data
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
        <p style="font-weight:800;">حدث خطأ في تحميل دليل المكتبات: ${err.message}</p>
        <button type="button" class="btn btn-secondary btn-sm" onclick="location.reload()" style="margin-top:12px;">إعادة المحاولة</button>
      </div>
    `;
  }
}
