import { api } from '../utils/api.js';
import { setAuth } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { gradesList, esc } from '../utils/helpers.js';
import drZiadImg from '../assets/dr-ziad.png';
import zraLogoFace from '../assets/zra-logo-face.png';
import zraLogoText from '../assets/zra-logo-text.png';

function normalizeDigits(str) {
  if (!str) return '';
  return String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/\s|-/g, '');
}

function showInlineAuthAlert(boxId, message, type = 'error') {
  const box = document.getElementById(boxId);
  if (!box) return;
  if (!message) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  const isError = type === 'error';
  const isSuccess = type === 'success';
  const bg = isSuccess ? 'rgba(16, 185, 129, 0.12)' : isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.12)';
  const border = isSuccess ? '#10b981' : isError ? '#ef4444' : '#f59e0b';
  const color = isSuccess ? '#047857' : isError ? '#dc2626' : '#b45309';
  const icon = isSuccess ? 'check_circle' : isError ? 'error' : 'warning';
  box.style.display = 'flex';
  box.style.cssText = `display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;background:${bg};border:1.5px solid ${border};color:${color};font-size:0.88rem;font-weight:700;margin-bottom:16px;line-height:1.5;`;
  box.innerHTML = `<span class="material-symbols-rounded" style="font-size:1.3rem;flex-shrink:0;">${icon}</span><span>${esc(message)}</span>`;
}

export function renderLogin() {
  return `
  <div class="auth-page-sakr">
    <div class="auth-card-sakr">
      
      <!-- Right Side: Form (RTL Start) -->
      <div class="auth-form-col">
        <div class="auth-top-nav" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <a href="/" class="auth-back-link">
            <span class="material-symbols-rounded">arrow_forward</span> العودة للرئيسية
          </a>
          <a href="/parent-portal" class="btn btn-outline btn-sm" style="gap:6px; font-weight:800; border-radius:10px;">
            <span class="material-symbols-rounded" style="font-size:1.1rem;">family_restroom</span> بوابة ولي الأمر
          </a>
        </div>
        
        <div class="auth-form-header">
          <div class="auth-form-logo">
            <img src="${zraLogoFace}" alt="Z.R.A" class="logo-face-img" style="height: 44px;" />
            <img src="${zraLogoText}" alt="Z.R.A" class="logo-text-img" style="height: 32px;" />
          </div>
          <h1 class="auth-form-title">أهلاً بك مجدداً! جاهز للمذاكرة؟</h1>
          <p class="auth-form-subtitle">سجّل دخولك للوصول إلى لوحة التحكم والمحاضرات والامتحانات</p>
        </div>

        <div id="loginAlertBox" style="display:none;"></div>

        <form id="loginForm" novalidate>
          <div class="sakr-input-group">
            <label class="sakr-input-label" for="loginPhone">رقم الهاتف المسجل</label>
            <div class="sakr-input-wrap">
              <span class="material-symbols-rounded input-icon">phone_iphone</span>
              <input type="tel" inputmode="numeric" autocomplete="tel" class="sakr-input-field" id="loginPhone" placeholder="010xxxxxxxx" required dir="ltr">
            </div>
          </div>

          <div class="sakr-input-group" style="margin-bottom: 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 7px;">
              <label class="sakr-input-label" for="loginPassword" style="margin-bottom:0;">كلمة المرور</label>
            </div>
            <div class="sakr-input-wrap">
              <span class="material-symbols-rounded input-icon">lock</span>
              <input type="password" autocomplete="current-password" class="sakr-input-field has-toggle" id="loginPassword" placeholder="أدخل كلمة المرور" required>
              <button type="button" id="toggleLoginPassword" class="sakr-toggle-pw" title="إظهار/إخفاء كلمة المرور">
                <span class="material-symbols-rounded" style="font-size: 1.25rem;">visibility</span>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-sakr-submit" id="loginBtn">
            <span class="material-symbols-rounded">login</span> تسجيل الدخول الآن
          </button>
        </form>

        <div class="auth-switch-box">
          طالب جديد بالمنصة؟ <a href="/register" class="auth-switch-link">أنشئ حساباً جديداً الآن</a>
        </div>
      </div>

      <!-- Left Side: Interactive Visual Poster -->
      <div class="auth-poster-col">
        <div class="auth-poster-badge-wrap">
          <span class="auth-poster-pill">
            <span class="material-symbols-rounded" style="font-size:1.15rem; color:#86efac;">science</span> منصة الكيمياء التفاعلية
          </span>
          <span class="auth-poster-pill">
            <span class="material-symbols-rounded" style="font-size:1.15rem; color:#fde047;">verified</span> نظام المتابعة الكاملة
          </span>
        </div>

        <div class="auth-poster-center">
          <div class="auth-teacher-frame">
            <img src="${drZiadImg}" alt="د. زياد رمزي عياد" class="auth-teacher-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%2316a34a%22/></svg>'" />
          </div>
          <h2 class="auth-poster-title">انضم لمجتمع المتفوقين مع د. زياد رمزي عياد</h2>
          <p class="auth-poster-desc">تعلّم الكيمياء بأسلوب ممتع يجمع بين الفهم العميق، المختبر الكيميائي، وحل الأسئلة الوزارية.</p>
        </div>

        <div class="auth-poster-footer">
          <div class="auth-quote-text">"الكيمياء مش حفظ معادلات.. الكيمياء فهم وإبداع."</div>
          <div class="auth-quote-author">— د. زياد رمزي عياد</div>
        </div>
      </div>

    </div>
  </div>
  `;
}

