import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderStoreLocator() {
  return `
    <div class="app-layout">
      ${renderNavbar('store-locator')}
      <main class="main-content">
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
          <div>
            <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">storefront</span> دليل المكتبات ومنافذ الشحن</h1>
            <p class="page-subtitle">المكتبات والسناتر المعتمدة لشراء مذكرات كيمياوي وكروت شحن المنصة بجميع محافظات مصر</p>
          </div>
          <a href="#/wallet" class="btn btn-outline" style="gap:6px;">
            <span class="material-symbols-rounded">account_balance_wallet</span> شحن المحفظة أونلاين
          </a>
        </div>

        <!-- GOVERNORATE FILTER PILLS -->
        <div class="card" style="padding:16px 20px;margin-bottom:24px;">
          <div style="font-size:0.85rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
            <span class="material-symbols-rounded" style="font-size:1.1rem;color:var(--primary);">location_on</span>
            اختر المحافظة لتصفية المنافذ القريبة منك:
          </div>
          <div id="governoratePills" style="display:flex;gap:8px;flex-wrap:wrap;">
            <div class="skeleton-text skeleton" style="width:120px;height:34px;border-radius:20px;"></div>
          </div>
        </div>

        <!-- STORES GRID -->
        <div id="storesGrid">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </main>
    </div>
  `;
}

export async function initStoreLocator() {
  initNavbar();
  const gridEl = document.getElementById('storesGrid');
  const pillsEl = document.getElementById('governoratePills');
  if (!gridEl) return;

  let currentGov = 'الكل';

  async function loadStores(gov = 'الكل') {
    try {
      const data = await api.getBookstores(gov === 'الكل' ? '' : gov);

      // Render Governorate Filter Pills
      if (pillsEl && data.governorates) {
        pillsEl.innerHTML = data.governorates.map(g => `
          <button type="button" class="btn btn-sm gov-filter-btn ${g === gov ? 'btn-primary' : 'btn-outline'}" data-gov="${g}" style="border-radius:20px;font-weight:700;padding:6px 16px;">
            ${g}
          </button>
        `).join('');

        document.querySelectorAll('.gov-filter-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            currentGov = btn.dataset.gov;
            loadStores(currentGov);
          });
        });
      }

      const stores = data.stores || [];
      if (stores.length === 0) {
        gridEl.innerHTML = `
          <div class="card" style="text-align:center;padding:40px;color:var(--text-muted);">
            <span class="material-symbols-rounded" style="font-size:3rem;margin-bottom:8px;">store_mall_directory</span>
            <p style="font-weight:700;">لا توجد منافذ مسجلة في محافظة "${gov}" حالياً.</p>
            <small>يمكنك الشحن أونلاين ببطاقة فوري أو التواصل مع الدعم لتوفير مندوب.</small>
          </div>
        `;
        return;
      }

      gridEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px;">
          ${stores.map(store => `
            <div class="card store-card" style="padding:22px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid var(--border-light);border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
              <div>
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;">
                  <h3 style="font-size:1.1rem;font-weight:800;color:var(--text-primary);margin:0;">
                    ${esc(store.name)}
                  </h3>
                  <span class="badge badge-info" style="font-size:0.75rem;font-weight:700;">${esc(store.governorate)}</span>
                </div>

                <div style="display:flex;align-items:flex-start;gap:6px;font-size:0.85rem;color:var(--text-secondary);margin:10px 0;line-height:1.5;">
                  <span class="material-symbols-rounded" style="font-size:1.1rem;color:var(--primary);flex-shrink:0;">pin_drop</span>
                  <span>${esc(store.address)}</span>
                </div>

                <!-- Rating and crowd review -->
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;background:var(--bg-secondary);padding:8px 12px;border-radius:8px;">
                  <div style="display:flex;align-items:center;color:#f59e0b;font-weight:800;font-size:0.9rem;gap:4px;">
                    <span class="material-symbols-rounded" style="font-size:1.1rem;">star</span>
                    <span>${store.rating || 4.9}</span>
                  </div>
                  <span style="font-size:0.75rem;color:var(--text-muted);">(${store.reviews_count || 120} تقييم طلاب)</span>
                  <span class="badge badge-success" style="font-size:0.65rem;margin-right:auto;">أسعار رسمية معتمدة</span>
                </div>
              </div>

              <!-- Actions row -->
              <div style="display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px solid var(--border-light);gap:8px;flex-wrap:wrap;">
                <div style="display:flex;gap:6px;">
                  <a href="tel:${store.phone}" class="btn btn-outline btn-sm" style="gap:4px;" title="اتصال">
                    <span class="material-symbols-rounded">call</span> <span dir="ltr">${esc(store.phone)}</span>
                  </a>
                  ${store.whatsapp ? `
                    <a href="https://wa.me/${store.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('السلام عليكم، هل مذكرات وكروت د. زياد رمزي عياد للكيمياء متوفرة لديكم الآن؟')}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="color:#25D366;border-color:#25D366;padding:4px 8px;" title="محادثة واتساب">
                      <span class="material-symbols-rounded">chat</span>
                    </a>
                  ` : ''}
                </div>

                <button type="button" class="btn btn-ghost btn-sm rate-store-btn" data-store-id="${store.id}" style="color:var(--primary);font-size:0.78rem;gap:4px;">
                  <span class="material-symbols-rounded">rate_review</span> تقييم المنفذ
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Bind Rate Store buttons
      document.querySelectorAll('.rate-store-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const sId = btn.dataset.storeId;
          try {
            const res = await api.rateBookstore(sId, 5);
            showToast(res.message, 'success');
            loadStores(currentGov);
          } catch (e) {
            showToast(e.message, 'error');
          }
        });
      });

    } catch (err) {
      gridEl.innerHTML = `<p style="color:var(--error);text-align:center;padding:30px;">حدث خطأ في تحميل المنافذ: ${err.message}</p>`;
    }
  }

  loadStores();
}
