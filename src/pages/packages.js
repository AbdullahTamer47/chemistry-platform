import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderPackages() {
  return `
    <div class="app-layout">
      ${renderNavbar('packages')}
      <main class="main-content">
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
          <div>
            <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">view_carousel</span> باقات الـ 3 شهور والترم المخفضة</h1>
            <p class="page-subtitle">اشترك في باقات مجمعة بخصم يصل إلى 30% مع وصول شامل لجميع المحاضرات والمذكرات وامتحانات الثانوية</p>
          </div>
          <div style="display:flex;gap:10px;">
            <a href="#/store-locator" class="btn btn-outline" style="gap:6px;">
              <span class="material-symbols-rounded" style="color:var(--primary);">storefront</span> دليل المكتبات ومنافذ الشحن
            </a>
            <a href="#/wallet" class="btn btn-primary" style="gap:6px;">
              <span class="material-symbols-rounded">account_balance_wallet</span> شحن المحفظة
            </a>
          </div>
        </div>

        <div id="packagesList">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </main>
    </div>
  `;
}

export async function initPackages() {
  initNavbar();
  const listEl = document.getElementById('packagesList');
  if (!listEl) return;

  try {
    const packages = await api.getPackages();

    if (!packages || packages.length === 0) {
      listEl.innerHTML = `
        <div class="card" style="text-align:center;padding:50px 24px;">
          <span class="material-symbols-rounded" style="font-size:3.5rem;color:var(--text-muted);margin-bottom:12px;">inventory_2</span>
          <h3>لا توجد باقات متاحة حالياً</h3>
          <p style="color:var(--text-secondary);">تابعنا قريباً لإطلاق باقات المراجعات النهائية والترم الثاني.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:24px;">
        ${packages.map(pkg => {
          const discountPercent = pkg.discount_percent || 0;
          const savings = (pkg.original_price || pkg.price) - pkg.price;

          return `
            <div class="card" style="padding:0;overflow:hidden;border:1px solid var(--border-light);border-radius:18px;background:var(--bg-primary);box-shadow:0 12px 32px rgba(0,0,0,0.06);">
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));">
                
                <!-- Package Details Column -->
                <div style="padding:32px 28px;display:flex;flex-direction:column;justify-content:space-between;">
                  <div>
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
                      <span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.8rem; font-weight:800; border:1px solid #fde68a;">محتوى 3 شهور كاملة من المنهج</span>
                      <span class="badge" style="background:#ecfdf5; color:#065f46; font-size:0.8rem; font-weight:800; border:1px solid #a7f3d0; display:inline-flex; align-items:center; gap:4px;">
                        <span class="material-symbols-rounded" style="font-size:0.95rem; vertical-align:middle;">all_inclusive</span> متاح طوال العام الدراسي
                      </span>
                      ${discountPercent > 0 ? `<span class="badge badge-success" style="font-size:0.8rem;font-weight:800;">وفر ${savings} ج.م (${discountPercent}%)</span>` : ''}
                    </div>

                    <h2 style="font-size:1.35rem;font-weight:900;color:var(--text-primary);margin:0 0 10px 0;line-height:1.4;">
                      ${esc(pkg.title)}
                    </h2>
                    <p style="color:var(--text-secondary);font-size:0.88rem;line-height:1.6;margin-bottom:20px;">
                      ${esc(pkg.description)}
                    </p>

                    <!-- Features bullets -->
                    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px;margin-bottom:20px;font-size:0.84rem;">
                      <div style="display:flex;align-items:center;gap:8px;">
                        <span class="material-symbols-rounded" style="color:var(--success);font-size:1.1rem;">check_circle</span>
                        <span>جميع المحاضرات والتدريبات</span>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <span class="material-symbols-rounded" style="color:var(--success);font-size:1.1rem;">check_circle</span>
                        <span>حل امتحانات الوزارة السابقة</span>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <span class="material-symbols-rounded" style="color:var(--success);font-size:1.1rem;">check_circle</span>
                        <span>المذكرات والواجبات PDF</span>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <span class="material-symbols-rounded" style="color:var(--success);font-size:1.1rem;">check_circle</span>
                        <span>شهادات تفوق وتقرير ولي الأمر</span>
                      </div>
                    </div>
                  </div>

                  <!-- Price & Subscribe Action -->
                  <div style="display:flex;align-items:center;justify-content:space-between;padding-top:20px;border-top:1px solid var(--border-light);flex-wrap:wrap;gap:16px;">
                    <div>
                      <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;">سعر الباقة الإجمالي:</div>
                      <div style="display:flex;align-items:baseline;gap:8px;">
                        <span style="font-size:1.8rem;font-weight:900;color:var(--primary);">${pkg.price} <small style="font-size:0.85rem;">ج.م</small></span>
                        ${pkg.original_price > pkg.price ? `<span style="font-size:1rem;color:var(--text-muted);text-decoration:line-through;">${pkg.original_price} ج</span>` : ''}
                      </div>
                    </div>

                    ${pkg.is_enrolled ? `
                      <div style="display:flex;align-items:center;gap:10px;">
                        <span class="badge badge-success" style="padding:10px 16px;font-size:0.9rem;gap:6px;">
                          <span class="material-symbols-rounded">verified</span> مشترك ومفعّل بحسابك
                        </span>
                        <a href="#/courses" class="btn btn-primary" style="padding:10px 20px;">
                          <span class="material-symbols-rounded">play_lesson</span> الدخول للمحاضرات
                        </a>
                      </div>
                    ` : `
                      <button type="button" class="btn btn-primary subscribe-pkg-btn" data-pkg-id="${pkg.id}" data-pkg-title="${esc(pkg.title)}" data-pkg-price="${pkg.price}" style="padding:12px 28px;font-size:1rem;font-weight:800;gap:8px;">
                        <span class="material-symbols-rounded">shopping_cart_checkout</span> اشترك الآن في الباقة
                      </button>
                    `}
                  </div>
                </div>

                <!-- Included Courses Sidebar Column -->
                <div style="background:var(--bg-secondary);padding:28px 24px;border-right:1px solid var(--border-light);">
                  <div style="font-weight:800;font-size:0.95rem;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
                    <span class="material-symbols-rounded" style="color:var(--primary);">library_books</span>
                    الكورسات المشمولة في الباقة (${pkg.courses?.length || 0})
                  </div>

                  <div style="display:flex;flex-direction:column;gap:12px;">
                    ${(pkg.courses || []).map(c => `
                      <div style="padding:12px 14px;background:var(--bg-primary);border:1px solid var(--border-light);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
                        <div>
                          <div style="font-weight:700;font-size:0.88rem;color:var(--text-primary);">${esc(c.title)}</div>
                          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">
                            ${c.lessons_count} محاضرة • ${c.exams_count} اختبار منهجي
                          </div>
                        </div>
                        <div style="font-weight:800;font-size:0.85rem;color:var(--text-secondary);" dir="ltr">
                          ${c.price} ج
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>

              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Bind Subscribe Buttons
    document.querySelectorAll('.subscribe-pkg-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pkgId = btn.dataset.pkgId;
        const title = btn.dataset.pkgTitle;
        const price = Number(btn.dataset.pkgPrice);

        // Fetch wallet balance
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
                  <span class="material-symbols-rounded">bolt</span> التوجه لشحن المحفظة بفوري
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
            await initPackages();
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
            document.querySelector('.modal-backdrop')?.remove();
            await initPackages();
          } catch (err) {
            showToast(err.message, 'error');
            vBtn.disabled = false;
            vBtn.innerHTML = '<span class="material-symbols-rounded">qr_code</span> تفعيل الباقة بكود الكارت';
          }
        });

      });
    });

  } catch (err) {
    listEl.innerHTML = `<p style="color:var(--error);text-align:center;padding:30px;">حدث خطأ في تحميل الباقات: ${err.message}</p>`;
  }
}
