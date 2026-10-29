import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { showModal, confirmModal } from '../components/modal.js';
import { formatDate, gradesList, createPaginatedList } from '../utils/helpers.js';
import { exportToCSV } from '../utils/export.js';

export function renderAdmin() {
  return `<div class="app-layout">
    ${renderNavbar('admin')}
    <main class="main-content">
      <div class="page-header"><h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">dashboard</span> لوحة تحكم المعلم</h1><p class="page-subtitle">مرحباً د. زياد رمزي عياد</p></div>
      <div class="stats-grid" id="adminStats"><div class="loading-spinner"><div class="spinner"></div></div></div>
      <div class="card" id="adminPayments" style="margin-top:24px"></div>
      <div class="card" id="adminPaymentSettings" style="margin-top:24px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px" id="adminGrid">
        <div class="card" id="recentStudents"></div>
        <div class="card" id="gradeChart"></div>
      </div>
    </main>
  </div>`;
}

export async function initAdmin() {
  initNavbar();
  loadAdminPayments();
  loadPaymentSettings();
  try {
    const stats = await api.getDashboardStats();
    document.getElementById('adminStats').innerHTML = `
      <div class="stat-card"><div class="stat-icon green"><span class="material-symbols-rounded">group</span></div><div class="stat-info"><div class="stat-value">${stats.total_students}</div><div class="stat-label">طالب مسجل</div></div></div>
      <div class="stat-card"><div class="stat-icon gold"><span class="material-symbols-rounded">book</span></div><div class="stat-info"><div class="stat-value">${stats.total_courses}</div><div class="stat-label">كورس</div></div></div>
      <div class="stat-card"><div class="stat-icon blue"><span class="material-symbols-rounded">play_circle</span></div><div class="stat-info"><div class="stat-value">${stats.total_lessons}</div><div class="stat-label">درس</div></div></div>
      <div class="stat-card"><div class="stat-icon purple"><span class="material-symbols-rounded">assignment</span></div><div class="stat-info"><div class="stat-value">${stats.total_exams}</div><div class="stat-label">امتحان</div></div></div>
      <div class="stat-card"><div class="stat-icon green"><span class="material-symbols-rounded">person_add</span></div><div class="stat-info"><div class="stat-value">${stats.total_enrollments}</div><div class="stat-label">اشتراك فعال</div></div></div>
      <div class="stat-card"><div class="stat-icon gold"><span class="material-symbols-rounded">key</span></div><div class="stat-info"><div class="stat-value">${stats.active_codes}</div><div class="stat-label">كود متاح</div></div></div>
    `;
    document.getElementById('recentStudents').innerHTML = `
      <div class="card-header"><h3 class="card-title"><span class="material-symbols-rounded" style="color:var(--primary)">person_add</span> آخر الطلاب المسجلين</h3></div>
      ${stats.recent_students.map(s => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-light)">
        <div class="sidebar-user-avatar" style="width:34px;height:34px;font-size:0.75rem">${escA(s.name[0])}</div>
        <div style="flex:1"><div style="font-weight:600;font-size:0.85rem">${escA(s.name)}</div><div style="font-size:0.72rem;color:var(--text-muted)">${escA(s.grade || '')} · ${escA(s.phone)}</div></div>
        <span style="font-size:0.7rem;color:var(--text-muted)">${formatDate(s.created_at)}</span>
      </div>`).join('')}
    `;
    document.getElementById('gradeChart').innerHTML = `
      <div class="card-header"><h3 class="card-title"><span class="material-symbols-rounded" style="color:var(--accent)">pie_chart</span> توزيع الطلاب</h3></div>
      ${stats.grade_distribution.map(g => `<div style="display:flex;align-items:center;gap:10px;padding:6px 0">
        <span style="font-size:0.85rem;font-weight:600;min-width:100px">${escA(g.grade)}</span>
        <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${(g.count / stats.total_students) * 100}%"></div></div>
        <span style="font-size:0.8rem;font-weight:700;color:var(--primary)">${g.count}</span>
      </div>`).join('')}
    `;
  } catch (err) { showToast(err.message, 'error'); }
}

// Payment requests review (Vodafone Cash / InstaPay / Fawry)
const PAY_METHOD = { vodafone_cash: 'فودافون كاش', instapay: 'إنستاباي', fawry: 'فوري' };
const escA = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function loadAdminPayments() {
  const box = document.getElementById('adminPayments');
  if (!box) return;
  try {
    const list = await api.getPayments('pending');
    box.innerHTML = `
      <div class="card-header"><h3 class="card-title"><span class="material-symbols-rounded" style="color:var(--primary)">payments</span> طلبات الدفع قيد المراجعة <span class="badge badge-warning">${list.length}</span></h3></div>
      ${list.length ? list.map(p => `
        <div class="pay-request-row" data-id="${p.id}">
          <div style="min-width:0;flex:1">
            <div class="wallet-course-title">${escA(p.student_name)} — ${escA(p.course_title)}</div>
            <div class="wallet-course-meta">${PAY_METHOD[p.method]} • ${Number(p.amount)} ج.م • من: <span dir="ltr">${escA(p.sender_phone || '-')}</span> • رقم العملية: <span dir="ltr">${escA(p.transaction_ref)}</span> • ${formatDate(p.created_at)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${p.receipt_image ? `<button class="btn btn-ghost btn-sm pay-view" data-id="${p.id}"><span class="material-symbols-rounded">image</span></button>` : ''}
            <button class="btn btn-primary btn-sm pay-approve" data-id="${p.id}"><span class="material-symbols-rounded">check</span> قبول</button>
            <button class="btn btn-secondary btn-sm pay-reject" data-id="${p.id}"><span class="material-symbols-rounded">close</span> رفض</button>
          </div>
        </div>`).join('') : '<p class="pay-empty">لا توجد طلبات دفع جديدة.</p>'}`;

    box.querySelectorAll('.pay-view').forEach(b => b.addEventListener('click', () => {
      const p = list.find(x => x.id == b.dataset.id);
      showModal('صورة الإيصال', `<img src="${p.receipt_image}" alt="إيصال" style="max-width:100%;border-radius:12px">`);
    }));
    const review = async (id, status, admin_note) => {
      try {
        const res = await api.reviewPayment(id, { status, admin_note });
        showToast(res.message, 'success');
        loadAdminPayments();
      } catch (err) { showToast(err.message, 'error'); }
    };
    box.querySelectorAll('.pay-approve').forEach(b => b.addEventListener('click', () => { b.disabled = true; review(b.dataset.id, 'approved'); }));
    box.querySelectorAll('.pay-reject').forEach(b => b.addEventListener('click', () => {
      showModal('رفض طلب الدفع', `
        <div style="text-align:right;">
          <p style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:12px;">يرجى توضيح سبب رفض الطلب (سيظهر للطالب فوراً في الإشعارات):</p>
          <div class="form-group">
            <textarea id="rejectReasonInput" class="form-input" rows="3" placeholder="مثال: لم يتم العثور على التحويل بالرقم المرفق">لم يتم العثور على التحويل بالرقم المرفق</textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
            <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay')?.remove()">إلغاء</button>
            <button class="btn btn-danger" id="confirmRejectBtn">تأكيد الرفض</button>
          </div>
        </div>
      `);
      document.getElementById('confirmRejectBtn')?.addEventListener('click', () => {
        const note = document.getElementById('rejectReasonInput')?.value.trim();
        document.querySelector('.modal-overlay')?.remove();
        review(b.dataset.id, 'rejected', note || 'لم يتم العثور على التحويل');
      });
    }));
  } catch (err) {
    box.innerHTML = `<p class="pay-empty">تعذّر تحميل طلبات الدفع: ${escA(err.message)}</p>`;
  }
}

// Payment Settings management (Vodafone Cash / InstaPay / Fawry / WhatsApp)
async function loadPaymentSettings() {
  const box = document.getElementById('adminPaymentSettings');
  if (!box) return;
  try {
    const cfg = await api.getPaymentConfig();
    box.innerHTML = `
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <h3 class="card-title">
          <span class="material-symbols-rounded" style="color:var(--primary)">tune</span>
          إعدادات أرقام واستقبال أموال الدفع (كاش / إنستاباي / فوري / واتساب)
        </h3>
        <span style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">الأرقام دي بتظهر للطلاب في صفحة الدفع والاشتراك</span>
      </div>
      
      <form id="adminPaymentConfigForm" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;margin-top:14px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;">
            <span class="material-symbols-rounded" style="font-size:1.1rem;color:#e11d48;">smartphone</span>
            رقم فودافون كاش / المحافظ الإلكترونية
          </label>
          <input type="text" id="cfgVodafone" class="form-input" dir="ltr" value="${escA(cfg.vodafone_cash || '')}" placeholder="مثال: 01012345678">
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;">
            <span class="material-symbols-rounded" style="font-size:1.1rem;color:#7c3aed;">account_balance</span>
            معرّف أو رابط إنستاباي (InstaPay)
          </label>
          <input type="text" id="cfgInstapay" class="form-input" dir="ltr" value="${escA(cfg.instapay || '')}" placeholder="مثال: ziad.ramzy@instapay">
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;">
            <span class="material-symbols-rounded" style="font-size:1.1rem;color:#d97706;">storefront</span>
            كود تاجر فوري (Fawry Merchant)
          </label>
          <input type="text" id="cfgFawry" class="form-input" dir="ltr" value="${escA(cfg.fawry_merchant || '')}" placeholder="مثال: 788">
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;">
            <span class="material-symbols-rounded" style="font-size:1.1rem;color:#16a34a;">chat</span>
            رقم واتساب الدعم الفني وتلقي الإيصالات
          </label>
          <input type="text" id="cfgWhatsapp" class="form-input" dir="ltr" value="${escA(cfg.whatsapp || '')}" placeholder="مثال: 201012345678">
        </div>

        <div style="grid-column:1/-1;display:flex;justify-content:flex-end;margin-top:6px;">
          <button type="submit" class="btn btn-primary" id="savePaymentConfigBtn" style="padding:10px 24px;">
            <span class="material-symbols-rounded">save</span> حفظ أرقام الدفع فوراً
          </button>
        </div>
      </form>
    `;

    document.getElementById('adminPaymentConfigForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('savePaymentConfigBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري الحفظ...';

      const payload = {
        vodafone_cash: document.getElementById('cfgVodafone').value.trim(),
        instapay: document.getElementById('cfgInstapay').value.trim(),
        fawry_merchant: document.getElementById('cfgFawry').value.trim(),
        whatsapp: document.getElementById('cfgWhatsapp').value.trim(),
      };

      try {
        const res = await api.updatePaymentConfig(payload);
        showToast(res.message || 'تم حفظ أرقام الدفع بنجاح!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded">save</span> حفظ أرقام الدفع فوراً';
      }
    });
  } catch (err) {
    box.innerHTML = `<p class="pay-empty">تعذّر تحميل إعدادات الدفع: ${escA(err.message)}</p>`;
  }
}

// Admin Courses
export function renderAdminCourses() {
  return `<div class="app-layout">
    ${renderNavbar('admin-courses')}
    <main class="main-content">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><div><h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">book</span> إدارة الكورسات</h1></div>
      <button class="btn btn-primary" id="addCourseBtn"><span class="material-symbols-rounded">add</span> كورس جديد</button></div>
      <div id="adminCoursesList"><div class="loading-spinner"><div class="spinner"></div></div></div>
    </main>
  </div>`;
}

export async function initAdminCourses() {
  initNavbar();
  const courses = await api.getCourses();

  const bindCourseEvents = () => {
    document.querySelectorAll('.edit-course-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const c = courses.find(x => x.id == id);
        showModal('تعديل كورس أو باقة', `
          <div class="form-group"><label class="form-label">عنوان الكورس / الباقة</label><input type="text" class="form-input" id="ecTitle" value="${escA(c.title)}" required></div>
          <div class="form-group"><label class="form-label">الوصف والتعليمات</label><textarea class="form-input" id="ecDesc" rows="3">${escA(c.description || '')}</textarea></div>
          <div class="form-group"><label class="form-label">المرحلة الدراسية</label><select class="form-select" id="ecGrade">${gradesList.map(g => `<option value="${g}" ${c.grade===g?'selected':''}>${g}</option>`).join('')}<option value="جميع المراحل" ${c.grade==='جميع المراحل'?'selected':''}>جميع المراحل</option></select></div>
          
          <div style="background:rgba(5, 150, 105, 0.08); border:1px solid rgba(5, 150, 105, 0.2); border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:0.83rem; color:var(--emerald-800); display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-rounded" style="color:var(--emerald-600); font-size:1.2rem;">all_inclusive</span>
            <span><strong>ضمان المنصة:</strong> الكورسات ليس لها تاريخ انتهاء صلاحية. "3 شهور" أو "ترم" تعبر عن <u>حجم المحتوى المنهجي</u>، والمحتوى يظل متاحاً للطالب طوال العام الدراسي حتى امتحانات الثانوية العامة.</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label class="form-label">نطاق محتوى الكورس من المنهج</label>
              <select class="form-select" id="ecType">
                <option value="monthly" ${c.course_type==='monthly'?'selected':''}>كورس شهري (محتوى شهر دراسي)</option>
                <option value="quarterly" ${c.course_type==='quarterly'?'selected':''}>باقة 3 شهور (محتوى 3 شهور من المنهج)</option>
                <option value="term" ${c.course_type==='term'?'selected':''}>باقة ترم كامل (محتوى ترم دراسي كامل)</option>
                <option value="annual" ${c.course_type==='annual'?'selected':''}>كورس سنوي شامل (منهج العام كاملاً)</option>
                <option value="custom" ${c.course_type==='custom'?'selected':''}>كورس مخصص / مراجعة نهائية</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">صلاحية وصول الطالب</label>
              <input type="text" class="form-input" value="مفتوح طوال العام الدراسي (دائم)" disabled style="background:var(--bg-secondary); color:var(--emerald-600); font-weight:700;">
              <input type="hidden" id="ecDays" value="365">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="form-group">
              <label class="form-label">السعر الفعلي (0 = مجاني)</label>
              <input type="number" class="form-input" id="ecPrice" value="${c.price || 0}">
            </div>
            <div class="form-group">
              <label class="form-label">السعر الأصلي قبل الخصم</label>
              <input type="number" class="form-input" id="ecOrigPrice" value="${c.original_price || 0}" placeholder="اختياري للتوفير">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">بادج ترويجي مميز (اختياري)</label>
            <input type="text" class="form-input" id="ecBadge" value="${escA(c.badge_text || '')}" placeholder="مثال: الأكثر طلباً 🔥 / وفر 30%">
          </div>

          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="ecSequential" ${c.sequential_access ? 'checked' : ''} style="margin-left: 8px;"> تفعيل الترتيب الإجباري للدروس والامتحانات</label>
          </div>
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="ecReplies" ${c.allow_student_replies ? 'checked' : ''} style="margin-left: 8px;"> السماح للطلاب بالرد على بعضهم في المنتدى</label>
          </div>
          <button class="btn btn-primary btn-block" id="updateCourseBtn"><span class="material-symbols-rounded">check</span> تحديث الكورس</button>
        `);
        document.getElementById('updateCourseBtn').addEventListener('click', async () => {
          try {
            const price = parseInt(document.getElementById('ecPrice').value) || 0;
            const original_price = parseInt(document.getElementById('ecOrigPrice').value) || 0;
            const duration_days = parseInt(document.getElementById('ecDays').value) || 30;
            const course_type = document.getElementById('ecType').value;
            const badge_text = document.getElementById('ecBadge').value;
            const sequential_access = document.getElementById('ecSequential').checked;
            const allow_student_replies = document.getElementById('ecReplies').checked;
            await api.updateCourse(id, { 
              title: document.getElementById('ecTitle').value, 
              description: document.getElementById('ecDesc').value, 
              grade: document.getElementById('ecGrade').value, 
              price, 
              original_price,
              duration_days,
              course_type,
              badge_text,
              is_free: price === 0, 
              sequential_access, 
              allow_student_replies 
            });
            showToast('تم التحديث بنجاح', 'success');
            document.querySelector('.modal-overlay')?.remove();
            initAdminCourses();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    });

    document.querySelectorAll('.delete-course-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الكورس وجميع محتوياته نهائياً؟');
        if (ok) {
          try {
            await api.deleteCourse(btn.dataset.id);
            showToast('تم الحذف', 'success');
            initAdminCourses();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });
  };

  createPaginatedList({
    data: courses,
    containerId: 'adminCoursesList',
    searchPlaceholder: 'ابحث باسم الكورس أو المرحلة أو نوع الباقة...',
    itemsPerPage: 8,
    filterFn: (c, search) => !search || c.title.toLowerCase().includes(search) || (c.grade && c.grade.includes(search)) || (c.badge_text && c.badge_text.includes(search)),
    renderList: (items, totalFiltered) => {
      if (totalFiltered === 0) return '<div class="empty-state"><span class="material-symbols-rounded">book</span><h3>لا توجد كورسات مطابقة</h3></div>';
      return items.map(c => `
        <div class="exam-card">
          <div class="exam-icon green" style="background:var(--green-100);color:var(--green-700)">
            <span class="material-symbols-rounded">book</span>
          </div>
          <div class="exam-info">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
              <h3 style="margin:0;">${escA(c.title)}</h3>
              ${c.badge_text ? `<span class="badge badge-warning" style="font-size:0.72rem;">${escA(c.badge_text)}</span>` : ''}
              ${c.course_type === 'quarterly' ? '<span class="badge badge-info" style="font-size:0.72rem;">باقة 3 شهور</span>' : c.course_type === 'term' ? '<span class="badge badge-primary" style="font-size:0.72rem;">باقة ترم كامل</span>' : ''}
            </div>
            <div class="exam-meta">
              <span>${escA(c.grade)}</span>
              <span><span class="material-symbols-rounded" style="font-size:0.9rem; color:var(--emerald-600);">menu_book</span> ${c.course_type === 'quarterly' ? 'محتوى 3 شهور' : c.course_type === 'term' ? 'محتوى ترم' : c.course_type === 'annual' ? 'منهج سنوي' : 'محتوى شهر'}</span>
              <span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success); font-size:0.68rem; font-weight:700; padding:2px 6px;"><span class="material-symbols-rounded" style="font-size:0.75rem; vertical-align:middle;">all_inclusive</span> طوال العام</span>
              <span>${c.lesson_count || 0} درس</span>
              <span>${c.student_count || 0} طالب</span>
              <span>${c.is_free ? 'مجاني' : c.price + ' جنيه'}${c.original_price > c.price ? ` <s style="color:var(--text-muted);font-size:0.75rem;">${c.original_price} ج</s>` : ''}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <a href="#/admin/courses/${c.id}" class="btn btn-ghost btn-sm" title="إدارة المحتوى والمحاضرات والامتحانات"><span class="material-symbols-rounded">settings</span></a>
            <button class="btn btn-ghost btn-sm edit-course-btn" data-id="${c.id}" title="تعديل"><span class="material-symbols-rounded">edit</span></button>
            <button class="btn btn-ghost btn-sm text-danger delete-course-btn" data-id="${c.id}" title="حذف" style="color:var(--error)"><span class="material-symbols-rounded">delete</span></button>
          </div>
        </div>
      `).join('');
    },
    onRender: bindCourseEvents
  });

  document.getElementById('addCourseBtn').addEventListener('click', () => {
    showModal('إضافة كورس أو باقة جديدة', `
      <div class="form-group"><label class="form-label">عنوان الكورس أو الباقة</label><input type="text" class="form-input" id="mcTitle" placeholder="مثال: الباب الأول أو باقة الـ 3 شهور الشاملة" required></div>
      <div class="form-group"><label class="form-label">الوصف والتعليمات</label><textarea class="form-input" id="mcDesc" rows="3" placeholder="تفاصيل المحاضرات والمذكرات المتضمنة..."></textarea></div>
      <div class="form-group"><label class="form-label">المرحلة الدراسية</label><select class="form-select" id="mcGrade">${gradesList.map(g => `<option value="${g}">${g}</option>`).join('')}<option value="جميع المراحل">جميع المراحل</option></select></div>
      
      <div style="background:rgba(5, 150, 105, 0.08); border:1px solid rgba(5, 150, 105, 0.2); border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:0.83rem; color:var(--emerald-800); display:flex; align-items:center; gap:8px;">
        <span class="material-symbols-rounded" style="color:var(--emerald-600); font-size:1.2rem;">all_inclusive</span>
        <span><strong>ضمان المنصة:</strong> الكورسات ليس لها تاريخ انتهاء صلاحية. "3 شهور" أو "ترم" تعبر عن <u>حجم المحتوى المنهجي</u>، والمحتوى يظل متاحاً للطالب طوال العام الدراسي حتى امتحانات الثانوية العامة.</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">نطاق محتوى الكورس من المنهج</label>
          <select class="form-select" id="mcType">
            <option value="monthly">كورس شهري (محتوى شهر دراسي)</option>
            <option value="quarterly">باقة 3 شهور (محتوى 3 شهور من المنهج)</option>
            <option value="term">باقة ترم كامل (محتوى ترم دراسي كامل)</option>
            <option value="annual">كورس سنوي شامل (منهج العام كاملاً)</option>
            <option value="custom">كورس مخصص / مراجعة نهائية</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">صلاحية وصول الطالب</label>
          <input type="text" class="form-input" value="مفتوح طوال العام الدراسي (دائم)" disabled style="background:var(--bg-secondary); color:var(--emerald-600); font-weight:700;">
          <input type="hidden" id="mcDays" value="365">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">السعر الفعلي (0 = مجاني)</label>
          <input type="number" class="form-input" id="mcPrice" value="0">
        </div>
        <div class="form-group">
          <label class="form-label">السعر الأصلي قبل الخصم</label>
          <input type="number" class="form-input" id="mcOrigPrice" value="0" placeholder="لحساب نسبة التوفير">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">بادج مميز (اختياري)</label>
        <input type="text" class="form-input" id="mcBadge" placeholder="مثال: خصم 30% أو الأكثر طلباً">
      </div>

      <div class="form-group">
        <label class="form-label"><input type="checkbox" id="mcSequential" style="margin-left: 8px;"> تفعيل الترتيب الإجباري للدروس والامتحانات</label>
      </div>
      <div class="form-group">
        <label class="form-label"><input type="checkbox" id="mcReplies" style="margin-left: 8px;"> السماح للطلاب بالرد على بعضهم في المنتدى</label>
      </div>
      <button class="btn btn-primary btn-block" id="saveCourseBtn"><span class="material-symbols-rounded">check</span> حفظ الكورس</button>
    `);

    // Auto update days when course type changes
    document.getElementById('mcType').addEventListener('change', (e) => {
      const type = e.target.value;
      const daysInput = document.getElementById('mcDays');
      if (type === 'monthly') daysInput.value = 30;
      else if (type === 'quarterly') daysInput.value = 90;
      else if (type === 'term') daysInput.value = 120;
      else if (type === 'annual') daysInput.value = 365;
    });

    document.getElementById('saveCourseBtn').addEventListener('click', async () => {
      try {
        const price = parseInt(document.getElementById('mcPrice').value) || 0;
        const original_price = parseInt(document.getElementById('mcOrigPrice').value) || 0;
        const duration_days = parseInt(document.getElementById('mcDays').value) || 30;
        const course_type = document.getElementById('mcType').value;
        const badge_text = document.getElementById('mcBadge').value;
        const sequential_access = document.getElementById('mcSequential').checked;
        const allow_student_replies = document.getElementById('mcReplies').checked;
        await api.createCourse({ 
          title: document.getElementById('mcTitle').value, 
          description: document.getElementById('mcDesc').value, 
          grade: document.getElementById('mcGrade').value, 
          price, 
          original_price,
          duration_days,
          course_type,
          badge_text,
          is_free: price === 0, 
          sequential_access, 
          allow_student_replies 
        });
        showToast('تم إضافة الكورس / الباقة بنجاح', 'success');
        document.querySelector('.modal-overlay')?.remove();
        initAdminCourses();
      } catch (err) { showToast(err.message, 'error'); }
    });
  });
}

// Admin Codes
export function renderAdminCodes() {
  return `<div class="app-layout">
    ${renderNavbar('admin-codes')}
    <main class="main-content">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><div><h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--accent)">key</span> أكواد التفعيل</h1></div>
      <button class="btn btn-primary" id="genCodesBtn"><span class="material-symbols-rounded">add</span> إنشاء أكواد</button></div>
      <div id="codesList"><div class="loading-spinner"><div class="spinner"></div></div></div>
    </main>
  </div>`;
}

export async function initAdminCodes() {
  initNavbar();
  const [codes, courses] = await Promise.all([api.getCodes(), api.getCourses()]);
  
  const bindCodeEvents = () => {
    document.querySelectorAll('.edit-code-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const c = codes.find(x => x.id == id);
        showModal('تعديل الكود', `
          <div class="form-group"><label class="form-label">الاستخدام الأقصى (-1 للانهائي)</label><input type="number" class="form-input" id="ecMax" value="${c.max_uses}"></div>
          <div class="form-group"><label class="form-label">تاريخ الانتهاء</label><input type="date" class="form-input" id="ecExp" value="${c.expires_at ? c.expires_at.split('T')[0] : ''}"></div>
          <div class="form-group"><label class="form-label">الحالة</label><select class="form-select" id="ecActive"><option value="1" ${c.is_active ? 'selected' : ''}>فعال</option><option value="0" ${!c.is_active ? 'selected' : ''}>مغلق</option></select></div>
          <button class="btn btn-primary btn-block" id="updateCodeBtn">تحديث</button>
        `);
        document.getElementById('updateCodeBtn').addEventListener('click', async () => {
          try {
            let exp = document.getElementById('ecExp').value;
            await api.updateCode(id, { max_uses: parseInt(document.getElementById('ecMax').value), expires_at: exp ? new Date(exp).toISOString() : null, is_active: parseInt(document.getElementById('ecActive').value) });
            showToast('تم التحديث', 'success');
            document.querySelector('.modal-overlay')?.remove();
            initAdminCodes();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    });

    document.querySelectorAll('.delete-code-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الكود نهائياً؟');
        if (ok) {
          try {
            await api.deleteCode(btn.dataset.id);
            showToast('تم الحذف', 'success');
            initAdminCodes();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });
  };

  createPaginatedList({
    data: codes,
    containerId: 'codesList',
    searchPlaceholder: 'ابحث برقم الكود أو اسم الكورس...',
    itemsPerPage: 15,
    filterFn: (c, search) => !search || c.code.toLowerCase().includes(search) || (c.course_title && c.course_title.toLowerCase().includes(search)),
    renderList: (items, totalFiltered) => {
      if (totalFiltered === 0) return '<div class="empty-state"><span class="material-symbols-rounded">key</span><h3>لا توجد أكواد مطابقة</h3></div>';
      return `<div class="mobile-swipe-hint"><span class="material-symbols-rounded">swipe</span> اسحب أفقياً لعرض باقي بيانات الأكواد</div><div class="table-wrapper"><table><thead><tr><th>الكود</th><th>الكورس</th><th>النوع</th><th>الاستخدام</th><th>الانتهاء</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>
        ${items.map(c => {
          const uses = c.max_uses === -1 ? 'غير محدود' : `${c.used_count}/${c.max_uses}`;
          const expiry = c.expires_at ? formatDate(c.expires_at) : 'لا ينتهي';
          const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
          const badge = c.is_active && !isExpired ? '<span class="badge badge-success">فعال</span>' : '<span class="badge badge-danger">مغلق</span>';
          return `<tr>
            <td><span class="code-text">${escA(c.code)}</span></td>
            <td>${escA(c.course_title || '-')}</td>
            <td>${c.type === 'universal' ? '<span class="badge badge-info">عام</span>' : '<span class="badge badge-warning">فردي</span>'}</td>
            <td><span style="direction:ltr;display:inline-block">${uses}</span></td>
            <td>${expiry}</td>
            <td>${badge}</td>
            <td><div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm edit-code-btn" data-id="${c.id}" title="تعديل"><span class="material-symbols-rounded">edit</span></button>
              <button class="btn btn-ghost btn-sm text-danger delete-code-btn" data-id="${c.id}" title="حذف" style="color:var(--error)"><span class="material-symbols-rounded">delete</span></button>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody></table></div>`;
    },
    onRender: bindCodeEvents
  });

  document.getElementById('genCodesBtn').addEventListener('click', () => {
    showModal('إنشاء أكواد تفعيل', `
      <div class="form-group"><label class="form-label">الكورس</label><select class="form-select" id="gcCourse">${courses.map(c => `<option value="${c.id}">${escA(c.title)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">النوع</label><select class="form-select" id="gcType"><option value="universal">عام (لأي طالب)</option><option value="individual">فردي (لطالب محدد)</option></select></div>
      <div class="form-group"><label class="form-label">تاريخ الانتهاء (اختياري)</label><input type="date" class="form-input" id="gcExpiry"></div>
      <div class="form-group"><label class="form-label">عدد الأكواد (للفردي)</label><input type="number" class="form-input" id="gcCount" value="10" min="1" max="100"></div>
      <div class="form-group" id="maxUsesGroup" style="display:none"><label class="form-label">عدد الاستخدامات لكل كود (للفردي)</label><input type="number" class="form-input" id="gcMax" value="1" min="1"></div>
      <button class="btn btn-primary btn-block" id="genBtn"><span class="material-symbols-rounded">key</span> إنشاء</button>
    `);
    
    const typeSel = document.getElementById('gcType');
    const countInp = document.getElementById('gcCount');
    const maxGrp = document.getElementById('maxUsesGroup');
    typeSel.addEventListener('change', () => {
      if (typeSel.value === 'universal') {
        countInp.value = 1; countInp.disabled = true; maxGrp.style.display = 'none';
      } else {
        countInp.value = 10; countInp.disabled = false; maxGrp.style.display = 'block';
      }
    });
    
    document.getElementById('genBtn').addEventListener('click', async () => {
      try {
        const type = document.getElementById('gcType').value;
        const max_uses = type === 'universal' ? -1 : parseInt(document.getElementById('gcMax').value);
        let expires_at = document.getElementById('gcExpiry').value;
        if (expires_at) expires_at = new Date(expires_at).toISOString();
        else expires_at = null;
        
        const res = await api.generateCodes({ 
          course_id: parseInt(document.getElementById('gcCourse').value), 
          type, 
          count: parseInt(document.getElementById('gcCount').value), 
          max_uses,
          expires_at
        });
        showToast(res.message, 'success');
        const codesModal = showModal('الأكواد المُنشأة', `<div style="direction:ltr;font-family:monospace;font-size:1.1rem;line-height:2.5">${res.codes.map(c => `<div class="code-item"><span class="code-text">${escA(c)}</span><button class="btn btn-ghost btn-sm copy-code-btn" data-code="${escA(c)}"><span class="material-symbols-rounded">content_copy</span></button></div>`).join('')}</div>`);
        codesModal.overlay.querySelectorAll('.copy-code-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(btn.dataset.code);
              btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 1.1rem; color: var(--success);">done</span>';
            } catch { showToast('انسخ الكود يدوياً', 'warning'); }
          });
        });
        initAdminCodes(); // Refresh
      } catch (err) { showToast(err.message, 'error'); }
    });
  });
}

// Admin Students
export function renderAdminStudents() {
  return `<div class="app-layout">
    ${renderNavbar('admin-students')}
    <main class="main-content">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">group</span> الطلاب</h1>
        <button class="btn btn-secondary btn-sm" id="exportStudentsCsvBtn" style="display:inline-flex;align-items:center;gap:6px;">
          <span class="material-symbols-rounded" style="color:var(--success);font-size:1.15rem;">table_view</span> تصدير الطلاب Excel
        </button>
      </div>
      <div class="tabs" id="studentGradeTabs">
        <div class="tab active" data-grade="">الكل</div>
        ${gradesList.map(g => `<div class="tab" data-grade="${g}">${g}</div>`).join('')}
      </div>
      <div id="studentsList"><div class="loading-spinner"><div class="spinner"></div></div></div>
    </main>
  </div>`;
}

export async function initAdminStudents() {
  initNavbar();
  let currentGrade = '';
  let currentStudentsList = [];
  
  async function load(grade) {
    currentGrade = grade;
    const students = await api.getStudents(grade ? { grade } : {});
    currentStudentsList = students;

    const bindStudentEvents = () => {
      document.querySelectorAll('.report-st-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const s = students.find(x => x.id == btn.dataset.id);
          try {
            const details = await api.getStudent(s.id);
            const examsHtml = details.exam_attempts && details.exam_attempts.length > 0 
              ? details.exam_attempts.map(e => `
                <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-secondary);padding:10px;border-radius:6px;margin-bottom:8px">
                  <div><strong style="font-size:0.9rem">${escA(e.exam_title)}</strong><div style="font-size:0.75rem;color:var(--text-muted)">${new Date(e.completed_at).toLocaleDateString('ar-EG')}</div></div>
                  <span class="badge ${e.score >= 60 ? 'badge-success' : 'badge-danger'}">${e.score}%</span>
                </div>`).join('') 
              : '<div style="font-size:0.85rem;color:var(--text-muted)">لم يقم بأي امتحانات.</div>';

            const lessonsHtml = details.lesson_progress && details.lesson_progress.length > 0
              ? details.lesson_progress.map(l => `
                <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-secondary);padding:10px;border-radius:6px;margin-bottom:8px">
                  <div>
                    <strong style="font-size:0.9rem">${escA(l.lesson_title)}</strong>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${escA(l.course_title)}</div>
                  </div>
                  <div style="text-align:left">
                    <div style="font-size:0.8rem;color:var(--text-secondary)">المشاهدات: ${l.views_count} / ${l.max_views || 8}</div>
                    ${l.completed ? '<span class="badge badge-success" style="font-size:0.7rem;padding:2px 6px">مكتمل</span>' : ''}
                  </div>
                </div>`).join('')
              : '<div style="font-size:0.85rem;color:var(--text-muted)">لم يقم بمشاهدة أي دروس.</div>';

            showModal(`تقرير الطالب: ${escA(s.name)}`, `
              <div style="margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="card" style="padding:12px"><div style="font-size:0.8rem;color:var(--text-muted)">متوسط درجاته</div><div style="font-size:1.4rem;font-weight:700;color:var(--primary)">${s.avg_score || 0}%</div></div>
                <div class="card" style="padding:12px"><div style="font-size:0.8rem;color:var(--text-muted)">عدد الكورسات</div><div style="font-size:1.4rem;font-weight:700;color:var(--accent)">${details.enrollments?.length || 0}</div></div>
              </div>
              <h4 style="font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--gold-600)">assignment</span> نتائج الامتحانات الأخيرة</h4>
              <div style="max-height:200px;overflow-y:auto;margin-bottom:20px">${examsHtml}</div>
              <h4 style="font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--info)">play_circle</span> استهلاك المشاهدات (الدروس)</h4>
              <div style="max-height:200px;overflow-y:auto">${lessonsHtml}</div>
              <div style="display:flex;gap:10px;margin-top:20px;">
                <button class="btn btn-secondary flex-1" onclick="document.querySelector('.modal-overlay')?.remove()">إغلاق</button>
                <button class="btn btn-outline-danger" id="modalResetDeviceBtn" style="border:1px solid var(--error);color:var(--error);gap:6px;">
                  <span class="material-symbols-rounded" style="font-size:1.1rem;">devices_off</span> إعادة ضبط الأجهزة
                </button>
              </div>
            `);

            document.getElementById('modalResetDeviceBtn')?.addEventListener('click', async () => {
              const ok = await confirmModal('إعادة ضبط الأجهزة', `هل أنت متأكد من مسح الأجهزة المسجلة للطالب ${escA(s.name)}؟ سيمكنه ذلك من الدخول من أجهزة جديدة.`);
              if (ok) {
                try {
                  const res = await api.resetStudentDevices(s.id);
                  showToast(res.message || 'تمت إعادة الضبط بنجاح', 'success');
                } catch(err) { showToast(err.message, 'error'); }
              }
            });
          } catch(err) { showToast('تعذر تحميل التقرير', 'error'); }
        });
      });

      document.querySelectorAll('.edit-st-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const s = students.find(x => x.id == btn.dataset.id);
          try {
            const studentDetails = await api.getStudent(s.id);
            const enrollmentsHtml = studentDetails.enrollments && studentDetails.enrollments.length > 0 
              ? `<div style="margin-top:16px;border-top:1px solid var(--border-color);padding-top:16px">
                  <h4 style="margin-bottom:12px;font-weight:700">كورسات الطالب:</h4>
                  ${studentDetails.enrollments.map(e => `
                    <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-secondary);padding:8px 12px;border-radius:6px;margin-bottom:8px">
                      <span style="font-size:0.9rem">${escA(e.course_title)}</span>
                      <label class="form-label" style="margin:0;display:flex;align-items:center;gap:6px;font-size:0.85rem">
                        <input type="checkbox" class="suspend-toggle" data-course="${e.course_id}" ${e.is_suspended ? 'checked' : ''}>
                        إيقاف الطالب
                      </label>
                    </div>
                  `).join('')}
                 </div>`
              : '<div style="margin-top:16px;color:var(--text-muted);font-size:0.85rem">لا يوجد كورسات مشترك بها.</div>';

            showModal('تعديل بيانات الطالب', `
              <div class="form-group"><label class="form-label">الاسم</label><input type="text" class="form-input" id="esName" value="${escA(s.name)}" required></div>
              <div class="form-group"><label class="form-label">رقم الهاتف</label><input type="text" class="form-input" id="esPhone" value="${escA(s.phone)}" required dir="ltr"></div>
              <div class="form-group"><label class="form-label">رقم ولي الأمر</label><input type="text" class="form-input" id="esParent" value="${escA(s.parent_phone || '')}" dir="ltr"></div>
              <div class="form-group"><label class="form-label">المرحلة</label><select class="form-select" id="esGrade">${gradesList.map(g => `<option value="${g}" ${s.grade===g?'selected':''}>${g}</option>`).join('')}</select></div>
              <div class="form-group"><label class="form-label">كلمة مرور جديدة (اتركها فارغة لعدم التغيير)</label><input type="password" class="form-input" id="esPass"></div>
              ${enrollmentsHtml}
              <button class="btn btn-primary btn-block" style="margin-top:20px" id="updateStBtn">تحديث الطالب</button>
            `);

            // Attach toggle handlers
            document.querySelectorAll('.suspend-toggle').forEach(toggle => {
              toggle.addEventListener('change', async (ev) => {
                try {
                  const courseId = ev.target.dataset.course;
                  const isSuspended = ev.target.checked;
                  await api.suspendStudent(s.id, courseId, isSuspended);
                  showToast(isSuspended ? 'تم إيقاف الطالب من الكورس' : 'تم تفعيل الطالب في الكورس', isSuspended ? 'warning' : 'success');
                } catch (err) {
                  showToast(err.message, 'error');
                  ev.target.checked = !ev.target.checked; // revert
                }
              });
            });

            document.getElementById('updateStBtn').addEventListener('click', async () => {
              try {
                await api.updateStudent(s.id, {
                  name: document.getElementById('esName').value, phone: document.getElementById('esPhone').value,
                  parent_phone: document.getElementById('esParent').value, grade: document.getElementById('esGrade').value,
                  password: document.getElementById('esPass').value || undefined
                });
                showToast('تم تحديث الطالب', 'success');
                document.querySelector('.modal-overlay')?.remove();
                load(currentGrade);
              } catch (err) { showToast(err.message, 'error'); }
            });
          } catch(err) {
             showToast(err.message, 'error');
          }
        });
      });

      document.querySelectorAll('.wa-st-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const s = students.find(x => x.id == btn.dataset.id);
          try {
            const rep = await api.getStudentWhatsAppReport(s.id);
            showModal(`تقرير ولي الأمر (واتساب) — ${escA(s.name)}`, `
              <div style="text-align:right;">
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">نص التقرير الجاهز للإرسال:</p>
                <div style="background:var(--bg-secondary); border:1px solid var(--border-light); border-radius:8px; padding:12px; font-size:0.85rem; line-height:1.6; white-space:pre-wrap; margin-bottom:16px;">${escA(rep.report_text)}</div>
                <div style="display:flex; flex-direction:column; gap:10px;">
                  ${rep.whatsapp_parent_url ? `
                    <a href="${rep.whatsapp_parent_url}" target="_blank" class="btn btn-primary btn-block" style="background:#25D366; border-color:#25D366; gap:8px;">
                      <span class="material-symbols-rounded">chat</span> إرسال لولي الأمر الأول (الأب) عبر واتساب
                    </a>
                  ` : '<p style="font-size:0.8rem; color:var(--error);">لم يتم تسجيل رقم ولي الأمر الأول</p>'}
                  ${rep.whatsapp_parent_secondary_url ? `
                    <a href="${rep.whatsapp_parent_secondary_url}" target="_blank" class="btn btn-secondary btn-block" style="gap:8px;">
                      <span class="material-symbols-rounded">chat</span> إرسال لولي الأمر الثاني (الأم) عبر واتساب
                    </a>
                  ` : ''}
                </div>
              </div>
            `);
          } catch(err) { showToast(err.message, 'error'); }
        });
      });

      document.querySelectorAll('.delete-st-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await confirmModal('تأكيد حذف الطالب', 'هل أنت متأكد من حذف حساب الطالب نهائياً؟ سيتم حذف جميع اشتراكاته ودرجاته.');
          if (ok) {
            try {
              await api.deleteStudent(btn.dataset.id);
              showToast('تم الحذف', 'success');
              load(currentGrade);
            } catch (err) { showToast(err.message, 'error'); }
          }
        });
      });
    };

    createPaginatedList({
      data: students,
      containerId: 'studentsList',
      searchPlaceholder: 'ابحث بالاسم أو رقم الهاتف...',
      itemsPerPage: 15,
      filterFn: (s, search) => !search || s.name.toLowerCase().includes(search) || s.phone.includes(search),
      renderList: (items, totalFiltered) => {
        if (totalFiltered === 0) return '<div class="empty-state"><span class="material-symbols-rounded">group</span><h3>لا يوجد طلاب مطابقين</h3></div>';
        return `<div class="mobile-swipe-hint"><span class="material-symbols-rounded">swipe</span> اسحب أفقياً لعرض باقي سجلات الطلاب</div><div class="table-wrapper"><table><thead><tr><th>الاسم</th><th>الهاتف</th><th>المرحلة</th><th>الكورسات</th><th>المعدل</th><th>إجراءات</th></tr></thead><tbody>
          ${items.map(s => `<tr><td style="font-weight:600">${escA(s.name)}</td><td dir="ltr">${escA(s.phone)}</td><td>${escA(s.grade || '-')}</td><td>${s.enrolled_courses}</td><td><span class="badge ${(s.avg_score || 0) >= 60 ? 'badge-success' : 'badge-danger'}">${s.avg_score || 0}%</span></td>
          <td><div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm wa-st-btn" data-id="${s.id}" title="تقرير الواتساب لولي الأمر"><span class="material-symbols-rounded" style="color:#25D366">chat</span></button>
            <button class="btn btn-ghost btn-sm report-st-btn" data-id="${s.id}" title="تقرير الطالب"><span class="material-symbols-rounded" style="color:var(--info)">analytics</span></button>
            <button class="btn btn-ghost btn-sm edit-st-btn" data-id="${s.id}" title="تعديل"><span class="material-symbols-rounded">edit</span></button>
            <button class="btn btn-ghost btn-sm text-danger delete-st-btn" data-id="${s.id}" title="حذف" style="color:var(--error)"><span class="material-symbols-rounded">delete</span></button>
          </div></td></tr>`).join('')}
        </tbody></table></div>`;
      },
      onRender: bindStudentEvents
    });
  }

  document.getElementById('studentGradeTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('#studentGradeTabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    load(tab.dataset.grade);
  });

  document.getElementById('exportStudentsCsvBtn')?.addEventListener('click', () => {
    if (!currentStudentsList.length) return showToast('لا توجد بيانات طلاب للتصدير', 'warning');
    const headers = ['اسم الطالب', 'رقم الهاتف', 'رقم ولي الأمر', 'المرحلة الدراسية', 'عدد الكورسات المشترك بها', 'متوسط درجات الامتحانات', 'تاريخ التسجيل'];
    const rows = currentStudentsList.map(s => [
      s.name,
      s.phone,
      s.parent_phone || '',
      s.grade || 'غير محدد',
      s.enrolled_courses || 0,
      `${s.avg_score || 0}%`,
      formatDate(s.created_at)
    ]);
    const gradeLabel = currentGrade ? `_${currentGrade.replace(/\s+/g, '_')}` : '_الكل';
    exportToCSV(`قائمة_طلاب_كيمياوي${gradeLabel}`, headers, rows);
    showToast('تم تصدير قائمة الطلاب بنجاح بصيغة Excel', 'success');
  });

  load('');
}

// Admin Exams
export function renderAdminExams() {
  return `<div class="app-layout">
    ${renderNavbar('admin-exams')}
    <main class="main-content">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><div><h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--accent)">assignment</span> إدارة الامتحانات</h1></div>
      <button class="btn btn-primary" id="addExamBtn"><span class="material-symbols-rounded">add</span> امتحان جديد</button></div>
      <div id="adminExamsList"><div class="loading-spinner"><div class="spinner"></div></div></div>
    </main>
  </div>`;
}

export async function initAdminExams() {
  initNavbar();
  const [exams, courses] = await Promise.all([api.getExams(), api.getCourses()]);
  
  const bindExamEvents = () => {
    document.querySelectorAll('.edit-exam-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const e = exams.find(x => x.id == id);
        showModal('تعديل امتحان', `
          <div class="form-group"><label class="form-label">عنوان الامتحان</label><input type="text" class="form-input" id="eeT" value="${escA(e.title)}"></div>
          <div style="display:flex;gap:12px">
            <div class="form-group" style="flex:1"><label class="form-label">المدة (دقائق)</label><input type="number" class="form-input" id="eeD" value="${e.duration_minutes}"></div>
            <div class="form-group" style="flex:1"><label class="form-label">عدد المحاولات</label><input type="number" class="form-input" id="eeA" value="${e.max_attempts}"></div>
            <div class="form-group" style="flex:1"><label class="form-label">الترتيب</label><input type="number" class="form-input" id="eeO" value="${e.order_num || 0}"></div>
          </div>
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" id="eeBankToggle" ${e.random_questions_count > 0 ? 'checked' : ''} style="margin-left: 8px;">
              تفعيل نظام بنك الأسئلة (أسئلة عشوائية لكل طالب)
            </label>
          </div>
          <div class="form-group" id="eeBankGroup" style="display: ${e.random_questions_count > 0 ? 'block' : 'none'};">
            <label class="form-label">عدد الأسئلة التي ستظهر لكل طالب</label>
            <input type="number" class="form-input" id="eeBankCount" value="${e.random_questions_count || 10}">
          </div>
          <button class="btn btn-primary btn-block" id="updateExamBtn">تحديث</button>
        `);
        document.getElementById('eeBankToggle').addEventListener('change', (ev) => {
          document.getElementById('eeBankGroup').style.display = ev.target.checked ? 'block' : 'none';
        });
        document.getElementById('updateExamBtn').addEventListener('click', async () => {
          try {
            const randomCount = document.getElementById('eeBankToggle').checked ? parseInt(document.getElementById('eeBankCount').value) : 0;
            await api.updateExam(id, { 
              title: document.getElementById('eeT').value, 
              duration_minutes: parseInt(document.getElementById('eeD').value), 
              max_attempts: parseInt(document.getElementById('eeA').value), 
              random_questions_count: randomCount,
              order_num: parseInt(document.getElementById('eeO').value)
            });
            showToast('تم التحديث بنجاح', 'success');
            document.querySelector('.modal-overlay')?.remove();
            initAdminExams();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    });

    document.querySelectorAll('.delete-exam-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal('تأكيد حذف الامتحان', 'هل أنت متأكد من حذف هذا الامتحان وجميع أسئلته وتسليمات الطلاب؟');
        if (ok) {
          try {
            await api.deleteExam(btn.dataset.id);
            showToast('تم الحذف', 'success');
            initAdminExams();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });
  };

  createPaginatedList({
    data: exams,
    containerId: 'adminExamsList',
    searchPlaceholder: 'ابحث بعنوان الامتحان أو الكورس...',
    itemsPerPage: 5,
    filterFn: (e, search) => !search || e.title.toLowerCase().includes(search) || (e.course_title && e.course_title.toLowerCase().includes(search)),
    renderList: (items, totalFiltered) => {
      if (totalFiltered === 0) return '<div class="empty-state"><span class="material-symbols-rounded">assignment</span><h3>لا توجد امتحانات مطابقة</h3></div>';
      return items.map(e => `
        <div class="exam-card"><div class="exam-icon gold" style="background:var(--gold-100);color:var(--gold-700)"><span class="material-symbols-rounded">assignment</span></div>
        <div class="exam-info"><h3>${escA(e.title)}</h3><div class="exam-meta"><span>${escA(e.course_title || '-')}</span><span>${e.question_count} سؤال إجمالي</span><span>${e.random_questions_count > 0 ? `<span class="material-symbols-rounded" style="color:var(--warning)">shuffle</span> بنك (${e.random_questions_count} للطالب)` : 'ثابت'}</span><span>${e.duration_minutes} دقيقة</span><span>${e.attempt_count || 0} محاولة</span></div></div>
        <div style="display:flex;gap:8px">
          <a href="#/admin/exams/${e.id}" class="btn btn-ghost btn-sm" title="إدارة الأسئلة"><span class="material-symbols-rounded">settings</span></a>
          <button class="btn btn-ghost btn-sm edit-exam-btn" data-id="${e.id}" title="تعديل"><span class="material-symbols-rounded">edit</span></button>
          <button class="btn btn-ghost btn-sm text-danger delete-exam-btn" data-id="${e.id}" title="حذف" style="color:var(--error)"><span class="material-symbols-rounded">delete</span></button>
        </div></div>
      `).join('');
    },
    onRender: bindExamEvents
  });

  document.getElementById('addExamBtn').addEventListener('click', () => {
    showModal('إضافة امتحان جديد', `
      <div class="form-group"><label class="form-label">الكورس</label><select class="form-select" id="meC"><option value="">-- اختر الكورس --</option>${courses.map(c => `<option value="${c.id}">${escA(c.title)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">الفصل (اختر الكورس أولاً)</label><select class="form-select" id="meCh" disabled><option value="">-- اختر الفصل --</option></select></div>
      <div class="form-group"><label class="form-label">عنوان الامتحان</label><input type="text" class="form-input" id="meT"></div>
      <div style="display:flex;gap:12px">
        <div class="form-group" style="flex:1"><label class="form-label">المدة (دقائق)</label><input type="number" class="form-input" id="meD" value="30"></div>
        <div class="form-group" style="flex:1"><label class="form-label">عدد المحاولات</label><input type="number" class="form-input" id="meA" value="2"></div>
        <div class="form-group" style="flex:1"><label class="form-label">الترتيب</label><input type="number" class="form-input" id="meO" value="1"></div>
      </div>
      <div class="form-group">
        <label class="form-label">
          <input type="checkbox" id="meBankToggle" style="margin-left: 8px;">
          تفعيل نظام بنك الأسئلة (أسئلة عشوائية لكل طالب)
        </label>
      </div>
      <div class="form-group" id="meBankGroup" style="display: none;">
        <label class="form-label">عدد الأسئلة التي ستظهر لكل طالب</label>
        <input type="number" class="form-input" id="meBankCount" value="10">
      </div>
      <button class="btn btn-primary btn-block" id="saveExamBtn">حفظ</button>
    `);

    // Fetch chapters dynamically
    document.getElementById('meC').addEventListener('change', async (e) => {
      const courseId = e.target.value;
      const chSelect = document.getElementById('meCh');
      if (!courseId) { chSelect.disabled = true; chSelect.innerHTML = '<option value="">-- اختر الفصل --</option>'; return; }
      try {
        const course = await api.getCourse(courseId);
        chSelect.disabled = false;
        chSelect.innerHTML = '<option value="">-- اختر الفصل --</option>' + (course.chapters || []).map(ch => `<option value="${ch.id}">${escA(ch.title)}</option>`).join('');
      } catch (err) {}
    });

    document.getElementById('meBankToggle').addEventListener('change', (ev) => {
      document.getElementById('meBankGroup').style.display = ev.target.checked ? 'block' : 'none';
    });
    
    document.getElementById('saveExamBtn').addEventListener('click', async () => {
      try {
        const courseId = document.getElementById('meC').value;
        const chapterId = document.getElementById('meCh').value;
        if (!courseId || !chapterId) throw new Error('يجب اختيار الكورس والفصل');
        
        const randomCount = document.getElementById('meBankToggle').checked ? parseInt(document.getElementById('meBankCount').value) : 0;
        await api.createExam({ 
          course_id: parseInt(courseId), 
          chapter_id: parseInt(chapterId),
          title: document.getElementById('meT').value, 
          duration_minutes: parseInt(document.getElementById('meD').value), 
          max_attempts: parseInt(document.getElementById('meA').value), 
          random_questions_count: randomCount,
          order_num: parseInt(document.getElementById('meO').value)
        });
        showToast('تم إضافة الامتحان', 'success');
        document.querySelector('.modal-overlay')?.remove();
        initAdminExams();
      } catch (err) { showToast(err.message, 'error'); }
    });
  });
}

