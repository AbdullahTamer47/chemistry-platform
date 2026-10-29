import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

const METHOD_LABELS = {
  vodafone_cash: 'فودافون كاش',
  instapay: 'إنستاباي',
  fawry: 'فوري',
  paymob: 'Paymob'
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
          <p class="page-subtitle">شحن المحفظة والاشتراك في الكورسات عبر فودافون كاش، إنستاباي، كروت السنتر، أو الدفع الإلكتروني (Paymob)</p>
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
        <button type="button" class="tab active" data-tab="manual_pay" role="tab">
          <span class="material-symbols-rounded">payments</span> فودافون كاش / إنستاباي
        </button>
        <button type="button" class="tab" data-tab="vouchers_charge" role="tab">
          <span class="material-symbols-rounded">qr_code</span> شحن كارت السنتر والأكواد
        </button>
        <button type="button" class="tab" data-tab="paymob_gateway" role="tab">
          <span class="material-symbols-rounded">credit_card</span> الدفع الإلكتروني (Paymob / فوري)
        </button>
        <button type="button" class="tab" data-tab="transactions_history" role="tab">
          <span class="material-symbols-rounded">history</span> سجل العمليات
        </button>
      </div>

      <div class="wallet-grid">
        <div class="wallet-col">

          <!-- 1. MANUAL ONLINE PAY (VODAFONE CASH / INSTAPAY) -->
          <div class="card wallet-tab-pane" id="pane_manual_pay">
            <h3 class="card-title" style="margin-bottom: 6px;">
              <span class="material-symbols-rounded" style="color:var(--primary)">payments</span> التحويل عبر فودافون كاش أو إنستاباي
            </h3>
            <p class="pay-hint">حوّل قيمة الكورس على الرقم الموضح، وارفع صورة إيصال التحويل لتفعيل الكورس فوراً بعد المراجعة.</p>

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

            <div class="pay-step-label"><span>3</span> بيانات التحويل وإيصال الدفع</div>
            <form id="payForm" class="pay-form" novalidate>
              <div id="paySenderWrap">
                <label class="form-label" for="paySender">رقم الموبايل المحوَّل منه *</label>
                <input type="tel" id="paySender" class="form-input" dir="ltr" inputmode="numeric" maxlength="11" placeholder="01XXXXXXXXX" required>
              </div>
              <div>
                <label class="form-label" for="payRef" id="payRefLabel" style="display:flex;justify-content:space-between;">
                  <span>رقم العملية المرجعي</span>
                  <span style="color:var(--text-muted);font-size:0.75rem;">(اختياري)</span>
                </label>
                <input type="text" id="payRef" class="form-input" dir="ltr" maxlength="40" placeholder="اختياري — اتركه فارغاً إن لم يتوفر">
              </div>
              <div>
                <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;">
                  <span>صورة الإيصال / لقطة شاشة التحويل</span>
                  <span style="color:var(--error, #ef4444); font-size:0.75rem; font-weight:800;">* إجباري للتأكيد</span>
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

          <!-- 2. SCRATCH VOUCHER CHARGE -->
          <div class="card wallet-tab-pane" id="pane_vouchers_charge" hidden>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <span class="material-symbols-rounded" style="color:var(--primary);font-size:1.8rem;">qr_code</span>
              <div>
                <h3 class="card-title" style="margin:0;">شحن المحفظة بكارت السنتر</h3>
                <small style="color:var(--text-muted);">أدخل الكود المطبوع على كارت السنتر لشحن رصيد محفظتك واستخدامه في الاشتراك بأي كورس</small>
              </div>
            </div>

            <form id="voucherChargeForm" style="margin-top:16px;">
              <div class="form-group">
                <label class="form-label">كود كارت الشحن:</label>
                <div class="input-group">
                  <span class="material-symbols-rounded input-icon">key</span>
                  <input type="text" class="form-input code-input" id="voucherChargeInput" placeholder="مثال: KEM-100-XXXX" dir="ltr" autocomplete="off">
                </div>
              </div>
              <button type="submit" class="btn btn-primary btn-block" id="voucherChargeBtn">
                <span class="material-symbols-rounded">add_circle</span> شحن الكارت إلى المحفظة فوراً
              </button>
            </form>
            <div id="voucherChargeResult"></div>
          </div>

          <!-- 3. PAYMOB ELECTRONIC GATEWAY -->
          <div class="card wallet-tab-pane" id="pane_paymob_gateway" hidden>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <span class="material-symbols-rounded" style="color:var(--primary);font-size:1.8rem;">credit_card</span>
              <div>
                <h3 class="card-title" style="margin:0;">بوابة الدفع الإلكتروني الفوري (Paymob)</h3>
                <small style="color:var(--text-muted);">ادفع بالبطاقات البنكية (Visa / MasterCard / ميزة) أو المحافظ الإلكترونية وفوري عبر بوابة Paymob المعتمدة</small>
              </div>
            </div>

            <div class="pay-step-label"><span>1</span> اختر وسيلة الدفع عبر Paymob</div>
            <div class="pay-methods" id="paymobSubMethods" style="margin-bottom:14px;">
              <button type="button" class="pay-method active" data-pm="card">
                <span class="material-symbols-rounded">credit_card</span><strong>بطاقة بنكية / ميزة</strong><small>Visa / MasterCard / Meeza</small>
              </button>
              <button type="button" class="pay-method" data-pm="wallet">
                <span class="material-symbols-rounded">account_balance_wallet</span><strong>محفظة إلكترونية</strong><small>دفع إلكتروني مباشر</small>
              </button>
            </div>

            <div class="pay-step-label"><span>2</span> حدد قيمة شحن المحفظة (ج.م)</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(80px, 1fr));gap:10px;margin-bottom:14px;">
              <button type="button" class="btn btn-outline paymob-preset-btn" data-amt="100" style="font-weight:800;">100 ج</button>
              <button type="button" class="btn btn-outline paymob-preset-btn active" data-amt="220" style="font-weight:800;border-color:var(--primary);">220 ج</button>
              <button type="button" class="btn btn-outline paymob-preset-btn" data-amt="350" style="font-weight:800;">350 ج</button>
              <button type="button" class="btn btn-outline paymob-preset-btn" data-amt="500" style="font-weight:800;">500 ج</button>
            </div>

            <div class="form-group">
              <label class="form-label">أو أدخل مبلغ الشحن المطلوب بالجنيه:</label>
              <input type="number" id="paymobAmountInput" class="form-input" min="10" max="10000" value="220" dir="ltr">
            </div>

            <button type="button" class="btn btn-primary btn-block" id="paymobCheckoutBtn" style="padding:14px;font-size:1rem;gap:8px;">
              <span class="material-symbols-rounded">lock</span> الانتقال لصفحة الدفع الآمن (Paymob)
            </button>
            <div id="paymobStatusBox" style="margin-top:14px;"></div>
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
              <span class="material-symbols-rounded" style="color:var(--primary)">verified_user</span> إرشادات الدفع والتفعيل الآمن
            </h3>
            <ul style="display:flex;flex-direction:column;gap:12px;font-size:0.86rem;color:var(--text-secondary);padding:0;list-style:none;">
              <li style="display:flex;align-items:flex-start;gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--success);font-size:1.1rem;">check_circle</span>
                <span><strong>فودافون كاش وإنستاباي:</strong> حوّل قيمة الكورس وارفع صورة الإيصال، ورقم العملية اختياري للتسهيل عليك.</span>
              </li>
              <li style="display:flex;align-items:flex-start;gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--success);font-size:1.1rem;">check_circle</span>
                <span><strong>كروت السنتر:</strong> يمكنك شحن الكارت مباشرة إلى محفظتك أو تفعيل الكورس من صفحة تفاصيل الكورس.</span>
              </li>
              <li style="display:flex;align-items:flex-start;gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--success);font-size:1.1rem;">check_circle</span>
                <span><strong>الدفع الإلكتروني (Paymob):</strong> يدعم البطاقات البنكية والمحافظ الإلكترونية وفوري فور تفعيله من إدارة المنصة.</span>
              </li>
            </ul>

            <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border-light);">
              <a href="/courses" class="btn btn-outline btn-block" style="gap:8px;font-weight:700;">
                <span class="material-symbols-rounded" style="color:var(--primary)">menu_book</span> استعراض جميع الكورسات
              </a>
            </div>

            <a href="#" target="_blank" rel="noopener" class="btn btn-secondary btn-block" id="supportWaBtn" style="margin-top: 14px; display:none;">
              <span class="material-symbols-rounded">chat</span> تواصل مع الدعم الفني عبر واتساب
            </a>
          </div>
        </div>
      </div>
    </main>
  </div>`;
}

export async function initWallet() {
  initNavbar();

  const tabs = document.querySelectorAll('#walletTabs .tab');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.toggle('active', x === t));
    document.querySelectorAll('.wallet-tab-pane').forEach(p => { p.hidden = p.id !== `pane_${t.dataset.tab}`; });
  }));

  let paymobMethod = 'card';
  document.querySelectorAll('#paymobSubMethods .pay-method').forEach(btn => {
    btn.addEventListener('click', () => {
      paymobMethod = btn.dataset.pm;
      document.querySelectorAll('#paymobSubMethods .pay-method').forEach(x => x.classList.toggle('active', x === btn));
    });
  });

  document.querySelectorAll('.paymob-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.paymob-preset-btn').forEach(b => {
        b.classList.remove('active');
        b.style.borderColor = '';
      });
      btn.classList.add('active');
      btn.style.borderColor = 'var(--primary)';
      document.getElementById('paymobAmountInput').value = btn.dataset.amt;
    });
  });

  document.getElementById('paymobCheckoutBtn')?.addEventListener('click', async () => {
    const amount = Number(document.getElementById('paymobAmountInput')?.value || 0);
    if (!amount || amount < 10) return showToast('يرجى تحديد مبلغ لا يقل عن 10 جنيه', 'warning');
    const btn = document.getElementById('paymobCheckoutBtn');
    const statusBox = document.getElementById('paymobStatusBox');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري الاتصال ببوابة Paymob...';
    try {
      const res = await api.paymobCheckout({ amount, payment_method: paymobMethod });
      if (res.iframe_url) {
        window.location.href = res.iframe_url;
      } else {
        showToast(res.message || 'تم إنشاء طلب الدفع', 'success');
      }
    } catch (err) {
      if (statusBox) {
        statusBox.innerHTML = `
          <div class="notice notice-warning">
            <span class="material-symbols-rounded">info</span>
            <div>
              <strong>تنبيه بوابة الدفع الإلكتروني:</strong>
              <div>${esc(err.message)}</div>
            </div>
          </div>
        `;
      }
      showToast(err.message, 'warning');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-rounded">lock</span> الانتقال لصفحة الدفع الآمن (Paymob)';
    }
  });

  async function refreshWalletBalance() {
    try {
      const data = await api.getWalletBalance();
      const balEl = document.getElementById('currentWalletBalance');
      if (balEl) balEl.textContent = Number(data.balance).toFixed(0);

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
    } catch (e) {
      console.error('Error fetching wallet balance:', e);
    }
  }

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

  const myCoursesWallet = document.getElementById('myCoursesWallet');
  async function loadEnrolled() {
    try {
      const enrolled = await api.getMyEnrolled();
      if (!enrolled.length) {
        myCoursesWallet.innerHTML = `<div class="empty-state" style="padding: 20px 0;"><span class="material-symbols-rounded" style="font-size:2.5rem;">school</span><h3>لا توجد كورسات مفعّلة</h3><p style="font-size:0.78rem;">اشترك في أي كورس للبدء.</p></div>`;
        return [];
      }
      myCoursesWallet.innerHTML = enrolled.map(c => `
        <a href="/courses/${c.id}" class="wallet-course-row">
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

  let config = {};
  let courses = [];
  let method = 'vodafone_cash';
  let receiptData = null;

  const courseSelect = document.getElementById('payCourseSelect');
  const target = document.getElementById('payTarget');
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
      howTo = 'حوّل المبلغ على هذا الرقم من أي محفظة إلكترونية (فودافون، اتصالات، أورنج، وي).';
    } else {
      account = config.instapay;
      howTo = 'من تطبيق InstaPay اختر "تحويل" وأدخل هذا المعرف أو الحساب.';
    }

    target.innerHTML = account
      ? `<div class="pay-target-row"><div><small>حوّل على</small><div class="pay-account" dir="ltr">${esc(account)}</div></div>${copyBtn(account)}</div>
         <div class="pay-target-row"><div><small>المبلغ المطلوب</small><div class="pay-amount">${amount}</div></div></div>
         <p class="pay-howto"><span class="material-symbols-rounded">info</span> ${howTo}</p>`
      : `<div class="notice notice-warning"><span class="material-symbols-rounded">info</span><span>بيانات ${METHOD_LABELS[method]} لم تُضف بعد. تواصل مع الدعم الفني.</span></div>`;
  }

  document.querySelectorAll('#payMethods .pay-method').forEach(b => b.addEventListener('click', () => {
    method = b.dataset.method;
    document.querySelectorAll('#payMethods .pay-method').forEach(x => x.classList.toggle('active', x === b));
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
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { showToast('الصورة يجب أن تكون PNG أو JPG أو WebP', 'warning'); e.target.value = ''; return; }
    if (file.size > 3 * 1024 * 1024) { showToast('حجم الصورة أكبر من 3 ميجا', 'warning'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { receiptData = reader.result; nameEl.textContent = `تم إرفاق: ${file.name}`; };
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
        : `<option value="">لا توجد كورسات مدفوعة غير مشترك بها حالياً</option>`;
      if (prev && courses.some(c => String(c.id) === prev)) courseSelect.value = prev;
      renderMyPayments(payments);
      renderTarget();
    } catch {
      courseSelect.innerHTML = `<option value="">تعذّر تحميل الكورسات</option>`;
    }
  }

  function renderMyPayments(list) {
    const el = document.getElementById('myPaymentsList');
    if (!list.length) { el.innerHTML = `<p class="pay-empty">لا توجد طلبات تحويل سابقة.</p>`; return; }
    el.innerHTML = list.map(p => {
      const s = STATUS_LABELS[p.status] || STATUS_LABELS.pending;
      return `<div class="pay-request-row">
        <div style="min-width:0;">
          <div class="wallet-course-title">${esc(p.course_title || 'كورس')}</div>
          <div class="wallet-course-meta">${METHOD_LABELS[p.method] || p.method} • ${Number(p.amount)} ج.م ${p.transaction_ref ? `• <span dir="ltr">#${esc(p.transaction_ref)}</span>` : ''}</div>
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
    if (!course_id) return showToast('يرجى اختيار الكورس أولاً', 'warning');
    if (!/^01[0125]\d{8}$/.test(sender_phone)) return showToast('رقم الموبايل المحول منه يجب أن يكون 11 رقماً ويبدأ بـ 01', 'warning');
    if (!receiptData) return showToast('يرجى إرفاق صورة إيصال التحويل أو لقطة الشاشة لإتمام الطلب', 'warning');

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
