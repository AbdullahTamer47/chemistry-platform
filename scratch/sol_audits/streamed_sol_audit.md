These replacements introduce **`#/admin/stores`** as a separate management page. Students and guests use **`#/store-locator`**; staff never receive student navigation or student-page layouts.

**Integration assumptions:** roles are exactly `student`, `teacher`, or `admin`; authentication stores its bearer token under `localStorage.token`; the server router is mounted at `/api/packages`. Store requests use `/api` by default, or `VITE_API_URL` if configured.

## `src/pages/storeLocator.js`

```javascript
import { renderNavbar, initNavbar } from '../components/navbar.js';
import {
  renderPublicHeader,
  initPublicHeader
} from '../components/publicHeader.js';
import { getUser, isLoggedIn } from '../utils/auth.js';
import { showToast } from '../components/toast.js';

const STAFF_ROLES = new Set(['teacher', 'admin']);
const API_BASE = String(import.meta.env.VITE_API_URL || '/api')
  .replace(/\/+$/, '');
const STORE_API = `${API_BASE}/packages/stores`;

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

function getViewer() {
  if (!isLoggedIn()) return { role: 'guest', id: null };

  const user = getUser();
  return {
    role: user?.role,
    id: Number(user?.id)
  };
}

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ar')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآ]/g, 'ا')
    .trim();
}

function normalizeDigits(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06F0));
}

function phoneDigits(value) {
  const raw = normalizeDigits(value).trim();

  if (!raw || !/^[+\d\s().-]+$/.test(raw)) return '';

  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    // Egyptian local number: 010... -> 2010...
    digits = `20${digits.slice(1)}`;
  } else if (/^1[0125]\d{8}$/.test(digits)) {
    // Egyptian mobile number entered without its initial zero.
    digits = `20${digits}`;
  }

  return /^[1-9]\d{6,14}$/.test(digits) ? digits : '';
}

function normalizeStore(store) {
  const id = Number(store?.id);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    typeof store?.name !== 'string' ||
    typeof store?.address !== 'string' ||
    typeof store?.governorate !== 'string'
  ) {
    throw new Error('استجابة غير صالحة من خدمة دليل المكتبات');
  }

  const count = Number(store.reviews_count);
  const rating = Number(store.rating);
  const myRating = Number(store.my_rating);

  return {
    id,
    name: store.name,
    address: store.address,
    governorate: store.governorate,
    phone: String(store.phone ?? ''),
    whatsapp: String(store.whatsapp ?? ''),
    is_active: store.is_active === true || Number(store.is_active) === 1 ? 1 : 0,
    reviews_count: Number.isSafeInteger(count) && count >= 0 ? count : 0,
    rating: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : 0,
    my_rating: Number.isInteger(myRating) && myRating >= 1 && myRating <= 5
      ? myRating
      : null
  };
}

async function requestStores(path = '', options = {}) {
  const { method = 'GET', body, signal } = options;
  const headers = new Headers({ Accept: 'application/json' });
  const token = localStorage.getItem('token');

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${STORE_API}${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const error = new Error('استجابة غير صالحة من الخادم');
      error.status = response.status;
      throw error;
    }
  }

  if (!response.ok) {
    const error = new Error(
      typeof data?.error === 'string'
        ? data.error
        : 'تعذر تنفيذ الطلب. يرجى المحاولة مرة أخرى.'
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

function walletLink(logged) {
  return `
    <a href="${logged ? '#/wallet' : '#/login'}"
       class="btn btn-outline" style="gap:6px;">
      <span class="material-symbols-rounded">account_balance_wallet</span>
      ${logged ? 'شحن المحفظة أونلاين' : 'تسجيل الدخول للشحن'}
    </a>
  `;
}

function renderContent(management, logged) {
  return `
    <section id="bookstorePage"
             data-mode="${management ? 'manage' : 'browse'}"
             dir="rtl">
      <style>
        #bookstorePage .bookstore-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
          gap: 20px;
        }
        #bookstoreDialog::backdrop {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }
        #bookstoreDialog {
          color: var(--text-primary);
          background: var(--bg-main);
        }
        #bookstoreDialog fieldset {
          border: 0;
          padding: 0;
          margin: 0;
          min-width: 0;
        }
      </style>

      <div class="page-header"
           style="display:flex;justify-content:space-between;align-items:center;
                  flex-wrap:wrap;gap:16px;margin-bottom:24px;">
        <div>
          <h1 class="page-title"
              style="display:flex;align-items:center;gap:10px;">
            <span class="material-symbols-rounded"
                  style="color:var(--primary);font-size:2rem;">storefront</span>
            ${management
              ? 'إدارة المكتبات ومنافذ الشحن'
              : 'دليل المكتبات ومنافذ الشحن المعتمدة'}
          </h1>
          <p class="page-subtitle">
            ${management
              ? 'إضافة المنافذ وتعديل بياناتها وتفعيلها أو حذفها. التقييمات تخص الطلاب فقط.'
              : 'المكتبات والسناتر المعتمدة لشراء مذكرات كيمياوي وكروت شحن المنصة.'}
          </p>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${management ? `
            <button type="button" class="btn btn-primary"
                    data-action="add" disabled>
              <span class="material-symbols-rounded">add_business</span>
              إضافة مكتبة
            </button>
            <button type="button" class="btn btn-outline"
                    data-action="reload" disabled>
              <span class="material-symbols-rounded">refresh</span>
              تحديث
            </button>
          ` : walletLink(logged)}
        </div>
      </div>

      <div class="card" style="padding:20px;margin-bottom:24px;border-radius:18px;">
        <div style="display:flex;align-items:end;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:min(100%,240px);">
            <label class="form-label" for="storeSearchInput">البحث عن مكتبة</label>
            <input type="search" id="storeSearchInput" class="form-input"
                   maxlength="120"
                   placeholder="اسم المكتبة، الشارع، المنطقة أو المحافظة"
                   autocomplete="off" />
          </div>

          ${management ? `
            <div>
              <label class="form-label" for="storeStatusFilter">حالة المنفذ</label>
              <select id="storeStatusFilter" class="form-select">
                <option value="all">جميع المنافذ</option>
                <option value="active">المفعّلة فقط</option>
                <option value="inactive">غير المفعّلة فقط</option>
              </select>
            </div>
          ` : ''}

          <div id="resultsCountBadge" class="badge badge-info"
               role="status" aria-live="polite" style="padding:10px 14px;">
            جاري التحميل...
          </div>
        </div>

        <div style="margin-top:18px;margin-bottom:10px;font-weight:700;">
          التصفية حسب المحافظة
        </div>
        <div id="governoratePills"
             role="group" aria-label="تصفية حسب المحافظة"
             style="display:flex;gap:8px;flex-wrap:wrap;">
          <span>جاري تحميل المحافظات...</span>
        </div>
      </div>

      <div id="storesGrid" aria-busy="true">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    </section>
  `;
}

export function renderStoreLocator() {
  const viewer = getViewer();

  if (viewer.role !== 'guest' && viewer.role !== 'student') {
    throw new Error('Student store locator cannot render for this role');
  }

  if (viewer.role === 'guest') {
    return `
      <div class="landing" style="min-height:100vh;background:var(--bg-main);">
        ${renderPublicHeader('store-locator')}
        <main class="section-container"
              style="padding-top:110px;padding-bottom:60px;max-width:1200px;
                     margin:0 auto;padding-inline:20px;">
          ${renderContent(false, false)}
        </main>
      </div>
    `;
  }

  return `
    <div class="app-layout">
      ${renderNavbar('store-locator')}
      <main class="main-content" style="width:100%;max-width:1200px;">
        ${renderContent(false, true)}
      </main>
    </div>
  `;
}

export function renderAdminStores() {
  if (!STAFF_ROLES.has(getViewer().role)) {
    throw new Error('Bookstore management requires a staff role');
  }

  return `
    <div class="app-layout">
      ${renderNavbar('admin-stores')}
      <main class="main-content" style="width:100%;max-width:1200px;">
        ${renderContent(true, true)}
      </main>
    </div>
  `;
}

export function initStoreLocator(context = {}) {
  return initializeLocator(false, context);
}

export function initAdminStores(context = {}) {
  return initializeLocator(true, context);
}

function initializeLocator(management, context) {
  const page = document.getElementById('bookstorePage');
  if (!page || context.signal?.aborted) return () => {};

  const viewer = getViewer();
  const expectedMode = management ? 'manage' : 'browse';

  if (
    page.dataset.mode !== expectedMode ||
    (management
      ? !STAFF_ROLES.has(viewer.role)
      : !['guest', 'student'].includes(viewer.role))
  ) {
    throw new Error('Bookstore page role mismatch');
  }

  const controller = new AbortController();
  const { signal } = controller;
  const navCleanup = viewer.role === 'guest'
    ? initPublicHeader()
    : initNavbar();

  const grid = page.querySelector('#storesGrid');
  const pills = page.querySelector('#governoratePills');
  const search = page.querySelector('#storeSearchInput');
  const count = page.querySelector('#resultsCountBadge');
  const statusSelect = page.querySelector('#storeStatusFilter');

  let stores = [];
  let governorates = [];
  let currentGovernorate = '';
  let searchQuery = '';
  let status = 'all';
  let loading = false;
  let loaded = false;
  let loadVersion = 0;
  let activeDialog = null;
  const deleting = new Set();

  function alive() {
    const current = getViewer();
    return !signal.aborted &&
      page.isConnected &&
      context.isCurrent?.() !== false &&
      current.role === viewer.role &&
      current.id === viewer.id;
  }

  function closeDialog(force = false) {
    if (!activeDialog || (activeDialog.busy && !force)) return;

    const dialog = activeDialog;
    activeDialog = null;
    if (dialog.element.open) dialog.element.close();
    dialog.element.remove();

    if (dialog.returnFocus?.isConnected) dialog.returnFocus.focus();
  }

  function cleanup() {
    if (signal.aborted) return;
    controller.abort();
    closeDialog(true);
    if (typeof navCleanup === 'function') navCleanup();
    context.signal?.removeEventListener('abort', cleanup);
  }

  context.signal?.addEventListener('abort', cleanup, { once: true });

  function handleAuthorizationError(error) {
    if (error.status !== 401 && error.status !== 403) return false;

    closeDialog(true);
    document.getElementById('app')?.replaceChildren();

    if (error.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.replace('#/login');
    } else {
      window.location.replace('#/dashboard');
    }

    return true;
  }

  function updateGovernorates() {
    governorates = [...new Set(
      stores.map(store => store.governorate).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'ar'));

    if (
      currentGovernorate &&
      !governorates.includes(currentGovernorate)
    ) {
      currentGovernorate = '';
    }

    pills.innerHTML = ['', ...governorates].map(governorate => `
      <button type="button"
              class="btn btn-sm ${governorate === currentGovernorate
                ? 'btn-primary'
                : 'btn-outline'}"
              data-governorate="${esc(governorate)}"
              aria-pressed="${governorate === currentGovernorate}"
              style="border-radius:20px;padding:6px 16px;">
        ${esc(governorate || 'الكل')}
      </button>
    `).join('');
  }

  function renderCard(store) {
    const phone = phoneDigits(store.phone);
    const whatsapp = phoneDigits(store.whatsapp || store.phone);
    const mapsURL = `https://www.google.com/maps/search/?api=1&query=${
      encodeURIComponent(`${store.name} ${store.address} ${store.governorate}`)
    }`;
    const whatsappURL = whatsapp
      ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(
        `السلام عليكم، هل مذكرات وكروت شحن منصة كيمياوي متوفرة لديكم في ${store.name}؟`
      )}`
      : '';
    const busy = deleting.has(store.id);

    return `
      <article class="card store-card"
               style="padding:22px;border-radius:16px;display:flex;
                      flex-direction:column;gap:16px;">
        <div style="display:flex;align-items:start;justify-content:space-between;gap:12px;">
          <h3 style="font-size:1.15rem;font-weight:900;margin:0;">
            ${esc(store.name)}
          </h3>
          <span class="badge badge-primary">${esc(store.governorate)}</span>
        </div>

        <p style="display:flex;align-items:start;gap:8px;
                  color:var(--text-secondary);line-height:1.6;margin:0;">
          <span class="material-symbols-rounded"
                style="color:var(--primary);">pin_drop</span>
          <span>${esc(store.address)}</span>
        </p>

        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          ${store.reviews_count > 0 ? `
            <span style="display:flex;align-items:center;gap:4px;
                         color:#d97706;font-weight:800;">
              <span class="material-symbols-rounded">star</span>
              ${store.rating.toFixed(1)}
            </span>
            <span style="color:var(--text-muted);font-size:0.8rem;">
              (${store.reviews_count} تقييم طالب)
            </span>
          ` : `
            <span style="color:var(--text-muted);font-size:0.85rem;">
              لا توجد تقييمات بعد
            </span>
          `}
          <span class="badge ${store.is_active ? 'badge-success' : 'badge-warning'}">
            ${management
              ? (store.is_active ? 'مفعّل' : 'غير مفعّل')
              : 'منفذ معتمد'}
          </span>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;">
          ${phone ? `
            <a href="tel:+${phone}" class="btn btn-outline btn-sm">
              <span class="material-symbols-rounded">call</span> اتصال
            </a>
          ` : ''}
          ${whatsappURL ? `
            <a href="${esc(whatsappURL)}" target="_blank"
               rel="noopener noreferrer" class="btn btn-outline btn-sm">
              <span class="material-symbols-rounded">chat</span> واتساب
            </a>
          ` : ''}
          <a href="${esc(mapsURL)}" target="_blank"
             rel="noopener noreferrer" class="btn btn-ghost btn-sm">
            <span class="material-symbols-rounded">navigation</span> الخريطة
          </a>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:12px;
                    border-top:1px solid var(--border-light);">
          ${management ? `
            <button type="button" class="btn btn-outline btn-sm"
                    data-action="edit" data-store-id="${store.id}"
                    ${busy ? 'disabled' : ''}>
              <span class="material-symbols-rounded">edit</span> تعديل
            </button>
            <button type="button" class="btn btn-outline btn-sm"
                    data-action="delete" data-store-id="${store.id}"
                    style="color:var(--error);" ${busy ? 'disabled' : ''}>
              <span class="material-symbols-rounded">delete</span>
              ${busy ? 'جاري الحذف...' : 'حذف'}
            </button>
          ` : viewer.role === 'student' ? `
            <button type="button" class="btn btn-ghost btn-sm"
                    data-action="rate" data-store-id="${store.id}"
                    style="color:#d97706;">
              <span class="material-symbols-rounded">star_rate</span>
              ${store.my_rating ? `تقييمك: ${store.my_rating} / 5` : 'تقييم المكتبة'}
            </button>
          ` : `
            <a href="#/login" class="btn btn-ghost btn-sm">
              تسجيل الدخول لتقييم المكتبة
            </a>
          `}
        </div>
      </article>
    `;
  }

  function renderStores() {
    if (!alive() || !loaded) return;

    const query = normalizeSearch(searchQuery);
    const filtered = stores.filter(store => {
      if (!management && !store.is_active) return false;
      if (currentGovernorate && store.governorate !== currentGovernorate) {
        return false;
      }
      if (management && status === 'active' && !store.is_active) return false;
      if (management && status === 'inactive' && store.is_active) return false;

      return !query || normalizeSearch(
        `${store.name} ${store.address} ${store.governorate}`
      ).includes(query);
    });

    count.textContent = `${filtered.length} ${management ? 'مكتبة' : 'منفذ معتمد'}`;
    grid.setAttribute('aria-busy', 'false');

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="card" style="text-align:center;padding:40px 20px;">
          <span class="material-symbols-rounded"
                style="font-size:3rem;color:var(--text-muted);">storefront</span>
          <h3>لا توجد منافذ مطابقة</h3>
          <p style="color:var(--text-secondary);">
            غيّر المحافظة أو كلمات البحث${management ? ' أو حالة المنفذ' : ''}.
          </p>
          ${management ? `
            <button type="button" class="btn btn-primary" data-action="add">
              إضافة مكتبة
            </button>
          ` : walletLink(viewer.role === 'student')}
        </div>
      `;
      return;
    }

    grid.innerHTML = `
      <div class="bookstore-grid">${filtered.map(renderCard).join('')}</div>
    `;
  }

  async function loadStores() {
    if (!alive() || loading) return;

    loading = true;
    const version = ++loadVersion;
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    count.textContent = 'جاري التحميل...';
    page.querySelectorAll('[data-action="reload"], [data-action="add"]')
      .forEach(button => { button.disabled = true; });

    try {
      const data = await requestStores(management ? '/manage' : '/all', { signal });
      if (!alive() || version !== loadVersion) return;
      if (!Array.isArray(data?.stores)) {
        throw new Error('استجابة غير صالحة من خدمة دليل المكتبات');
      }

      stores = data.stores.map(normalizeStore);
      if (!management) stores = stores.filter(store => store.is_active);
      loaded = true;
      updateGovernorates();
      renderStores();
    } catch (error) {
      if (!alive() || version !== loadVersion || error.name === 'AbortError') return;
      if (handleAuthorizationError(error)) return;

      loaded = false;
      count.textContent = 'تعذر التحميل';
      grid.setAttribute('aria-busy', 'false');
      grid.innerHTML = `
        <div class="card" role="alert" style="text-align:center;padding:32px;">
          <p>${esc(error.message || 'حدث خطأ في تحميل دليل المكتبات')}</p>
          <button type="button" class="btn btn-secondary"
                  data-action="reload">إعادة المحاولة</button>
        </div>
      `;
    } finally {
      if (alive() && version === loadVersion) {
        loading = false;
        page.querySelectorAll('[data-action="reload"], [data-action="add"]')
          .forEach(button => { button.disabled = false; });
      }
    }
  }

  function createDialog(title, content, confirmText) {
    closeDialog(true);

    const returnFocus = document.activeElement;
    const element = document.createElement('dialog');
    element.id = 'bookstoreDialog';
    element.className = 'card';
    element.dir = 'rtl';
    element.setAttribute('aria-labelledby', 'bookstoreDialogTitle');
    element.style.cssText = `
      border:1px solid var(--border-light);border-radius:20px;
      width:min(560px,calc(100vw - 32px));max-height:90vh;
      overflow:auto;padding:24px;
    `;
    element.innerHTML = `
      <h2 id="bookstoreDialogTitle" style="margin-bottom:20px;">${esc(title)}</h2>
      <form>
        <fieldset>
          ${content}
          <div style="display:flex;gap:10px;margin-top:24px;">
            <button type="button" class="btn btn-secondary"
                    data-close style="flex:1;">إلغاء</button>
            <button type="submit" class="btn btn-primary"
                    data-confirm style="flex:1;">${esc(confirmText)}</button>
          </div>
        </fieldset>
        <p data-error role="alert"
           style="color:var(--error);margin-top:12px;" hidden></p>
      </form>
    `;

    document.body.appendChild(element);

    const dialog = {
      element,
      form: element.querySelector('form'),
      fieldset: element.querySelector('fieldset'),
      confirm: element.querySelector('[data-confirm]'),
      error: element.querySelector('[data-error]'),
      returnFocus,
      busy: false,
      confirmText
    };
    activeDialog = dialog;

    element.querySelector('[data-close]').addEventListener(
      'click',
      () => closeDialog(),
      { signal }
    );

    element.addEventListener('cancel', event => {
      event.preventDefault();
      closeDialog();
    }, { signal });

    element.addEventListener('click', event => {
      if (event.target !== element) return;
      const rect = element.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        closeDialog();
      }
    }, { signal });

    element.showModal();
    return dialog;
  }

  function setDialogBusy(dialog, busy) {
    dialog.busy = busy;
    dialog.fieldset.disabled = busy;
    dialog.confirm.textContent = busy ? 'جاري الحفظ...' : dialog.confirmText;
    dialog.error.hidden = true;
    dialog.error.textContent = '';
  }

  function showDialogError(dialog, error) {
    if (!alive() || activeDialog !== dialog || error.name === 'AbortError') return;
    if (handleAuthorizationError(error)) return;

    setDialogBusy(dialog, false);
    dialog.error.textContent = error.message || 'تعذر حفظ البيانات';
    dialog.error.hidden = false;
  }

  function openEditor(store = null) {
    if (!alive() || !management || !STAFF_ROLES.has(getViewer().role)) return;

    const dialog = createDialog(
      store ? 'تعديل بيانات المكتبة' : 'إضافة مكتبة',
      `
        <div class="form-group">
          <label class="form-label" for="storeName">اسم المكتبة</label>
          <input id="storeName" name="name" class="form-input"
                 required minlength="2" maxlength="120"
                 value="${esc(store?.name || '')}" autofocus />
        </div>
        <div class="form-group">
          <label class="form-label" for="storeGovernorate">المحافظة</label>
          <input id="storeGovernorate" name="governorate" class="form-input"
                 required minlength="2" maxlength="80" list="storeGovernorateList"
                 value="${esc(store?.governorate || '')}" />
          <datalist id="storeGovernorateList">
            ${governorates.map(governorate => `
              <option value="${esc(governorate)}"></option>
            `).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label" for="storeAddress">العنوان</label>
          <textarea id="storeAddress" name="address" class="form-input"
                    rows="3" required minlength="2" maxlength="500">${esc(
                      store?.address || ''
                    )}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="storePhone">الهاتف — اختياري</label>
          <input id="storePhone" name="phone" type="tel" class="form-input"
                 dir="ltr" maxlength="40" placeholder="010XXXXXXXX أو +2010XXXXXXXX"
                 value="${esc(store?.phone || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="storeWhatsApp">واتساب — اختياري</label>
          <input id="storeWhatsApp" name="whatsapp" type="tel" class="form-input"
                 dir="ltr" maxlength="40"
                 value="${esc(store?.whatsapp || '')}" />
          <small style="color:var(--text-muted);">
            عند تركه فارغاً يُستخدم رقم الهاتف للمحادثة.
          </small>
        </div>
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" name="is_active"
                 ${!store || store.is_active ? 'checked' : ''} />
          إظهار المكتبة في دليل الطلاب
        </label>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-top:12px;">
          التقييمات وعددها محسوبان من تقييمات الطلاب، ولا يمكن تعديلهما إدارياً.
        </p>
      `,
      'حفظ البيانات'
    );

    dialog.form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!alive() || dialog.busy || !dialog.form.reportValidity()) return;

      const formData = new FormData(dialog.form);
      const payload = {
        name: String(formData.get('name') || '').trim(),
        governorate: String(formData.get('governorate') || '').trim(),
        address: String(formData.get('address') || '').trim(),
        phone: String(formData.get('phone') || '').trim(),
        whatsapp: String(formData.get('whatsapp') || '').trim(),
        is_active: formData.has('is_active')
      };

      setDialogBusy(dialog, true);

      try {
        const data = await requestStores(store ? `/${store.id}` : '', {
          method: store ? 'PUT' : 'POST',
          body: payload,
          signal
        });
        if (!alive() || activeDialog !== dialog) return;

        const saved = normalizeStore(data?.store);
        const index = stores.findIndex(item => item.id === saved.id);

        if (index === -1) stores.unshift(saved);
        else stores[index] = saved;

        closeDialog(true);
        updateGovernorates();
        renderStores();
        showToast(store ? 'تم تحديث المكتبة بنجاح' : 'تمت إضافة المكتبة بنجاح', 'success');
      } catch (error) {
        showDialogError(dialog, error);
      }
    }, { signal });
  }

  function openRating(store) {
    if (!alive() || management || getViewer().role !== 'student') return;

    let selectedRating = store.my_rating || 0;
    const dialog = createDialog(
      'تقييم منفذ البيع',
      `
        <p style="color:var(--text-secondary);">${esc(store.name)}</p>
        <div role="group" aria-label="اختر تقييماً من نجمة إلى خمس نجوم"
             style="display:flex;justify-content:center;gap:8px;margin:20px 0;">
          ${[1, 2, 3, 4, 5].map(rating => `
            <button type="button" data-rating="${rating}"
                    aria-label="${rating} من 5" aria-pressed="false"
                    style="border:0;background:none;cursor:pointer;padding:5px;">
              <span class="material-symbols-rounded"
                    style="font-size:2.2rem;">star</span>
            </button>
          `).join('')}
        </div>
        <p data-rating-description style="text-align:center;"></p>
      `,
      'تأكيد التقييم'
    );

    function updateStars() {
      dialog.element.querySelectorAll('[data-rating]').forEach(button => {
        const rating = Number(button.dataset.rating);
        button.style.color = rating <= selectedRating ? '#f59e0b' : '#9ca3af';
        button.setAttribute('aria-pressed', String(rating === selectedRating));
      });
      dialog.element.querySelector('[data-rating-description]').textContent =
        selectedRating ? `${selectedRating} من 5` : 'اختر تقييماً أولاً';
      dialog.confirm.disabled = selectedRating === 0;
    }

    dialog.element.querySelectorAll('[data-rating]').forEach(button => {
      button.addEventListener('click', () => {
        selectedRating = Number(button.dataset.rating);
        updateStars();
      }, { signal });
    });

    updateStars();

    dialog.form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!alive() || dialog.busy || !selectedRating) return;

      setDialogBusy(dialog, true);

      try {
        const data = await requestStores(`/${store.id}/rate`, {
          method: 'POST',
          body: { rating: selectedRating },
          signal
        });
        if (!alive() || activeDialog !== dialog) return;

        const updated = normalizeStore({
          ...store,
          rating: data?.new_rating,
          reviews_count: data?.reviews_count,
          my_rating: data?.user_rating
        });
        const index = stores.findIndex(item => item.id === store.id);
        if (index !== -1) stores[index] = updated;

        closeDialog(true);
        renderStores();
        showToast('تم حفظ تقييمك بنجاح', 'success');
      } catch (error) {
        showDialogError(dialog, error);
        if (alive() && activeDialog === dialog) updateStars();
      }
    }, { signal });
  }

  async function deleteStore(store) {
    if (
      !alive() ||
      !management ||
      !STAFF_ROLES.has(getViewer().role) ||
      deleting.has(store.id)
    ) {
      return;
    }

    if (!window.confirm(
      `هل تريد حذف "${store.name}" نهائياً؟ سيتم حذف تقييماتها أيضاً.\n` +
      'يمكنك تعطيل المكتبة بدلاً من حذفها للاحتفاظ بتقييماتها.'
    )) {
      return;
    }

    deleting.add(store.id);
    renderStores();

    try {
      await requestStores(`/${store.id}`, { method: 'DELETE', signal });
      if (!alive()) return;

      stores = stores.filter(item => item.id !== store.id);
      updateGovernorates();
      showToast('تم حذف المكتبة بنجاح', 'success');
    } catch (error) {
      if (!alive() || error.name === 'AbortError') return;
      if (!handleAuthorizationError(error)) {
        showToast(error.message || 'تعذر حذف المكتبة', 'error');
      }
    } finally {
      deleting.delete(store.id);
      if (alive()) renderStores();
    }
  }

  search.addEventListener('input', () => {
    searchQuery = search.value;
    renderStores();
  }, { signal });

  statusSelect?.addEventListener('change', () => {
    status = statusSelect.value;
    renderStores();
  }, { signal });

  pills.addEventListener('click', event => {
    const button = event.target.closest?.('button[data-governorate]');
    if (!button || !pills.contains(button) || !alive()) return;

    currentGovernorate = button.dataset.governorate;
    updateGovernorates();
    renderStores();
  }, { signal });

  page.addEventListener('click', event => {
    const button = event.target.closest?.('button[data-action]');
    if (!button || !page.contains(button) || button.disabled || !alive()) return;

    const action = button.dataset.action;

    if (action === 'reload') {
      void loadStores();
      return;
    }
    if (action === 'add') {
      if (management) openEditor();
      return;
    }

    const store = stores.find(item => item.id === Number(button.dataset.storeId));
    if (!store) return;

    if (action === 'edit' && management) openEditor(store);
    if (action === 'delete' && management) void deleteStore(store);
    if (action === 'rate' && !management) openRating(store);
  }, { signal });

  void loadStores();
  return cleanup;
}
```

## `src/components/navbar.js`

```javascript
import { getUser, isLoggedIn, logout } from '../utils/auth.js';
import { getInitials } from '../utils/helpers.js';
import { api } from '../utils/api.js';
import zraLogoFace from '../assets/zra-logo-face.png';
import zraLogoText from '../assets/zra-logo-text.png';

const STAFF_ROLES = new Set(['teacher', 'admin']);
const KNOWN_ROLES = new Set(['student', 'teacher', 'admin']);

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

let activeNavbarCleanup = null;

function readDarkMode() {
  try {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
      localStorage.getItem('darkMode') === 'true';
  } catch {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }
}

function renderLink(currentPage, page, href, icon, label, notification = false) {
  const active = currentPage === page;

  return `
    <a class="nav-item ${active ? 'active' : ''}" href="${href}"
       ${active ? 'aria-current="page"' : ''}
       ${notification ? 'id="nav-notif"' : ''}>
      <span class="material-symbols-rounded">${icon}</span>
      ${label}
      ${notification ? `
        <span class="nav-badge" id="notifBadge"
              aria-label="إشعارات غير مقروءة" style="display:none;">0</span>
      ` : ''}
    </a>
  `;
}

function renderStudentNav(currentPage) {
  return `
    <div class="nav-section-title">لوحة الطالب</div>
    ${renderLink(currentPage, 'dashboard', '#/dashboard', 'home', 'الرئيسية التعليمية')}
    ${renderLink(currentPage, 'courses', '#/courses', 'school', 'الكورسات')}
    ${renderLink(currentPage, 'exams', '#/exams', 'assignment', 'الامتحانات والتقييمات')}
    ${renderLink(currentPage, 'my-results', '#/my-results', 'fact_check', 'نتائجي وتصحيحاتي')}
    ${renderLink(currentPage, 'certificates', '#/certificates', 'workspace_premium', 'شهاداتي المعتمدة')}
    ${renderLink(currentPage, 'leaderboard', '#/leaderboard', 'emoji_events', 'لوحة المتصدرين')}
    ${renderLink(currentPage, 'live', '#/live', 'live_tv', 'الحصص اللايف')}

    <div class="nav-section-title">حسابي والخدمات</div>
    ${renderLink(currentPage, 'wallet', '#/wallet', 'account_balance_wallet', 'المحفظة والشحن')}
    ${renderLink(currentPage, 'store-locator', '#/store-locator', 'storefront', 'دليل المكتبات والمنافذ')}
    ${renderLink(currentPage, 'notifications', '#/notifications', 'notifications', 'الإشعارات', true)}
    ${renderLink(currentPage, 'profile', '#/profile', 'person', 'الملف الشخصي')}
  `;
}

function renderStaffNav(currentPage) {
  return `
    <div class="nav-section-title">لوحة المعلم والإدارة</div>
    ${renderLink(currentPage, 'admin', '#/admin', 'admin_panel_settings', 'لوحة الإدارة العامة')}
    ${renderLink(currentPage, 'admin-courses', '#/admin/courses', 'book', 'إدارة الكورسات')}
    ${renderLink(currentPage, 'admin-exams', '#/admin/exams', 'assignment', 'إدارة الامتحانات')}
    ${renderLink(currentPage, 'admin-students', '#/admin/students', 'group', 'سجل الطلاب')}
    ${renderLink(currentPage, 'admin-codes', '#/admin/codes', 'key', 'أكواد التفعيل والشحن')}
    ${renderLink(currentPage, 'admin-live', '#/admin/live', 'live_tv', 'بث الحصص اللايف')}
    ${renderLink(currentPage, 'admin-notifications', '#/admin/notifications', 'notifications', 'إرسال الإشعارات')}
    ${renderLink(currentPage, 'admin-stores', '#/admin/stores', 'storefront', 'إدارة المكتبات والمنافذ')}
  `;
}

export function renderNavbar(currentPage) {
  if (!isLoggedIn()) return '';

  const user = getUser();
  if (!user || !KNOWN_ROLES.has(user.role)) return '';

  const page = String(currentPage || '');
  const staff = STAFF_ROLES.has(user.role);
  const managementPage = /^admin(?:$|[-/])/.test(page);

  // Fail closed instead of placing an admin sidebar on a student page,
  // or student navigation on a management page.
  if (staff !== managementPage) {
    throw new Error(`Navbar role/page mismatch: ${user.role} / ${page}`);
  }

  const dark = readDarkMode();
  const home = staff ? '#/admin' : '#/dashboard';
  const roleLabel = user.role === 'admin'
    ? 'إدارة المنصة'
    : user.role === 'teacher'
      ? 'معلم'
      : String(user.grade || 'طالب');

  const userContent = `
    <div class="sidebar-user-avatar">${esc(getInitials(String(user.name || '')))}</div>
    <div class="sidebar-user-info">
      <div class="sidebar-user-name">${esc(user.name || '')}</div>
      <div class="sidebar-user-role">${esc(roleLabel)}</div>
    </div>
  `;

  return `
    <div class="sidebar-overlay" id="sidebarOverlay" aria-hidden="true"></div>

    <header class="mobile-header" id="mobileHeader">
      <button type="button" class="mobile-menu-btn" id="mobileMenuBtn"
              aria-label="فتح القائمة" aria-controls="sidebar"
              aria-expanded="false">
        <span class="material-symbols-rounded">menu</span>
      </button>

      <a href="${home}" class="sidebar-logo"
         aria-label="الرئيسية"
         style="display:flex;align-items:center;gap:6px;">
        <img src="${esc(zraLogoFace)}" alt="" class="logo-face-img"
             style="height:32px;" />
        <img src="${esc(zraLogoText)}" alt="كيمياوي" class="logo-text-img"
             style="height:22px;" />
      </a>

      <button type="button" class="mobile-menu-btn" id="mobileDarkToggle"
              aria-label="${dark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}">
        <span class="material-symbols-rounded">
          ${dark ? 'light_mode' : 'dark_mode'}
        </span>
      </button>
    </header>

    <aside class="sidebar" id="sidebar"
           data-role="${esc(user.role)}" data-user-id="${esc(user.id)}">
      <div class="sidebar-header" style="position:relative;">
        <button type="button" class="sidebar-close-btn" id="sidebarCloseBtn"
                aria-label="إغلاق القائمة">
          <span class="material-symbols-rounded">close</span>
        </button>

        <a href="${home}" class="sidebar-logo" aria-label="الرئيسية"
           style="display:flex;align-items:center;justify-content:center;gap:8px;">
          <img src="${esc(zraLogoFace)}" alt="" class="logo-face-img"
               style="height:36px;" />
          <img src="${esc(zraLogoText)}" alt="كيمياوي" class="logo-text-img"
               style="height:26px;" />
        </a>
        <div class="sidebar-subtitle">د. زياد رمزي عياد</div>
      </div>

      <nav class="sidebar-nav"
           aria-label="${staff ? 'قائمة الإدارة' : 'قائمة الطالب'}">
        ${staff ? renderStaffNav(page) : renderStudentNav(page)}
      </nav>

      <button type="button" class="dark-mode-toggle" id="darkModeToggle"
              style="display:block;width:calc(100% - 20px);padding:4px 10px;
                     margin:4px 10px;border:0;background:none;color:inherit;
                     font:inherit;text-align:inherit;cursor:pointer;">
        <span class="nav-item" style="margin:0;">
          <span class="material-symbols-rounded" id="sidebarDarkIcon">
            ${dark ? 'light_mode' : 'dark_mode'}
          </span>
          <span id="sidebarDarkText">
            ${dark ? 'الوضع النهاري' : 'الوضع الليلي'}
          </span>
        </span>
      </button>

      ${staff ? `
        <div class="sidebar-user">${userContent}</div>
      ` : `
        <a href="#/profile" class="sidebar-user" style="text-decoration:none;">
          ${userContent}
        </a>
      `}

      <button type="button" class="sidebar-logout" id="logoutBtn"
              style="width:100%;border:0;background:none;font:inherit;
                     text-align:inherit;cursor:pointer;">
        <span class="material-symbols-rounded">logout</span> تسجيل خروج
      </button>
    </aside>
  `;
}

export function destroyNavbar() {
  const cleanup = activeNavbarCleanup;
  activeNavbarCleanup = null;
  if (cleanup) cleanup();
}

export function initNavbar() {
  destroyNavbar();

  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return () => {};

  const user = getUser();
  if (
    !isLoggedIn() ||
    !KNOWN_ROLES.has(user?.role) ||
    sidebar.dataset.role !== user.role ||
    sidebar.dataset.userId !== String(user.id)
  ) {
    throw new Error('Navbar initialized with an invalid session');
  }

  const controller = new AbortController();
  const { signal } = controller;
  const button = document.getElementById('mobileMenuBtn');
  const overlay = document.getElementById('sidebarOverlay');
  const closeButton = document.getElementById('sidebarCloseBtn');
  const logoutButton = document.getElementById('logoutBtn');
  let previousOverflow = null;

  function closeMobileSidebar(restoreFocus = true) {
    const wasOpen = sidebar.classList.contains('open');

    sidebar.classList.remove('open');
    overlay?.classList.remove('active');
    button?.setAttribute('aria-expanded', 'false');

    if (previousOverflow !== null) {
      document.body.style.overflow = previousOverflow;
      previousOverflow = null;
    }

    if (wasOpen && restoreFocus && button?.isConnected) button.focus();
  }

  function openMobileSidebar() {
    if (window.innerWidth > 1024) return;

    sidebar.classList.add('open');
    overlay?.classList.add('active');
    button?.setAttribute('aria-expanded', 'true');

    if (previousOverflow === null) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    const first = sidebar.querySelector('button:not(:disabled), a[href]');
    first?.focus();
  }

  function cleanup() {
    if (signal.aborted) return;
    controller.abort();
    closeMobileSidebar(false);
    if (activeNavbarCleanup === cleanup) activeNavbarCleanup = null;
  }

  activeNavbarCleanup = cleanup;

  button?.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeMobileSidebar();
    else openMobileSidebar();
  }, { signal });

  overlay?.addEventListener('click', () => closeMobileSidebar(), { signal });
  closeButton?.addEventListener('click', () => closeMobileSidebar(), { signal });

  sidebar.querySelectorAll('.sidebar-nav a, a.sidebar-user').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 1024) closeMobileSidebar(false);
    }, { signal });
  });

  document.addEventListener('keydown', event => {
    if (!sidebar.classList.contains('open')) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileSidebar();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = [...sidebar.querySelectorAll(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled)'
    )].filter(element => element.getClientRects().length > 0);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const focused = document.activeElement;

    if (event.shiftKey && (focused === first || !sidebar.contains(focused))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (focused === last || !sidebar.contains(focused))) {
      event.preventDefault();
      first.focus();
    }
  }, { signal });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) closeMobileSidebar(false);
  }, { signal });

  logoutButton?.addEventListener('click', () => {
    closeMobileSidebar(false);
    logout();
  }, { signal });

  function toggleDarkMode() {
    const dark = document.documentElement.getAttribute('data-theme') !== 'dark';

    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');

    try {
      localStorage.setItem('darkMode', String(dark));
    } catch {
      // Theme switching still works when persistent storage is unavailable.
    }

    const mobileToggle = document.getElementById('mobileDarkToggle');
    const icon = document.getElementById('sidebarDarkIcon');
    const text = document.getElementById('sidebarDarkText');

    if (mobileToggle) {
      mobileToggle.querySelector('.material-symbols-rounded').textContent =
        dark ? 'light_mode' : 'dark_mode';
      mobileToggle.setAttribute(
        'aria-label',
        dark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'
      );
    }
    if (icon) icon.textContent = dark ? 'light_mode' : 'dark_mode';
    if (text) text.textContent = dark ? 'الوضع النهاري' : 'الوضع الليلي';
  }

  document.getElementById('darkModeToggle')?.addEventListener(
    'click',
    toggleDarkMode,
    { signal }
  );
  document.getElementById('mobileDarkToggle')?.addEventListener(
    'click',
    toggleDarkMode,
    { signal }
  );

  // Staff navigation has no student notification badge and makes no
  // student notification-count request.
  if (user.role === 'student') {
    void loadNotificationBadge(sidebar, user.id, signal);
  }

  return cleanup;
}

async function loadNotificationBadge(sidebar, userId, signal) {
  const badge = sidebar.querySelector('#notifBadge');
  if (!badge) return;

  try {
    const response = await api.getUnreadCount();
    const current = getUser();

    if (
      signal.aborted ||
      !sidebar.isConnected ||
      !isLoggedIn() ||
      current?.role !== 'student' ||
      String(current.id) !== String(userId)
    ) {
      return;
    }

    const count = Number(response?.count);
    const unread = Number.isSafeInteger(count) && count > 0 ? count : 0;

    badge.style.display = unread ? 'inline-flex' : 'none';
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.setAttribute('aria-label', `${unread} إشعار غير مقروء`);
  } catch {
    // A badge failure must not break navigation.
  }
}
```

## `src/main.js`

```javascript
import './styles/main.css';
import './styles/landing.css';
import './styles/pages.css';

import { renderLanding, initLanding } from './pages/landing.js';
import { renderLogin, initLogin, renderRegister, initRegister } from './pages/auth.js';
import { renderDashboard, initDashboard } from './pages/dashboard.js';
import { renderCourses, initCourses } from './pages/courses.js';
import { renderCourseDetail, initCourseDetail } from './pages/courseDetail.js';
import { renderLesson, initLesson } from './pages/lesson.js';
import {
  renderExams,
  initExams,
  renderExamTake,
  initExamTake,
  renderExamReview,
  initExamReview
} from './pages/exams.js';
import { renderLeaderboard, initLeaderboard } from './pages/leaderboard.js';
import { renderMyResults, initMyResults } from './pages/myResults.js';
import { renderLive, initLive } from './pages/live.js';
import { renderWallet, initWallet } from './pages/wallet.js';
import { renderCertificates, initCertificates } from './pages/certificates.js';
import {
  renderStoreLocator,
  initStoreLocator,
  renderAdminStores,
  initAdminStores
} from './pages/storeLocator.js';
import {
  renderAdmin,
  initAdmin,
  renderAdminCourses,
  initAdminCourses,
  renderAdminCodes,
  initAdminCodes,
  renderAdminStudents,
  initAdminStudents,
  renderAdminExams,
  initAdminExams,
  renderAdminLive,
  initAdminLive,
  renderAdminNotifications,
  initAdminNotifications
} from './pages/admin.js';
import {
  renderAdminCourseDetail,
  initAdminCourseDetail
} from './pages/adminCourseDetail.js';
import {
  renderAdminExamDetail,
  initAdminExamDetail
} from './pages/adminExamDetail.js';
import {
  renderNavbar,
  initNavbar,
  destroyNavbar
} from './components/navbar.js';
import { api } from './utils/api.js';
import { isLoggedIn, getUser, logout } from './utils/auth.js';
import { showToast } from './components/toast.js';
import { timeAgo, getInitials } from './utils/helpers.js';

const STAFF_ROLES = new Set(['teacher', 'admin']);
const KNOWN_ROLES = new Set(['student', 'teacher', 'admin']);
const LANDING_SECTIONS = new Set([
  'reviews', 'faq', 'features', 'grades', 'why-us'
]);

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

let activeNavigation = null;
let navigationSequence = 0;

function cacheVerifiedUser(user) {
  const id = Number(user?.id);

  if (!Number.isSafeInteger(id) || id <= 0 || !KNOWN_ROLES.has(user?.role)) {
    throw new Error('Unsupported or invalid authenticated account');
  }

  const verified = { ...user, id };
  localStorage.setItem('user', JSON.stringify(verified));
  return verified;
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function redirect(path) {
  window.location.replace(`#${path}`);
}

function createPageScope(host, context = {}) {
  const controller = new AbortController();
  const viewer = getUser();
  const navbarCleanup = initNavbar();

  function cleanup() {
    if (controller.signal.aborted) return;
    controller.abort();
    navbarCleanup();
    context.signal?.removeEventListener('abort', cleanup);
  }

  if (context.signal?.aborted) cleanup();
  else context.signal?.addEventListener('abort', cleanup, { once: true });

  return {
    signal: controller.signal,
    cleanup,
    alive() {
      const current = getUser();
      return !controller.signal.aborted &&
        host.isConnected &&
        context.isCurrent?.() !== false &&
        isLoggedIn() &&
        current?.role === viewer?.role &&
        String(current?.id) === String(viewer?.id);
    }
  };
}

// ===== Student Notifications =====

function renderNotifications() {
  return `
    <div class="app-layout">
      ${renderNavbar('notifications')}
      <main class="main-content">
        <div class="page-header"
             style="display:flex;align-items:center;justify-content:space-between;
                    flex-wrap:wrap;gap:12px;">
          <div>
            <h1 class="page-title">
              <span class="material-symbols-rounded"
                    style="color:var(--warning);">notifications</span>
              الإشعارات
            </h1>
            <p class="page-subtitle">آخر الأخبار والتحديثات على حسابك</p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm"
                  id="markAllReadBtn">
            <span class="material-symbols-rounded">done_all</span>
            تحديد الكل كمقروء
          </button>
        </div>
        <section id="notificationsPage">
          <div id="notifsContent" aria-busy="true">
            <div class="loading-spinner"><div class="spinner"></div></div>
          </div>
        </section>
      </main>
    </div>
  `;
}

function initNotifications(context = {}) {
  const host = document.getElementById('notificationsPage');
  if (!host || context.signal?.aborted) return () => {};

  const scope = createPageScope(host, context);
  const content = host.querySelector('#notifsContent');
  const markAllButton = document.getElementById('markAllReadBtn');
  const pending = new Set();
  let notifications = [];
  let markingAll = false;

  function updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge || !scope.alive()) return;

    const unread = notifications.filter(item => !item.is_read).length;
    badge.style.display = unread ? 'inline-flex' : 'none';
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.setAttribute('aria-label', `${unread} إشعار غير مقروء`);
  }

  function renderList() {
    if (!scope.alive()) return;
    content.setAttribute('aria-busy', 'false');

    if (!notifications.length) {
      content.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-rounded">notifications_off</span>
          <h3>لا توجد إشعارات</h3>
          <p>ستظهر هنا إشعاراتك عند وصولها</p>
        </div>
      `;
      updateBadge();
      return;
    }

    content.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${notifications.map(item => {
          const type = item.type === 'success'
            ? { color: 'success', icon: 'check_circle', className: 'green' }
            : item.type === 'warning'
              ? { color: 'warning', icon: 'warning', className: 'gold' }
              : { color: 'info', icon: 'info', className: 'blue' };

          return `
            <button type="button" class="card" data-nid="${item.id}"
                    ${item.is_read || pending.has(item.id) ? 'disabled' : ''}
                    style="padding:18px;text-align:inherit;color:inherit;
                           font:inherit;width:100%;opacity:${item.is_read ? 0.65 : 1};
                           border-right:4px solid var(--${type.color});">
              <span style="display:flex;align-items:center;gap:14px;">
                <span class="stat-icon ${type.className}"
                      style="width:44px;height:44px;flex-shrink:0;">
                  <span class="material-symbols-rounded">${type.icon}</span>
                </span>
                <span style="flex:1;min-width:0;">
                  <span style="font-weight:700;display:flex;align-items:center;gap:8px;">
                    ${esc(item.title)}
                    ${!item.is_read
                      ? '<span class="badge badge-info">جديد</span>'
                      : ''}
                  </span>
                  <span style="display:block;color:var(--text-secondary);
                               margin-top:4px;line-height:1.5;">
                    ${esc(item.message)}
                  </span>
                  <span style="display:block;color:var(--text-muted);
                               font-size:0.75rem;margin-top:6px;">
                    ${esc(timeAgo(item.created_at))}
                  </span>
                </span>
              </span>
            </button>
          `;
        }).join('')}
      </div>
    `;
    updateBadge();
  }

  async function loadNotifications() {
    try {
      const data = await api.getNotifications();
      if (!scope.alive()) return;
      if (!Array.isArray(data)) throw new Error('استجابة إشعارات غير صالحة');

      notifications = data.map(item => ({
        ...item,
        id: Number(item.id),
        is_read: item.is_read === true || Number(item.is_read) === 1
      })).filter(item => Number.isSafeInteger(item.id) && item.id > 0);

      renderList();
    } catch (error) {
      if (!scope.alive()) return;
      content.setAttribute('aria-busy', 'false');
      content.innerHTML = `
        <div class="card" role="alert">
          <p>${esc(error.message || 'تعذر تحميل الإشعارات')}</p>
          <button type="button" class="btn btn-secondary"
                  data-retry-notifications>إعادة المحاولة</button>
        </div>
      `;
    }
  }

  content.addEventListener('click', async event => {
    if (!scope.alive()) return;

    const retry = event.target.closest?.('[data-retry-notifications]');
    if (retry && content.contains(retry)) {
      retry.disabled = true;
      void loadNotifications();
      return;
    }

    const button = event.target.closest?.('button[data-nid]');
    if (!button || !content.contains(button) || button.disabled || markingAll) return;

    const id = Number(button.dataset.nid);
    const item = notifications.find(notification => notification.id === id);
    if (!item || item.is_read || pending.has(id)) return;

    pending.add(id);
    button.disabled = true;

    try {
      await api.markNotifRead(id);
      if (!scope.alive()) return;
      item.is_read = true;
    } catch (error) {
      if (scope.alive()) {
        showToast(error.message || 'تعذر تحديث الإشعار', 'error');
      }
    } finally {
      pending.delete(id);
      if (scope.alive()) renderList();
    }
  }, { signal: scope.signal });

  markAllButton?.addEventListener('click', async () => {
    if (!scope.alive() || markingAll) return;

    markingAll = true;
    markAllButton.disabled = true;

    try {
      await api.markAllNotifsRead();
      if (!scope.alive()) return;

      notifications.forEach(item => { item.is_read = true; });
      renderList();
      showToast('تم تحديد الكل كمقروء', 'success');
    } catch (error) {
      if (scope.alive()) {
        showToast(error.message || 'تعذر تحديث الإشعارات', 'error');
      }
    } finally {
      markingAll = false;
      if (scope.alive()) markAllButton.disabled = false;
    }
  }, { signal: scope.signal });

  void loadNotifications();
  return scope.cleanup;
}

