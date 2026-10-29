import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { showModal, confirmModal } from '../components/modal.js';
import { formatTime, esc, escRich, safeUrl } from '../utils/helpers.js';

export function renderExams() {
  return `
  <div class="app-layout">
    ${renderNavbar('exams')}
    <main class="main-content">
      <div class="page-header" style="display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
          <div>
            <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--accent)">assignment</span> الامتحانات والواجبات</h1>
            <p class="page-subtitle">اختبر مستواك العلمي بشكل دوري وتابع تقييمات المحاضرات والواجبات</p>
          </div>
          <div class="search-wrapper" style="max-width: 320px; width: 100%; position: relative;">
            <span class="material-symbols-rounded input-icon" style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">search</span>
            <input type="text" class="form-input" id="examSearch" placeholder="ابحث عن امتحان أو واجب..." style="padding-right: 44px;">
          </div>
        </div>
      </div>

      <!-- ADAPTIVE MISTAKES QUIZ BANNER -->
      <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg, rgba(5,150,105,0.1), rgba(16,185,129,0.06));border:1px solid rgba(5,150,105,0.25);padding:18px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div class="stat-icon green" style="width:44px;height:44px;border-radius:10px;">
            <span class="material-symbols-rounded">psychology</span>
          </div>
          <div>
            <strong style="font-size:1rem;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
              <span>امتحان علاجي مخصص: تدريب مكثف على أخطائك السابقة</span>
            </strong>
            <small style="color:var(--text-secondary);">اختبار تفاعلي يجمع الأسئلة التي تعثرت فيها في امتحاناتك السابقة لإتقانها ومعالجة نقاط الضعف.</small>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="adaptiveQuizBtn" style="gap:6px;font-weight:800;padding:8px 18px;">
          <span class="material-symbols-rounded">rocket_launch</span> بدء التدريب المخصص
        </button>
      </div>

      <div id="examsList">
        <div class="skeleton" style="height: 100px; border-radius: var(--radius-xl); margin-bottom:14px;"></div>
        <div class="skeleton" style="height: 100px; border-radius: var(--radius-xl); margin-bottom:14px;"></div>
      </div>
    </main>
  </div>`;
}

export async function initExams() {
  initNavbar();
  try {
    const exams = await api.getExams();
    const container = document.getElementById('examsList');
    if (!container) return;

    if (exams.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-rounded">assignment</span>
          <h3>لا توجد امتحانات أو واجبات متاحة حالياً</h3>
          <p>سيظهر هنا أي امتحان أو واجب جديد يضيفه المعلم في الكورسات المسجلة.</p>
        </div>
      `;
      return;
    }

    const renderExamsList = (examsList) => {
      if (examsList.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="material-symbols-rounded">assignment</span>
            <h3>لا توجد نتائج مطابقة</h3>
            <p>لم يتم العثور على امتحانات مطابقة لبحثك.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = examsList.map(e => {
        const best = e.my_best_score;
        const isTaken = best != null;
        const passingScore = e.passing_score || 60;
        const isPassed = isTaken && best >= passingScore;
        const isHomework = e.exam_type === 'homework';
        
        let statusClass = 'gold';
        let iconColor = 'var(--gold-700)';
        let iconBg = 'var(--gold-100)';
        let badgeText = 'لم يُختبر بعد';
        let badgeClass = 'badge-warning';

        if (isTaken) {
          statusClass = isPassed ? 'green' : 'red';
          iconColor = isPassed ? 'var(--green-700)' : 'var(--error)';
          iconBg = isPassed ? 'var(--green-100)' : '#FEE2E2';
          badgeText = isPassed ? 'اجتياز بنجاح' : 'لم يجتز';
          badgeClass = isPassed ? 'badge-success' : 'badge-danger';
        }

        const effectiveMax = isHomework ? 0 : ((e.max_attempts || 1) + (e.extra_attempts || 0));
        const attemptsExhausted = !isHomework && effectiveMax > 0 && (e.my_attempts || 0) >= effectiveMax;
        const isLocked = !isHomework && (Boolean(e.my_locked) || attemptsExhausted);

        if (e.my_locked) {
          badgeText = 'مغلق (بانتظار إذن المعلم)';
          badgeClass = 'badge-danger';
        }

        return `
          <div class="exam-card">
            <div class="exam-icon ${statusClass}" style="background:${iconBg}; color:${iconColor}; flex-shrink:0;">
              <span class="material-symbols-rounded">${isHomework ? 'menu_book' : 'assignment'}</span>
            </div>
            
            <div class="exam-info">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                <h3 style="font-weight: 800; font-size: 1rem; color: var(--text-primary); margin: 0;">${esc(e.title)}</h3>
                <span class="badge ${isHomework ? 'badge-info' : 'badge-warning'}" style="font-size:0.72rem;">
                  ${isHomework ? 'واجب منزلي' : 'امتحان تقييمي'}
                </span>
                ${Number(e.has_certificate) === 1 ? `
                  <span class="badge badge-success" style="font-size:0.7rem;display:inline-flex;align-items:center;gap:3px;">
                    <span class="material-symbols-rounded" style="font-size:0.85rem;">workspace_premium</span> يمنح شهادة
                  </span>
                ` : ''}
              </div>
              <div class="exam-meta">
                <span><span class="material-symbols-rounded" style="font-size:1.05rem;">schedule</span> ${e.duration_minutes} دقيقة</span>
                <span><span class="material-symbols-rounded" style="font-size:1.05rem;">help</span> ${e.question_count} سؤال</span>
                <span><span class="material-symbols-rounded" style="font-size:1.05rem;">repeat</span> المحاولات: ${e.my_attempts || 0} من ${isHomework ? 'مفتوح' : effectiveMax}</span>
                ${e.course_title ? `<span><span class="material-symbols-rounded" style="font-size:1.05rem;">book</span> ${esc(e.course_title)}</span>` : ''}
              </div>
            </div>
            
            ${isTaken 
              ? `
              <div style="text-align: center; margin-left: 16px; margin-right: 16px; min-width: 80px;">
                <div style="font-size: 1.45rem; font-weight: 900; color: ${isPassed ? 'var(--success)' : 'var(--error)'}; line-height:1.2;">${best}%</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; margin-top:2px;">أفضل درجة</div>
              </div>
              ` 
              : ''
            }

            <div style="display:flex; flex-direction:column; gap:6px; min-width: 170px;">
              <span class="badge ${badgeClass}" style="text-align:center; font-weight:700; width:100%;">${badgeText}</span>
              ${isTaken ? `
                <a href="/exams/${e.id}/review" class="btn btn-outline btn-sm" style="text-align:center; padding:6px 12px; font-size:0.8rem; display:flex; align-items:center; justify-content:center; gap:4px;">
                  <span class="material-symbols-rounded" style="font-size:1rem;">visibility</span> مراجعة إجاباتي والنتيجة
                </a>
              ` : ''}
              ${isLocked ? `
                ${e.my_retake_requested ? `
                  <span class="badge badge-info" style="padding:7px 10px;text-align:center;font-weight:700;">
                    <span class="material-symbols-rounded" style="font-size:0.95rem;vertical-align:middle;">hourglass_top</span> تم إرسال طلب إعادة للمعلم
                  </span>
                ` : `
                  <button type="button" class="btn btn-secondary btn-sm req-retake-btn" data-id="${e.id}" data-title="${esc(e.title)}" style="gap:4px;font-weight:700;">
                    <span class="material-symbols-rounded" style="font-size:1rem;">lock_reset</span> طلب إعادة فتح من المعلم
                  </button>
                `}
              ` : `
                <a href="/exams/${e.id}/take" class="btn btn-primary btn-sm" style="gap:4px;">
                  <span class="material-symbols-rounded" style="font-size:1rem;">play_arrow</span>
                  ${e.my_attempts > 0 ? (isHomework ? 'إعادة حل الواجب' : 'دخول المحاولة المتاحة') : (isHomework ? 'بدء حل الواجب' : 'ابدأ الامتحان')}
                </a>
              `}
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.req-retake-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const examId = btn.dataset.id;
          const examTitle = btn.dataset.title;
          showModal(`طلب إعادة فتح الامتحان: ${examTitle}`, `
            <div style="text-align:right;">
              <p style="font-size:0.88rem;color:var(--text-secondary);margin-bottom:12px;">
                سيتم إرسال طلبك مباشرة إلى المعلم (د. زياد رمزي) للموافقة على فتح محاولة جديدة لك في هذا الامتحان.
              </p>
              <div class="form-group">
                <label class="form-label">سبب طلب الإعادة أو الخروج (اختياري)</label>
                <textarea id="retakeModalReason" class="form-input" rows="3" placeholder="مثال: انقطع الاتصال بالإنترنت أثناء الحل أو أرغب في تحسين درجتي..."></textarea>
              </div>
              <button type="button" class="btn btn-primary btn-block" id="confirmRetakeReqBtn">
                <span class="material-symbols-rounded">send</span> إرسال الطلب للمعلم الآن
              </button>
            </div>
          `);
          document.getElementById('confirmRetakeReqBtn')?.addEventListener('click', async () => {
            const reason = document.getElementById('retakeModalReason')?.value.trim() || 'طلب إعادة فتح الامتحان';
            const submitBtn = document.getElementById('confirmRetakeReqBtn');
            submitBtn.disabled = true;
            try {
              const res = await api.requestExamRetake(examId, reason);
              showToast(res.message, 'success');
              document.querySelector('.modal-overlay')?.remove();
              initExams();
            } catch (err) {
              showToast(err.message, 'error');
              submitBtn.disabled = false;
            }
          });
        });
      });
    };

    renderExamsList(exams);

    const searchInput = document.getElementById('examSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
          renderExamsList(exams);
          return;
        }
        const filtered = exams.filter(ex => 
          ex.title.toLowerCase().includes(query) || 
          (ex.course_title && ex.course_title.toLowerCase().includes(query))
        );
        renderExamsList(filtered);
      });
    }

    document.getElementById('adaptiveQuizBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('adaptiveQuizBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري التجهيز...';
      try {
        const data = await api.getAdaptiveMistakesQuiz();
        sessionStorage.setItem('adaptive_quiz', JSON.stringify(data));
        showToast(`تم تجهيز ${data.count} سؤال من أخطائك للتدريب المكثف`, 'success');
        if (window.navigateTo) window.navigateTo('/exams/adaptive/take');
        else window.location.href = '/exams/adaptive/take';
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-rounded">rocket_launch</span> بدء التدريب المخصص';
      }
    });

  } catch (err) {
    showToast(err.message, 'error');
  }
}

