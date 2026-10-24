import { api } from '../utils/api.js';
import { setAuth } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { gradesList } from '../utils/helpers.js';
import drZiadImg from '../assets/dr-ziad.png';
import zraLogoFace from '../assets/zra-logo-face.png';
import zraLogoText from '../assets/zra-logo-text.png';

function normalizeDigits(str) {
  if (!str) return '';
  return String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/\s|-/g, '');
}

export function renderLogin() {
  return `
  <div class="auth-page-sakr">
    <div class="auth-card-sakr">
      
      <!-- Right Side: Form (RTL Start) -->
      <div class="auth-form-col">
        <div class="auth-top-nav">
          <a href="#/" class="auth-back-link">
            <span class="material-symbols-rounded">arrow_forward</span> العودة للرئيسية
          </a>
        </div>
        
        <div class="auth-form-header">
          <div class="auth-form-logo">
            <img src="${zraLogoFace}" alt="Z.R.A" class="logo-face-img" style="height: 44px;" />
            <img src="${zraLogoText}" alt="Z.R.A" class="logo-text-img" style="height: 32px;" />
          </div>
          <h1 class="auth-form-title">أهلاً بك مجدداً! جاهز للمذاكرة؟</h1>
          <p class="auth-form-subtitle">سجّل دخولك للوصول إلى دروسك، امتحاناتك وواجباتك التفاعلية</p>
        </div>

        <form id="loginForm">
          <div class="sakr-input-group">
            <label class="sakr-input-label">رقم الهاتف</label>
            <div class="sakr-input-wrap">
              <span class="material-symbols-rounded input-icon">phone_iphone</span>
              <input type="tel" class="sakr-input-field" id="loginPhone" placeholder="01xxxxxxxxx" required dir="ltr">
            </div>
          </div>

          <div class="sakr-input-group" style="margin-bottom: 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 7px;">
              <label class="sakr-input-label" style="margin-bottom:0;">كلمة المرور</label>
            </div>
            <div class="sakr-input-wrap">
              <span class="material-symbols-rounded input-icon">lock</span>
              <input type="password" class="sakr-input-field has-toggle" id="loginPassword" placeholder="••••••••" required>
              <button type="button" id="toggleLoginPassword" class="sakr-toggle-pw" title="إظهار/إخفاء كلمة المرور">
                <span class="material-symbols-rounded" style="font-size: 1.25rem;">visibility</span>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-sakr-submit" id="loginBtn">
            <span class="material-symbols-rounded">login</span> تسجيل الدخول
          </button>
        </form>

        <div class="auth-switch-box">
          لا يوجد لديك حساب؟ <a href="#/register" class="auth-switch-link">أنشئ حسابك الآن !</a>
        </div>
      </div>

      <!-- Left Side: Interactive Visual Poster (Khaled Sakr Inspired, Platform Emerald Palette) -->
      <div class="auth-poster-col">
        <div class="auth-poster-badge-wrap">
          <span class="auth-poster-pill">
            <span class="material-symbols-rounded" style="font-size:1.15rem; color:#86efac;">science</span> منصة الكيمياء التفاعلية
          </span>
          <span class="auth-poster-pill">
            <span class="material-symbols-rounded" style="font-size:1.15rem; color:#fde047;">star</span> نظام الـ 60/60
          </span>
        </div>

        <div class="auth-poster-center">
          <div class="auth-teacher-frame">
            <img src="${drZiadImg}" alt="د. زياد رمزي عياد" class="auth-teacher-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%2316a34a%22/></svg>'" />
          </div>
          <h2 class="auth-poster-title">انضم لمجتمع المتفوقين مع د. زياد رمزي عياد</h2>
          <p class="auth-poster-desc">تعلّم الكيمياء بأسلوب ممتع وشيق يجمع بين الفهم العميق، التجارب التوضيحية، وحل آلاف الأسئلة الوزارية.</p>
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

  // Toggle Password Visibility
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
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري تسجيل الدخول...';
    
    try {
      let deviceId = localStorage.getItem('chem_device_id');
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 12);
        localStorage.setItem('chem_device_id', deviceId);
      }
      const deviceName = /Mobi|Android/i.test(navigator.userAgent) ? 'موبايل' : 'كمبيوتر / لابتوب';

      const data = await api.login({
        phone: normalizeDigits(document.getElementById('loginPhone').value),
        password: passwordInput.value,
        device_id: deviceId,
        device_name: deviceName
      });
      setAuth(data.user, data.token);
      showToast(`مرحباً بك ${data.user.name.split(' ')[0]}!`, 'success');
      const isT = data.user.role === 'teacher' || data.user.role === 'admin';
      window.location.hash = isT ? '#/admin' : '#/dashboard';
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-rounded">login</span> تسجيل الدخول';
    }
  });
}

export function renderRegister() {
  return `
  <div class="auth-page-sakr">
    <div class="auth-card-sakr">
      
      <!-- Right Side: Form (RTL Start) -->
      <div class="auth-form-col">
        <div class="auth-top-nav">
          <a href="#/" class="auth-back-link">
            <span class="material-symbols-rounded">arrow_forward</span> العودة للرئيسية
          </a>
        </div>
        
        <div class="auth-form-header">
          <div class="auth-form-logo">
            <img src="${zraLogoFace}" alt="Z.R.A" class="logo-face-img" style="height: 44px;" />
            <img src="${zraLogoText}" alt="Z.R.A" class="logo-text-img" style="height: 32px;" />
          </div>
          <h1 class="auth-form-title">طلب إنشاء حساب جديد :</h1>
          <p class="auth-form-subtitle">ادخل بياناتك بدقة لتفعيل حسابك ومتابعة دراستك فوراً</p>
        </div>

        <form id="registerForm">
          <div class="sakr-input-group">
            <label class="sakr-input-label">الاسم بالكامل</label>
            <div class="sakr-input-wrap">
              <span class="material-symbols-rounded input-icon">person</span>
              <input type="text" class="sakr-input-field" id="regName" placeholder="الاسم ثلاثي أو رباعي" required>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div class="sakr-input-group">
              <label class="sakr-input-label">رقم الهاتف</label>
              <div class="sakr-input-wrap">
                <span class="material-symbols-rounded input-icon">phone_iphone</span>
                <input type="tel" class="sakr-input-field" id="regPhone" placeholder="01xxxxxxxxx" required dir="ltr">
              </div>
            </div>
            
            <div class="sakr-input-group">
              <label class="sakr-input-label">رقم ولي الأمر</label>
              <div class="sakr-input-wrap">
                <span class="material-symbols-rounded input-icon">family_restroom</span>
                <input type="tel" class="sakr-input-field" id="regParentPhone" placeholder="01xxxxxxxxx" required dir="ltr">
              </div>
            </div>
          </div>

          <div class="sakr-input-group">
            <label class="sakr-input-label">المرحلة الدراسية</label>
            <div class="sakr-input-wrap">
              <span class="material-symbols-rounded input-icon">school</span>
              <select class="sakr-input-field" id="regGrade" required style="cursor: pointer;">
                <option value="">اختر المرحلة الدراسية</option>
                ${gradesList.map(g => `<option value="${g}">${g}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="sakr-input-group" style="margin-bottom: 22px;">
            <label class="sakr-input-label">كلمة المرور</label>
            <div class="sakr-input-wrap">
              <span class="material-symbols-rounded input-icon">lock</span>
              <input type="password" class="sakr-input-field has-toggle" id="regPassword" placeholder="6 أحرف على الأقل" required minlength="6">
              <button type="button" id="toggleRegPassword" class="sakr-toggle-pw" title="إظهار/إخفاء كلمة المرور">
                <span class="material-symbols-rounded" style="font-size: 1.25rem;">visibility</span>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-sakr-submit" id="regBtn">
            <span class="material-symbols-rounded">person_add</span> إنشاء حسابي الآن
          </button>
        </form>

        <div class="auth-switch-box">
          لديك حساب بالفعل؟ <a href="#/login" class="auth-switch-link">ادخل إلى حسابك الآن !</a>
        </div>
      </div>

      <!-- Left Side: Interactive Visual Poster (Khaled Sakr Inspired, Platform Emerald Palette) -->
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
          <p class="auth-poster-desc">احصل على تجربة تعليمية متكاملة تتضمن فيديوهات بجودة عالية، تقارير دورية لولي الأمر، ومتابعة فردية مستمرة.</p>
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

  // Toggle Password Visibility
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
    
    // Normalize and validate phone numbers
    const parentPhone = normalizeDigits(document.getElementById('regParentPhone').value);
    const studentPhone = normalizeDigits(document.getElementById('regPhone').value);
    const grade = document.getElementById('regGrade').value;
    const name = document.getElementById('regName').value.trim();

    if (!name) {
      showToast('يرجى إدخال الاسم بالكامل', 'warning');
      return;
    }

    if (!studentPhone.startsWith('01') || studentPhone.length !== 11) {
      showToast('يرجى إدخال رقم هاتف محمول مصري صحيح مكون من 11 رقماً يبدأ بـ 01', 'warning');
      return;
    }

    if (parentPhone && (!parentPhone.startsWith('01') || parentPhone.length !== 11)) {
      showToast('يرجى إدخال رقم ولي أمر مصري صحيح مكون من 11 رقماً يبدأ بـ 01', 'warning');
      return;
    }

    if (parentPhone && parentPhone === studentPhone) {
      showToast('رقم هاتف الطالب لا يمكن أن يكون هو نفسه رقم ولي الأمر', 'error');
      return;
    }

    if (!grade) {
      showToast('يرجى اختيار المرحلة الدراسية', 'warning');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري إنشاء الحساب...';
    
    try {
      const data = await api.register({
        name,
        phone: studentPhone,
        password: passwordInput.value,
        grade,
        parent_phone: parentPhone
      });
      setAuth(data.user, data.token);
      showToast('تم إنشاء حسابك بنجاح! مرحباً بك', 'success');
      window.location.hash = '#/dashboard';
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-rounded">person_add</span> إنشاء حسابي الآن';
    }
  });
}