// ===== Student Profile =====

function renderProfile() {
  return `
    <div class="app-layout">
      ${renderNavbar('profile')}
      <main class="main-content">
        <div class="page-header">
          <h1 class="page-title">
            <span class="material-symbols-rounded"
                  style="color:var(--primary);">person</span>
            الملف الشخصي
          </h1>
        </div>
        <section id="profileContent" aria-busy="true">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </section>
      </main>
    </div>
  `;
}

function initProfile(context = {}) {
  const host = document.getElementById('profileContent');
  if (!host || context.signal?.aborted) return () => {};

  const scope = createPageScope(host, context);
  const viewerId = Number(getUser()?.id);

  async function loadProfile() {
    try {
      const user = await api.getMe();
      if (!scope.alive()) return;

      if (user?.role !== 'student' || Number(user.id) !== viewerId) {
        cacheVerifiedUser(user);
        void navigate();
        return;
      }

      const grades = [...new Set([
        'سادسة ابتدائي',
        'أولى إعدادي',
        'ثانية إعدادي',
        'ثالثة إعدادي',
        'أولى ثانوي',
        'ثانية ثانوي',
        'ثالثة ثانوي',
        ...(typeof user.grade === 'string' && user.grade ? [user.grade] : [])
      ])];

      const joined = new Date(user.created_at);
      const joinedLabel = Number.isNaN(joined.getTime())
        ? 'غير متاح'
        : joined.toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

      host.setAttribute('aria-busy', 'false');
      host.innerHTML = `
        <div style="display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));
                    gap:24px;max-width:850px;">
          <div class="card">
            <h3 style="margin-bottom:20px;">بياناتي</h3>
            <form id="profileForm">
              <div class="form-group">
                <label class="form-label" for="pName">الاسم</label>
                <input type="text" class="form-input" id="pName"
                       value="${esc(user.name)}" required maxlength="120"
                       autocomplete="name" />
              </div>
              <div class="form-group">
                <label class="form-label" for="pPhone">رقم الهاتف</label>
                <input type="tel" class="form-input" id="pPhone"
                       value="${esc(user.phone)}" disabled dir="ltr" />
              </div>
              <div class="form-group">
                <label class="form-label" for="pGrade">المرحلة الدراسية</label>
                <select class="form-select" id="pGrade">
                  <option value="" ${!user.grade ? 'selected' : ''}>اختر المرحلة</option>
                  ${grades.map(grade => `
                    <option value="${esc(grade)}"
                            ${user.grade === grade ? 'selected' : ''}>
                      ${esc(grade)}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="pParent">رقم هاتف الأب</label>
                <input type="tel" class="form-input" id="pParent"
                       value="${esc(user.parent_phone || '')}"
                       dir="ltr" maxlength="40" placeholder="01XXXXXXXXX" />
              </div>
              <div class="form-group">
                <label class="form-label" for="pParentSecondary">رقم هاتف الأم</label>
                <input type="tel" class="form-input" id="pParentSecondary"
                       value="${esc(user.parent_phone_secondary || '')}"
                       dir="ltr" maxlength="40" placeholder="01XXXXXXXXX" />
              </div>
              <button type="submit" class="btn btn-primary btn-block">
                <span class="material-symbols-rounded">save</span>
                حفظ التعديلات
              </button>
            </form>
          </div>

          <div class="card">
            <h3 style="margin-bottom:20px;">تغيير كلمة المرور</h3>
            <form id="passwordForm">
              <div class="form-group">
                <label class="form-label" for="currentPass">كلمة المرور الحالية</label>
                <input type="password" class="form-input" id="currentPass"
                       required autocomplete="current-password" />
              </div>
              <div class="form-group">
                <label class="form-label" for="newPass">كلمة المرور الجديدة</label>
                <input type="password" class="form-input" id="newPass"
                       required minlength="6" autocomplete="new-password" />
              </div>
              <div class="form-group">
                <label class="form-label" for="confirmPass">تأكيد كلمة المرور</label>
                <input type="password" class="form-input" id="confirmPass"
                       required minlength="6" autocomplete="new-password" />
              </div>
              <button type="submit" class="btn btn-accent btn-block">
                <span class="material-symbols-rounded">key</span>
                تغيير كلمة المرور
              </button>
            </form>
            <p style="margin-top:24px;color:var(--text-muted);font-size:0.82rem;">
              عضو منذ ${esc(joinedLabel)}
            </p>
          </div>
        </div>
      `;

      const profileForm = host.querySelector('#profileForm');
      const passwordForm = host.querySelector('#passwordForm');

      profileForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!scope.alive() || !profileForm.reportValidity()) return;

        const button = profileForm.querySelector('[type="submit"]');
        if (button.disabled) return;

        const payload = {
          name: host.querySelector('#pName').value.trim(),
          grade: host.querySelector('#pGrade').value,
          parent_phone: host.querySelector('#pParent').value.trim(),
          parent_phone_secondary: host.querySelector('#pParentSecondary').value.trim()
        };

        if (!payload.name) {
          showToast('يرجى إدخال الاسم', 'warning');
          return;
        }

        button.disabled = true;

        try {
          const updated = await api.updateProfile(payload);
          if (!scope.alive()) return;

          // Profile updates cannot grant or modify a role in the client cache.
          const stored = getUser();
          const safeUpdate = {
            name: typeof updated?.name === 'string' ? updated.name : payload.name,
            grade: typeof updated?.grade === 'string' ? updated.grade : payload.grade,
            parent_phone: updated?.parent_phone ?? payload.parent_phone,
            parent_phone_secondary:
              updated?.parent_phone_secondary ?? payload.parent_phone_secondary
          };

          localStorage.setItem('user', JSON.stringify({ ...stored, ...safeUpdate }));

          const nameElement = document.querySelector('.sidebar-user-name');
          const avatarElement = document.querySelector('.sidebar-user-avatar');
          const roleElement = document.querySelector('.sidebar-user-role');

          if (nameElement) nameElement.textContent = safeUpdate.name;
          if (avatarElement) avatarElement.textContent = getInitials(safeUpdate.name);
          if (roleElement) roleElement.textContent = safeUpdate.grade || 'طالب';

          showToast('تم تحديث البيانات بنجاح', 'success');
        } catch (error) {
          if (scope.alive()) {
            showToast(error.message || 'تعذر تحديث البيانات', 'error');
          }
        } finally {
          if (scope.alive()) button.disabled = false;
        }
      }, { signal: scope.signal });

      passwordForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!scope.alive() || !passwordForm.reportValidity()) return;

        const button = passwordForm.querySelector('[type="submit"]');
        if (button.disabled) return;

        const newPassword = host.querySelector('#newPass').value;
        if (newPassword !== host.querySelector('#confirmPass').value) {
          showToast('كلمة المرور غير متطابقة', 'error');
          return;
        }

        button.disabled = true;

        try {
          await api.changePassword({
            currentPassword: host.querySelector('#currentPass').value,
            newPassword
          });
          if (!scope.alive()) return;

          passwordForm.reset();
          showToast('تم تغيير كلمة المرور بنجاح', 'success');
        } catch (error) {
          if (scope.alive()) {
            showToast(error.message || 'تعذر تغيير كلمة المرور', 'error');
          }
        } finally {
          if (scope.alive()) button.disabled = false;
        }
      }, { signal: scope.signal });
    } catch (error) {
      if (!scope.alive()) return;
      host.setAttribute('aria-busy', 'false');
      host.innerHTML = `
        <div class="card" role="alert">
          <p>${esc(error.message || 'تعذر تحميل الملف الشخصي')}</p>
          <button type="button" class="btn btn-secondary"
                  data-retry-profile>إعادة المحاولة</button>
        </div>
      `;
    }
  }

  host.addEventListener('click', event => {
    const button = event.target.closest?.('[data-retry-profile]');
    if (!button || !host.contains(button) || !scope.alive()) return;
    button.disabled = true;
    void loadProfile();
  }, { signal: scope.signal });

  void loadProfile();
  return scope.cleanup;
}

// ===== Route Policies =====
// public: any visitor, using a public layout.
// public-student: guests or students only; staff use a management counterpart.
// student: authenticated students only.
// staff: authenticated teachers/admins only.

const routes = {
  '/': {
    render: renderLanding, init: initLanding, access: 'public'
  },
  '/login': {
    render: renderLogin, init: initLogin, access: 'public', guestOnly: true
  },
  '/register': {
    render: renderRegister, init: initRegister, access: 'public', guestOnly: true
  },
  '/dashboard': {
    render: renderDashboard, init: initDashboard, access: 'student'
  },
  '/courses': {
    render: renderCourses, init: initCourses,
    access: 'public-student', staffRedirect: '/admin/courses'
  },
  '/exams': {
    render: renderExams, init: initExams,
    access: 'student', staffRedirect: '/admin/exams'
  },
  '/my-results': {
    render: renderMyResults, init: initMyResults, access: 'student'
  },
  '/leaderboard': {
    render: renderLeaderboard, init: initLeaderboard, access: 'student'
  },
  '/live': {
    render: renderLive, init: initLive,
    access: 'student', staffRedirect: '/admin/live'
  },
  '/wallet': {
    render: renderWallet, init: initWallet, access: 'student'
  },
  '/certificates': {
    render: renderCertificates, init: initCertificates, access: 'student'
  },
  '/packages': {
    access: 'public-student',
    redirect: '/courses',
    staffRedirect: '/admin/courses'
  },
  '/store-locator': {
    render: renderStoreLocator, init: initStoreLocator,
    access: 'public-student', staffRedirect: '/admin/stores'
  },
  '/notifications': {
    render: renderNotifications, init: initNotifications,
    access: 'student', staffRedirect: '/admin/notifications'
  },
  '/profile': {
    render: renderProfile, init: initProfile, access: 'student'
  },
  '/admin': {
    render: renderAdmin, init: initAdmin, access: 'staff'
  },
  '/admin/courses': {
    render: renderAdminCourses, init: initAdminCourses, access: 'staff'
  },
  '/admin/codes': {
    render: renderAdminCodes, init: initAdminCodes, access: 'staff'
  },
  '/admin/students': {
    render: renderAdminStudents, init: initAdminStudents, access: 'staff'
  },
  '/admin/exams': {
    render: renderAdminExams, init: initAdminExams, access: 'staff'
  },
  '/admin/live': {
    render: renderAdminLive, init: initAdminLive, access: 'staff'
  },
  '/admin/notifications': {
    render: renderAdminNotifications, init: initAdminNotifications, access: 'staff'
  },
  '/admin/stores': {
    render: renderAdminStores, init: initAdminStores, access: 'staff'
  }
};

function validNumericId(value) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

function matchDynamic(path) {
  let match = path.match(/^\/courses\/([1-9]\d*)$/);
  if (match && validNumericId(match[1])) {
    const id = match[1];
    return {
      render: () => renderCourseDetail(id),
      init: () => initCourseDetail(id),
      access: 'public-student',
      staffRedirect: `/admin/courses/${id}`
    };
  }

  match = path.match(/^\/lessons\/([1-9]\d*)$/);
  if (match && validNumericId(match[1])) {
    const id = match[1];
    return {
      render: () => renderLesson(id),
      init: () => initLesson(id),
      access: 'student',
      staffRedirect: '/admin/courses'
    };
  }

  match = path.match(/^\/exams\/([a-zA-Z0-9_-]+)\/take$/);
  if (match) {
    const id = match[1];
    return {
      render: () => renderExamTake(id),
      init: () => initExamTake(id),
      access: 'student',
      staffRedirect: '/admin/exams'
    };
  }

  match = path.match(/^\/exams\/([1-9]\d*)\/review$/);
  if (match && validNumericId(match[1])) {
    const id = match[1];
    return {
      render: () => renderExamReview(id),
      init: () => initExamReview(id),
      access: 'student',
      staffRedirect: '/admin/exams'
    };
  }

  match = path.match(/^\/admin\/courses\/([1-9]\d*)$/);
  if (match && validNumericId(match[1])) {
    const id = match[1];
    return {
      render: () => renderAdminCourseDetail(id),
      init: () => initAdminCourseDetail(id),
      access: 'staff'
    };
  }

  match = path.match(/^\/admin\/exams\/([1-9]\d*)$/);
  if (match && validNumericId(match[1])) {
    const id = match[1];
    return {
      render: () => renderAdminExamDetail(id),
      init: () => initAdminExamDetail(id),
      access: 'staff'
    };
  }

  return null;
}

function parseLocation() {
  const raw = window.location.hash.slice(1) || '/';
  const queryIndex = raw.indexOf('?');
  const rawPath = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const decoded = decodeURIComponent(rawPath);

  const section = decoded.replace(/^\/?#?/, '');
  if (LANDING_SECTIONS.has(section)) {
    return { path: '/', targetSection: section };
  }

  let path = decoded.startsWith('/') ? decoded : `/${decoded}`;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');

  return { path, targetSection: null };
}

function renderStatus(root, navigation, code, message, retry = false) {
  const user = getUser();
  const home = isLoggedIn() && STAFF_ROLES.has(user?.role)
    ? '#/admin'
    : isLoggedIn() && user?.role === 'student'
      ? '#/dashboard'
      : '#/';

  root.innerHTML = `
    <main style="display:flex;align-items:center;justify-content:center;
                 min-height:100vh;text-align:center;flex-direction:column;
                 gap:16px;padding:24px;" dir="rtl">
      <span class="material-symbols-rounded"
            style="font-size:5rem;color:var(--primary);">science</span>
      <h1 style="font-size:2rem;font-weight:800;">${esc(code)}</h1>
      <p role="alert" style="color:var(--text-secondary);">${esc(message)}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
        <a href="${home}" class="btn btn-primary">الرئيسية</a>
        ${retry
          ? '<button type="button" class="btn btn-secondary" data-navigation-retry>إعادة المحاولة</button>'
          : ''}
        ${isLoggedIn()
          ? '<button type="button" class="btn btn-outline" data-navigation-logout>تسجيل خروج</button>'
          : '<a href="#/login" class="btn btn-outline">تسجيل الدخول</a>'}
      </div>
    </main>
  `;

  root.querySelector('[data-navigation-retry]')?.addEventListener(
    'click',
    () => { void navigate(); },
    { signal: navigation.controller.signal }
  );
  root.querySelector('[data-navigation-logout]')?.addEventListener(
    'click',
    logout,
    { signal: navigation.controller.signal }
  );
}

async function navigate() {
  if (activeNavigation) {
    activeNavigation.controller.abort();
    if (typeof activeNavigation.cleanup === 'function') {
      activeNavigation.cleanup();
    }
  }
  destroyNavbar();

  const navigation = {
    id: ++navigationSequence,
    controller: new AbortController(),
    cleanup: null
  };
  activeNavigation = navigation;

  const current = () => activeNavigation === navigation &&
    !navigation.controller.signal.aborted;

  const root = document.getElementById('app');
  if (!root) {
    console.error('#app element not found');
    return;
  }

  // Immediately remove the previous layout before authentication or redirects.
  // A denied navigation must never leave an old admin page visible.
  root.replaceChildren();

  let location;
  try {
    location = parseLocation();
  } catch {
    renderStatus(root, navigation, '400', 'عنوان الصفحة غير صالح');
    return;
  }

  const { path, targetSection } = location;
  const route = routes[path] || matchDynamic(path);
  const adminPath = /^\/admin(?:\/|$)/.test(path);
  let session = null;

  // Do not trust a role read only from localStorage. Verify the account against
  // the authenticated /me endpoint before rendering any logged-in navigation.
  if (isLoggedIn()) {
    const initialToken = localStorage.getItem('token');
    root.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
      const user = await api.getMe();
      if (!current()) return;

      if (
        !isLoggedIn() ||
        localStorage.getItem('token') !== initialToken
      ) {
        void navigate();
        return;
      }

      if (!KNOWN_ROLES.has(user?.role)) {
        renderStatus(root, navigation, '403', 'نوع الحساب غير مصرح له باستخدام المنصة');
        return;
      }

      session = cacheVerifiedUser(user);
    } catch (error) {
      if (!current()) return;

      if (error.status === 401 || error.status === 403) {
        clearSession();
        redirect('/login');
        return;
      }

      console.error('Session verification failed:', error);
      renderStatus(
        root,
        navigation,
        'تعذر التحقق من الحساب',
        'تعذر التحقق من صلاحياتك. أعد المحاولة أو سجّل الدخول من جديد.',
        true
      );
      return;
    }
  }

  if (!current()) return;

  // Prefix guard also covers unknown/future admin URLs.
  if (adminPath) {
    if (!session) {
      redirect('/login');
      return;
    }
    if (!STAFF_ROLES.has(session.role)) {
      showToast('هذه الصفحة متاحة للمعلم والإدارة فقط', 'warning');
      redirect('/dashboard');
      return;
    }
  }

  if (!route) {
    renderStatus(root, navigation, '404', 'الصفحة غير موجودة');
    return;
  }

  if (route.guestOnly && session) {
    redirect(STAFF_ROLES.has(session.role) ? '/admin' : '/dashboard');
    return;
  }

  if (route.access === 'staff') {
    if (!session) {
      redirect('/login');
      return;
    }
    if (!STAFF_ROLES.has(session.role)) {
      redirect('/dashboard');
      return;
    }
  } else if (route.access === 'student' || route.access === 'public-student') {
    if (session && STAFF_ROLES.has(session.role)) {
      redirect(route.staffRedirect || '/admin');
      return;
    }
    if (route.access === 'student' && !session) {
      redirect('/login');
      return;
    }
    if (session && session.role !== 'student') {
      renderStatus(root, navigation, '403', 'غير مصرح بالدخول إلى هذه الصفحة');
      return;
    }
  } else if (route.access !== 'public') {
    // Missing or misspelled policies must not silently become public.
    renderStatus(root, navigation, '403', 'سياسة الوصول إلى الصفحة غير صالحة');
    return;
  }

  if (route.redirect) {
    redirect(route.redirect);
    return;
  }

  if (!targetSection) window.scrollTo(0, 0);

  try {
    if (!current()) return;

    root.innerHTML = route.render();

    const cleanup = route.init
      ? await route.init({
        signal: navigation.controller.signal,
        isCurrent: current,
        user: session
      })
      : null;

    if (typeof cleanup === 'function') {
      if (current()) navigation.cleanup = cleanup;
      else cleanup();
    }

    if (!current()) return;

    if (targetSection) {
      requestAnimationFrame(() => {
        if (!current()) return;
        document.getElementById(targetSection)?.scrollIntoView({
          behavior: 'smooth'
        });
      });
    }
  } catch (error) {
    if (!current()) return;
    destroyNavbar();
    console.error('Navigation error:', error);
    renderStatus(
      root,
      navigation,
      'تعذر تحميل الصفحة',
      'حدث خطأ في تحميل الصفحة. يرجى المحاولة مرة أخرى.',
      true
    );
  }
}

// Apply persisted theme before the first render.
try {
  if (localStorage.getItem('darkMode') === 'true') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
} catch {
  // Storage may be unavailable in restricted browser contexts.
}

window.addEventListener('hashchange', () => { void navigate(); });

// Re-verify roles after login/logout or account changes in another tab.
window.addEventListener('storage', event => {
  if (event.key === 'token' || event.key === 'user' || event.key === null) {
    void navigate();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { void navigate(); }, {
    once: true
  });
} else {
  void navigate();
}
```

## `server/routes/packages.js`

```javascript
import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';

const router = Router();
const STAFF_ROLES = new Set(['teacher', 'admin']);
const STORE_FIELDS = new Set([
  'name', 'governorate', 'address', 'phone', 'whatsapp', 'is_active'
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendError(res, error) {
  if (res.headersSent) return;

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error('Packages route error:', error);
  res.status(500).json({ error: 'حدث خطأ داخلي. يرجى المحاولة مرة أخرى.' });
}

function handle(handler) {
  return (req, res) => {
    try {
      handler(req, res);
    } catch (error) {
      sendError(res, error);
    }
  };
}

function parseId(value) {
  const text = String(value ?? '');
  const id = Number(text);

  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(id)) {
    throw new HttpError(400, 'معرّف غير صالح');
  }

  return id;
}

function currentUser(req) {
  if (!req.user) return null;

  const id = Number(req.user.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  // Always use the current database role, not a client-supplied or stale role.
  return db.prepare('SELECT id, role FROM users WHERE id = ?').get(id) || null;
}

function requireRoles(...roles) {
  const allowed = new Set(roles);

  return (req, res, next) => {
    try {
      const user = currentUser(req);
      if (!user) throw new HttpError(401, 'يرجى تسجيل الدخول');
      if (!allowed.has(user.role)) {
        throw new HttpError(403, 'غير مصرح لك بتنفيذ هذا الإجراء');
      }

      req.currentUser = user;
      next();
    } catch (error) {
      sendError(res, error);
    }
  };
}

const staffOnly = requireRoles('teacher', 'admin');
const studentOnly = requireRoles('student');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Run schema initialization once at module startup, never in request handlers.
// Existing tables and bookstore records are preserved.
db.exec(`
  CREATE TABLE IF NOT EXISTS bookstores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    governorate TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    whatsapp TEXT NOT NULL DEFAULT '',
    rating REAL NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
    reviews_count INTEGER NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookstore_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL REFERENCES bookstores(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL
      CHECK (typeof(rating) = 'integer' AND rating BETWEEN 1 AND 5),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS bookstore_ratings_user_id_idx
    ON bookstore_ratings(user_id);
`);

const VALID_RATING_CONDITION = `
  u.role = 'student'
  AND typeof(br.rating) = 'integer'
  AND br.rating BETWEEN 1 AND 5
`;

const STORE_SELECT = `
  SELECT
    b.id,
    b.name,
    b.governorate,
    b.address,
    b.phone,
    b.whatsapp,
    b.is_active,
    COALESCE(stats.rating, 0) AS rating,
    COALESCE(stats.reviews_count, 0) AS reviews_count,
    mine.rating AS my_rating
  FROM bookstores b
  LEFT JOIN (
    SELECT
      br.store_id,
      ROUND(AVG(br.rating), 1) AS rating,
      COUNT(*) AS reviews_count
    FROM bookstore_ratings br
    INNER JOIN users u ON u.id = br.user_id
    WHERE ${VALID_RATING_CONDITION}
    GROUP BY br.store_id
  ) stats ON stats.store_id = b.id
  LEFT JOIN bookstore_ratings mine
    ON mine.store_id = b.id
    AND mine.user_id = ?
    AND typeof(mine.rating) = 'integer'
    AND mine.rating BETWEEN 1 AND 5
`;

// Remove fabricated legacy aggregate values from the cached columns.
// Public responses also calculate aggregates directly from real student rows.
db.prepare(`
  UPDATE bookstores
  SET
    rating = COALESCE((
      SELECT ROUND(AVG(br.rating), 1)
      FROM bookstore_ratings br
      INNER JOIN users u ON u.id = br.user_id
      WHERE br.store_id = bookstores.id AND ${VALID_RATING_CONDITION}
    ), 0),
    reviews_count = (
      SELECT COUNT(*)
      FROM bookstore_ratings br
      INNER JOIN users u ON u.id = br.user_id
      WHERE br.store_id = bookstores.id AND ${VALID_RATING_CONDITION}
    )
`).run();

function getStore(id) {
  return db.prepare(`${STORE_SELECT} WHERE b.id = ?`).get(0, id) || null;
}

function updateStoreStats(id) {
  const stats = db.prepare(`
    SELECT COUNT(*) AS reviews_count, ROUND(AVG(br.rating), 1) AS rating
    FROM bookstore_ratings br
    INNER JOIN users u ON u.id = br.user_id
    WHERE br.store_id = ? AND ${VALID_RATING_CONDITION}
  `).get(id);

  const rating = stats.rating ?? 0;
  const count = stats.reviews_count;

  db.prepare(`
    UPDATE bookstores SET rating = ?, reviews_count = ? WHERE id = ?
  `).run(rating, count, id);

  return { rating, reviews_count: count };
}

function queryText(value, label, maxLength) {
  if (value === undefined) return '';
  if (typeof value !== 'string') {
    throw new HttpError(400, `${label} غير صالح`);
  }

  const text = value.trim();
  if (text.length > maxLength) {
    throw new HttpError(400, `${label} أطول من الحد المسموح`);
  }
  return text;
}

function requiredText(value, label, maxLength) {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${label} مطلوب`);
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    throw new HttpError(400, `${label} يحتوي على محارف غير صالحة`);
  }

  const text = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (text.length < 2 || text.length > maxLength) {
    throw new HttpError(400, `${label} يجب أن يكون بين 2 و${maxLength} حرفاً`);
  }
  return text;
}

function normalizePhone(value, label) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > 40) {
    throw new HttpError(400, `${label} غير صالح`);
  }

  const raw = value.normalize('NFKC')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06F0))
    .trim();

  if (!raw) return '';
  if (!/^\+?[\d\s().-]+$/.test(raw)) {
    throw new HttpError(400, `${label} غير صالح`);
  }

  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (!raw.startsWith('+') && digits.startsWith('0')) {
    digits = `20${digits.slice(1)}`;
  } else if (!raw.startsWith('+') && /^1[0125]\d{8}$/.test(digits)) {
    digits = `20${digits}`;
  }

  if (!/^[1-9]\d{6,14}$/.test(digits)) {
    throw new HttpError(400, `${label} يجب أن يكون رقماً محلياً صحيحاً أو دولياً`);
  }

  return `+${digits}`;
}

