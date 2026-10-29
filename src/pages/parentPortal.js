import { renderPublicHeader, initPublicHeader } from '../components/publicHeader.js';
import { renderNavbar, initNavbar } from '../components/navbar.js';
import { isLoggedIn } from '../utils/auth.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { esc, formatDateTime, formatDate } from '../utils/helpers.js';

export function renderParentPortal() {
  const logged = isLoggedIn();
  const headerHtml = logged ? renderNavbar('parent-portal') : renderPublicHeader('parent-portal');
  const wrapperClass = logged ? 'app-layout' : 'landing';
  const mainStyle = logged ? '' : 'padding-top: 110px; padding-bottom: 60px; min-height: 85vh;';
  const containerClass = logged ? 'main-content' : 'section-container';

  return `
    <div class="${wrapperClass}" style="min-height: 100vh;">
      ${headerHtml}
      <main class="${containerClass}" style="${mainStyle}">
        <div class="page-header" style="margin-bottom: 24px;">
          <h1 class="page-title" style="display:flex; align-items:center; gap:10px;">
            <span class="material-symbols-rounded" style="color:var(--primary); font-size:2.1rem;">family_restroom</span>
            بوابة متابعة ولي الأمر
          </h1>
          <p class="page-subtitle">متابعة فورية وشاملة لدرجات الامتحانات، نسبة حضور المحاضرات، وتقارير المعلم الخاصة بالطالب</p>
        </div>

        <div class="card" style="max-width: 760px; margin: 0 auto 28px; border: 1.5px solid var(--border-light);">
          <h3 style="font-size:1.1rem; font-weight:900; margin:0 0 8px; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
            <span class="material-symbols-rounded" style="color:var(--primary);">verified_user</span>
            الاستعلام برقم هاتف الطالب ورقم ولي الأمر
          </h3>
          <p style="font-size:0.86rem; color:var(--text-secondary); margin-bottom:18px;">
            أدخل رقم هاتف الطالب المسجل بالمنصة ورقم هاتف ولي الأمر المرتبط بالحساب لعرض التقرير التفصيلي الكامل:
          </p>

          <form id="parentLookupForm" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; align-items:end;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">رقم هاتف الطالب</label>
              <input type="tel" id="ppStudentPhone" class="form-input" placeholder="01XXXXXXXXX" dir="ltr" required maxlength="11">
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">رقم هاتف ولي الأمر</label>
              <input type="tel" id="ppParentPhone" class="form-input" placeholder="01XXXXXXXXX" dir="ltr" required maxlength="11">
            </div>
            <button type="submit" id="ppSubmitBtn" class="btn btn-primary" style="height:46px; font-weight:800; gap:6px; justify-content:center;">
              <span class="material-symbols-rounded">analytics</span> عرض تقرير الطالب
            </button>
          </form>
        </div>

        <div id="parentReportContainer"></div>
      </main>
    </div>
  `;
}

