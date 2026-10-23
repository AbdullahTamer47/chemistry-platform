import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { formatDate, formatTime } from '../utils/helpers.js';

export function renderMyResults() {
  return `
    <div class="app-layout">
      ${renderNavbar('my-results')}
      <main class="main-content">
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">insights</span> تحليلات الأداء ونتائجي</h1>
            <p class="page-subtitle">مخطط إنجاز المنهج، مسار تطور درجاتك عبر العام، وشهادات التفوق المعتمدة</p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <a href="#/certificates" class="btn btn-outline" style="gap:6px;">
              <span class="material-symbols-rounded" style="color:var(--warning);">workspace_premium</span> شهاداتي المعتمدة
            </a>
            <a href="#/exams" class="btn btn-primary" style="gap:6px;">
              <span class="material-symbols-rounded">assignment</span> الامتحانات المتاحة
            </a>
          </div>
        </div>

        <!-- VISUAL ANALYTICS CONTAINER -->
        <div id="visualAnalyticsContainer" style="margin-bottom:28px;"></div>

        <!-- STATS CARDS -->
        <div id="resultsStatsContainer" style="margin-bottom:28px;"></div>

        <!-- ADAPTIVE MISTAKES BANNER -->
        <div id="adaptiveQuizBanner" class="card" style="margin-bottom:28px;background:linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.08));border:1px solid rgba(99,102,241,0.25);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <div class="stat-icon purple" style="width:48px;height:48px;border-radius:12px;">
              <span class="material-symbols-rounded">psychology</span>
            </div>
            <div>
              <h3 style="font-size:1.05rem;font-weight:800;margin:0 0 4px 0;">امتحانك الخاص: تدريب علاجي مكثف على أخطائك السابقة</h3>
              <p style="margin:0;font-size:0.84rem;color:var(--text-secondary);">النظام الذكي يفرز كل سؤال أخطأت فيه في الاختبارات السابقة ليولّد لك تدريباً مخصصاً لمعالجة نقاط ضعفك فوراً.</p>
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="startAdaptiveMistakesBtn" style="gap:6px;font-weight:800;">
            <span class="material-symbols-rounded">rocket_launch</span> ابدأ اختبار أخطائي الآن
          </button>
        </div>

        <!-- TABS & FILTER -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div class="tabs" id="resultsFilterTabs" style="margin:0;">
            <button class="tab active" data-filter="all">جميع المحاولات (<span id="countAll">0</span>)</button>
            <button class="tab" data-filter="graded">معتمدة ومصححة (<span id="countGraded">0</span>)</button>
            <button class="tab" data-filter="pending">قيد مراجعة المقالي (<span id="countPending">0</span>)</button>
          </div>
        </div>

        <div id="myResultsList">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </main>
    </div>
  `;
}