export function renderExamTake() {
  return `
  <div style="max-width: 900px; margin: 0 auto; padding: 40px 20px 80px;">
    <div id="examTakeContent">
      <div class="loading-spinner"><div class="spinner"></div></div>
    </div>
  </div>`;
}

export async function initExamTake(id) {
  let exam, answers = {}, flagged = new Set(), timeLeft, timerInterval, startTime = Date.now();
  let isSubmitted = false;

  if (id === 'adaptive') {
    const raw = sessionStorage.getItem('adaptive_quiz');
    if (raw) {
      exam = JSON.parse(raw);
    } else {
      exam = await api.getAdaptiveMistakesQuiz();
    }
    exam.id = 'adaptive';
  } else {
    try {
      exam = await api.getExamForTaking(id);
    } catch (err) {
      const canReqRetake = err.data?.can_request_retake || err.data?.is_locked || err.data?.attempts_exhausted || (err.message && (err.message.includes('استنفذت') || err.message.includes('إغلاق')));
      const alreadyRequested = Boolean(err.data?.retake_requested);
      document.getElementById('examTakeContent').innerHTML = `
        <div class="card" style="padding:44px 28px; text-align:center; max-width:620px; margin:0 auto;">
          <span class="material-symbols-rounded" style="font-size:3.8rem; color:${canReqRetake ? 'var(--warning)' : 'var(--error)'};">
            ${canReqRetake ? 'lock_person' : 'error'}
          </span>
          <h3 style="font-weight:900; font-size:1.35rem; margin:12px 0 8px;">${canReqRetake ? 'الامتحان مغلق حالياً — يتطلب إذن المعلم للإعادة' : 'عذراً! تعذر فتح الامتحان'}</h3>
          <p style="color:var(--text-secondary); max-width:500px; margin:0 auto 22px; line-height:1.7;">${esc(err.message)}</p>
          
          ${canReqRetake ? `
            <div style="background:var(--bg-secondary); border:1px solid var(--border-light); border-radius:14px; padding:18px; margin-bottom:22px; text-align:right;">
              ${alreadyRequested ? `
                <div style="display:flex;align-items:center;gap:10px;color:var(--primary);font-weight:800;">
                  <span class="material-symbols-rounded">hourglass_top</span>
                  <span>تم إرسال طلبك للمعلم بالفعل، وسيصلك إشعار فور فتح الامتحان لك.</span>
                </div>
              ` : `
                <label class="form-label" style="font-weight:800;">طلب السماح بدخول أو إعادة الامتحان من المعلم:</label>
                <textarea id="directRetakeReason" class="form-input" rows="2" placeholder="اكتب سبب الخروج أو سبب طلب إعادة الامتحان للمعلم..." style="margin-bottom:12px;"></textarea>
                <button type="button" class="btn btn-primary btn-block" id="directRequestRetakeBtn" style="gap:8px;font-weight:800;">
                  <span class="material-symbols-rounded">lock_reset</span> إرسال طلب للمعلم لفتح الامتحان
                </button>
              `}
            </div>
          ` : ''}

          <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
            <a href="/exams/${id}/review" class="btn btn-outline">
              <span class="material-symbols-rounded">visibility</span> عرض نتيجة وتصحيح المحاولة السابقة
            </a>
            <a href="/exams" class="btn btn-secondary">العودة لصفحة الامتحانات</a>
          </div>
        </div>
      `;

      document.getElementById('directRequestRetakeBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('directRequestRetakeBtn');
        const reason = document.getElementById('directRetakeReason')?.value.trim() || 'طلب إعادة فتح الامتحان';
        btn.disabled = true;
        try {
          const res = await api.requestExamRetake(id, reason);
          showToast(res.message, 'success');
          initExamTake(id);
        } catch (e) {
          showToast(e.message, 'error');
          btn.disabled = false;
        }
      });
      return;
    }
  }

  const isStrictExam = id !== 'adaptive' && exam.exam_type !== 'homework';
  timeLeft = Number.isFinite(exam.remaining_seconds) ? exam.remaining_seconds : exam.duration_minutes * 60;
  let deadline = Date.now() + timeLeft * 1000;
  const draftKey = `exam_draft_${id}`;

  const savedDraft = localStorage.getItem(draftKey);
  if (savedDraft) {
    try {
      const parsed = JSON.parse(savedDraft);
      if (parsed.answers && Object.keys(parsed.answers).length > 0) {
        answers = parsed.answers;
      }
    } catch (e) {}
  }

  const typeLabels = { 
    mcq: 'اختيار من متعدد', 
    true_false: 'صح أو خطأ', 
    fill_blank: 'أكمل الفراغ', 
    ordering: 'ترتيب تصاعدي', 
    multi_select: 'اختر الإجابات الصحيحة',
    essay: 'سؤال مقالي (نص أو صورة بالورقة والقلم)'
  };

  function renderQuestions() {
    document.getElementById('examTakeContent').innerHTML = `
      <!-- Sticky exam timer -->
      <div class="exam-timer">
        <div>
          <h2 style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">${esc(exam.title)}</h2>
          <div style="display:flex; align-items:center; gap:12px; margin-top:2px; flex-wrap:wrap;">
            <p style="font-size: 0.74rem; color: var(--text-muted); font-weight: 600;">إجمالي الأسئلة: ${exam.questions.length} سؤال</p>
            <span id="saveStatus" style="font-size:0.72rem; color:var(--primary); font-weight:700; display:inline-flex; align-items:center; gap:4px;">
              <span class="material-symbols-rounded" style="font-size:0.95rem;">cloud_done</span> حفظ تلقائي محلي
            </span>
          </div>
        </div>
        
        <div class="timer-display" id="timerDisplay">${formatTime(timeLeft)}</div>
        
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${isStrictExam ? `
            <button type="button" class="btn btn-secondary btn-sm" id="exitExamBtn" style="color:var(--error);border-color:rgba(239,68,68,0.3);">
              <span class="material-symbols-rounded">logout</span> خروج
            </button>
          ` : `
            <a href="/exams" class="btn btn-secondary btn-sm">رجوع</a>
          `}
          <button class="btn btn-primary" id="submitExamBtn"><span class="material-symbols-rounded">done_all</span> تسليم وإرسال</button>
        </div>
      </div>
      
      <!-- Dots Navigation -->
      <div class="card" style="margin-bottom: 24px; padding: 16px;">
        <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px; display:flex; align-items:center; gap:5px;">
          <span class="material-symbols-rounded" style="font-size:1.1rem;">map</span>
          <span>خريطة الأسئلة المنهجية (اضغط للتنقل السريع):</span>
        </div>
        <div class="question-nav" id="questionNav">
          ${exam.questions.map((_, i) => `<div class="q-dot ${i === 0 ? 'current' : ''}" data-idx="${i}">${i + 1}</div>`).join('')}
        </div>
      </div>
      
      <!-- Questions wrapper -->
      <div id="questionsContainer">
        ${exam.questions.map((q, i) => renderQuestion(q, i)).join('')}
      </div>
    `;
    startTimer();
    bindEvents();
    if (isStrictExam) secureExam();
  }

  function renderQuestion(q, idx) {
    let optionsHtml = '';
    
    if (q.type === 'mcq' && q.options) {
      const letters = ['أ', 'ب', 'ج', 'د'];
      optionsHtml = q.options.map((o, oi) => `
        <div class="option-item ${answers[q.id] === o.id ? 'selected' : ''}" data-qid="${q.id}" data-val="${o.id}">
          <span class="option-letter">${letters[oi]}</span>
          <span class="option-text">${escRich(o.text)}</span>
        </div>
      `).join('');
    } else if (q.type === 'true_false') {
      optionsHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; width:100%;">
          <div class="option-item ${answers[q.id] === 'true' ? 'selected' : ''}" data-qid="${q.id}" data-val="true">
            <span class="option-letter" style="display:flex; align-items:center; justify-content:center; height:100%;"><span class="material-symbols-rounded" style="font-size:1.15rem;">check</span></span>
            <span class="option-text">صح</span>
          </div>
          <div class="option-item ${answers[q.id] === 'false' ? 'selected' : ''}" data-qid="${q.id}" data-val="false">
            <span class="option-letter" style="display:flex; align-items:center; justify-content:center; height:100%;"><span class="material-symbols-rounded" style="font-size:1.15rem;">close</span></span>
            <span class="option-text">خطأ</span>
          </div>
        </div>
      `;
    } else if (q.type === 'fill_blank') {
      const currentFill = answers[q.id] || '';
      optionsHtml = `
        <div style="width: 100%;">
          <input type="text" class="form-input fill-blank-input" data-qid="${q.id}" value="${esc(currentFill)}" placeholder="اكتب إجابتك الكيميائية الدقيقة هنا..." style="max-width: 100%;">
        </div>
      `;
    } else if (q.type === 'multi_select' && q.options) {
      const letters = ['أ', 'ب', 'ج', 'د', 'هـ'];
      const curArr = Array.isArray(answers[q.id]) ? answers[q.id] : [];
      optionsHtml = q.options.map((o, oi) => `
        <div class="option-item multi-option ${curArr.includes(o.id) ? 'selected' : ''}" data-qid="${q.id}" data-val="${esc(o.id)}">
          <span class="option-letter">${letters[oi]}</span>
          <span class="option-text">${escRich(o.text)}</span>
        </div>
      `).join('');
    } else if (q.type === 'essay') {
      const curr = answers[q.id] || {};
      const currText = typeof curr === 'string' ? curr : (curr.text || '');
      const currImg = typeof curr === 'object' ? (curr.image_url || '') : '';
      optionsHtml = `
        <div style="width: 100%;">
          <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:8px; font-weight:700;">
            <span class="material-symbols-rounded" style="vertical-align:middle; font-size:1.1rem; color:var(--primary);">edit_note</span>
            أجب كتابة أو ارفع صورة لإجابتك الورقية وحلك بالمعادلات:
          </div>
          <textarea class="form-input essay-text-input" data-qid="${q.id}" rows="3" placeholder="اكتب خطوات الحل أو الإجابة النموذجية هنا بالتفصيل..." style="width:100%; resize:vertical; line-height:1.6; font-size:0.9rem;">${esc(currText)}</textarea>
          
          <div style="margin-top:10px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <label class="btn btn-secondary btn-sm" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
              <span class="material-symbols-rounded">photo_camera</span> التقاط أو رفع صورة إجابتك بالورقة والقلم
              <input type="file" accept="image/*" capture="environment" class="essay-img-input" data-qid="${q.id}" style="display:none;">
            </label>
            <span id="essayFileStatus_${q.id}" style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">
              ${currImg ? 'تم إرفاق صورة الحل بنجاح' : 'لم يتم اختيار صورة'}
            </span>
          </div>
          <div id="essayImgPreview_${q.id}" style="margin-top:10px; ${currImg ? '' : 'display:none;'}">
            <img src="${esc(currImg)}" id="essayImgTag_${q.id}" alt="صورة إجابة الطالب" style="max-height:160px; border-radius:var(--radius-md); border:1px solid var(--border-light); box-shadow:var(--shadow-sm);" />
          </div>
        </div>
      `;
    }

    return `
      <div class="question-card" data-qidx="${idx}">
        <div style="display:flex; align-items:center; margin-bottom:16px; gap:8px; flex-wrap:wrap;">
          <span class="question-num">${idx + 1}</span>
          <span class="question-type-badge">${typeLabels[q.type] || q.type}</span>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">(${q.points} ${q.points > 1 ? 'درجات' : 'درجة'})</span>
          
          <button class="btn btn-ghost btn-sm flag-btn" data-qid="${q.id}" style="margin-right:auto; padding:4px;" title="تعليم السؤال للعودة لاحقاً">
            <span class="material-symbols-rounded">bookmark</span>
          </button>
        </div>
        
        <div class="question-text" style="margin-bottom: 20px;">${escRich(q.text)}</div>
        ${q.image_url ? `<div style="margin-bottom:18px;"><img src="${esc(q.image_url)}" alt="توضيح السؤال" style="max-width:100%;max-height:320px;border-radius:var(--radius-md);border:1px solid var(--border-light);box-shadow:var(--shadow-sm);" /></div>` : ''}
        <div class="question-options">${optionsHtml}</div>
      </div>
    `;
  }

  let autoSaveTimer = null;

  function tick() {
    timeLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const display = document.getElementById('timerDisplay');
    if (display) {
      display.textContent = formatTime(timeLeft);
      display.className = 'timer-display' + (timeLeft <= 60 ? ' danger' : timeLeft <= 300 ? ' warning' : '');
    }
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (autoSaveTimer) clearInterval(autoSaveTimer);
      showToast('انتهى وقت الامتحان! جاري التسليم التلقائي...', 'warning');
      submitExam();
      return false;
    }
    return true;
  }

  function startTimer() {
    clearInterval(timerInterval);
    if (!tick()) return;
    timerInterval = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tickOnVisible);
    window.addEventListener('popstate', leaveExamPage, { once: true });
  }

  function tickOnVisible() { if (!document.hidden) tick(); }

  function leaveExamPage() {
    clearInterval(timerInterval);
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    document.removeEventListener('visibilitychange', tickOnVisible);
    if (isStrictExam && !isSubmitted) {
      api.lockExamExit(id, 'غادر الطالب صفحة الامتحان قبل التسليم').catch(() => {});
    }
    unsecureExam();
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers, timestamp: Date.now() }));
      const statusEl = document.getElementById('saveStatus');
      if (statusEl) {
        statusEl.innerHTML = '<span class="material-symbols-rounded" style="color:var(--primary); font-size:0.95rem;">cloud_done</span> تم الحفظ تلقائياً';
      }
    } catch (e) {}
  }

  function bindEvents() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(saveDraft, 15000);

    document.querySelectorAll('.option-item:not(.multi-option)').forEach(opt => {
      opt.addEventListener('click', () => {
        const qid = opt.dataset.qid;
        document.querySelectorAll(`.option-item[data-qid="${qid}"]:not(.multi-option)`).forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        answers[qid] = opt.dataset.val;
        saveDraft();
        updateNav();
      });
    });

    document.querySelectorAll('.multi-option').forEach(opt => {
      opt.addEventListener('click', () => {
        opt.classList.toggle('selected');
        const qid = opt.dataset.qid;
        const selected = [...document.querySelectorAll(`.multi-option.selected[data-qid="${qid}"]`)].map(o => o.dataset.val);
        answers[qid] = selected;
        saveDraft();
        updateNav();
      });
    });

    document.querySelectorAll('.fill-blank-input').forEach(input => {
      input.addEventListener('input', () => {
        answers[input.dataset.qid] = input.value.trim();
        saveDraft();
        updateNav();
      });
    });

    document.querySelectorAll('.essay-text-input').forEach(input => {
      input.addEventListener('input', () => {
        const qid = input.dataset.qid;
        if (!answers[qid] || typeof answers[qid] !== 'object') {
          answers[qid] = { text: input.value };
        } else {
          answers[qid].text = input.value;
        }
        saveDraft();
        updateNav();
      });
    });

    document.querySelectorAll('.essay-img-input').forEach(fileInput => {
      fileInput.addEventListener('change', () => {
        const qid = fileInput.dataset.qid;
        const file = fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          if (!answers[qid] || typeof answers[qid] !== 'object') {
            answers[qid] = { image_url: e.target.result };
          } else {
            answers[qid].image_url = e.target.result;
          }
          const statusSpan = document.getElementById(`essayFileStatus_${qid}`);
          if (statusSpan) statusSpan.textContent = 'تم إرفاق صورة الحل بنجاح';
          const previewBox = document.getElementById(`essayImgPreview_${qid}`);
          const previewImg = document.getElementById(`essayImgTag_${qid}`);
          if (previewBox && previewImg) {
            previewImg.src = e.target.result;
            previewBox.style.display = 'block';
          }
          saveDraft();
          updateNav();
          showToast('تم إرفاق صورة إجابتك وحفظها بنجاح', 'success');
        };
        reader.readAsDataURL(file);
      });
    });

    document.querySelectorAll('.flag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        if (flagged.has(qid)) {
          flagged.delete(qid);
          btn.innerHTML = '<span class="material-symbols-rounded">bookmark</span>';
        } else {
          flagged.add(qid);
          btn.innerHTML = '<span class="material-symbols-rounded" style="color:var(--warning)">bookmark</span>';
        }
        updateNav();
      });
    });

    document.querySelectorAll('.q-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = dot.dataset.idx;
        const targetCard = document.querySelector(`.question-card[data-qidx="${idx}"]`);
        document.querySelectorAll('.q-dot').forEach(d => d.classList.remove('current'));
        dot.classList.add('current');
        targetCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    document.getElementById('exitExamBtn')?.addEventListener('click', async () => {
      const ok = await confirmModal(
        'تأكيد الخروج من الامتحان',
        'تنبيه هام: الخروج من الامتحان قبل التسليم سيؤدي إلى إغلاق محاولتك وإرسال إشعار للمعلم، ولن تتمكن من الدخول مرة أخرى إلا بعد موافقة المعلم. هل تريد الخروج؟'
      );
      if (!ok) return;
      isSubmitted = true;
      clearInterval(timerInterval);
      if (autoSaveTimer) clearInterval(autoSaveTimer);
      unsecureExam();
      try {
        await api.lockExamExit(id, 'خرج الطالب من الامتحان قبل التسليم');
        showToast('تم إغلاق المحاولة وإبلاغ المعلم. يمكنك طلب إعادة الفتح من صفحة الامتحانات.', 'warning');
      } catch (e) {}
      if (window.navigateTo) window.navigateTo('/exams');
      else window.location.href = '/exams';
    });

    document.getElementById('submitExamBtn')?.addEventListener('click', async () => {
      const unanswered = exam.questions.filter(q => {
        const ans = answers[q.id];
        return !ans || ans === '' || (Array.isArray(ans) && ans.length === 0) || (typeof ans === 'object' && !ans.text && !ans.image_url);
      }).length;

      if (unanswered > 0) {
        const ok = await confirmModal('تأكيد تسليم الامتحان', `تنبيه: يوجد ${unanswered} أسئلة لم تقم بالإجابة عليها بعد. هل تريد تسليم الامتحان الآن؟`);
        if (!ok) return;
      } else {
        const ok = await confirmModal('إنهاء وتسليم الامتحان', 'هل أنت متأكد من تسليم جميع الإجابات وحساب النتيجة؟');
        if (!ok) return;
      }
      clearInterval(autoSaveTimer);
      submitExam();
    });
  }

  function updateNav() {
    document.querySelectorAll('.q-dot').forEach(dot => {
      const idx = parseInt(dot.dataset.idx);
      const q = exam.questions[idx];
      dot.className = 'q-dot';
      
      const hasAnswer = answers[q.id] && answers[q.id] !== '' && (!Array.isArray(answers[q.id]) || answers[q.id].length > 0);
      if (hasAnswer) dot.classList.add('answered');
      if (flagged.has(String(q.id))) dot.classList.add('flagged');
      
      const card = document.querySelector(`.question-card[data-qidx="${idx}"]`);
      if (card && card.getBoundingClientRect().top < window.innerHeight / 2 && card.getBoundingClientRect().bottom > window.innerHeight / 2) {
        dot.classList.add('current');
      }
    });
  }

  let warningsCount = 0;
  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden' && !isSubmitted) {
      warningsCount++;
      if (warningsCount >= 2) {
        showModal('إنهاء الامتحان لمغادرة الصفحة', `
          <div style="text-align:right;">
            <p style="color:var(--error); font-weight:700; margin-bottom:12px;">تم رصد مغادرة نافذة الامتحان أكثر من مرة.</p>
            <p style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:16px;">وفقاً للائحة الاختبارات، تم إنهاء الامتحان وتسليمه تلقائياً وإبلاغ المعلم.</p>
            <button class="btn btn-primary btn-block" onclick="document.querySelector('.modal-overlay')?.remove()">فهمت ذلك</button>
          </div>
        `);
        submitExam();
      } else {
        showModal('تحذير نزاهة الامتحان', `
          <div style="text-align:right;">
            <p style="color:var(--warning); font-weight:700; margin-bottom:12px;">تنبيه: مغادرة نافذة الامتحان غير مسموح بها!</p>
            <p style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:16px;">يمنع التبديل بين علامات التبويب أو فتح تطبيقات أخرى. المغادرة القادمة ستؤدي لإلغاء الامتحان وتسليمه فوراً.</p>
            <button class="btn btn-primary btn-block" onclick="document.querySelector('.modal-overlay')?.remove()">متابعة الامتحان</button>
          </div>
        `);
      }
    }
  }

  function handleBeforeUnload(e) {
    if (!isSubmitted) {
      e.preventDefault();
      e.returnValue = 'مغادرة الصفحة ستفقدك محاولة الامتحان بالكامل. هل تريد المغادرة؟';
    }
  }

  function preventCopyAndContext(e) {
    e.preventDefault();
  }

  function secureExam() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('contextmenu', preventCopyAndContext);
    document.addEventListener('copy', preventCopyAndContext);
  }

  function unsecureExam() {
    if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('contextmenu', preventCopyAndContext);
    document.removeEventListener('copy', preventCopyAndContext);
  }

  async function submitExam() {
    isSubmitted = true;
    clearInterval(timerInterval);
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    document.removeEventListener('visibilitychange', tickOnVisible);
    window.removeEventListener('popstate', leaveExamPage);
    unsecureExam();
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    
    const submitBtn = document.getElementById('submitExamBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري الحفظ...';
    }

    if (id === 'adaptive') {
      try {
        const result = await api.submitAdaptiveQuiz({
          question_ids: exam.questions.map(q => q.id),
          answers,
          time_spent: timeTaken
        });
        localStorage.removeItem(draftKey);
        renderResult({ ...result, rank: 1 }, timeTaken);
      } catch (err) {
        showToast(err.message || 'تعذر تصحيح الاختبار العلاجي', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span class="material-symbols-rounded">send</span> تسليم الامتحان';
        }
      }
      return;
    }

    try {
      const result = await api.submitExam(id, { answers, time_spent: timeTaken });
      localStorage.removeItem(draftKey);
      renderResult(result, timeTaken);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  renderQuestions();
}

export function renderResult(result, timeTaken) {
  const pct = result.score;
  const passed = result.passed;
  
  const container = document.getElementById('examTakeContent');
  if (!container) return;

  container.innerHTML = `
    <div class="card" style="text-align:center; padding:48px 32px; max-width:820px; margin:0 auto;">
      <div style="font-size:5.5rem; margin-bottom:12px; display:flex; justify-content:center; color:${passed ? 'var(--accent)' : 'var(--text-muted)'};">
        <span class="material-symbols-rounded" style="font-size:5.5rem;">${passed ? 'workspace_premium' : 'school'}</span>
      </div>
      <h2 style="font-size:1.6rem; font-weight:900; color:var(--text-primary); margin-bottom:8px;">
        ${passed ? 'أحسنت! اجتزت التقييم بنجاح' : 'لم تحقق نسبة النجاح المطلوبة'}
      </h2>
      <p style="color:var(--text-secondary); font-size:0.9rem; font-weight:600;">
        نسبة النجاح المطلوبة: ${result.passing_score || 60}%
      </p>

      <div style="font-size:3.5rem; font-weight:900; color:${passed ? 'var(--success)' : 'var(--error)'}; margin:20px 0; font-variant-numeric:tabular-nums;">
        ${pct}%
      </div>
      
      <div style="display:flex; justify-content:center; gap:24px; flex-wrap:wrap; margin-bottom:24px; font-size:0.88rem; color:var(--text-secondary); font-weight:600;">
        <span><span class="material-symbols-rounded" style="vertical-align:middle; color:var(--primary)">done</span> الدرجة: ${result.earned_points} من ${result.total_points}</span>
        <span><span class="material-symbols-rounded" style="vertical-align:middle; color:var(--primary)">schedule</span> الوقت المستغرق: ${formatTime(timeTaken)}</span>
        <span><span class="material-symbols-rounded" style="vertical-align:middle; color:var(--accent)">emoji_events</span> الترتيب الحالي: #${result.rank || '-'}</span>
      </div>

      ${result.is_graded === 0 ? `
        <div class="notice notice-warning" style="margin:20px 0;text-align:right;background:rgba(217,119,6,0.08);border:1.5px solid rgba(217,119,6,0.3);padding:14px 18px;border-radius:12px;display:flex;gap:12px;align-items:flex-start;">
          <span class="material-symbols-rounded" style="font-size:1.6rem;color:#d97706;flex-shrink:0;">pending_actions</span>
          <div>
            <strong style="font-size:0.98rem;color:#b45309;display:block;margin-bottom:3px;">تم استلام إجاباتك وبانتظار اعتماد وتصحيح المعلم للأسئلة المقالية</strong>
            <p style="font-size:0.83rem;color:var(--text-secondary);margin:0;line-height:1.6;">
              تم حفظ خطوات حلك الورقية والنصية بالكامل. يقوم د. زياد رمزي بمراجعة وتصحيح الحل المقالي، وسيصلك إشعار فوري بالدرجة النهائية المعتمدة.
            </p>
          </div>
        </div>
      ` : ''}

      ${result.is_graded === 1 && result.results && result.results.some(r => r.is_essay) ? `
        <div class="notice notice-success" style="margin:20px 0;text-align:right;background:rgba(16,185,129,0.08);border:1.5px solid rgba(16,185,129,0.3);padding:14px 18px;border-radius:12px;display:flex;gap:12px;align-items:flex-start;">
          <span class="material-symbols-rounded" style="font-size:1.6rem;color:var(--success);flex-shrink:0;">verified</span>
          <div>
            <strong style="font-size:0.98rem;color:var(--success);display:block;margin-bottom:3px;">تم اعتماد وتصحيح الامتحان من قِبل المعلم بنجاح</strong>
            <p style="font-size:0.83rem;color:var(--text-secondary);margin:0;line-height:1.6;">
              تمت مراجعة خطوات حلك المقالي بدقة واعتماد الدرجة المستحقة مع التوجيهات والملاحظات أدناه.
            </p>
          </div>
        </div>
      ` : ''}

      ${result.teacher_feedback ? `
        <div style="background:rgba(5,150,105,0.06); border:1.5px solid rgba(5,150,105,0.25); border-radius:12px; padding:16px 20px; margin:20px 0; text-align:right;">
          <div style="display:flex; align-items:center; gap:8px; font-weight:800; color:var(--primary); font-size:0.95rem; margin-bottom:6px;">
            <span class="material-symbols-rounded">rate_review</span> تقييم وتوجيهات المعلم (د. زياد رمزي):
          </div>
          <p style="margin:0; font-size:0.88rem; line-height:1.7; color:var(--text-primary); white-space:pre-wrap;">${esc(result.teacher_feedback)}</p>
        </div>
      ` : ''}

      <!-- Certificate Celebration Banner (Only when exam has_certificate enabled) -->
      ${result.certificate ? `
        <div style="background:linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.06)); border:2px solid #f59e0b; border-radius:14px; padding:18px 22px; margin:20px 0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; text-align:right;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:48px;height:48px;border-radius:12px;background:rgba(245,158,11,0.2);color:#d97706;display:flex;align-items:center;justify-content:center;">
              <span class="material-symbols-rounded" style="font-size:2rem;">workspace_premium</span>
            </div>
            <div>
              <strong style="color:#d97706; font-size:1.05rem; display:block;">تهانينا! استحققت شهادة تقدير معتمدة من د. زياد رمزي عياد</strong>
              <small style="color:var(--text-secondary);">تم إصدار وتوثيق شهادتك الرسمية كصورة عالية الجودة بكود: <code dir="ltr" style="color:var(--primary); font-weight:800;">${esc(result.certificate.cert_code)}</code></small>
            </div>
          </div>
          <a href="/certificates" class="btn btn-primary" style="background:#f59e0b; border-color:#f59e0b; color:#000; font-weight:800; gap:6px;">
            <span class="material-symbols-rounded">download</span> عرض وتحميل صورة الشهادة
          </a>
        </div>
      ` : ''}

      <!-- Unified WhatsApp Parent Report -->
      ${result.whatsapp_parent_url ? `
        <div style="background:var(--green-50); border:1.5px solid var(--green-200); border-radius:var(--radius-xl); padding:16px 20px; margin:20px 0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; text-align:right;">
          <div>
            <div style="font-weight:900; font-size:0.95rem; color:var(--green-900); display:flex; align-items:center; gap:6px;">
              <span class="material-symbols-rounded" style="color:#25D366; font-size:1.3rem;">family_restroom</span>
              تقرير ولي الأمر المعتمد
            </div>
            <p style="font-size:0.8rem; color:var(--green-700); margin-top:4px; font-weight:600;">
              يمكنك إرسال كشف النتيجة المعتمد مباشرة إلى رقم ولي الأمر المسجل عبر واتساب.
            </p>
          </div>
          <div>
            <a href="${result.whatsapp_parent_url}" target="_blank" class="btn" style="background:#25D366; color:#ffffff; font-weight:800; padding:8px 18px; gap:6px; border-radius:10px;">
              <span class="material-symbols-rounded">send</span> إرسال النتيجة لولي الأمر عبر واتساب
            </a>
          </div>
        </div>
      ` : ''}

      <div class="divider" style="margin:24px 0;"></div>

      <h3 style="font-weight:900; margin-bottom:20px; text-align:right; font-size:1.15rem; display:flex; align-items:center; gap:8px;">
        <span class="material-symbols-rounded" style="color:var(--primary);">fact_check</span> مراجعة وتصحيح الأسئلة والتفسير العلمي
      </h3>

      ${(result.results || []).map((r, i) => {
        let letters = ['أ', 'ب', 'ج', 'د', 'هـ'];
        
        return `
          <div class="question-card" style="text-align:right; border-color:${r.is_correct ? 'var(--green-300)' : 'var(--error)'};">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
              <span class="question-num" style="background:${r.is_correct ? 'var(--green-100)' : '#FEE2E2'}; color:${r.is_correct ? 'var(--green-800)' : 'var(--error)'};">${i + 1}</span>
              <span class="badge ${r.is_correct ? 'badge-success' : (r.is_essay && result.is_graded === 0 ? 'badge-warning' : 'badge-danger')}" style="font-weight:700;">
                ${r.is_essay ? (result.is_graded === 0 ? 'سؤال مقالي (قيد التصحيح)' : (r.is_correct ? 'إجابة معتمدة' : 'إجابة مقالية غير مكتملة')) : (r.is_correct ? 'إجابة صحيحة' : 'إجابة خاطئة')}
              </span>
              <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700; margin-right:auto;">
                الدرجة: ${r.earned_points !== undefined ? r.earned_points : (r.is_correct ? r.points : 0)} من ${r.points}
              </span>
            </div>

            <div class="question-text" style="margin-bottom:16px;">${escRich(r.text)}</div>
            ${r.image_url ? `<div style="margin-bottom:16px;"><img src="${esc(r.image_url)}" alt="توضيح السؤال" style="max-width:100%;max-height:280px;border-radius:var(--radius-md);border:1px solid var(--border-light);" /></div>` : ''}

            ${(r.type === 'mcq' || r.type === 'multi_select') && r.options 
              ? r.options.map((o, oi) => {
                  let multiCorrect = [];
                  if (r.type === 'multi_select' && r.correct_answer) {
                    try { multiCorrect = JSON.parse(r.correct_answer); } catch (e) {}
                  }
                  const isCorrectOpt = r.type === 'multi_select' 
                    ? (Array.isArray(multiCorrect) && multiCorrect.includes(o.id)) 
                    : o.id === r.correct_answer;
                    
                  const isUserOpt = r.type === 'multi_select' 
                    ? (Array.isArray(r.user_answer) && r.user_answer.includes(o.id)) 
                    : r.user_answer === o.id;

                  let optClass = '';
                  if (isCorrectOpt) optClass = 'correct';
                  else if (isUserOpt && !isCorrectOpt) optClass = 'wrong';

                  return `
                    <div class="option-item ${optClass}" style="cursor:default; margin-bottom:6px;">
                      <span class="option-letter">${letters[oi]}</span>
                      <span class="option-text">${escRich(o.text)}</span>
                      ${isCorrectOpt ? '<span style="margin-right:auto; font-size:0.7rem; font-weight:700; color:var(--success)">الإجابة النموذجية</span>' : ''}
                    </div>
                  `;
                }).join('') 
              : ''
            }

            ${r.type === 'true_false' 
              ? `
              <div style="font-size:0.85rem; color:var(--text-secondary); background:var(--bg-secondary); padding:10px 14px; border-radius:var(--radius-md); font-weight:600;">
                <span>إجابتك: <strong>${r.user_answer === 'true' ? 'صح' : 'خطأ'}</strong></span>
                <span style="margin-right:20px;">الصحيح: <strong>${r.correct_answer === 'true' ? 'صح' : 'خطأ'}</strong></span>
              </div>
              ` 
              : ''
            }

            ${r.type === 'fill_blank' 
              ? `
              <div style="font-size:0.85rem; color:var(--text-secondary); background:var(--bg-secondary); padding:10px 14px; border-radius:var(--radius-md); font-weight:600;">
                <div>إجابتك المسجلة: <strong style="color:var(--text-primary); font-family:monospace;">${esc(r.user_answer || '(لم تكتب إجابة)')}</strong></div>
                <div style="margin-top:6px;">الإجابة النموذجية الصحيحة: <strong style="color:var(--primary); font-family:monospace;">${esc(r.correct_answer || '')}</strong></div>
              </div>
              ` 
              : ''
            }

            ${r.type === 'essay' 
              ? `
              <div style="background:var(--bg-secondary); padding:14px 18px; border-radius:var(--radius-md); font-size:0.85rem; line-height:1.7;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                  <span style="font-weight:800; color:var(--text-primary);">
                    <span class="material-symbols-rounded" style="vertical-align:middle; font-size:1.15rem; color:#d97706;">edit_note</span> 
                    سؤال مقالي (خطوات حل بالورقة والقلم):
                  </span>
                  <span class="badge ${r.earned_points > 0 ? 'badge-success' : (result.is_graded === 0 ? 'badge-warning' : 'badge-danger')}" style="font-size:0.75rem; font-weight:700;">
                    الدرجة المعتمدة: ${r.earned_points !== undefined ? r.earned_points : 0} من ${r.points}
                  </span>
                </div>

                ${r.teacher_comment ? `
                  <div style="background:rgba(16,185,129,0.08); border-right:3px solid var(--success); padding:8px 12px; border-radius:4px; color:var(--text-primary); margin-bottom:10px; font-weight:600; font-size:0.82rem;">
                    <span class="material-symbols-rounded" style="font-size:1rem;vertical-align:middle;color:var(--success);">rate_review</span>
                    <strong>ملاحظة المعلم على إجابتك:</strong> ${esc(r.teacher_comment)}
                  </div>
                ` : ''}
                
                ${r.ai_feedback ? `
                  <div style="color:var(--text-secondary); margin-bottom:10px; font-weight:600; font-size:0.82rem;">
                    <span class="material-symbols-rounded" style="font-size:1rem;vertical-align:middle;color:var(--primary);">info</span>
                    <strong>ملاحظات المراجعة:</strong> ${esc(r.ai_feedback)}
                  </div>
                ` : ''}

                <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);">
                  <div style="font-weight:700; color:var(--text-secondary); font-size:0.8rem; margin-bottom:4px;">إجابة الطالب المدخلة:</div>
                  <div style="color:var(--text-primary); white-space:pre-wrap;">
                    ${esc((typeof r.user_answer === 'object' ? r.user_answer?.text : r.user_answer) || '') || '<span style="color:var(--text-muted);">(لم يكتب إجابة نصية)</span>'}
                  </div>
                  ${(typeof r.user_answer === 'object' && r.user_answer?.image_url) ? `
                    <div style="margin-top:10px;">
                      <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:4px;">صورة الحل بالورقة والقلم المرفقة (اضغط للتكبير):</span>
                      <a href="${esc(r.user_answer.image_url)}" target="_blank">
                        <img src="${esc(r.user_answer.image_url)}" alt="صورة حل الطالب" style="max-height:200px; border-radius:var(--radius-sm); border:1px solid var(--border-light); cursor:zoom-in;" />
                      </a>
                    </div>
                  ` : ''}
                </div>
              </div>
              ` 
              : ''
            }

            <!-- Scientific Explanation (Text + Teacher Image) -->
            ${(r.explanation || r.explanation_image) 
              ? `
              <div class="notice notice-warning" style="margin-top:12px; font-size:0.84rem; padding:12px 16px; display:flex; align-items:flex-start; gap:10px;">
                <span class="material-symbols-rounded" style="font-size:1.3rem; color:var(--accent); flex-shrink:0;">lightbulb</span>
                <div style="flex:1;">
                  <strong style="display:block; margin-bottom:4px;">التفسير العلمي المنهجي (شرح المعلم):</strong>
                  ${r.explanation ? `<div style="line-height:1.7;">${escRich(r.explanation)}</div>` : ''}
                  ${r.explanation_image ? `
                    <div style="margin-top:10px;">
                      <a href="${safeUrl(r.explanation_image)}" target="_blank" title="اضغط لتكبير صورة التفسير العلمي">
                        <img src="${safeUrl(r.explanation_image)}" alt="صورة التفسير العلمي" style="max-width:100%; max-height:280px; border-radius:10px; border:1px solid var(--border-light); box-shadow:var(--shadow-sm); cursor:zoom-in;" />
                      </a>
                    </div>
                  ` : ''}
                </div>
              </div>
              ` 
              : ''
            }

            ${r.pedagogical_feedback 
              ? `
              <div style="margin-top:10px; background:rgba(5, 150, 105, 0.06); border-right:3px solid var(--primary); border-radius:var(--radius-md); padding:12px 16px; font-size:0.82rem; line-height:1.7;">
                <div style="font-weight:800; color:var(--primary); display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                  <span class="material-symbols-rounded" style="font-size:1.1rem;">psychology</span>
                  <span>توجيه علمي لتثبيت المفهوم الكيميائي:</span>
                </div>
                <div style="color:var(--text-primary); margin-bottom:6px;">
                  ${esc(r.pedagogical_feedback.reinforcement)}
                </div>
                <div style="font-weight:700; color:#059669; font-size:0.78rem; display:flex; align-items:center; gap:4px;">
                  <span class="material-symbols-rounded" style="font-size:0.95rem;">assignment_turned_in</span>
                  <span>الخطوة المقترحة للإتقان: ${esc(r.pedagogical_feedback.learning_action)}</span>
                </div>
              </div>
              ` 
              : ''
            }
          </div>
        `;
      }).join('')}

      <div style="margin-top:32px; display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
        ${result.course_id ? `<a href="/courses/${result.course_id}" class="btn btn-secondary"><span class="material-symbols-rounded">book</span> العودة للمنهج الدراسي</a>` : ''}
        ${result.next_item 
          ? `<a href="/${result.next_item.item_type === 'exam' ? 'exams' : 'lessons'}/${result.next_item.id}${result.next_item.item_type === 'exam' ? '/take' : ''}" class="btn btn-primary">المحتوى التالي <span class="material-symbols-rounded">arrow_back</span></a>` 
          : `<a href="/exams" class="btn btn-primary">قائمة الامتحانات <span class="material-symbols-rounded">arrow_back</span></a>`
        }
        <a href="/leaderboard" class="btn btn-accent"><span class="material-symbols-rounded">emoji_events</span> عرض لوحة المتصدرين</a>
      </div>
    </div>
  `;
}

export function renderExamReview() {
  return `
    <div class="app-layout">
      ${renderNavbar('exams')}
      <main class="main-content" style="max-width: 900px; margin: 0 auto; padding: 40px 20px 80px;">
        <div id="examTakeContent">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </main>
    </div>
  `;
}

export async function initExamReview(id) {
  initNavbar();
  try {
    const review = await api.getExamReview(id);
    renderResult(review, review.time_spent || 0);
  } catch (err) {
    document.getElementById('examTakeContent').innerHTML = `
      <div class="empty-state" style="padding:48px 24px; text-align:center;">
        <span class="material-symbols-rounded" style="font-size:3.5rem; color:var(--error);">error</span>
        <h3 style="font-weight:800; margin:12px 0 6px;">تعذر عرض نتيجة وتصحيح الامتحان</h3>
        <p style="color:var(--text-secondary); max-width:480px; margin:0 auto 20px;">${esc(err.message || 'حدث خطأ في جلب بيانات المحاولة')}</p>
        <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
          <a href="/exams" class="btn btn-primary">العودة لقائمة الامتحانات</a>
          <a href="/dashboard" class="btn btn-secondary">لوحة التحكم</a>
        </div>
      </div>
    `;
  }
}