// Admin Live & Notifications (simplified)
export function renderAdminLive() {
  return `<div class="app-layout">${renderNavbar('admin-live')}<main class="main-content">
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><div><h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--error)">live_tv</span> إدارة الحصص اللايف</h1></div>
    <button class="btn btn-primary" id="addLiveBtn"><span class="material-symbols-rounded">add</span> حصة جديدة</button></div>
    <div id="adminLiveList"><div class="loading-spinner"><div class="spinner"></div></div></div>
  </main></div>`;
}

export async function initAdminLive() {
  initNavbar();
  const [sessions, courses] = await Promise.all([api.getLiveSessions(), api.getCourses()]);
  
  const bindLiveEvents = () => {
    document.querySelectorAll('.edit-live-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const s = sessions.find(x => x.id == id);
        const dt = new Date(s.scheduled_at);
        dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
        showModal('تعديل حصة', `
          <div class="form-group"><label class="form-label">العنوان</label><input type="text" class="form-input" id="esT" value="${escA(s.title)}"></div>
          <div class="form-group"><label class="form-label">الموعد</label><input type="datetime-local" class="form-input" id="esD" value="${dt.toISOString().slice(0,16)}"></div>
          <div class="form-group"><label class="form-label">الحالة</label>
            <select class="form-select" id="esStatus">
              <option value="upcoming" ${s.status === 'upcoming' ? 'selected' : ''}>قادمة</option>
              <option value="live" ${s.status === 'live' ? 'selected' : ''}>مباشر الآن</option>
              <option value="completed" ${s.status === 'completed' ? 'selected' : ''}>انتهت</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">رابط الحصة</label><input type="url" class="form-input" id="esL" value="${s.meeting_link || ''}" dir="ltr"></div>
          <div class="form-group"><label class="form-label">رابط الإعادة (إن وجد)</label><input type="url" class="form-input" id="esR" value="${s.replay_url || ''}" dir="ltr"></div>
          <button class="btn btn-primary btn-block" id="updateLiveBtn">تحديث</button>
        `);
        document.getElementById('updateLiveBtn').addEventListener('click', async () => {
          try {
            await api.updateLiveSession(id, { title: document.getElementById('esT').value, scheduled_at: new Date(document.getElementById('esD').value).toISOString(), status: document.getElementById('esStatus').value, meeting_link: document.getElementById('esL').value, replay_url: document.getElementById('esR').value });
            showToast('تم التحديث', 'success');
            document.querySelector('.modal-overlay')?.remove();
            initAdminLive();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    });

    document.querySelectorAll('.delete-live-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal('تأكيد حذف الحصة', 'هل أنت متأكد من حذف هذه الحصة التفاعلية؟');
        if (ok) {
          try {
            await api.deleteLiveSession(btn.dataset.id);
            showToast('تم الحذف', 'success');
            initAdminLive();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });
  };

  createPaginatedList({
    data: sessions,
    containerId: 'adminLiveList',
    searchPlaceholder: 'ابحث بعنوان الحصة أو الكورس...',
    itemsPerPage: 10,
    filterFn: (s, search) => !search || s.title.toLowerCase().includes(search) || (s.course_title && s.course_title.toLowerCase().includes(search)),
    renderList: (items, totalFiltered) => {
      if (totalFiltered === 0) return '<div class="empty-state"><span class="material-symbols-rounded">live_tv</span><h3>لا توجد حصص مطابقة</h3></div>';
      return items.map(s => `<div class="live-card"><div class="stat-icon purple" style="width:45px;height:45px;font-size:1.1rem;flex-shrink:0;background:#EDE9FE;color:#7C3AED"><span class="material-symbols-rounded">live_tv</span></div>
        <div style="flex:1"><h3 style="font-weight:700;font-size:0.9rem">${escA(s.title)}</h3><div style="font-size:0.78rem;color:var(--text-muted)">${formatDate(s.scheduled_at)} · ${escA(s.course_title || '')}</div></div>
        <span class="badge ${s.status === 'upcoming' ? 'badge-info' : s.status === 'live' ? 'badge-danger' : 'badge-success'}">${s.status === 'upcoming' ? 'قادمة' : s.status === 'live' ? 'مباشر' : 'انتهت'}</span>
        <div style="display:flex;gap:8px;margin-right:12px">
          <button class="btn btn-ghost btn-sm edit-live-btn" data-id="${s.id}" title="تعديل"><span class="material-symbols-rounded">edit</span></button>
          <button class="btn btn-ghost btn-sm text-danger delete-live-btn" data-id="${s.id}" title="حذف" style="color:var(--error)"><span class="material-symbols-rounded">delete</span></button>
        </div></div>`).join('');
    },
    onRender: bindLiveEvents
  });

  document.getElementById('addLiveBtn').addEventListener('click', () => {
    showModal('إضافة حصة لايف', `
      <div class="form-group"><label class="form-label">العنوان</label><input type="text" class="form-input" id="lsT"></div>
      <div class="form-group"><label class="form-label">الكورس</label><select class="form-select" id="lsC"><option value="">عام</option>${courses.map(c => `<option value="${c.id}">${escA(c.title)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">الموعد</label><input type="datetime-local" class="form-input" id="lsD"></div>
      <div class="form-group"><label class="form-label">رابط الحصة</label><input type="url" class="form-input" id="lsL" placeholder="https://meet.google.com/..." dir="ltr"></div>
      <button class="btn btn-primary btn-block" id="saveLiveBtn">حفظ</button>
    `);
    document.getElementById('saveLiveBtn').addEventListener('click', async () => {
      try {
        await api.createLiveSession({ title: document.getElementById('lsT').value, course_id: document.getElementById('lsC').value || null, scheduled_at: new Date(document.getElementById('lsD').value).toISOString(), meeting_link: document.getElementById('lsL').value });
        showToast('تم إضافة الحصة', 'success');
        document.querySelector('.modal-overlay')?.remove();
        initAdminLive();
      } catch (err) { showToast(err.message, 'error'); }
    });
  });
}

export function renderAdminNotifications() {
  return `<div class="app-layout">${renderNavbar('admin-notifications')}<main class="main-content">
    <div class="page-header"><h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--warning)">notifications</span> إرسال إشعارات</h1></div>
    <div class="card" style="max-width:600px">
      <div class="form-group"><label class="form-label">العنوان</label><input type="text" class="form-input" id="notifTitle"></div>
      <div class="form-group"><label class="form-label">الرسالة</label><textarea class="form-input" id="notifMsg" rows="3"></textarea></div>
      <div class="form-group"><label class="form-label">إرسال إلى</label><select class="form-select" id="notifTarget"><option value="all">كل الطلاب</option></select></div>
      <button class="btn btn-primary" id="sendNotifBtn"><span class="material-symbols-rounded">send</span> إرسال</button>
    </div>
  </main></div>`;
}

export async function initAdminNotifications() {
  initNavbar();
  try {
    const courses = await api.getCourses();
    const targetSelect = document.getElementById('notifTarget');
    courses.forEach(c => {
      targetSelect.innerHTML += `<option value="${c.id}">${escA(c.title)}</option>`;
    });
  } catch (err) {
    console.error(err);
  }

  document.getElementById('sendNotifBtn').addEventListener('click', async () => {
    const target = document.getElementById('notifTarget').value;
    try {
      await api.sendNotification({ 
        title: document.getElementById('notifTitle').value, 
        message: document.getElementById('notifMsg').value, 
        course_id: target !== 'all' ? parseInt(target) : undefined 
      });
      showToast('تم إرسال الإشعار بنجاح', 'success');
      document.getElementById('notifTitle').value = '';
      document.getElementById('notifMsg').value = '';
    } catch (err) { showToast(err.message, 'error'); }
  });
}