export async function initMyResults() {
  initNavbar();
  const listEl = document.getElementById('myResultsList');
  const statsEl = document.getElementById('resultsStatsContainer');
  const analyticsEl = document.getElementById('visualAnalyticsContainer');
  if (!listEl) return;

  // Bind Adaptive Mistakes Quiz button
  document.getElementById('startAdaptiveMistakesBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('startAdaptiveMistakesBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري فحص بنك أخطائك...';
    try {
      const data = await api.getAdaptiveMistakesQuiz();
      if (!data.questions || data.questions.length === 0) {
        showToast(data.message || 'لا توجد أخطاء مسجلة بحسابك حالياً. ممتاز!', 'info');
      } else {
        // Store adaptive test in session and navigate to exam take
        sessionStorage.setItem('adaptive_quiz', JSON.stringify(data));
        showToast(`تم تجهيز ${data.count} سؤال من أخطائك السابقة للتدريب!`, 'success');
        window.location.hash = '#/exams/adaptive/take';
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-rounded">rocket_launch</span> ابدأ اختبار أخطائي الآن';
    }
  });

  try {
    const [attempts, analytics] = await Promise.all([
      api.getMyExamAttempts(),
      api.getStudentAnalytics().catch(() => null)
    ]);

    // RENDER VISUAL CHARTS (DONUT + BAR CHART)
    if (analytics) {
      const c = analytics.curriculum || { percent: 0, completed_lessons: 0, total_lessons: 0, remaining_lessons: 0 };
      const e = analytics.exams || { average_percent: 0, max_percent: 0, min_percent: 0, total_taken: 0, passed_count: 0 };
      const prog = analytics.progression || [];
      const weekly = analytics.weekly_activity || [];

      // Calculate SVG Donut stroke-dasharray (circumference = 2 * PI * 45 ≈ 283)
      const circumference = 283;
      const progressOffset = circumference - (circumference * (c.percent / 100));

      analyticsEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px;">

          <!-- 1. CURRICULUM DONUT CHART -->
          <div class="card" style="padding:24px;display:flex;flex-direction:column;justify-content:space-between;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
              <h3 style="font-size:1.05rem;font-weight:800;margin:0;display:flex;align-items:center;gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--primary);">pie_chart</span>
                مخطط إنجاز المنهج الدراسي
              </h3>
              <span class="badge badge-info" style="font-weight:700;">${c.percent}% مكتمل</span>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-around;gap:20px;flex-wrap:wrap;margin:10px 0;">
              <!-- Animated SVG Donut -->
              <div style="position:relative;width:150px;height:150px;display:flex;align-items:center;justify-content:center;">
                <svg width="150" height="150" viewBox="0 0 100 100" style="transform:rotate(-90deg);">
                  <!-- Background Track -->
                  <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-secondary)" stroke-width="10" />
                  <!-- Progress Track -->
                  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#donutGradient)" stroke-width="10"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${progressOffset}"
                    stroke-linecap="round" style="transition:stroke-dashoffset 1.2s ease;" />
                  <defs>
                    <linearGradient id="donutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#38bdf8" />
                      <stop offset="100%" stop-color="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style="position:absolute;text-align:center;">
                  <div style="font-size:1.6rem;font-weight:900;color:var(--text-primary);line-height:1;">${c.percent}%</div>
                  <small style="font-size:0.68rem;color:var(--text-muted);font-weight:700;">مذاكرة مكتملة</small>
                </div>
              </div>

              <!-- Metrics Legend -->
              <div style="display:flex;flex-direction:column;gap:12px;font-size:0.85rem;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="width:12px;height:12px;border-radius:3px;background:linear-gradient(135deg, #38bdf8, #6366f1);"></div>
                  <span style="color:var(--text-secondary);">المحاضرات المكتملة:</span>
                  <strong style="color:var(--text-primary);">${c.completed_lessons} محاضرة</strong>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="width:12px;height:12px;border-radius:3px;background:var(--bg-secondary);border:1px solid var(--border-light);"></div>
                  <span style="color:var(--text-secondary);">المحاضرات المتبقية:</span>
                  <strong style="color:var(--text-primary);">${c.remaining_lessons} محاضرة</strong>
                </div>
                <div style="display:flex;align-items:center;gap:10px;padding-top:8px;border-top:1px solid var(--border-light);">
                  <span class="material-symbols-rounded" style="color:var(--warning);font-size:1.1rem;">workspace_premium</span>
                  <span style="color:var(--text-secondary);">شهادات التقدير المكتسبة:</span>
                  <strong style="color:var(--warning);">${analytics.certificates_count || 0} شهادة</strong>
                </div>
              </div>
            </div>

            <div style="font-size:0.78rem;color:var(--text-muted);background:var(--bg-secondary);padding:10px 14px;border-radius:8px;margin-top:12px;">
              <span class="material-symbols-rounded" style="font-size:0.95rem;vertical-align:middle;color:var(--primary);">lightbulb</span>
              استمر في إتمام المحاضرات والواجبات لتصل نسبة إنجازك إلى 100% وتحصل على وسام الإتقان!
            </div>
          </div>

          <!-- 2. SCORE PROGRESSION BAR CHART -->
          <div class="card" style="padding:24px;display:flex;flex-direction:column;justify-content:space-between;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
              <h3 style="font-size:1.05rem;font-weight:800;margin:0;display:flex;align-items:center;gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--success);">bar_chart</span>
                مسار تطور الدرجات عبر العام الدراسي
              </h3>
              <div style="font-size:0.8rem;color:var(--text-muted);font-weight:700;">
                المتوسط العام: <span style="color:var(--primary);font-size:1rem;font-weight:900;">${e.average_percent}%</span>
              </div>
            </div>

            <!-- Bar Chart Container -->
            <div style="min-height:160px;display:flex;align-items:flex-end;gap:12px;padding:16px 8px;background:var(--bg-secondary);border-radius:12px;overflow-x:auto;">
              ${prog.length === 0 ? `
                <div style="width:100%;text-align:center;color:var(--text-muted);font-size:0.85rem;padding:30px 0;">
                  لم تسجل درجات كافية لرسم المنحنى البياني بعد. ابدأ بأول اختبار!
                </div>
              ` : prog.map((item, idx) => {
                const barHeight = Math.max(15, Math.min(100, item.percent));
                const isPassed = item.passed;
                const barColor = isPassed ? 'linear-gradient(180deg, #10b981, #059669)' : 'linear-gradient(180deg, #ef4444, #b91c1c)';

                return `
                  <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;min-width:38px;" title="${item.exam_title} (${item.percent}%)">
                    <span style="font-size:0.7rem;font-weight:800;color:${isPassed ? 'var(--success)' : 'var(--error)'};">${item.percent}%</span>
                    <div style="width:100%;height:${barHeight}px;background:${barColor};border-radius:6px 6px 2px 2px;transition:height 0.8s ease;box-shadow:0 2px 8px rgba(0,0,0,0.15);"></div>
                    <span style="font-size:0.65rem;color:var(--text-muted);font-weight:700;">مـ${idx + 1}</span>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Trend Indicators -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;font-size:0.8rem;color:var(--text-secondary);flex-wrap:wrap;gap:8px;">
              <div>أعلى نتيجة: <strong style="color:var(--success);">${e.max_percent}%</strong> ${e.best_exam ? `(${e.best_exam.title.slice(0, 15)}...)` : ''}</div>
              <div>أضعف نتيجة: <strong style="color:var(--error);">${e.min_percent}%</strong></div>
              <div>نسبة النجاح: <strong style="color:var(--primary);">${e.total_taken > 0 ? Math.round((e.passed_count / e.total_taken) * 100) : 0}%</strong></div>
            </div>
          </div>

        </div>
      `;
    }

    if (!attempts || attempts.length === 0) {
      statsEl.innerHTML = '';
      listEl.innerHTML = `
        <div class="card" style="text-align:center; padding:60px 24px; max-width:640px; margin:40px auto;">
          <div style="font-size:4.5rem; color:var(--text-muted); margin-bottom:14px;">
            <span class="material-symbols-rounded" style="font-size:4.5rem;">history_edu</span>
          </div>
          <h3 style="font-weight:800; font-size:1.3rem; margin-bottom:8px;">لا يوجد سجل امتحانات بعد</h3>
          <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:24px;">لم تقم بتسليم أي اختبار أو كويز حتى الآن. ابدأ بحل أول امتحان لتسجيل درجاتك وترتيبك!</p>
          <a href="#/exams" class="btn btn-primary" style="padding:10px 24px;">
            <span class="material-symbols-rounded">rocket_launch</span> ابدأ بحل أول امتحان الآن
          </a>
        </div>
      `;
      return;
    }

    // Calculate metrics
    const totalTaken = attempts.length;
    const gradedAttempts = attempts.filter(a => a.is_graded === 1);
    const pendingAttempts = attempts.filter(a => a.is_graded === 0);
    const passedAttempts = attempts.filter(a => a.score >= (a.passing_score || 60));
    const avgScore = gradedAttempts.length > 0
      ? Math.round(gradedAttempts.reduce((sum, a) => sum + a.score, 0) / gradedAttempts.length)
      : 0;

    document.getElementById('countAll').textContent = totalTaken;
    document.getElementById('countGraded').textContent = gradedAttempts.length;
    document.getElementById('countPending').textContent = pendingAttempts.length;

    statsEl.innerHTML = `
      <div class="stats-grid">
        <div class="card stat-card">
          <div class="stat-icon blue"><span class="material-symbols-rounded">assignment_turned_in</span></div>
          <div>
            <div class="stat-value">${totalTaken}</div>
            <div class="stat-label">إجمالي الامتحانات المسلّمة</div>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon green"><span class="material-symbols-rounded">verified</span></div>
          <div>
            <div class="stat-value">${passedAttempts.length}</div>
            <div class="stat-label">امتحانات تم اجتيازها بنجاح</div>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon gold"><span class="material-symbols-rounded">percent</span></div>
          <div>
            <div class="stat-value">${avgScore}%</div>
            <div class="stat-label">متوسط الدرجات المعتمدة</div>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon purple"><span class="material-symbols-rounded">rate_review</span></div>
          <div>
            <div class="stat-value">${gradedAttempts.length}</div>
            <div class="stat-label">محاولات تم تدقيق مقاليها</div>
          </div>
        </div>
      </div>
    `;

    function renderList(filtered) {
      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div class="card" style="text-align:center; padding:40px; color:var(--text-muted);">
            <span class="material-symbols-rounded" style="font-size:3rem; margin-bottom:8px;">search_off</span>
            <p style="font-weight:600;">لا توجد امتحانات في هذا التصنيف</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${filtered.map(a => {
            const passed = a.score >= (a.passing_score || 60);
            const isGraded = a.is_graded === 1;

            return `
              <div class="card" style="padding:22px; border-right:4px solid ${isGraded ? (passed ? 'var(--success)' : 'var(--error)') : 'var(--warning)'}; display:flex; flex-direction:column; gap:14px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
                  <div style="min-width:0; flex:1;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
                      <h3 style="font-size:1.05rem; font-weight:800; color:var(--text-primary); margin:0;">${a.exam_title}</h3>
                      <span class="badge ${isGraded ? (passed ? 'badge-success' : 'badge-danger') : 'badge-warning'}" style="font-size:0.72rem; font-weight:700;">
                        ${isGraded ? (passed ? 'اجتياز بنجاح ✨' : 'لم يحقق نسبة النجاح') : 'قيد تصحيح المقالي ⏳'}
                      </span>
                      ${a.course_title ? `<span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">• ${a.course_title}</span>` : ''}
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); display:flex; gap:16px; flex-wrap:wrap; margin-top:6px;">
                      <span><span class="material-symbols-rounded" style="font-size:0.95rem; vertical-align:middle; color:var(--primary);">schedule</span> وقت التسليم: ${formatDate(a.completed_at)}</span>
                      <span><span class="material-symbols-rounded" style="font-size:0.95rem; vertical-align:middle; color:var(--primary);">timer</span> الوقت المستغرق: ${formatTime(a.time_spent || 0)}</span>
                      <span>نسبة الاجتياز المطلوبة: ${a.passing_score || 60}%</span>
                    </div>
                  </div>

                  <div style="text-align:center; min-width:90px; padding:6px 14px; background:var(--bg-secondary); border-radius:12px;">
                    <div style="font-size:1.6rem; font-weight:900; color:${isGraded ? (passed ? 'var(--success)' : 'var(--error)') : 'var(--warning)'}; font-variant-numeric:tabular-nums;">
                      ${a.score}%
                    </div>
                    <div style="font-size:0.68rem; color:var(--text-muted); font-weight:700;">
                      ${isGraded ? 'الدرجة المعتمدة' : 'درجة أولية (مؤقتة)'}
                    </div>
                  </div>
                </div>

                ${a.teacher_feedback ? `
                  <div style="background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.25); border-radius:10px; padding:12px 16px; font-size:0.85rem;">
                    <div style="font-weight:800; color:var(--primary); display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                      <span class="material-symbols-rounded" style="font-size:1.1rem;">rate_review</span> ملاحظات المعلم (د. زياد رمزي):
                    </div>
                    <p style="margin:0; color:var(--text-primary); line-height:1.6; white-space:pre-wrap;">${a.teacher_feedback}</p>
                  </div>
                ` : ''}

                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-top:1px solid var(--border-light); padding-top:12px; margin-top:2px;">
                  <div>
                    ${passed && isGraded ? `
                      <a href="#/certificates" class="btn btn-ghost btn-sm" style="color:var(--warning);gap:4px;font-weight:700;">
                        <span class="material-symbols-rounded">workspace_premium</span> عرض وتحميل شهادة التقدير
                      </a>
                    ` : ''}
                  </div>
                  <a href="#/exams/${a.exam_id}/review" class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
                    <span class="material-symbols-rounded">visibility</span> عرض المراجعة والتصحيح الكامل
                  </a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    renderList(attempts);

    // Tab filter switching
    document.querySelectorAll('#resultsFilterTabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#resultsFilterTabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.dataset.filter;
        if (filter === 'graded') {
          renderList(attempts.filter(a => a.is_graded === 1));
        } else if (filter === 'pending') {
          renderList(attempts.filter(a => a.is_graded === 0));
        } else {
          renderList(attempts);
        }
      });
    });

  } catch (err) {
    listEl.innerHTML = `<p style="color:var(--error); text-align:center; padding:30px;">حدث خطأ أثناء تحميل السجل: ${err.message}</p>`;
  }
}