export function initLogin() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const toggleBtn = document.getElementById('toggleLoginPassword');
  const passwordInput = document.getElementById('loginPassword');
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      toggleBtn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 1.25rem;">${type === 'password' ? 'visibility' : 'visibility_off'}</span>`;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    if (!btn || btn.disabled) return;

    showInlineAuthAlert('loginAlertBox', '');
    const phone = normalizeDigits(document.getElementById('loginPhone')?.value || '');
    const password = document.getElementById('loginPassword')?.value || '';

    if (!phone || !password) {
      const msg = 'يرجى إدخال رقم الهاتف وكلمة المرور';
      showInlineAuthAlert('loginAlertBox', msg, 'warning');
      showToast(msg, 'warning');
      return;
    }

    if (!/^01[0125][0-9]{8}$/.test(phone)) {
      const msg = 'رقم الهاتف يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015';
      showInlineAuthAlert('loginAlertBox', msg, 'warning');
      showToast(msg, 'warning');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري تسجيل الدخول...';

    try {
      let deviceId = localStorage.getItem('chem_device_id');
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 12);
        localStorage.setItem('chem_device_id', deviceId);
      }
      const deviceName = /Mobi|Android/i.test(navigator.userAgent) ? 'موبايل' : 'كمبيوتر / لابتوب';

      const data = await api.login({ phone, password, device_id: deviceId, device_name: deviceName });
      setAuth(data.user, data.token);
      showInlineAuthAlert('loginAlertBox', `مرحباً بك ${data.user.name}! جاري تحويلك للوحة التحكم...`, 'success');
      showToast(`مرحباً بك ${data.user.name.split(' ')[0]}!`, 'success');
      const isT = data.user.role === 'teacher' || data.user.role === 'admin';
      const target = isT ? '/admin' : '/dashboard';
      if (typeof window.navigateTo === 'function') {
        window.navigateTo(target, true);
      } else {
        window.location.href = target;
      }
    } catch (err) {
      const errMsg = err.message || 'تعذر تسجيل الدخول، تأكد من رقم الهاتف وكلمة المرور';
      showInlineAuthAlert('loginAlertBox', errMsg, 'error');
      showToast(errMsg, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded">login</span> تسجيل الدخول الآن';
      }
    }
  });
}