function activeValue(value) {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  throw new HttpError(400, 'حالة التفعيل يجب أن تكون true أو false أو 1 أو 0');
}

function validateStorePayload(input, existing = null, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'بيانات المكتبة غير صالحة');
  }

  const keys = Object.keys(input);
  if (keys.some(key => !STORE_FIELDS.has(key))) {
    throw new HttpError(400, 'الطلب يحتوي على حقول غير مسموح بتعديلها');
  }
  if (partial && keys.length === 0) {
    throw new HttpError(400, 'أرسل حقلاً واحداً على الأقل للتعديل');
  }

  const value = (key, fallback) => {
    if (Object.prototype.hasOwnProperty.call(input, key)) return input[key];
    if (partial && existing) return existing[key];
    return fallback;
  };

  const store = {
    name: requiredText(value('name'), 'اسم المكتبة', 120),
    governorate: requiredText(value('governorate'), 'المحافظة', 80),
    address: requiredText(value('address'), 'العنوان', 500),
    phone: normalizePhone(value('phone', ''), 'رقم الهاتف'),
    whatsapp: normalizePhone(value('whatsapp', ''), 'رقم واتساب'),
    is_active: activeValue(value('is_active', existing?.is_active ?? 1))
  };

  if (store.governorate === 'الكل') {
    throw new HttpError(400, 'يرجى إدخال اسم محافظة حقيقي');
  }

  return store;
}

