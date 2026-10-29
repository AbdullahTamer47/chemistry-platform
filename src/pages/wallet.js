import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

const METHOD_LABELS = {
  vodafone_cash: 'فودافون كاش',
  instapay: 'إنستاباي',
  fawry: 'فوري',
};
const STATUS_LABELS = {
  pending: { text: 'قيد المراجعة', cls: 'badge-warning', icon: 'schedule' },
  approved: { text: 'تم التفعيل', cls: 'badge-success', icon: 'check_circle' },
  rejected: { text: 'مرفوض', cls: 'badge-danger', icon: 'cancel' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderWallet() {
  return `
  <div class="app-layout">
    ${renderNavbar('wallet')}
    <main class="main-content">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div>
          <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">account_balance_wallet</span> المحفظة الرقمية وطرق الدفع</h1>
          <p class="page-subtitle">شحن رصيد المحفظة آلياً بفوري، كروت السنتر، أو التحويل اليدوي</p>
        </div>
        <div id="walletBalanceBadge" class="card" style="padding:14px 22px;display:flex;align-items:center;gap:14px;background:linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,95,70,0.08));border:1px solid rgba(16,185,129,0.3);border-radius:var(--radius-md);">
          <div class="stat-icon green" style="width:44px;height:44px;border-radius:12px;">
            <span class="material-symbols-rounded">payments</span>
          </div>
          <div>
            <div style="font-size:0.78rem;color:var(--text-muted);font-weight:700;">رصيدك الحالي في المحفظة</div>
            <div style="font-size:1.4rem;font-weight:900;color:var(--success);display:flex;align-items:baseline;gap:4px;">
              <span id="currentWalletBalance">0</span> <small style="font-size:0.8rem;color:var(--text-secondary);">ج.م</small>
            </div>
          </div>
        </div>
      </div>

      <div class="tabs wallet-tabs" id="walletTabs" role="tablist">
        <button type="button" class="tab active" data-tab="fawry_auto" role="tab">
          <span class="material-symbols-rounded">bolt</span> شحن فوري الآلي (رقم مرجعي مباشر)
        </button>
        <button type="button" class="tab" data-tab="vouchers_charge" role="tab">
          <span class="material-symbols-rounded">qr_code</span> شحن كارت السنتر والمكتبات
        </button>
        <button type="button" class="tab" data-tab="manual_pay" role="tab">
          <span class="material-symbols-rounded">payments</span> فودافون كاش / إنستاباي (إيصال)
        </button>
        <button type="button" class="tab" data-tab="transactions_history" role="tab">
          <span class="material-symbols-rounded">history</span> سجل عمليات المحفظة
        </button>
      </div>

      <div class="wallet-grid">
        <div class="wallet-col">

          <!-- 1. FAWRY AUTOMATED REFERENCE RECHARGE -->
          <div class="card wallet-tab-pane" id="pane_fawry_auto">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <span class="material-symbols-rounded" style="color:#f59e0b;font-size:1.8rem;">bolt</span>
              <div>
                <h3 class="card-title" style="margin:0;">شحن فوري الذكي (Fawry Instant Pay)</h3>
                <small style="color:var(--text-muted);">توليد رقم دفع مرجعي فوري صالح لمدة 24 ساعة في أي ماكينة فوري بمصر</small>
              </div>
            </div>

            <div class="pay-step-label"><span>1</span> اختر مبلغ الشحن</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(80px, 1fr));gap:10px;margin-bottom:14px;">
              <button type="button" class="btn btn-outline fawry-preset-btn" data-amt="50" style="font-weight:800;">50 ج</button>
              <button type="button" class="btn btn-outline fawry-preset-btn" data-amt="100" style="font-weight:800;">100 ج</button>
              <button type="button" class="btn btn-outline fawry-preset-btn active" data-amt="200" style="font-weight:800;border-color:var(--primary);">200 ج</button>
              <button type="button" class="btn btn-outline fawry-preset-btn" data-amt="350" style="font-weight:800;">350 ج (باقة)</button>
            </div>

            <div class="form-group">
              <label class="form-label">أو اكتب مبلغاً مخصصاً (بالجنيه المصري):</label>
              <div class="input-group">
                <span class="material-symbols-rounded input-icon">attach_money</span>
                <input type="number" id="fawryCustomAmount" class="form-input" min="10" max="5000" value="200" placeholder="مثال: 200">
              </div>
            </div>

            <button type="button" class="btn btn-primary btn-block" id="generateFawryBtn" style="padding:14px;font-size:1rem;gap:8px;">
              <span class="material-symbols-rounded">receipt_long</span> توليد كود دفع فوري الآن
            </button>

            <!-- FAWRY INVOICE CONTAINER -->
            <div id="fawryInvoiceWrap" style="margin-top:20px;display:none;"></div>
          </div>

          <!-- 2. SCRATCH VOUCHER CHARGE -->
          <div class="card wallet-tab-pane" id="pane_vouchers_charge" hidden>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <span class="material-symbols-rounded" style="color:var(--primary);font-size:1.8rem;">credit_card</span>
              <div>
                <h3 class="card-title" style="margin:0;">شحن المحفظة بكارت السنتر أو المذكرات</h3>
                <small style="color:var(--text-muted);">اخربش الكارت واكتب الكود المطبوع لشحن رصيد محفظتك واستخدامه في شراء أي باقة أو كورس</small>
              </div>
            </div>

            <form id="voucherChargeForm" style="margin-top:16px;">
              <div class="form-group">
                <label class="form-label">كود كارت الشحن (14 أو 15 رقماً/حرفاً):</label>
                <div class="input-group">
                  <span class="material-symbols-rounded input-icon">key</span>
                  <input type="text" class="form-input code-input" id="voucherChargeInput" placeholder="مثال: KEM-100-DEMO2" dir="ltr" autocomplete="off">
                </div>
              </div>
              <button type="submit" class="btn btn-primary btn-block" id="voucherChargeBtn">
                <span class="material-symbols-rounded">add_circle</span> شحن الكارت إلى المحفظة فوراً
              </button>
            </form>
            <div id="voucherChargeResult"></div>
          </div>

          <!-- 3. MANUAL ONLINE PAY (VODAFONE CASH / INSTAPAY) -->
          <div class="card wallet-tab-pane" id="pane_manual_pay" hidden>
            <h3 class="card-title" style="margin-bottom: 6px;">
              <span class="material-symbols-rounded" style="color:var(--primary)">payments</span> التحويل اليدوي (فودافون كاش / إنستاباي)
            </h3>
            <p class="pay-hint">حوّل قيمة الكورس بأي وسيلة، وارفع صورة إيصال التحويل، وسيتم مراجعة الطلب وتفعيل الكورس.</p>

            <div class="pay-step-label"><span>1</span> اختر وسيلة الدفع</div>
            <div class="pay-methods" id="payMethods">
              <button type="button" class="pay-method active" data-method="vodafone_cash">
                <span class="material-symbols-rounded">smartphone</span><strong>فودافون كاش</strong><small>وأي محفظة إلكترونية</small>
              </button>
              <button type="button" class="pay-method" data-method="instapay">
                <span class="material-symbols-rounded">account_balance</span><strong>إنستاباي</strong><small>InstaPay</small>
              </button>
            </div>

            <div class="pay-step-label"><span>2</span> اختر الكورس وحوّل المبلغ</div>
            <select id="payCourseSelect" class="form-input" style="margin-bottom:12px;">
              <option value="">جاري تحميل الكورسات...</option>
            </select>
            <div class="pay-target" id="payTarget"></div>

            <div class="pay-step-label"><span>3</span> اكتب بيانات التحويل مع الإيصال</div>
            <form id="payForm" class="pay-form" novalidate>
              <div id="paySenderWrap">
                <label class="form-label" for="paySender">رقم الموبايل المحوَّل منه</label>
                <input type="tel" id="paySender" class="form-input" dir="ltr" inputmode="numeric" maxlength="11" placeholder="01XXXXXXXXX">
              </div>
              <div>
                <label class="form-label" for="payRef" id="payRefLabel">رقم العملية (من رسالة التحويل)</label>
                <input type="text" id="payRef" class="form-input" dir="ltr" maxlength="40" placeholder="مثال: 123456789">
              </div>
              <div>
                <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;">
                  <span>صورة الإيصال / لقطة التحويل</span>
                  <span style="color:var(--error, #ef4444); font-size:0.75rem; font-weight:800;">* إجباري للمراجعة والقبول</span>
                </label>
                <label class="pay-upload" for="payReceipt" style="border-style:dashed; border-width:2px;">
                  <span class="material-symbols-rounded" style="color:var(--primary)">add_photo_alternate</span>
                  <span id="payReceiptName">اضغط لاختيار صورة الإيصال (PNG / JPG حتى 3 ميجا)</span>
                </label>
                <input type="file" id="payReceipt" accept="image/png,image/jpeg,image/webp" hidden>
              </div>
              <button type="submit" class="btn btn-primary btn-block" id="paySubmitBtn">
                <span class="material-symbols-rounded">send</span> إرسال طلب التفعيل
              </button>
            </form>

            <div class="pay-step-label" style="margin-top:24px;"><span class="material-symbols-rounded" style="font-size:1rem;">history</span> طلباتي السابقة</div>
            <div id="myPaymentsList"><p class="pay-empty">جاري التحميل...</p></div>
          </div>

          <!-- 4. TRANSACTIONS HISTORY -->
          <div class="card wallet-tab-pane" id="pane_transactions_history" hidden>
            <h3 class="card-title" style="margin-bottom: 12px;">
              <span class="material-symbols-rounded" style="color:var(--primary)">receipt_long</span> كشف حساب المحفظة
            </h3>
            <div id="walletTransactionsList">
              <p class="pay-empty">جاري التحميل...</p>
            </div>
          </div>

          <!-- Enrolled Courses -->
          <div class="card" style="margin-top:20px;">
            <h3 class="card-title" style="margin-bottom: 16px;"><span class="material-symbols-rounded" style="color:var(--primary)">book</span> كورساتي المفعّلة</h3>
            <div id="myCoursesWallet">
              <div class="skeleton-text skeleton"></div>
              <div class="skeleton-text skeleton" style="width: 70%;"></div>
            </div>
          </div>

        </div>

        <!-- SIDEBAR -->
        <div class="wallet-col">
          <div class="card" style="padding: 24px;">
            <h3 class="card-title" style="margin-bottom: 16px;display:flex;align-items:center;gap:8px;">
              <span class="material-symbols-rounded" style="color:var(--warning)">stars</span> مزايا الدفع الآلي الفوري
            </h3>
            <ul style="display:flex;flex-direction:column;gap:12px;font-size:0.86rem;color:var(--text-secondary);padding:0;list-style:none;">
              <li style="display:flex;align-items:flex-start;gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--success);font-size:1.1rem;">check_circle</span>
                <span><strong>تفعيل فوري:</strong> يتم إضافة الرصيد في محفظتك تلقائياً في ثوانٍ بمجرد السداد.</span>
              </li>
              <li style="display:flex;align-items:flex-start;gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--success);font-size:1.1rem;">check_circle</span>
                <span><strong>متوفر في كل مكان:</strong> أكثر من 160 ألف ماكينة فوري بجميع محافظات وقرى مصر.</span>
              </li>
              <li style="display:flex;align-items:flex-start;gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--success);font-size:1.1rem;">check_circle</span>
                <span><strong>كود خدمة موحد:</strong> اطلب من التاجر الدفع على كود خدمة منصة كيمياوي (788).</span>
              </li>
              <li style="display:flex;align-items:flex-start;gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--success);font-size:1.1rem;">check_circle</span>
                <span><strong>شراء الباقات والكورسات:</strong> يمكنك استخدام الرصيد فوراً للاشتراك في باقات الـ 3 شهور المخفضة.</span>
              </li>
            </ul>

            <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border-light);">
              <a href="#/packages" class="btn btn-outline btn-block" style="gap:8px;font-weight:700;">
                <span class="material-symbols-rounded" style="color:var(--primary)">view_carousel</span> تصفح باقات الـ 3 شهور المخفضة
              </a>
            </div>

            <a href="#" target="_blank" rel="noopener" class="btn btn-secondary btn-block" id="supportWaBtn" style="margin-top: 14px; display:none;">
              <span class="material-symbols-rounded">chat</span> محتاج مساعدة؟ تواصل مع الدعم
            </a>
          </div>
        </div>
      </div>
    </main>
  </div>`;
}

export async function initWallet() {
  initNavbar();

  // ---------- Tabs ----------
  const tabs = document.querySelectorAll('#walletTabs .tab');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.toggle('active', x === t));
    document.querySelectorAll('.wallet-tab-pane').forEach(p => { p.hidden = p.id !== `pane_${t.dataset.tab}`; });
  }));

  // Preset Fawry Amount buttons
  document.querySelectorAll('.fawry-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fawry-preset-btn').forEach(b => {
        b.classList.remove('active');
        b.style.borderColor = '';
      });
      btn.classList.add('active');
      btn.style.borderColor = 'var(--primary)';
      document.getElementById('fawryCustomAmount').value = btn.dataset.amt;
    });
  });

  // Load and refresh wallet balance
  async function refreshWalletBalance() {
    try {
      const data = await api.getWalletBalance();
      const balEl = document.getElementById('currentWalletBalance');
      if (balEl) balEl.textContent = Number(data.balance).toFixed(0);

      // Render transactions history
      const txWrap = document.getElementById('walletTransactionsList');
      if (txWrap) {
        if (!data.transactions || data.transactions.length === 0) {
          txWrap.innerHTML = `<p class="pay-empty">لا توجد عمليات مسجلة في محفظتك بعد.</p>`;
        } else {
          txWrap.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${data.transactions.map(t => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-secondary);border:1px solid var(--border-light);border-radius:var(--radius-sm);">
                  <div style="display:flex;align-items:center;gap:12px;">
                    <div class="stat-icon ${t.amount >= 0 ? 'green' : 'red'}" style="width:36px;height:36px;border-radius:8px;">
                      <span class="material-symbols-rounded">${t.amount >= 0 ? 'arrow_downward' : 'arrow_upward'}</span>
                    </div>
                    <div>
                      <div style="font-weight:700;font-size:0.88rem;">${esc(t.description || (t.amount >= 0 ? 'شحن رصيد' : 'دفع اشتراك'))}</div>
                      <small style="color:var(--text-muted);font-size:0.75rem;">${new Date(t.created_at).toLocaleString('ar-EG')}</small>
                    </div>
                  </div>
                  <div style="font-weight:800;font-size:1.05rem;color:${t.amount >= 0 ? 'var(--success)' : 'var(--error, #ef4444)'};" dir="ltr">
                    ${t.amount >= 0 ? '+' : ''}${t.amount} ج.م
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        }
      }

      // Check if active pending Fawry order exists
      if (data.active_fawry_order) {
        renderFawryTicket(data.active_fawry_order);
      }
    } catch (e) {
      console.error('Error fetching wallet balance:', e);
    }
  }

  // Render Fawry Ticket (Styled like Shake-Out / Bassthalk voucher ticket)
  function renderFawryTicket(order) {
    const wrap = document.getElementById('fawryInvoiceWrap');
    if (!wrap) return;
    wrap.style.display = 'block';
    wrap.innerHTML = `
      <div style="background:linear-gradient(145deg, #1e293b, #0f172a);border:2px solid #f59e0b;border-radius:var(--radius-md);padding:24px;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,0.3);position:relative;overflow:hidden;">
        <div style="position:absolute;top:-10px;left:-10px;background:#f59e0b;color:#000;padding:4px 20px;font-size:0.75rem;font-weight:900;border-radius:4px;transform:rotate(-8deg);">
          رقم فوري المعتمد
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;border-bottom:1px dashed rgba(255,255,255,0.2);padding-bottom:14px;">
          <div>
            <div style="font-size:0.8rem;color:#94a3b8;">كود الخدمة في الماكينة:</div>
            <div style="font-size:1.3rem;font-weight:900;color:#fcd34d;">788</div>
          </div>
          <div style="text-align:left;">
            <div style="font-size:0.8rem;color:#94a3b8;">إجمالي المبلغ المطلوب:</div>
            <div style="font-size:1.3rem;font-weight:900;color:#10b981;">${order.amount + 5} ج.م <small style="font-size:0.7rem;color:#94a3b8;">(شامل 5 ج مصاريف الخدمة)</small></div>
          </div>
        </div>

        <div style="margin:20px 0;text-align:center;">
          <div style="font-size:0.85rem;color:#cbd5e1;margin-bottom:6px;">الرقم المرجعي (Fawry Reference Code):</div>
          <div style="background:#020617;border:1px solid #334155;border-radius:10px;padding:12px;font-family:monospace;font-size:1.5rem;font-weight:900;letter-spacing:2px;color:#38bdf8;display:flex;align-items:center;justify-content:center;gap:12px;" dir="ltr">
            <span id="fawryCodeDisplay">${order.reference_code}</span>
            <button type="button" class="btn btn-ghost btn-sm" id="copyFawryCodeBtn" style="color:#fcd34d;padding:4px 8px;" title="نسخ الكود">
              <span class="material-symbols-rounded">content_copy</span>
            </button>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.78rem;color:#94a3b8;margin-bottom:18px;">
          <div style="display:flex;align-items:center;gap:4px;">
            <span class="material-symbols-rounded" style="font-size:1rem;color:#f59e0b;">timer</span>
            <span>صلاحية الكود: 24 ساعة من تاريخ الطلب</span>
          </div>
          <div>ينتهي في: ${new Date(order.expires_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    `;

    document.getElementById('copyFawryCodeBtn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(order.reference_code);
        showToast('تم نسخ رقم فوري بنجاح', 'success');
      } catch {
        showToast('انسخ الرقم يدوياً', 'warning');
      }
    });
  }

  // Generate Fawry Button
  document.getElementById('generateFawryBtn')?.addEventListener('click', async () => {
    const amt = Number(document.getElementById('fawryCustomAmount').value);
    if (!amt || amt < 10) return showToast('يرجى تحديد مبلغ شحن لا يقل عن 10 جنيه', 'warning');

    const btn = document.getElementById('generateFawryBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري توليد كود فوري...';
    try {
      const res = await api.generateFawry(amt);
      showToast(res.message, 'success');
      renderFawryTicket(res.order);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-rounded">receipt_long</span> توليد كود دفع فوري الآن';
    }
  });

  // Voucher Charge to Wallet
  document.getElementById('voucherChargeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('voucherChargeInput').value.trim();
    if (!code) return showToast('يرجى كتابة كود الكارت', 'warning');

    const btn = document.getElementById('voucherChargeBtn');
    const resBox = document.getElementById('voucherChargeResult');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري شحن الكارت...';
    try {
      const res = await api.chargeVoucher(code);
      resBox.innerHTML = `
        <div class="notice notice-success" style="margin-top:14px;">
          <span class="material-symbols-rounded">check_circle</span>
          <div>
            <strong>${esc(res.message)}</strong>
            <div>رصيدك الجديد: ${res.new_balance} ج.م</div>
          </div>
        </div>
      `;
      showToast(res.message, 'success');
      document.getElementById('voucherChargeInput').value = '';
      await refreshWalletBalance();
      await refreshCourses();
    } catch (err) {
      resBox.innerHTML = `
        <div class="notice notice-error" style="margin-top:14px;">
          <span class="material-symbols-rounded">error</span>
          <span>${esc(err.message)}</span>
        </div>
      `;
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-rounded">add_circle</span> شحن الكارت إلى المحفظة فوراً';
    }
  });

  // Enrolled Courses
  const myCoursesWallet = document.getElementById('myCoursesWallet');
  async function loadEnrolled() {
    try {
      const enrolled = await api.getMyEnrolled();
      if (!enrolled.length) {
        myCoursesWallet.innerHTML = `<div class="empty-state" style="padding: 20px 0;"><span class="material-symbols-rounded" style="font-size:2.5rem;">school</span><h3>لا توجد كورسات مفعّلة</h3><p style="font-size:0.78rem;">اشترك في أي باقة أو كورس للبدء.</p></div>`;
        return [];
      }
      myCoursesWallet.innerHTML = enrolled.map(c => `
        <a href="#/courses/${c.id}" class="wallet-course-row">
          <div class="stat-icon green" style="width:40px; height:40px; border-radius:var(--radius-sm);"><span class="material-symbols-rounded">book</span></div>
          <div style="flex:1; min-width:0;">
            <div class="wallet-course-title">${esc(c.title)}</div>
            <div class="wallet-course-meta">${esc(c.grade || '')} • ${new Date(c.activated_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
          </div>
          <span class="badge badge-success">مفعّل</span>
        </a>`).join('');
      return enrolled;
    } catch {
      myCoursesWallet.innerHTML = `<p class="pay-empty">تعذّر تحميل الكورسات.</p>`;
      return [];
    }
  }

  // Online / Manual payment handling
  let config = {};
  let courses = [];
  let method = 'vodafone_cash';
  let receiptData = null;

  const courseSelect = document.getElementById('payCourseSelect');
  const target = document.getElementById('payTarget');
  const senderWrap = document.getElementById('paySenderWrap');
  const refLabel = document.getElementById('payRefLabel');
  const refInput = document.getElementById('payRef');
  const senderInput = document.getElementById('paySender');

  const copyBtn = (val) => `<button type="button" class="btn btn-ghost btn-sm pay-copy" data-copy="${esc(val)}"><span class="material-symbols-rounded">content_copy</span> نسخ</button>`;

  function renderTarget() {
    const course = courses.find(c => String(c.id) === courseSelect.value);
    const amount = course ? `${Number(course.price)} ج.م` : '—';
    let account = '';
    let howTo = '';
    if (method === 'vodafone_cash') {
      account = config.vodafone_cash;
      howTo = 'حوّل المبلغ على الرقم ده من أي محفظة إلكترونية (فودافون، اتصالات، أورنج، وي).';
    } else {
      account = config.instapay;
      howTo = 'من تطبيق InstaPay اختار "تحويل" وحط المعرف أو الحساب ده.';
    }
    refLabel.textContent = 'رقم العملية (الموجود في رسالة التحويل)';

    target.innerHTML = account
      ? `<div class="pay-target-row"><div><small>حوّل على</small><div class="pay-account" dir="ltr">${esc(account)}</div></div>${copyBtn(account)}</div>
         <div class="pay-target-row"><div><small>المبلغ المطلوب</small><div class="pay-amount">${amount}</div></div></div>
         <p class="pay-howto"><span class="material-symbols-rounded">info</span> ${howTo}</p>`
      : `<div class="notice notice-warning"><span class="material-symbols-rounded">info</span><span>بيانات ${METHOD_LABELS[method]} لسه متضافتش. تواصل مع الدعم.</span></div>`;
  }

  document.querySelectorAll('.pay-method').forEach(b => b.addEventListener('click', () => {
    method = b.dataset.method;
    document.querySelectorAll('.pay-method').forEach(x => x.classList.toggle('active', x === b));
    renderTarget();
  }));
  courseSelect.addEventListener('change', renderTarget);

  target.addEventListener('click', async (e) => {
    const b = e.target.closest('.pay-copy');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); showToast('تم النسخ', 'success'); }
    catch { showToast('انسخ الرقم يدوياً', 'warning'); }
  });

  senderInput?.addEventListener('input', () => { senderInput.value = senderInput.value.replace(/\D/g, '').slice(0, 11); });

  document.getElementById('payReceipt')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const nameEl = document.getElementById('payReceiptName');
    receiptData = null;
    if (!file) { nameEl.textContent = 'اضغط لاختيار صورة الإيصال (PNG / JPG حتى 3 ميجا)'; return; }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { showToast('الصورة لازم تكون PNG أو JPG أو WebP', 'warning'); e.target.value = ''; return; }
    if (file.size > 3 * 1024 * 1024) { showToast('حجم الصورة أكبر من 3 ميجا', 'warning'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { receiptData = reader.result; nameEl.textContent = `✓ ${file.name}`; };
    reader.readAsDataURL(file);
  });

  async function refreshCourses() {
    try {
      const [all, enrolled, payments] = await Promise.all([api.getCourses(), api.getMyEnrolled(), api.getMyPayments().catch(() => [])]);
      const enrolledIds = new Set(enrolled.map(c => c.id));
      const pendingIds = new Set(payments.filter(p => p.status === 'pending').map(p => p.course_id));
      courses = all.filter(c => !c.is_free && Number(c.price) > 0 && !enrolledIds.has(c.id));
      const prev = courseSelect.value;
      courseSelect.innerHTML = courses.length
        ? `<option value="">— اختر الكورس —</option>` + courses.map(c => `<option value="${c.id}" ${pendingIds.has(c.id) ? 'disabled' : ''}>${esc(c.title)} (${esc(c.grade)}) — ${Number(c.price)} ج.م${pendingIds.has(c.id) ? ' • قيد المراجعة' : ''}</option>`).join('')
        : `<option value="">مشترك في كل الكورسات المدفوعة 🎉</option>`;
      if (prev && courses.some(c => String(c.id) === prev)) courseSelect.value = prev;
      renderMyPayments(payments);
      renderTarget();
    } catch {
      courseSelect.innerHTML = `<option value="">تعذّر تحميل الكورسات</option>`;
    }
  }

  function renderMyPayments(list) {
    const el = document.getElementById('myPaymentsList');
    if (!list.length) { el.innerHTML = `<p class="pay-empty">لا توجد طلبات بعد.</p>`; return; }
    el.innerHTML = list.map(p => {
      const s = STATUS_LABELS[p.status] || STATUS_LABELS.pending;
      return `<div class="pay-request-row">
        <div style="min-width:0;">
          <div class="wallet-course-title">${esc(p.course_title || 'كورس')}</div>
          <div class="wallet-course-meta">${METHOD_LABELS[p.method]} • ${Number(p.amount)} ج.م • <span dir="ltr">#${esc(p.transaction_ref)}</span></div>
          ${p.status === 'rejected' && p.admin_note ? `<div class="pay-note">سبب الرفض: ${esc(p.admin_note)}</div>` : ''}
        </div>
        <span class="badge ${s.cls}"><span class="material-symbols-rounded" style="font-size:0.95rem;">${s.icon}</span> ${s.text}</span>
      </div>`;
    }).join('');
  }

  document.getElementById('payForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const course_id = courseSelect.value;
    const sender_phone = senderInput.value.trim();
    const transaction_ref = refInput.value.trim();
    if (!course_id) return showToast('اختار الكورس الأول', 'warning');
    if (!/^01[0125]\d{8}$/.test(sender_phone)) return showToast('رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01', 'warning');
    if (transaction_ref.length < 4) return showToast('اكتب رقم العملية الموجود في رسالة التحويل', 'warning');
    if (!receiptData) return showToast('يجب رفع صورة إيصال التحويل أو لقطة الشاشة لإتمام الطلب', 'warning');

    const btn = document.getElementById('paySubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري الإرسال...';
    try {
      const res = await api.submitPayment({ course_id, method, sender_phone, transaction_ref, receipt_image: receiptData });
      showToast(res.message, 'success');
      e.target.reset();
      receiptData = null;
      document.getElementById('payReceiptName').textContent = 'اضغط لاختيار صورة الإيصال (PNG / JPG حتى 3 ميجا)';
      await refreshCourses();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-rounded">send</span> إرسال طلب التفعيل';
    }
  });

  try { config = await api.getPaymentConfig(); } catch { config = {}; }
  if (config.whatsapp) {
    const wa = document.getElementById('supportWaBtn');
    if (wa) {
      wa.href = `https://wa.me/${config.whatsapp.replace(/\D/g, '')}`;
      wa.style.display = '';
    }
  }

  loadEnrolled();
  refreshCourses();
  refreshWalletBalance();
}