export function renderRegister() {
  const gradeDescriptions = {
    'أولى إعدادي': 'الصف الأول الإعدادي',
    'ثانية إعدادي': 'الصف الثاني الإعدادي',
    'ثالثة إعدادي': 'الصف الثالث الإعدادي',
    'أولى ثانوي': 'الصف الأول الثانوي',
    'ثانية ثانوي': 'الصف الثاني الثانوي',
    'ثالثة ثانوي': 'الصف الثالث الثانوي',
  };

  return `
  <div class="auth-page-sakr">
    <div class="auth-card-sakr">
      
      <!-- Right Side: Form (RTL Start) -->
      <div class="auth-form-col">
        <div class="auth-top-nav">
          <a href="/" class="auth-back-link">
            <span class="material-symbols-rounded">arrow_forward</span> العودة للرئيسية
          </a>
        </div>
        
        <div class="auth-form-header">
          <div class="auth-form-logo">
            <img src="${zraLogoFace}" alt="Z.R.A" class="logo-face-img" style="height: 44px;" />
            <img src="${zraLogoText}" alt="Z.R.A" class="logo-text-img" style="height: 32px;" />
          </div>
          <h1 class="auth-form-title">إنشاء حساب طالب جديد</h1>
          <p class="auth-form-subtitle">سجّل بياناتك الآن لتفعيل حسابك والوصول للكورسات والمحاضرات فوراً</p>
        </div>

        <div id="regAlertBox" style="display:none;"></div>

        <form id="registerForm" novalidate>
          <div class="sakr-input-group">
            <label class="sakr-input-label" for="regName">الاسم بالكامل <span style="color:var(--danger);">*</span></label>
            <div class="sakr-input-wrap">
              <span class="material-symbols-rounded input-icon">person</span>
              <input type="text" autocomplete="name" class="sakr-input-field" id="regName" placeholder="اكتب اسمك الثلاثي باللغة العربية" required>
            </div>
          </div>
          
          <div class="auth-phone-grid">
            <div class="sakr-input-group">
              <label class="sakr-input-label" for="regPhone">رقم هاتف الطالب <span style="color:var(--danger);">*</span></label>
              <div class="sakr-input-wrap">
                <span class="material-symbols-rounded input-icon">phone_iphone</span>
                <input type="tel" inputmode="numeric" autocomplete="tel" class="sakr-input-field" id="regPhone" placeholder="010xxxxxxxx" required dir="ltr">
              </div>
            </div>
            
            <div class="sakr-input-group">
              <label class="sakr-input-label" for="regParentPhone">رقم هاتف ولي الأمر <span style="color:var(--danger);">*</span></label>
              <div class="sakr-input-wrap">
                <span class="material-symbols-rounded input-icon">family_restroom</span>
                <input type="tel" inputmode="numeric" class="sakr-input-field" id="regParentPhone" placeholder="01xxxxxxxxx" required dir="ltr">
              </div>
            </div>
          </div>

          <div class="sakr-input-group">
            <label class="sakr-input-label" for="regGrade">المرحلة الدراسية <span style="color:var(--danger);">*</span></label>
            <div class="sakr-input-wrap">
              <span class="material-symbols-rounded input-icon">school</span>
              <select class="sakr-input-field" id="regGrade" required style="cursor: pointer;">
                ${gradesList.map(g => `<option value="${esc(g)}" ${g === 'ثالثة ثانوي' ? 'selected' : ''}>${esc(gradeDescriptions[g] || g)} (${esc(g)})</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="sakr-input-group" style="margin-bottom: 22px;">
            <label class="sakr-input-label" for="regPassword">كلمة المرور <span style="font-size:0.74rem;color:var(--text-muted);font-weight:500;">(6 أحرف أو أرقام على الأقل)</span></label>
            <div class="sakr-input-wrap">
              <span class="material-symbols-rounded input-icon">lock</span>
              <input type="password" autocomplete="new-password" class="sakr-input-field has-toggle" id="regPassword" placeholder="اكتب كلمة مرور سهلة التذكر (6+)" required minlength="6">
              <button type="button" id="toggleRegPassword" class="sakr-toggle-pw" title="إظهار/إخفاء كلمة المرور">
                <span class="material-symbols-rounded" style="font-size: 1.25rem;">visibility</span>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-sakr-submit" id="regBtn">
            <span class="material-symbols-rounded">person_add</span> إنشاء حسابي والدخول للمنصة
          </button>
        </form>

        <div class="auth-switch-box">
          لديك حساب بالفعل؟ <a href="/login" class="auth-switch-link">تسجيل الدخول من هنا</a>
        </div>
      </div>

      <!-- Left Side: Interactive Visual Poster -->
      <div class="auth-poster-col">
        <div class="auth-poster-badge-wrap">
          <span class="auth-poster-pill">
            <span class="material-symbols-rounded" style="font-size:1.15rem; color:#86efac;">local_library</span> شروحات حصرية
          </span>
          <span class="auth-poster-pill">
            <span class="material-symbols-rounded" style="font-size:1.15rem; color:#fde047;">quiz</span> امتحانات تفاعلية دورية
          </span>
        </div>

        <div class="auth-poster-center">
          <div class="auth-teacher-frame">
            <img src="${drZiadImg}" alt="د. زياد رمزي عياد" class="auth-teacher-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%2316a34a%22/></svg>'" />
          </div>
          <h2 class="auth-poster-title">خطوتك الأولى نحو التميز والتفوق</h2>
          <p class="auth-poster-desc">احصل على تجربة تعليمية متكاملة تتضمن فيديوهات بجودة عالية، مختبر كيميائي افتراضي، ومتابعة فردية مستمرة.</p>
        </div>

        <div class="auth-poster-footer">
          <div class="auth-quote-text">"طريق الـ 60 يبدأ بخطوة التزام واحدة."</div>
          <div class="auth-quote-author">— د. زياد رمزي عياد</div>
        </div>
      </div>

    </div>
  </div>
  `;
}

export function initRegister() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  const toggleBtn = document.getElementById('toggleRegPassword');
  const passwordInput = document.getElementById('regPassword');
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      toggleBtn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 1.25rem;">${type === 'password' ? 'visibility' : 'visibility_off'}</span>`;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('regBtn');
    if (!btn || btn.disabled) return;

    showInlineAuthAlert('regAlertBox', '');
    const parentPhone = normalizeDigits(document.getElementById('regParentPhone')?.value || '');
    const studentPhone = normalizeDigits(document.getElementById('regPhone')?.value || '');
    const grade = document.getElementById('regGrade')?.value || 'ثالثة ثانوي';
    const name = (document.getElementById('regName')?.value || '').trim();
    const password = passwordInput?.value || '';

    if (!name || name.length < 2) {
      const msg = 'يرجى إدخال اسمك الثلاثي بالكامل';
      showInlineAuthAlert('regAlertBox', msg, 'warning');
      showToast(msg, 'warning');
      return;
    }

    if (!/^01[0125][0-9]{8}$/.test(studentPhone)) {
      const msg = 'يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015';
      showInlineAuthAlert('regAlertBox', msg, 'warning');
      showToast(msg, 'warning');
      return;
    }

    if (!parentPhone || !/^01[0125][0-9]{8}$/.test(parentPhone)) {
      const msg = 'يرجى إدخال رقم هاتف ولي الأمر (إجباري، 11 رقماً يبدأ بـ 01)';
      showInlineAuthAlert('regAlertBox', msg, 'warning');
      showToast(msg, 'warning');
      return;
    }

    if (parentPhone === studentPhone) {
      const msg = 'يرجى إدخال رقم هاتف لولي الأمر مختلف عن رقم هاتف الطالب الشخصي';
      showInlineAuthAlert('regAlertBox', msg, 'warning');
      showToast(msg, 'warning');
      return;
    }

    if (!password || password.length < 6) {
      const msg = 'كلمة المرور يجب أن تتكون من 6 أحرف أو أرقام على الأقل';
      showInlineAuthAlert('regAlertBox', msg, 'warning');
      showToast(msg, 'warning');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري إنشاء حسابك وتجهيز المنصة...';

    try {
      const data = await api.register({ name, phone: studentPhone, password, grade, parent_phone: parentPhone });
      setAuth(data.user, data.token);
      showInlineAuthAlert('regAlertBox', 'تم إنشاء حسابك بنجاح! جاري تحويلك للوحة التحكم...', 'success');
      showToast('تم إنشاء حسابك بنجاح! مرحباً بك في كيمياوي', 'success');
      if (typeof window.navigateTo === 'function') {
        window.navigateTo('/dashboard', true);
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      const errMsg = err.message || 'حدث خطأ أثناء إنشاء الحساب، حاول مرة أخرى';
      showInlineAuthAlert('regAlertBox', errMsg, 'error');
      showToast(errMsg, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded">person_add</span> إنشاء حسابي والدخول للمنصة';
      }
    }
  });
}