export function initParentPortal() {
  if (isLoggedIn()) {
    initNavbar();
  } else {
    initPublicHeader();
  }

  const form = document.getElementById('parentLookupForm');
  const container = document.getElementById('parentReportContainer');
  const submitBtn = document.getElementById('ppSubmitBtn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const student_phone = document.getElementById('ppStudentPhone')?.value.trim();
    const parent_phone = document.getElementById('ppParentPhone')?.value.trim();

    if (!student_phone || !parent_phone) {
      return showToast('يرجى إدخال رقم هاتف الطالب ورقم هاتف ولي الأمر', 'warning');
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري جلب التقرير...';

    try {
      const data = await api.parentPortalLookup({ student_phone, parent_phone });
      const { student, summary, courses, exams, locked_exams, recent_lessons } = data;

      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:24px;">
          <!-- Student Identity Banner -->
          <div class="card" style="background:linear-gradient(135deg, #064e3b 0%, #047857 100%); color:#fff; border:none;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
              <div style="display:flex; align-items:center; gap:14px;">
                <div style="width:56px; height:56px; border-radius:50%; background:rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center;">
                  <span class="material-symbols-rounded" style="font-size:2rem;">person</span>
                </div>
                <div>
                  <h2 style="margin:0 0 4px; font-size:1.3rem; font-weight:900;">${esc(student.name)}</h2>
                  <div style="font-size:0.85rem; opacity:0.9; display:flex; gap:14px; flex-wrap:wrap;">
                    <span>المرحلة: <strong>${esc(student.grade || 'غير محدد')}</strong></span>
                    <span dir="ltr">هاتف الطالب: ${esc(student.phone)}</span>
                    <span>تاريخ الانضمام: ${formatDate(student.created_at)}</span>
                  </div>
                </div>
              </div>
              <button type="button" onclick="window.print()" class="btn btn-sm" style="background:rgba(255,255,255,0.2); color:#fff; border:1px solid rgba(255,255,255,0.35); gap:6px;">
                <span class="material-symbols-rounded">print</span> طباعة التقرير
              </button>
            </div>
          </div>

          <!-- Summary Stats -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon green"><span class="material-symbols-rounded">school</span></div>
              <div>
                <div class="stat-value">${summary.enrolled_courses_count}</div>
                <div class="stat-label">الكورسات المشترك بها</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon blue"><span class="material-symbols-rounded">play_lesson</span></div>
              <div>
                <div class="stat-value">${summary.completed_lessons_count}</div>
                <div class="stat-label">المحاضرات المكتملة</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon gold"><span class="material-symbols-rounded">assignment_turned_in</span></div>
              <div>
                <div class="stat-value">${summary.exams_taken_count}</div>
                <div class="stat-label">الامتحانات المسلمة</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon ${summary.avg_exam_score >= 60 ? 'green' : 'gold'}"><span class="material-symbols-rounded">insights</span></div>
              <div>
                <div class="stat-value">${summary.avg_exam_score}%</div>
                <div class="stat-label">متوسط درجات الامتحانات</div>
              </div>
            </div>
          </div>

          ${locked_exams && locked_exams.length > 0 ? `
            <div class="card" style="border:1.5px solid var(--warning); background:rgba(245,158,11,0.06);">
              <h3 style="margin:0 0 10px; font-size:1.05rem; font-weight:900; color:#d97706; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded">warning</span> تنبيهات الخروج من الامتحانات قبل التسليم (${locked_exams.length})
              </h3>
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${locked_exams.map(le => `
                  <div style="padding:10px 14px; background:var(--bg-card); border-radius:10px; border:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div>
                      <strong>${esc(le.exam_title)}</strong>
                      <div style="font-size:0.8rem; color:var(--text-secondary);">${esc(le.lock_reason || 'خرج الطالب من الامتحان قبل التسليم')}</div>
                    </div>
                    <span class="badge badge-warning">${le.retake_requested ? 'تم إرسال طلب إعادة للمعلم' : 'مغلق بانتظار مراجعة المعلم'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Courses Progress -->
          <div class="card">
            <h3 style="margin:0 0 14px; font-size:1.08rem; font-weight:900; display:flex; align-items:center; gap:8px;">
              <span class="material-symbols-rounded" style="color:var(--primary);">menu_book</span> متابعة التقدم في الكورسات
            </h3>
            ${courses.length === 0 ? `<p style="color:var(--text-muted);">الطالب غير مشترك في أي كورس حالياً.</p>` : `
              <div style="display:flex; flex-direction:column; gap:12px;">
                ${courses.map(c => {
                  const pct = c.total_lessons > 0 ? Math.round((c.completed_lessons / c.total_lessons) * 100) : 0;
                  return `
                    <div style="padding:14px 16px; background:var(--bg-secondary); border-radius:12px; border:1px solid var(--border-light);">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                        <strong style="font-size:0.96rem;">${esc(c.title)} <span style="font-size:0.78rem; color:var(--text-muted);">(${esc(c.grade)})</span></strong>
                        <span style="font-weight:800; color:var(--primary); font-size:0.85rem;">${c.completed_lessons} من ${c.total_lessons} محاضرة (${pct}%)</span>
                      </div>
                      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;"></div></div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Exam Attempts Table -->
          <div class="card">
            <h3 style="margin:0 0 14px; font-size:1.08rem; font-weight:900; display:flex; align-items:center; gap:8px;">
              <span class="material-symbols-rounded" style="color:var(--primary);">fact_check</span> سجل درجات الامتحانات والواجبات
            </h3>
            ${exams.length === 0 ? `<p style="color:var(--text-muted);">لم يقم الطالب بتسليم أي امتحانات حتى الآن.</p>` : `
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>الامتحان / الواجب</th>
                      <th>النوع</th>
                      <th>الدرجة</th>
                      <th>الحالة</th>
                      <th>ملاحظات المعلم</th>
                      <th>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${exams.map(ex => {
                      const passed = ex.score >= (ex.passing_score || 60);
                      return `
                        <tr>
                          <td><strong>${esc(ex.exam_title)}</strong></td>
                          <td><span class="badge ${ex.exam_type === 'homework' ? 'badge-info' : 'badge-warning'}">${ex.exam_type === 'homework' ? 'واجب' : 'امتحان'}</span></td>
                          <td><strong style="color:${passed ? 'var(--success)' : 'var(--error)'}; font-size:1rem;">${ex.score}%</strong></td>
                          <td>
                            ${ex.is_graded === 0
                              ? '<span class="badge badge-warning">قيد تصحيح المقالي</span>'
                              : (passed ? '<span class="badge badge-success">ناجح</span>' : '<span class="badge badge-danger">لم يجتز</span>')
                            }
                          </td>
                          <td>${esc(ex.teacher_feedback || '—')}</td>
                          <td style="font-size:0.78rem; color:var(--text-muted);">${formatDateTime(ex.completed_at)}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- Recent Watched Lessons -->
          <div class="card">
            <h3 style="margin:0 0 14px; font-size:1.08rem; font-weight:900; display:flex; align-items:center; gap:8px;">
              <span class="material-symbols-rounded" style="color:var(--primary);">history</span> آخر المحاضرات التي شاهدها الطالب
            </h3>
            ${recent_lessons.length === 0 ? `<p style="color:var(--text-muted);">لا توجد سجلات مشاهدة حتى الآن.</p>` : `
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${recent_lessons.map(rl => `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-secondary); border-radius:10px; border:1px solid var(--border-light); flex-wrap:wrap; gap:8px;">
                    <div>
                      <strong>${esc(rl.lesson_title)}</strong>
                      <span style="font-size:0.78rem; color:var(--text-muted); margin-right:8px;">(${esc(rl.course_title || '')})</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; font-size:0.8rem;">
                      <span class="badge ${rl.completed ? 'badge-success' : 'badge-info'}">${rl.completed ? 'مكتملة' : `شاهدها ${rl.views_count || 1} مرة`}</span>
                      <span style="color:var(--text-muted);">${formatDateTime(rl.watched_at)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      `;
    } catch (err) {
      showToast(err.message, 'error');
      container.innerHTML = `
        <div class="card" style="max-width:760px; margin:0 auto; text-align:center; padding:32px;">
          <span class="material-symbols-rounded" style="font-size:3rem; color:var(--error);">error</span>
          <h3 style="margin:10px 0 4px;">${esc(err.message)}</h3>
          <p style="color:var(--text-secondary); font-size:0.88rem;">تأكد من إدخال رقم هاتف الطالب ورقم هاتف ولي الأمر المسجلين في حساب الطالب بشكل صحيح.</p>
        </div>
      `;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="material-symbols-rounded">analytics</span> عرض تقرير الطالب';
    }
  });
}
