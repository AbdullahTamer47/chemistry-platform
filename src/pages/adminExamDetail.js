import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { showModal, confirmModal } from '../components/modal.js';
import { formatDate } from '../utils/helpers.js';
import { exportToCSV } from '../utils/export.js';

export function renderAdminExamDetail(id) {
  return `<div class="app-layout">
    ${renderNavbar('admin-exams')}
    <main class="main-content">
      <div id="aedContent"><div class="loading-spinner"><div class="spinner"></div></div></div>
    </main>
  </div>`;
}

export async function initAdminExamDetail(id) {
  initNavbar();

  let activeTab = 'questions'; // 'questions' or 'submissions'
  let currentExam = null;
  let currentUploadedImage = null;

  async function loadExam() {
    try {
      const exam = await api.getExam(id);
      currentExam = exam;
      renderExamView();
    } catch (err) {
      document.getElementById('aedContent').innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>${err.message}</h3></div>`;
    }
  }

  function renderExamView() {
    const exam = currentExam;
    document.getElementById('aedContent').innerHTML = `
      <a href="#/admin/exams" style="display:inline-flex;align-items:center;gap:6px;color:var(--text-muted);font-size:0.88rem;margin-bottom:16px">
        <span class="material-symbols-rounded">arrow_forward</span> الرجوع للامتحانات
      </a>
      
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="margin-bottom:4px">${exam.title}</h1>
          <p class="page-subtitle">${exam.duration_minutes} دقيقة · ${exam.questions.length} سؤال · درجة النجاح ${exam.passing_score}%</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-secondary" id="aedRefreshBtn" title="تحديث البيانات">
            <span class="material-symbols-rounded">refresh</span> تحديث
          </button>
          <button class="btn btn-primary" id="addQuestionBtn">
            <span class="material-symbols-rounded">add</span> إضافة سؤال جديد
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs" style="margin-bottom:24px;">
        <button type="button" class="tab ${activeTab === 'questions' ? 'active' : ''}" id="tabBtnQuestions">
          <span class="material-symbols-rounded">quiz</span> أسئلة الامتحان (${exam.questions.length})
        </button>
        <button type="button" class="tab ${activeTab === 'submissions' ? 'active' : ''}" id="tabBtnSubmissions">
          <span class="material-symbols-rounded">assignment_turned_in</span> نتائج وإجابات الطلاب وتصحيح المقالي
        </button>
      </div>

      <div id="tabContentArea">
        ${activeTab === 'questions' ? renderQuestionsList(exam) : '<div class="loading-spinner"><div class="spinner"></div></div>'}
      </div>
    `;

    bindTabEvents(exam);
    if (activeTab === 'questions') {
      bindQuestionEvents(exam);
    } else {
      loadSubmissionsTab();
    }
  }

  function renderQuestionsList(exam) {
    if (exam.questions.length === 0) {
      return '<div class="empty-state"><span class="material-symbols-rounded">help</span><h3>لا توجد أسئلة بعد</h3><p>اضغط على زر "إضافة سؤال جديد" لإنشاء أسئلة اختيارية، صح وخطأ، أو مقالية.</p></div>';
    }

    const typeNames = {
      mcq: 'اختيار من متعدد',
      true_false: 'صح أو خطأ',
      fill_blank: 'أكمل الفراغ',
      multi_select: 'اختيار متعدد',
      essay: 'سؤال مقالي (ورقي / كتابي)'
    };

    return `
      <div style="margin-top:16px">
        ${exam.questions.map((q, idx) => `
          <div class="question-card" style="margin-bottom:18px;position:relative;border-radius:14px;box-shadow:var(--shadow-sm);border:1px solid var(--border);">
            <div style="position:absolute;top:16px;left:16px;display:flex;gap:8px">
              <button class="btn btn-ghost btn-sm edit-q-btn" data-idx="${idx}" title="تعديل"><span class="material-symbols-rounded">edit</span></button>
              <button class="btn btn-ghost btn-sm text-danger delete-q-btn" data-qid="${q.id}" title="حذف" style="color:var(--error)"><span class="material-symbols-rounded">delete</span></button>
            </div>
            
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
              <span class="question-num">${q.order_num}</span>
              <span class="question-type-badge" style="${q.type === 'essay' ? 'background:rgba(217,119,6,0.12);color:#d97706;border:1px solid rgba(217,119,6,0.25);' : ''}">
                ${typeNames[q.type] || q.type}
              </span>
              <span style="font-size:0.78rem;color:var(--text-muted);font-weight:700">(${q.points} ${q.points > 1 ? 'درجات' : 'درجة'})</span>
            </div>
            
            <div class="question-text" style="padding-left:80px;font-size:1.05rem;line-height:1.6;font-weight:600;">${q.text}</div>
            
            ${q.image_url ? `
              <div style="margin:14px 0;">
                <img src="${q.image_url}" alt="صورة توضيحية للسؤال" style="max-height:200px;max-width:100%;border-radius:10px;border:1.5px solid var(--border);box-shadow:var(--shadow-sm);object-fit:contain;" />
              </div>
            ` : ''}
            
            ${q.options && q.type !== 'essay' ? `
              <div style="margin-top:14px;font-size:0.88rem;background:var(--bg-secondary);padding:10px 14px;border-radius:8px;">
                <strong style="color:var(--text-secondary)">الخيارات:</strong> ${q.options.map(o => o.text).join(' | ')}
              </div>
            ` : ''}

            ${q.type === 'essay' ? `
              <div style="margin-top:12px;font-size:0.86rem;background:rgba(217,119,6,0.06);border:1px dashed rgba(217,119,6,0.3);padding:10px 14px;border-radius:8px;">
                <strong style="color:#b45309">الإجابة النموذجية / معايير التصحيح:</strong>
                <p style="margin-top:4px;color:var(--text-primary);white-space:pre-wrap;">${q.correct_answer || 'لم يتم تحديد إجابة نموذجية'}</p>
              </div>
            ` : `
              <div style="margin-top:10px;font-size:0.86rem;color:var(--success);font-weight:700">
                <strong>الإجابة الصحيحة:</strong> ${q.type === 'multi_select' ? JSON.parse(q.correct_answer || '[]').join(', ') : (q.correct_answer === 'true' ? 'صح' : q.correct_answer === 'false' ? 'خطأ' : q.correct_answer || '-')}
              </div>
            `}

            ${q.explanation ? `
              <div style="margin-top:8px;font-size:0.82rem;color:var(--text-muted)">
                <strong>الشرح:</strong> ${q.explanation}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function getQuestionFormHtml(q = null, nextOrder = 1) {
    const isEdit = !!q;
    const type = q ? q.type : 'mcq';
    currentUploadedImage = q && q.image_url ? q.image_url : null;

    return `
      <div class="form-group">
        <label class="form-label">نوع السؤال</label>
        <select class="form-select" id="qType" ${isEdit ? 'disabled' : ''}>
          <option value="mcq" ${type === 'mcq' ? 'selected' : ''}>اختيار من متعدد</option>
          <option value="true_false" ${type === 'true_false' ? 'selected' : ''}>صح أو خطأ</option>
          <option value="fill_blank" ${type === 'fill_blank' ? 'selected' : ''}>أكمل الفراغ</option>
          <option value="multi_select" ${type === 'multi_select' ? 'selected' : ''}>اختيار متعدد (أكثر من إجابة)</option>
          <option value="essay" ${type === 'essay' ? 'selected' : ''}>سؤال مقالي (كتابة خطوات حل / إرفاق ورقة الإجابة)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">نص السؤال</label>
        <textarea class="form-input" id="qText" rows="3" placeholder="اكتب نص السؤال الكيميائي أو المسألة..." required>${q ? q.text : ''}</textarea>
      </div>

      <!-- Question Image Upload / URL -->
      <div class="form-group" style="background:var(--bg-secondary);padding:14px;border-radius:10px;border:1px solid var(--border);">
        <label class="form-label" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:700;"><span class="material-symbols-rounded" style="vertical-align:middle;font-size:1.1rem;color:var(--primary);">image</span> صورة السؤال أو المعادلة / الرسم البياني</span>
          <span style="font-size:0.75rem;color:var(--text-muted);">(اختياري)</span>
        </label>
        
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <span class="material-symbols-rounded">upload_file</span> رفع صورة من جهازك
            <input type="file" id="qImageFile" accept="image/*" style="display:none;">
          </label>
          <span style="font-size:0.78rem;color:var(--text-muted)">أو ضع رابط مباشر:</span>
        </div>
        
        <input type="url" class="form-input" id="qImage" value="${q && q.image_url ? q.image_url : ''}" placeholder="https://... رابط صورة خارجي" dir="ltr">
        
        <div id="qImagePreviewWrap" style="margin-top:12px;${currentUploadedImage ? '' : 'display:none;'}">
          <img id="qImagePreview" src="${currentUploadedImage || ''}" alt="معاينة صورة السؤال" style="max-height:160px;max-width:100%;border-radius:8px;border:1px solid var(--border);display:block;margin-bottom:8px;object-fit:contain;background:#fff;" />
          <button type="button" class="btn btn-ghost btn-sm text-danger" id="qRemoveImageBtn" style="color:var(--error);font-size:0.8rem;">
            <span class="material-symbols-rounded" style="font-size:1rem;">delete</span> حذف الصورة المرفقة
          </button>
        </div>
      </div>

      <div style="display:flex;gap:12px">
        <div class="form-group" style="flex:1">
          <label class="form-label">الدرجات</label>
          <input type="number" class="form-input" id="qPoints" value="${q ? q.points : 1}" min="1">
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">الترتيب</label>
          <input type="number" class="form-input" id="qOrder" value="${q ? q.order_num : nextOrder}">
        </div>
      </div>

      <div id="qOptionsArea">
        <!-- Injected dynamically based on type -->
      </div>

      <div class="form-group">
        <label class="form-label">شرح وتوضيح الإجابة (يظهر للطالب بعد إنهاء الامتحان)</label>
        <textarea class="form-input" id="qExp" rows="2" placeholder="شرح مبسط للمعادلة أو سبب اختيار الإجابة...">${q ? q.explanation || '' : ''}</textarea>
      </div>

      <button class="btn btn-primary btn-block" id="saveQuestionBtn" style="padding:12px;font-size:1rem;margin-top:10px;">
        <span class="material-symbols-rounded">save</span> ${isEdit ? 'تحديث السؤال' : 'حفظ السؤال في الامتحان'}
      </button>
    `;
  }

  function initImageUploadHandlers() {
    const fileInput = document.getElementById('qImageFile');
    const urlInput = document.getElementById('qImage');
    const previewWrap = document.getElementById('qImagePreviewWrap');
    const previewImg = document.getElementById('qImagePreview');
    const removeBtn = document.getElementById('qRemoveImageBtn');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!/^image\//.test(file.type)) return showToast('يرجى اختيار ملف صورة صالح', 'warning');
        if (file.size > 3 * 1024 * 1024) return showToast('حجم الصورة يجب ألا يتجاوز 3 ميجا', 'warning');
        
        const reader = new FileReader();
        reader.onload = () => {
          currentUploadedImage = reader.result;
          if (previewImg) previewImg.src = reader.result;
          if (previewWrap) previewWrap.style.display = 'block';
          if (urlInput) urlInput.value = '';
          showToast('تم تحميل الصورة بنجاح', 'success');
        };
        reader.readAsDataURL(file);
      });
    }

    if (urlInput) {
      urlInput.addEventListener('input', () => {
        const val = urlInput.value.trim();
        if (val) {
          currentUploadedImage = val;
          if (previewImg) previewImg.src = val;
          if (previewWrap) previewWrap.style.display = 'block';
        } else if (!fileInput?.files?.length) {
          currentUploadedImage = null;
          if (previewWrap) previewWrap.style.display = 'none';
        }
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        currentUploadedImage = null;
        if (fileInput) fileInput.value = '';
        if (urlInput) urlInput.value = '';
        if (previewWrap) previewWrap.style.display = 'none';
        if (previewImg) previewImg.src = '';
      });
    }
  }

  function updateOptionsArea(type, q = null) {
    const area = document.getElementById('qOptionsArea');
    if (!area) return;

    if (type === 'mcq' || type === 'multi_select') {
      const opts = q && q.options ? q.options : [{ id: 'opt1', text: '' }, { id: 'opt2', text: '' }, { id: 'opt3', text: '' }, { id: 'opt4', text: '' }];
      let correct = q ? q.correct_answer : '';
      let correctArr = type === 'multi_select' ? (correct ? JSON.parse(correct) : []) : [correct];

      area.innerHTML = `
        <label class="form-label" style="display:flex;justify-content:space-between;">
          <span>الخيارات والإجابة الصحيحة</span>
          <small style="color:var(--text-muted);">${type === 'multi_select' ? 'حدد كل الإجابات الصحيحة' : 'حدد الإجابة الصحيحة بالدائرة'}</small>
        </label>
        ${opts.map((o, i) => `
          <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
            <input type="${type === 'mcq' ? 'radio' : 'checkbox'}" name="qCorrectOpt" value="${o.id}" ${correctArr.includes(o.id) ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer;">
            <input type="text" class="form-input q-opt-input" data-id="${o.id}" value="${o.text}" placeholder="خيار ${i + 1}" style="flex:1">
          </div>
        `).join('')}
      `;
    } else if (type === 'true_false') {
      area.innerHTML = `
        <div class="form-group"><label class="form-label">الإجابة الصحيحة</label>
          <select class="form-select" id="qCorrectTF">
            <option value="true" ${q && q.correct_answer === 'true' ? 'selected' : ''}>صح</option>
            <option value="false" ${q && q.correct_answer === 'false' ? 'selected' : ''}>خطأ</option>
          </select>
        </div>
      `;
    } else if (type === 'fill_blank') {
      area.innerHTML = `
        <div class="form-group"><label class="form-label">الإجابة الصحيحة المقبولة</label>
          <input type="text" class="form-input" id="qCorrectFB" value="${q ? q.correct_answer : ''}" placeholder="الكلمة أو الرقم الصحيح بدقة..." required>
        </div>
      `;
    } else if (type === 'essay') {
      area.innerHTML = `
        <div class="form-group" style="background:rgba(217,119,6,0.06);padding:14px;border-radius:10px;border:1px dashed rgba(217,119,6,0.3);">
          <label class="form-label" style="color:#b45309;font-weight:700;">الإجابة النموذجية ومعايير توزيع الدرجات (مرجع للمعلم أثناء التصحيح)</label>
          <textarea class="form-input" id="qCorrectEssay" rows="3" placeholder="اكتب خطوات الحل النموذجية وتوزيع الدرجات هنا لتسهيل مراجعة إجابات الطلاب...">${q ? q.correct_answer || '' : ''}</textarea>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:6px;display:flex;align-items:center;gap:6px;">
            <span class="material-symbols-rounded" style="font-size:1rem;color:var(--primary);">info</span>
            <span>الطالب سيتمكن من كتابة الحل نصياً، أو تصوير ورقة إجابته المكتوبة باليد ورفعها. وستظهر لك للمراجعة والتصحيح.</span>
          </div>
        </div>
      `;
    }
  }

  function getQuestionData(type) {
    const data = {
      type,
      text: document.getElementById('qText').value.trim(),
      points: parseInt(document.getElementById('qPoints').value) || 1,
      order_num: parseInt(document.getElementById('qOrder').value) || 1,
      explanation: document.getElementById('qExp').value.trim(),
      image_url: currentUploadedImage || document.getElementById('qImage')?.value?.trim() || null
    };

    if (type === 'mcq') {
      data.options = Array.from(document.querySelectorAll('.q-opt-input')).map(inp => ({ id: inp.dataset.id, text: inp.value.trim() })).filter(o => o.text !== '');
      data.correct_answer = document.querySelector('input[name="qCorrectOpt"]:checked')?.value || '';
    } else if (type === 'multi_select') {
      data.options = Array.from(document.querySelectorAll('.q-opt-input')).map(inp => ({ id: inp.dataset.id, text: inp.value.trim() })).filter(o => o.text !== '');
      const selected = Array.from(document.querySelectorAll('input[name="qCorrectOpt"]:checked')).map(cb => cb.value);
      data.correct_answer = JSON.stringify(selected);
    } else if (type === 'true_false') {
      data.correct_answer = document.getElementById('qCorrectTF').value;
    } else if (type === 'fill_blank') {
      data.correct_answer = document.getElementById('qCorrectFB').value.trim();
    } else if (type === 'essay') {
      data.correct_answer = document.getElementById('qCorrectEssay')?.value?.trim() || 'إجابة نموذجية مقالية';
      data.options = null;
    }
    return data;
  }

  function bindTabEvents(exam) {
    document.getElementById('aedRefreshBtn')?.addEventListener('click', loadExam);

    document.getElementById('tabBtnQuestions')?.addEventListener('click', () => {
      activeTab = 'questions';
      renderExamView();
    });

    document.getElementById('tabBtnSubmissions')?.addEventListener('click', () => {
      activeTab = 'submissions';
      renderExamView();
    });
  }

  function bindQuestionEvents(exam) {
    // Add Question
    document.getElementById('addQuestionBtn')?.addEventListener('click', () => {
      showModal('إضافة سؤال جديد', getQuestionFormHtml(null, exam.questions.length + 1));
      initImageUploadHandlers();
      const typeSel = document.getElementById('qType');
      updateOptionsArea(typeSel.value);
      typeSel.addEventListener('change', (e) => updateOptionsArea(e.target.value));

      document.getElementById('saveQuestionBtn').addEventListener('click', async () => {
        try {
          const data = getQuestionData(typeSel.value);
          if (!data.text) return showToast('يرجى كتابة نص السؤال', 'warning');
          if (data.type === 'mcq' && !data.correct_answer) return showToast('يرجى تحديد الإجابة الصحيحة', 'warning');
          
          await api.addQuestion(id, data);
          showToast('تم إضافة السؤال بنجاح', 'success');
          document.querySelector('.modal-overlay')?.remove();
          loadExam();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    // Edit Question
    document.querySelectorAll('.edit-q-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = exam.questions[btn.dataset.idx];
        showModal('تعديل السؤال', getQuestionFormHtml(q));
        initImageUploadHandlers();
        updateOptionsArea(q.type, q);

        document.getElementById('saveQuestionBtn').addEventListener('click', async () => {
          try {
            const data = getQuestionData(q.type);
            if (!data.text) return showToast('يرجى كتابة نص السؤال', 'warning');
            await api.updateQuestion(q.id, data);
            showToast('تم تحديث السؤال بنجاح', 'success');
            document.querySelector('.modal-overlay')?.remove();
            loadExam();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    });

    // Delete Question
    document.querySelectorAll('.delete-q-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal('تأكيد حذف السؤال', 'هل أنت متأكد من حذف هذا السؤال نهائياً من الامتحان؟');
        if (ok) {
          try {
            await api.deleteQuestion(btn.dataset.qid);
            showToast('تم حذف السؤال', 'success');
            loadExam();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });
  }

  // ---------------- Submissions & Essay Grading ----------------
  async function loadSubmissionsTab() {
    const container = document.getElementById('tabContentArea');
    if (!container) return;
    try {
      const data = await api.getExamSubmissions(id);
      renderSubmissionsList(data);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>تعذر تحميل النتائج</h3><p>${err.message}</p></div>`;
    }
  }

  function renderSubmissionsList(data) {
    const container = document.getElementById('tabContentArea');
    const { exam, questions, attempts } = data;
    const hasEssayQuestions = questions.some(q => q.type === 'essay');

    if (!attempts || attempts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-rounded">assignment_late</span>
          <h3>لا توجد تسليمات حتى الآن</h3>
          <p>عندما يبدأ الطلاب في حل هذا الامتحان وتسليمه، ستظهر إجاباتهم ودرجاتهم هنا مباشرة للمراجعة والتصحيح.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="background:var(--bg-card);border-radius:14px;border:1px solid var(--border);padding:20px;margin-top:16px;box-shadow:var(--shadow-sm);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div>
            <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-primary);margin-bottom:4px;">
              تسليمات وإجابات الطلاب (${attempts.length} طالب)
            </h3>
            <p style="font-size:0.82rem;color:var(--text-muted);">
              ${hasEssayQuestions ? '💡 يحتوي هذا الامتحان على أسئلة مقالية تتطلب مراجعة المعلم واعتماد الدرجات.' : 'جميع الأسئلة موضوعية ومصححة تلقائياً.'}
            </p>
          </div>
          <button class="btn btn-secondary btn-sm" id="exportExamCsvBtn" style="display:inline-flex;align-items:center;gap:6px;">
            <span class="material-symbols-rounded" style="font-size:1.1rem;color:var(--success);">table_view</span> تصدير النتائج Excel
          </button>
        </div>

        <div class="mobile-swipe-hint"><span class="material-symbols-rounded">swipe</span> اسحب أفقياً لعرض باقي تفاصيل الطلاب ونتائجهم</div>
        <div class="table-wrapper">
          <table style="width:100%;min-width:650px;border-collapse:collapse;font-size:0.9rem;text-align:right;">
            <thead>
              <tr style="border-bottom:2px solid var(--border);color:var(--text-secondary);font-size:0.82rem;">
                <th style="padding:10px 12px;">الطالب</th>
                <th style="padding:10px 12px;">رقم الهاتف</th>
                <th style="padding:10px 12px;">تاريخ التسليم</th>
                <th style="padding:10px 12px;">الدرجة</th>
                <th style="padding:10px 12px;">حالة التصحيح</th>
                <th style="padding:10px 12px;text-align:left;">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              ${attempts.map(att => {
                const isPending = hasEssayQuestions && att.is_graded === 0;
                return `
                  <tr style="border-bottom:1px solid var(--border-light);">
                    <td style="padding:12px;font-weight:700;color:var(--text-primary);">
                      <div style="display:flex;align-items:center;gap:8px;">
                        <span class="material-symbols-rounded" style="color:var(--primary);font-size:1.3rem;">account_circle</span>
                        <span>${att.student_name}</span>
                      </div>
                    </td>
                    <td style="padding:12px;color:var(--text-muted);font-family:monospace;" dir="ltr">${att.student_phone || '-'}</td>
                    <td style="padding:12px;color:var(--text-secondary);font-size:0.82rem;">${formatDate(att.completed_at)}</td>
                    <td style="padding:12px;font-weight:800;">
                      <span style="font-size:1.05rem;color:${att.score >= exam.passing_score ? 'var(--success)' : 'var(--error)'};">
                        ${att.score}%
                      </span>
                      <small style="color:var(--text-muted);display:block;font-size:0.75rem;">(من ${att.total_points} درجة)</small>
                    </td>
                    <td style="padding:12px;">
                      ${isPending ? `
                        <span class="badge badge-warning" style="display:inline-flex;align-items:center;gap:4px;font-weight:700;">
                          <span class="material-symbols-rounded" style="font-size:0.95rem;">pending_actions</span> بانتظار تصحيح المقالي ✍️
                        </span>
                      ` : `
                        <span class="badge badge-success" style="display:inline-flex;align-items:center;gap:4px;font-weight:700;">
                          <span class="material-symbols-rounded" style="font-size:0.95rem;">verified</span> تم التصحيح والاعتماد ✅
                        </span>
                      `}
                    </td>
                    <td style="padding:12px;text-align:left;">
                      <button class="btn btn-primary btn-sm grade-attempt-btn" data-aid="${att.id}" style="padding:6px 14px;font-size:0.82rem;">
                        <span class="material-symbols-rounded" style="font-size:1rem;">rate_review</span> مراجعة وتصحيح
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelector('#exportExamCsvBtn')?.addEventListener('click', () => {
      const headers = ['اسم الطالب', 'رقم الهاتف', 'النسبة المئوية', 'الدرجة المحققة', 'إجمالي الدرجات', 'حالة التصحيح', 'تاريخ التسليم', 'ملاحظات المعلم'];
      const rows = attempts.map(att => [
        att.student_name,
        att.student_phone || '',
        `${att.score}%`,
        att.score,
        att.total_points,
        att.is_graded === 0 ? 'بانتظار تصحيح المقالي' : (att.score >= exam.passing_score ? 'ناجح' : 'راسب'),
        formatDate(att.completed_at),
        att.teacher_feedback || ''
      ]);
      exportToCSV(`نتائج_${exam.title.replace(/[^\u0600-\u06FF\w]/g, '_')}`, headers, rows);
      showToast('تم تصدير كشف الدرجات بنجاح بصيغة Excel', 'success');
    });

    container.querySelectorAll('.grade-attempt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const attempt = attempts.find(a => String(a.id) === btn.dataset.aid);
        if (attempt) openGradingModal(exam, questions, attempt);
      });
    });
  }

  function openGradingModal(exam, questions, attempt) {
    const answers = attempt.answers || {};
    const essayGrades = attempt.essay_grades || {};
    const hasEssay = questions.some(q => q.type === 'essay');

    const modalContent = `
      <div style="max-height:75vh;overflow-y:auto;padding-left:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;background:var(--bg-secondary);padding:12px 16px;border-radius:10px;margin-bottom:16px;">
          <div>
            <div style="font-weight:800;font-size:1.05rem;color:var(--text-primary);">${attempt.student_name}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;" dir="ltr">${attempt.student_phone || ''} · ${formatDate(attempt.completed_at)}</div>
          </div>
          <div style="text-align:left;">
            <div style="font-size:1.3rem;font-weight:900;color:${attempt.score >= exam.passing_score ? 'var(--success)' : 'var(--error)'};">
              ${attempt.score}%
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);font-weight:700;">الدرجة الحالية</div>
          </div>
        </div>

        <h4 style="font-size:1rem;font-weight:800;color:var(--text-primary);margin-bottom:14px;display:flex;align-items:center;gap:6px;">
          <span class="material-symbols-rounded" style="color:var(--primary);">fact_check</span> إجابات الطالب والأسئلة المقالية
        </h4>

        ${questions.map((q, qIndex) => {
          const userAns = answers[q.id];
          const isEssay = q.type === 'essay';
          const savedGrade = essayGrades[q.id] || {};
          const currentEssayScore = savedGrade.points !== undefined ? savedGrade.points : (isEssay ? Math.round(q.points * 0.9) : 0);
          const currentEssayComment = savedGrade.comment || '';

          let textAnswer = '';
          let imageAnswer = '';

          if (isEssay) {
            textAnswer = typeof userAns === 'object' ? (userAns?.text || '') : (userAns || '');
            imageAnswer = typeof userAns === 'object' ? (userAns?.image_url || '') : '';
          }

          return `
            <div class="question-card" style="margin-bottom:16px;border-radius:12px;border:1.5px solid ${isEssay ? '#d97706' : 'var(--border)'};background:var(--bg-card);padding:16px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                <span class="question-num">${qIndex + 1}</span>
                <span class="badge ${isEssay ? 'badge-warning' : 'badge-info'}" style="font-weight:700;">
                  ${isEssay ? 'سؤال مقالي' : (q.type === 'mcq' ? 'اختياري' : q.type === 'true_false' ? 'صح/خطأ' : q.type === 'fill_blank' ? 'أكمل' : 'متعدد')}
                </span>
                <span style="font-size:0.78rem;color:var(--text-muted);margin-right:auto;font-weight:700;">
                  درجة السؤال: ${q.points}
                </span>
              </div>

              <div style="font-size:0.98rem;font-weight:700;color:var(--text-primary);margin-bottom:10px;">${q.text}</div>
              
              ${q.image_url ? `
                <div style="margin-bottom:12px;">
                  <img src="${q.image_url}" alt="صورة السؤال" style="max-height:160px;max-width:100%;border-radius:8px;border:1px solid var(--border);" />
                </div>
              ` : ''}

              ${isEssay ? `
                <div style="background:rgba(217,119,6,0.05);border:1px dashed rgba(217,119,6,0.25);padding:14px;border-radius:10px;margin-top:12px;">
                  <div style="font-size:0.85rem;font-weight:800;color:#b45309;margin-bottom:8px;">إجابة الطالب:</div>
                  
                  <div style="background:var(--bg-card);padding:10px 14px;border-radius:8px;border:1px solid var(--border);color:var(--text-primary);font-size:0.92rem;line-height:1.6;white-space:pre-wrap;">
                    ${textAnswer || '<span style="color:var(--text-muted);">(لم يكتب الطالب إجابة نصية)</span>'}
                  </div>

                  ${imageAnswer ? `
                    <div style="margin-top:12px;">
                      <div style="font-size:0.82rem;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">
                        <span class="material-symbols-rounded" style="vertical-align:middle;font-size:1.1rem;color:var(--primary);">photo_camera</span>
                        ورقة إجابة الطالب المرفقة (اضغط للتكبير):
                      </div>
                      <a href="${imageAnswer}" target="_blank" title="اضغط لفتح الصورة بحجمها الكامل">
                        <img src="${imageAnswer}" alt="صورة حل الطالب" style="max-height:220px;max-width:100%;border-radius:8px;border:2px solid var(--border);box-shadow:var(--shadow-sm);cursor:zoom-in;" />
                      </a>
                    </div>
                  ` : `
                    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">(لم يقم الطالب برفع صورة ورقية)</div>
                  `}

                  <div style="margin-top:14px;background:#fff;padding:12px;border-radius:8px;border:1px solid var(--border);">
                    <div style="font-size:0.82rem;font-weight:800;color:var(--text-secondary);margin-bottom:4px;">الإجابة النموذجية المحددة بالسؤال:</div>
                    <div style="font-size:0.85rem;color:var(--text-muted);">${q.correct_answer || 'لا توجد'}</div>
                  </div>

                  <!-- Grading inputs -->
                  <div style="margin-top:14px;display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;">
                    <div style="flex:0 0 160px;">
                      <label class="form-label" style="font-weight:800;color:#b45309;">الدرجة المستحقة</label>
                      <div style="display:flex;align-items:center;gap:6px;">
                        <input type="number" class="form-input essay-score-input" data-qid="${q.id}" min="0" max="${q.points}" step="0.5" value="${currentEssayScore}" style="font-weight:800;font-size:1.05rem;width:80px;text-align:center;">
                        <span style="font-weight:700;color:var(--text-muted)">/ ${q.points}</span>
                      </div>
                    </div>
                    <div style="flex:1;min-width:200px;">
                      <label class="form-label" style="font-weight:700;">ملاحظة أو توجيه للطالب على هذا السؤال</label>
                      <input type="text" class="form-input essay-comment-input" data-qid="${q.id}" value="${currentEssayComment}" placeholder="مثال: أحسنت في المعادلة، ولكن انتبه لوزن الأكسجين...">
                    </div>
                  </div>
                </div>
              ` : `
                <!-- Auto graded review -->
                <div style="background:var(--bg-secondary);padding:10px 14px;border-radius:8px;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                  <div>
                    <span>إجابة الطالب: <strong>${userAns !== undefined ? String(userAns) : '(لم يجب)'}</strong></span>
                    <span style="margin-right:16px;">الصحيح: <strong style="color:var(--success);">${q.correct_answer}</strong></span>
                  </div>
                  <span class="badge ${String(userAns) === String(q.correct_answer) ? 'badge-success' : 'badge-danger'}">
                    ${String(userAns) === String(q.correct_answer) ? `+${q.points} درجة` : '0 درجة'}
                  </span>
                </div>
              `}
            </div>
          `;
        }).join('')}

        <!-- General Feedback -->
        <div class="form-group" style="margin-top:16px;">
          <label class="form-label" style="font-weight:800;">ملاحظات عامة وتوجيه شامل للطالب من أ/ زياد رمزي</label>
          <textarea class="form-input" id="teacherOverallFeedback" rows="2" placeholder="اكتب تقييمك الشامل للطالب وتوجيهات المذاكرة...">${attempt.teacher_feedback || ''}</textarea>
        </div>

        <div style="display:flex;gap:12px;margin-top:20px;">
          <button type="button" class="btn btn-primary" id="saveGradingBtn" style="flex:1;padding:12px;font-weight:800;">
            <span class="material-symbols-rounded">verified</span> حفظ التصحيح واعتماد النتيجة النهائية
          </button>
        </div>
      </div>
    `;

    showModal(`مراجعة وتصحيح امتحان: ${attempt.student_name}`, modalContent);

    document.getElementById('saveGradingBtn')?.addEventListener('click', async () => {
      const essay_grades = {};
      document.querySelectorAll('.essay-score-input').forEach(input => {
        const qid = input.dataset.qid;
        const pts = parseFloat(input.value) || 0;
        const commentInput = document.querySelector(`.essay-comment-input[data-qid="${qid}"]`);
        essay_grades[qid] = {
          points: pts,
          comment: commentInput ? commentInput.value.trim() : ''
        };
      });

      const teacher_feedback = document.getElementById('teacherOverallFeedback')?.value?.trim() || '';

      const btn = document.getElementById('saveGradingBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري الحفظ والاعتماد...';

      try {
        const res = await api.gradeEssaySubmission(attempt.id, { essay_grades, teacher_feedback });
        showToast(res.message || 'تم اعتماد النتيجة وإرسال إشعار للطالب بنجاح', 'success');
        document.querySelector('.modal-overlay')?.remove();
        loadSubmissionsTab();
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded">verified</span> حفظ التصحيح واعتماد النتيجة النهائية';
      }
    });
  }

  loadExam();
}