function listStores(req, res, management) {
  const user = management ? req.currentUser : currentUser(req);
  const viewerId = user?.role === 'student' ? user.id : 0;
  const governorate = queryText(req.query.governorate, 'المحافظة', 80);
  const query = queryText(req.query.q, 'كلمات البحث', 120);
  const conditions = [];
  const parameters = [];

  if (!management) {
    // Query parameters can never expose inactive stores publicly.
    conditions.push('b.is_active = 1');
  } else {
    const status = queryText(req.query.status, 'حالة المنفذ', 20) || 'all';
    if (!['all', 'active', 'inactive'].includes(status)) {
      throw new HttpError(400, 'حالة المنفذ غير صالحة');
    }
    if (status !== 'all') {
      conditions.push('b.is_active = ?');
      parameters.push(status === 'active' ? 1 : 0);
    }
  }

  if (governorate && governorate !== 'الكل') {
    conditions.push('b.governorate = ?');
    parameters.push(governorate);
  }

  if (query) {
    const escapedQuery = query.replace(/[\\%_]/g, character => `\\${character}`);
    const term = `%${escapedQuery}%`;
    conditions.push(`
      (
        b.name LIKE ? ESCAPE '\\'
        OR b.address LIKE ? ESCAPE '\\'
        OR b.governorate LIKE ? ESCAPE '\\'
      )
    `);
    parameters.push(term, term, term);
  }

  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const order = management
    ? ' ORDER BY b.is_active DESC, b.governorate, b.name, b.id'
    : ' ORDER BY rating DESC, reviews_count DESC, b.name, b.id';

  const stores = db.prepare(`${STORE_SELECT}${where}${order}`)
    .all(viewerId, ...parameters);

  const governorates = db.prepare(`
    SELECT DISTINCT governorate
    FROM bookstores
    ${management ? '' : 'WHERE is_active = 1'}
    ORDER BY governorate
  `).all().map(row => row.governorate).filter(Boolean);

  res.json({
    stores,
    governorates: ['الكل', ...governorates]
  });
}

// ==========================================
// BOOKSTORES
// Register these before the generic package /:id route.
// ==========================================

// Public/student directory: active stores only.
router.get(['/stores', '/stores/all'], optionalAuth, handle((req, res) => {
  listStores(req, res, false);
}));

// Staff directory: includes inactive stores.
router.get('/stores/manage', authMiddleware, staffOnly, handle((req, res) => {
  listStores(req, res, true);
}));

// Staff: read a single store, including inactive records.
router.get('/stores/:id', authMiddleware, staffOnly, handle((req, res) => {
  const store = getStore(parseId(req.params.id));
  if (!store) throw new HttpError(404, 'المكتبة غير موجودة');
  res.json({ store });
}));

// Staff: create.
router.post('/stores', authMiddleware, staffOnly, handle((req, res) => {
  const input = validateStorePayload(req.body);

  const store = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO bookstores (
        name, governorate, address, phone, whatsapp,
        is_active, rating, reviews_count
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, 0)
    `).run(
      input.name,
      input.governorate,
      input.address,
      input.phone,
      input.whatsapp,
      input.is_active
    );

    return getStore(Number(result.lastInsertRowid));
  }).immediate();

  res.location(`${req.baseUrl}/stores/${store.id}`);
  res.status(201).json({ message: 'تمت إضافة المكتبة بنجاح', store });
}));

function updateStore(req, res, partial) {
  const id = parseId(req.params.id);

  const store = db.transaction(() => {
    const existing = getStore(id);
    if (!existing) throw new HttpError(404, 'المكتبة غير موجودة');

    const input = validateStorePayload(req.body, existing, partial);
    db.prepare(`
      UPDATE bookstores
      SET name = ?, governorate = ?, address = ?,
          phone = ?, whatsapp = ?, is_active = ?
      WHERE id = ?
    `).run(
      input.name,
      input.governorate,
      input.address,
      input.phone,
      input.whatsapp,
      input.is_active,
      id
    );

    return getStore(id);
  }).immediate();

  res.json({ message: 'تم تحديث المكتبة بنجاح', store });
}

// Staff: full update of required text fields.
router.put('/stores/:id', authMiddleware, staffOnly, handle((req, res) => {
  updateStore(req, res, false);
}));

// Staff: partial update, useful for activation/deactivation.
router.patch('/stores/:id', authMiddleware, staffOnly, handle((req, res) => {
  updateStore(req, res, true);
}));

// Staff: hard delete. Ratings are explicitly removed even if an existing
// deployment has not enabled SQLite foreign-key enforcement.
router.delete('/stores/:id', authMiddleware, staffOnly, handle((req, res) => {
  const id = parseId(req.params.id);

  db.transaction(() => {
    const existing = db.prepare('SELECT id FROM bookstores WHERE id = ?').get(id);
    if (!existing) throw new HttpError(404, 'المكتبة غير موجودة');

    db.prepare('DELETE FROM bookstore_ratings WHERE store_id = ?').run(id);
    db.prepare('DELETE FROM bookstores WHERE id = ?').run(id);
  }).immediate();

  res.json({ message: 'تم حذف المكتبة بنجاح', id });
}));

// Students only: one rating per student/store, updated atomically.
router.post(
  '/stores/:id/rate',
  authMiddleware,
  studentOnly,
  handle((req, res) => {
    const id = parseId(req.params.id);
    const rating = req.body?.rating;

    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpError(400, 'التقييم يجب أن يكون عدداً صحيحاً من 1 إلى 5');
    }

    const stats = db.transaction(() => {
      const store = db.prepare(`
        SELECT id FROM bookstores WHERE id = ? AND is_active = 1
      `).get(id);
      if (!store) {
        throw new HttpError(404, 'المكتبة غير موجودة أو غير مفعّلة');
      }

      db.prepare(`
        INSERT INTO bookstore_ratings (store_id, user_id, rating)
        VALUES (?, ?, ?)
        ON CONFLICT(store_id, user_id)
        DO UPDATE SET rating = excluded.rating
      `).run(id, req.currentUser.id, rating);

      return updateStoreStats(id);
    }).immediate();

    res.json({
      message: 'تم تسجيل تقييمك بنجاح',
      new_rating: stats.rating,
      reviews_count: stats.reviews_count,
      user_rating: rating
    });
  })
);

// ==========================================
// PACKAGES
// ==========================================

function packageCourseIds(pkg, strict = false) {
  try {
    const parsed = JSON.parse(pkg.course_ids || '[]');
    if (!Array.isArray(parsed) || parsed.length > 500) throw new Error('Invalid course list');

    const ids = parsed.map(value => {
      if (
        !(
          (typeof value === 'number' && Number.isSafeInteger(value)) ||
          (typeof value === 'string' && /^[1-9]\d*$/.test(value))
        )
      ) {
        throw new Error('Invalid course ID');
      }

      const id = Number(value);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid course ID');
      return id;
    });

    return [...new Set(ids)];
  } catch {
    if (strict) {
      throw new HttpError(409, 'محتويات الباقة غير متاحة حالياً');
    }
    return [];
  }
}

function packageCourses(ids, detailed = false) {
  if (!ids.length) return [];

  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`
    SELECT
      id, title, price, thumbnail${detailed ? ', description' : ''},
      (SELECT COUNT(*) FROM lessons WHERE course_id = courses.id) AS lessons_count,
      (SELECT COUNT(*) FROM exams WHERE course_id = courses.id) AS exams_count
    FROM courses
    WHERE id IN (${placeholders})
    ORDER BY id
  `).all(...ids);
}

function hydratePackage(pkg, user, detailed = false) {
  const courseIds = packageCourseIds(pkg);
  const courses = packageCourses(courseIds, detailed);
  const enrollment = user?.role === 'student'
    ? db.prepare(`
      SELECT expires_at
      FROM package_enrollments
      WHERE user_id = ? AND package_id = ?
    `).get(user.id, pkg.id)
    : null;

  const totalRegularPrice = Math.round(courses.reduce((sum, course) => {
    const price = Number(course.price);
    return sum + (Number.isFinite(price) && price >= 0 ? price : 0);
  }, 0) * 100) / 100;

  const originalPrice = Number(pkg.original_price);
  const price = Number(pkg.price);
  const discountPercent =
    Number.isFinite(originalPrice) &&
    Number.isFinite(price) &&
    originalPrice > 0 &&
    price >= 0 &&
    originalPrice > price
      ? Math.min(100, Math.round(((originalPrice - price) / originalPrice) * 100))
      : 0;

  return {
    ...pkg,
    course_ids: courseIds,
    courses,
    total_regular_price: totalRegularPrice,
    discount_percent: discountPercent,
    is_enrolled: Boolean(enrollment),
    expires_at: enrollment?.expires_at ?? null
  };
}

function money(value) {
  const amount = Number(value);
  const cents = Math.round(amount * 100);

  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isSafeInteger(cents)
  ) {
    throw new HttpError(409, 'قيمة مالية غير صالحة. يرجى التواصل مع الإدارة.');
  }

  return cents / 100;
}

// Active package list.
router.get('/', optionalAuth, handle((req, res) => {
  const user = currentUser(req);
  const packages = db.prepare(`
    SELECT * FROM packages WHERE is_active = 1 ORDER BY created_at DESC, id DESC
  `).all();

  res.json(packages.map(pkg => hydratePackage(pkg, user)));
}));

// Public/student reads cannot expose inactive packages.
router.get('/:id', optionalAuth, handle((req, res) => {
  const id = parseId(req.params.id);
  const user = currentUser(req);
  const staff = user && STAFF_ROLES.has(user.role);

  const pkg = db.prepare(`
    SELECT * FROM packages
    WHERE id = ? ${staff ? '' : 'AND is_active = 1'}
  `).get(id);

  if (!pkg) throw new HttpError(404, 'الباقة غير موجودة');
  res.json(hydratePackage(pkg, user, true));
}));

// Students only: subscribe using wallet balance or a wallet voucher.
router.post(
  '/:id/subscribe',
  authMiddleware,
  studentOnly,
  handle((req, res) => {
    const id = parseId(req.params.id);
    const body = req.body ?? {};

    if (typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'بيانات الاشتراك غير صالحة');
    }

    const paymentMethod = body.payment_method ?? 'wallet';
    if (!['wallet', 'voucher'].includes(paymentMethod)) {
      throw new HttpError(400, 'طريقة الدفع غير صالحة');
    }

    const userId = req.currentUser.id;

    const result = db.transaction(() => {
      const pkg = db.prepare(`
        SELECT * FROM packages WHERE id = ? AND is_active = 1
      `).get(id);
      if (!pkg) throw new HttpError(404, 'الباقة غير متاحة حالياً');

      // Recheck inside the write transaction to prevent duplicate charging.
      const existing = db.prepare(`
        SELECT 1 FROM package_enrollments
        WHERE user_id = ? AND package_id = ?
      `).get(userId, pkg.id);

      if (existing) {
        throw new HttpError(409, 'أنت مشترك بالفعل في هذه الباقة');
      }

      const courseIds = packageCourseIds(pkg, true);
      if (!courseIds.length) {
        throw new HttpError(409, 'لا توجد كورسات متاحة داخل هذه الباقة');
      }

      const courses = packageCourses(courseIds);
      if (courses.length !== courseIds.length) {
        throw new HttpError(409, 'بعض محتويات الباقة غير متاحة حالياً');
      }

      const price = money(pkg.price);

      db.prepare(`
        INSERT INTO student_wallets (user_id, balance)
        VALUES (?, 0)
        ON CONFLICT(user_id) DO NOTHING
      `).run(userId);

      const wallet = db.prepare(`
        SELECT balance FROM student_wallets WHERE user_id = ?
      `).get(userId);

      const currentBalance = money(wallet.balance);

      if (paymentMethod === 'voucher') {
        if (
          typeof body.voucher_code !== 'string' ||
          !body.voucher_code.trim() ||
          body.voucher_code.length > 128
        ) {
          throw new HttpError(400, 'يرجى إدخال كود كارت صالح');
        }

        const code = body.voucher_code.trim().toUpperCase();
        const voucher = db.prepare(`
          SELECT * FROM wallet_vouchers WHERE code = ?
        `).get(code);

        if (!voucher) throw new HttpError(400, 'كود الكارت غير صحيح');
        if (Number(voucher.is_used) !== 0) {
          throw new HttpError(409, 'تم استخدام هذا الكود مسبقاً');
        }

        const amount = money(voucher.amount);
        if (amount <= 0 || amount < price) {
          throw new HttpError(
            400,
            `قيمة الكارت (${amount} ج) أقل من سعر الباقة (${price} ج)`
          );
        }

        const redemption = db.prepare(`
          UPDATE wallet_vouchers
          SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP
          WHERE id = ? AND is_used = 0
        `).run(userId, voucher.id);

        if (redemption.changes !== 1) {
          throw new HttpError(409, 'تم استخدام هذا الكود مسبقاً');
        }

        // Credit the entire voucher, then debit the package price.
        // Any excess value remains in the student's wallet and is audited.
        db.prepare(`
          UPDATE student_wallets
          SET balance = ROUND(balance + ?, 2), updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(amount, userId);

        db.prepare(`
          INSERT INTO wallet_transactions (user_id, amount, type, description)
          VALUES (?, ?, 'credit', ?)
        `).run(userId, amount, 'شحن كارت للاشتراك في باقة');
      } else if (currentBalance < price) {
        throw new HttpError(
          400,
          `رصيدك الحالي (${currentBalance} ج) غير كافٍ. سعر الباقة ${price} ج.`
        );
      }

      const deduction = db.prepare(`
        UPDATE student_wallets
        SET balance = ROUND(balance - ?, 2), updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND balance >= ?
      `).run(price, userId, price);

      if (deduction.changes !== 1) {
        throw new HttpError(409, 'الرصيد غير كافٍ لإتمام الاشتراك');
      }

      db.prepare(`
        INSERT INTO wallet_transactions (user_id, amount, type, description)
        VALUES (?, ?, 'debit', ?)
      `).run(userId, -price, `اشتراك في ${pkg.title}`);

      // Preserve the platform's existing no-expiration package policy.
      db.prepare(`
        INSERT INTO package_enrollments (user_id, package_id, expires_at)
        VALUES (?, ?, NULL)
      `).run(userId, pkg.id);

      const enrollCourse = db.prepare(`
        INSERT INTO enrollments (user_id, course_id, expires_at)
        VALUES (?, ?, NULL)
        ON CONFLICT(user_id, course_id)
        DO UPDATE SET expires_at = NULL, is_suspended = 0
      `);

      courseIds.forEach(courseId => enrollCourse.run(userId, courseId));

      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, 'success')
      `).run(
        userId,
        'تم تفعيل باقة الكيمياء الشاملة! 🎉',
        `تم تفعيل اشتراكك في "${pkg.title}". جميع كورسات الباقة متاحة دون انتهاء صلاحية.`
      );

      const updatedWallet = db.prepare(`
        SELECT balance FROM student_wallets WHERE user_id = ?
      `).get(userId);

      return {
        package_title: pkg.title,
        wallet_balance: money(updatedWallet.balance)
      };
    }).immediate();

    res.json({
      message: 'تم تفعيل الباقة بنجاح، وجميع محاضراتها متاحة دون انتهاء صلاحية!',
      ...result
    });
  })
);

export default router;
```

### Resulting bookstore API

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/packages/stores/all` | Public; active stores only |
| GET | `/api/packages/stores/manage` | Teacher/Admin; includes inactive stores |
| GET | `/api/packages/stores/:id` | Teacher/Admin |
| POST | `/api/packages/stores` | Teacher/Admin |
| PUT / PATCH | `/api/packages/stores/:id` | Teacher/Admin |
| DELETE | `/api/packages/stores/:id` | Teacher/Admin |
| POST | `/api/packages/stores/:id/rate` | Student only |

The code also removes fabricated rating defaults, fixes Egyptian WhatsApp links, escapes dynamic HTML, removes inline event handlers, and cleans up navbar listeners between navigations.

**Deployment:** back up the database before deploying—the startup aggregate correction replaces legacy cached rating/count values with actual student-rating statistics. Other server-side admin routers must independently enforce equivalent role checks. These replacements have not been executed against the unavailable remainder of the workspace.