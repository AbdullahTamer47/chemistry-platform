import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { getUser, isTeacher } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { confirmModal } from '../components/modal.js';
import { esc, sanitize, safeUrl, formatTime, getShortStudentName } from '../utils/helpers.js';
import { renderChemMarkdown } from '../utils/chemMarkdown.js';
import { openProtectedPdfModal } from '../components/pdfShieldViewer.js';

export function renderLesson(id) {
  return `
  <div class="app-layout">
    ${renderNavbar('courses')}
    <main class="main-content">
      <div id="lessonContent">
        <div class="skeleton" style="height: 40px; width: 30%; margin-bottom: 20px;"></div>
        <div class="skeleton" style="height: 380px; border-radius: var(--radius-xl); margin-bottom: 20px;"></div>
        <div style="display:flex; gap:12px; margin-bottom:24px;">
          <div class="skeleton-btn skeleton"></div>
          <div class="skeleton-btn skeleton"></div>
        </div>
      </div>
    </main>
  </div>`;
}

export async function initLesson(id) {
  initNavbar();
  const user = getUser();
  if (!user) return;

  try {
    const lesson = await api.getLesson(id);
    const course = await api.getCourse(lesson.course_id).catch(() => null);
    const shortName = getShortStudentName(user.name);
    const prereqExam = lesson.prerequisite_exam || null;
    const prereqLocked = Boolean(lesson.prerequisite_locked && !isTeacher());
    const allowForum = Number(lesson.allow_student_replies) === 1;
    const hasPdf = Boolean(lesson.has_pdf || lesson.pdf_url);
    const chapters = course?.chapters || [];

    const sidebarCurriculumHtml = chapters.length > 0 ? `
      <aside class="lesson-curriculum-sidebar">
        ${chapters.map((ch) => {
          const items = ch.items || [];
          const totalInCh = items.length;
          const completedInCh = items.filter(it => it.is_completed).length;
          const isCurrentChapter = Number(ch.id) === Number(lesson.chapter_id) || items.some(it => it.item_type === 'lesson' && Number(it.id) === Number(lesson.id));
          const summaryText = items.map(it => it.title).slice(0, 2).join(' - ') || 'محتوى الفصل الدراسي';

          return `
            <div class="lesson-sidebar-unit-wrap" data-ch-id="${ch.id}">
              <div class="lesson-sidebar-unit-card ${isCurrentChapter ? 'active-you-are-here' : ''}">
                <div class="lesson-sidebar-unit-left">
                  ${isCurrentChapter ? `
                    <span class="you-are-here-pill">أنت هنا</span>
                  ` : `
                    <button type="button" class="lesson-sidebar-toggle-circle" aria-label="عرض الفصل">
                      <span class="material-symbols-rounded">expand_less</span>
                    </button>
                    <span class="lesson-sidebar-progress-num" dir="ltr">(${completedInCh}/${totalInCh})</span>
                  `}
                </div>
                <div class="lesson-sidebar-unit-right">
                  <div class="lesson-sidebar-unit-title">
                    ${isCurrentChapter ? '<span class="you-are-here-dot"></span>' : ''}
                    <span>${esc(ch.title)}</span>
                  </div>
                  <div class="lesson-sidebar-unit-desc">
                    ${esc(summaryText)} <span style="text-decoration:underline; font-weight:700;">...عرض باقي التفاصيل</span>
                  </div>
                </div>
              </div>

              <div class="lesson-sidebar-subitems" style="${isCurrentChapter ? 'display:flex;' : 'display:none;'}">
                <!-- Current Lesson Sub-Sections (Bassthalk Green Bars) -->
                ${isCurrentChapter ? `
                  <a href="#videoBox" class="lesson-subbar-green active">
                    <span style="display:inline-flex; align-items:center; gap:6px; font-size:0.78rem; color:#047857;">
                      <span class="material-symbols-rounded" style="font-size:1.05rem;">expand_less</span> عرض
                    </span>
                    <span style="font-weight:900; color:#059669;">الشرح</span>
                  </a>
                  ${prereqExam ? `
                    <a href="/exams/${prereqExam.id}/take" class="lesson-subbar-green">
                      <span style="display:inline-flex; align-items:center; gap:6px; font-size:0.78rem; color:#047857;">
                        <span class="material-symbols-rounded" style="font-size:1.05rem;">expand_less</span> عرض
                      </span>
                      <span style="font-weight:900; color:#059669;">التطبيق التفاعلي (${esc(prereqExam.title)})</span>
                    </a>
                  ` : ''}
                  ${hasPdf ? `
                    <button type="button" class="lesson-subbar-green open-lesson-pdf-trigger" style="width:100%; border:none; cursor:pointer; font-family:inherit;">
                      <span style="display:inline-flex; align-items:center; gap:6px; font-size:0.78rem; color:#047857;">
                        <span class="material-symbols-rounded" style="font-size:1.05rem;">visibility</span> عرض
                      </span>
                      <span style="font-weight:900; color:#059669;">ملف المحاضرة المحمي (PDF)</span>
                    </button>
                  ` : ''}
                ` : ''}

                ${items.map((it) => {
                  const isThisLesson = it.item_type === 'lesson' && Number(it.id) === Number(lesson.id);
                  const itemHref = it.item_type === 'exam' ? `/exams/${it.id}/take` : `/lessons/${it.id}`;
                  return `
                    <a href="${it.is_locked ? '#' : itemHref}" class="lesson-sidebar-item-link ${isThisLesson ? 'current-item' : ''} ${it.is_locked ? 'locked' : ''}" ${it.is_locked ? 'data-locked="1"' : ''}>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span class="material-symbols-rounded" style="font-size:1.05rem; color:${isThisLesson ? '#059669' : 'var(--text-muted)'};">
                          ${it.is_locked ? 'lock' : (it.item_type === 'exam' ? 'quiz' : (it.is_completed ? 'check_circle' : 'play_circle'))}
                        </span>
                        <span style="font-size:0.82rem; font-weight:${isThisLesson ? '900' : '700'};">${esc(it.title)}</span>
                      </div>
                      ${isThisLesson ? '<span class="badge badge-success" style="font-size:0.65rem; padding:2px 6px;">أنت هنا</span>' : ''}
                    </a>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </aside>
    ` : '';

    document.getElementById('lessonContent').innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom: 16px;">
        <a href="/courses/${lesson.course_id}" class="btn btn-ghost btn-sm" style="padding-right:0; font-weight:800;">
          <span class="material-symbols-rounded">arrow_forward</span> العودة لمنهج الكورس (${esc(lesson.course_title || 'الكورس')})
        </a>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="you-are-here-pill" style="background:#059669; border-color:#34d399; color:#fff;">أنت هنا: ${esc(lesson.chapter_title || 'الفصل الحالي')}</span>
        </div>
      </div>

      <div class="lesson-bassthalk-grid">
        <!-- Main Video & Content Column -->
        <div class="lesson-main-col">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom: 14px;">
            <div>
              <h1 class="page-title" style="font-size:1.25rem; margin-bottom:2px;"><span class="material-symbols-rounded" style="color:var(--primary)">play_circle</span> ${esc(lesson.title)}</h1>
              <p class="page-subtitle" style="font-size:0.82rem; margin:0;">${esc(lesson.chapter_title || 'شرح الدرس الحالي من الكورس المنهجي')}</p>
            </div>
            <button type="button" class="btn btn-sm" id="bookmarkBtn" style="background:rgba(16,185,129,0.12); color:var(--primary); border:1px solid rgba(16,185,129,0.3); border-radius:99px; padding:7px 16px; gap:6px; font-weight:800;">
              <span class="material-symbols-rounded" id="bookmarkIcon" style="color:${lesson.is_saved ? '#f59e0b' : 'var(--primary)'}; font-size:1.15rem;">
                ${lesson.is_saved ? 'favorite' : 'favorite_border'}
              </span>
              <span id="bookmarkText">${lesson.is_saved ? 'تمت الإضافة للمفضلة' : 'إضافة إلى المفضلة'}</span>
            </button>
          </div>

          ${prereqExam ? `
            <div class="card" style="margin-bottom: 18px; border: 2px solid ${prereqExam.passed ? 'var(--success)' : 'var(--warning)'}; background: ${prereqExam.passed ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.08)'};">
              <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="width:46px; height:46px; border-radius:12px; background:${prereqExam.passed ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.2)'}; color:${prereqExam.passed ? 'var(--success)' : '#d97706'}; display:flex; align-items:center; justify-content:center;">
                    <span class="material-symbols-rounded" style="font-size:1.6rem;">${prereqExam.passed ? 'task_alt' : 'quiz'}</span>
                  </div>
                  <div>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                      <h3 style="margin:0; font-size:1.02rem; font-weight:900; color:var(--text-primary);">امتحان المحاضرة: ${esc(prereqExam.title)}</h3>
                      <span class="badge ${prereqExam.passed ? 'badge-success' : 'badge-warning'}" style="font-weight:800;">
                        ${prereqExam.passed ? `تم الاجتياز (${prereqExam.best_score}%)` : `مطلوب درجة النجاح: ${prereqExam.required_score}%`}
                      </span>
                    </div>
                    <p style="margin:4px 0 0; font-size:0.84rem; color:var(--text-secondary);">
                      ${prereqExam.passed
                        ? 'لقد اجتزت امتحان المحاضرة بنجاح وتم فتح الفيديو لك.'
                        : `يجب حل امتحان المحاضرة أولاً والحصول على درجة لا تقل عن ${prereqExam.required_score}% لفتح مشاهدة الفيديو.${prereqExam.best_score !== null ? ` (أعلى درجة سابقة لك: ${prereqExam.best_score}%)` : ''}`
                      }
                    </p>
                  </div>
                </div>
                <a href="/exams/${prereqExam.id}/take" class="btn ${prereqExam.passed ? 'btn-outline' : 'btn-primary'} btn-sm" style="gap:6px; font-weight:800;">
                  <span class="material-symbols-rounded">edit_document</span>
                  ${prereqExam.passed ? 'مراجعة / إعادة الامتحان' : 'ابدأ حل امتحان المحاضرة الآن'}
                </a>
              </div>
            </div>
          ` : ''}

          <!-- Secure Video Box or Prerequisite Gate -->
          ${prereqLocked ? `
            <div class="card" style="text-align:center; padding:56px 24px; margin-bottom:18px; border:2px dashed var(--warning); background:var(--bg-card);">
              <div style="width:76px; height:76px; border-radius:50%; background:rgba(245,158,11,0.14); color:#d97706; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
                <span class="material-symbols-rounded" style="font-size:2.6rem;">lock</span>
              </div>
              <h2 style="font-size:1.35rem; font-weight:900; color:var(--text-primary); margin-bottom:10px;">حل امتحان المحاضرة أولاً لفتح الفيديو</h2>
              <p style="color:var(--text-secondary); font-size:0.95rem; max-width:520px; margin:0 auto 22px; line-height:1.7;">
                اشترط المعلم اجتياز امتحان <strong>"${esc(prereqExam?.title || 'امتحان المحاضرة')}"</strong> بدرجة لا تقل عن <strong>${prereqExam?.required_score || 60}%</strong> قبل الدخول لمشاهدة فيديو المحاضرة.
              </p>
              <a href="/exams/${prereqExam?.id}/take" class="btn btn-primary" style="gap:8px; padding:12px 28px; font-weight:800;">
                <span class="material-symbols-rounded">quiz</span> حل امتحان المحاضرة الآن
              </a>
            </div>
          ` : `
            <div class="video-container kimyawy-custom-player" id="videoBox" oncontextmenu="return false;" style="user-select:none;-webkit-user-select:none; margin-bottom:12px;">
              <div id="videoContainer" style="width:100%; height:100%; position:relative; overflow:hidden; background:#050e17;">
                <div style="display:flex; align-items:center; justify-content:center; height:100%; color:white; flex-direction:column; gap:12px;">
                  <div class="spinner"></div>
                  <p style="font-size:0.85rem; opacity:0.8;">جاري تهيئة المشغل المشفر الآمن...</p>
                </div>
              </div>

              <!-- Transparent Click & Gesture Shield (Blocks all direct iframe clicks, right-clicks, and IDM hooks) -->
              <div id="playerClickShield" style="position:absolute; inset:0 0 54px 0; z-index:14; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                <!-- Opaque Pause Cover (Hides YouTube "More Videos" & Channel Info when paused/stopped) -->
                <div id="playerPauseMask" style="position:absolute; inset:0; background:radial-gradient(circle at center, rgba(6,78,59,0.88) 0%, rgba(5,14,23,0.97) 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:#fff; transition:opacity 0.2s ease;">
                  <div style="width:74px; height:74px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 10px rgba(16,185,129,0.2), 0 12px 30px rgba(0,0,0,0.5);">
                    <span class="material-symbols-rounded" id="centerPlayIcon" style="font-size:2.8rem;">play_arrow</span>
                  </div>
                  <div style="font-weight:800; font-size:0.95rem; letter-spacing:0.3px;">اضغط لتشغيل المحاضرة داخل المشغل المشفر</div>
                  <div style="font-size:0.75rem; color:#a7f3d0; display:flex; align-items:center; gap:5px;">
                    <span class="material-symbols-rounded" style="font-size:0.95rem;">verified_user</span>
                    محمي بنظام كيمياوي ضد التحميل والتسريب
                  </div>
                </div>
              </div>
              
              <!-- Anti-leak Moving Watermark (Instant jump, no animation, 2-part name + phone only, no ID) -->
              <div id="watermark" class="video-watermark" style="transition: none !important; z-index:18; pointer-events:none;">
                <span style="font-weight:800;">${esc(shortName)}</span>
                <span style="opacity:0.6; margin: 0 6px;">•</span>
                <span style="direction:ltr; display:inline-block;">${esc(user.phone || '')}</span>
              </div>

              <!-- Custom Kimyawy Encrypted Control Bar -->
              <div id="kimyawyPlayerControls" dir="ltr" style="position:absolute; bottom:0; left:0; right:0; height:54px; background:linear-gradient(to top, rgba(5,14,23,0.98), rgba(5,14,23,0.86)); border-top:1px solid rgba(255,255,255,0.1); z-index:16; display:flex; align-items:center; gap:10px; padding:0 14px; color:#fff;">
                <button type="button" id="kpPlayBtn" style="background:var(--primary); border:none; color:#fff; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;" title="تشغيل / إيقاف">
                  <span class="material-symbols-rounded" id="kpPlayIcon" style="font-size:1.4rem;">play_arrow</span>
                </button>
                <button type="button" id="kpRewindBtn" style="background:rgba(255,255,255,0.1); border:none; color:#fff; height:32px; padding:0 8px; border-radius:6px; display:flex; align-items:center; gap:2px; cursor:pointer; font-size:0.72rem; font-weight:700; flex-shrink:0;" title="رجوع 10 ثوانٍ">
                  <span class="material-symbols-rounded" style="font-size:1.05rem;">replay_10</span>
                </button>
                <button type="button" id="kpForwardBtn" style="background:rgba(255,255,255,0.1); border:none; color:#fff; height:32px; padding:0 8px; border-radius:6px; display:flex; align-items:center; gap:2px; cursor:pointer; font-size:0.72rem; font-weight:700; flex-shrink:0;" title="تقديم 10 ثوانٍ">
                  <span class="material-symbols-rounded" style="font-size:1.05rem;">forward_10</span>
                </button>

                <span id="kpTimeDisplay" style="font-family:monospace; font-size:0.78rem; color:#cbd5e1; white-space:nowrap; min-width:86px; text-align:center;">00:00 / 00:00</span>

                <input type="range" id="kpProgressRange" min="0" max="1000" value="0" style="flex:1; accent-color:#10b981; height:5px; cursor:pointer;">

                <select id="kpSpeedSelect" style="background:rgba(255,255,255,0.12); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:6px; padding:4px 6px; font-size:0.75rem; font-weight:700; cursor:pointer;" title="سرعة التشغيل">
                  <option value="0.75" style="color:#000;">0.75x</option>
                  <option value="1" selected style="color:#000;">1x</option>
                  <option value="1.25" style="color:#000;">1.25x</option>
                  <option value="1.5" style="color:#000;">1.5x</option>
                  <option value="2" style="color:#000;">2x</option>
                </select>

                <button type="button" id="kpMuteBtn" style="background:transparent; border:none; color:#fff; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="الصوت">
                  <span class="material-symbols-rounded" id="kpMuteIcon" style="font-size:1.25rem;">volume_up</span>
                </button>

                <button type="button" id="customFullscreenBtn" style="background:rgba(255,255,255,0.12); border:none; color:#fff; width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;" title="ملء الشاشة">
                  <span class="material-symbols-rounded" id="fullscreenIcon" style="font-size:1.3rem;">fullscreen</span>
                </button>
              </div>

              <!-- Anti-Screenshot / Focus Loss / Recording Blackout Shield -->
              <div id="antiCaptureShield" class="video-anti-capture-shield" style="display:none; z-index:25;">
                <span class="material-symbols-rounded" style="font-size:3rem; color:#f59e0b;">security</span>
                <h4 style="margin:8px 0 4px; font-weight:800;">تم إيقاف الفيديو مؤقتاً لحماية المحتوى من التسجيل أو التصوير</h4>
                <p style="font-size:0.85rem; opacity:0.85; margin:0 0 12px;">يُمنع استخدام برامج التصوير أو التحميل أو الخروج من نافذة المحاضرة أثناء التشغيل</p>
                <button type="button" class="btn btn-primary btn-sm" style="pointer-events:auto;">استئناف المشاهدة الآمنة</button>
              </div>
            </div>
          `}

          <!-- Full-Width Green "تم مشاهدة الفيديو" Button (Matching Screenshot) -->
          <button class="btn btn-primary" id="markCompleteBtn" style="width:100%; justify-content:center; padding:12px 20px; font-size:0.98rem; font-weight:900; border-radius:12px; margin-bottom:14px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow:0 6px 18px rgba(16,185,129,0.28);" ${(lesson.progress?.completed || prereqLocked) ? 'disabled' : ''}>
            <span class="material-symbols-rounded">check_circle</span>
            <span>${lesson.progress?.completed ? 'تم مشاهدة الفيديو بنجاح' : 'تم مشاهدة الفيديو'}</span>
          </button>

          <!-- Previous / Next Lesson Controls -->
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
            <div style="display:flex; gap:10px;">
              ${lesson.prev_lesson 
                ? `<a href="/${lesson.prev_lesson.item_type === 'exam' ? 'exams' : 'lessons'}/${lesson.prev_lesson.id}${lesson.prev_lesson.item_type === 'exam' ? '/take' : ''}" class="btn btn-secondary btn-sm"><span class="material-symbols-rounded">arrow_forward</span> الدرس السابق</a>` 
                : ''
              }
              ${lesson.next_lesson 
                ? `<a href="/${lesson.next_lesson.item_type === 'exam' ? 'exams' : 'lessons'}/${lesson.next_lesson.id}${lesson.next_lesson.item_type === 'exam' ? '/take' : ''}" class="btn btn-secondary btn-sm">الدرس التالي <span class="material-symbols-rounded">arrow_back</span></a>` 
                : ''
              }
            </div>
            ${(lesson.progress && (lesson.max_views || 8)) ? `
              <span style="font-size:0.78rem; color:var(--text-secondary); font-weight:700; display:inline-flex; align-items:center; gap:5px;">
                <span class="material-symbols-rounded" style="font-size:1rem; color:var(--primary);">visibility</span>
                المشاهدات المتبقية: <strong>${Math.max(0, ((lesson.max_views || 8) + (lesson.progress.extra_views || 0)) - (lesson.progress.views_count || 0))}</strong> من ${(lesson.max_views || 8) + (lesson.progress.extra_views || 0)}
              </span>
            ` : ''}
          </div>

          <!-- Description card -->
          ${lesson.description 
            ? `
            <div class="card" style="margin-bottom: 20px;">
              <h3 class="card-title" style="margin-bottom: 10px;"><span class="material-symbols-rounded">description</span> مذكرات وتفاصيل الحصة</h3>
              <div style="color:var(--text-secondary); font-size:0.88rem; line-height:1.75;">${renderChemMarkdown(lesson.description)}</div>
            </div>
            ` 
            : ''
          }

          <!-- Protected Lesson PDF / Study Notes Material -->
          ${hasPdf 
            ? `
            <div class="card" style="margin-bottom: 20px; border: 1.5px solid rgba(16,185,129,0.3); background: var(--bg-card);">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="width:44px; height:44px; border-radius:10px; background:rgba(16,185,129,0.12); color:var(--primary); display:flex; align-items:center; justify-content:center;">
                    <span class="material-symbols-rounded" style="font-size:1.6rem;">shield_lock</span>
                  </div>
                  <div>
                    <h4 style="font-size:0.95rem; font-weight:800; color:var(--text-primary); margin:0 0 2px;">مذكرة وملخص الحصة المنهجي المحمي (PDF)</h4>
                    <p style="font-size:0.78rem; color:var(--text-muted); margin:0;">يُفتح داخل العارض المشفر المحمي ببيانات الطالب ضد التحميل والتسريب</p>
                  </div>
                </div>
                <div style="display:flex; gap:8px;">
                  <button type="button" class="btn btn-primary btn-sm open-lesson-pdf-trigger" style="display:inline-flex; align-items:center; gap:6px; font-weight:800;">
                    <span class="material-symbols-rounded">visibility</span> فتح المذكرة داخل العارض المحمي
                  </button>
                </div>
              </div>
            </div>
            ` 
            : ''
          }

          <!-- Personal Timestamped Study Notes Card -->
          <div class="card" id="personalNotesSection" style="margin-bottom: 20px; border: 1.5px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
              <h3 class="card-title" style="margin:0; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--accent)">edit_note</span>
                ملاحظاتي الشخصية الموقوتة على المحاضرة
              </h3>
              <span style="font-size:0.76rem; color:var(--text-muted); font-weight:600;">سجّل أهم النقاط والمعادلات مع الدقيقة للرجوع إليها ليلة الامتحان</span>
            </div>
            <form id="lessonNoteForm" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;">
              <input type="text" id="noteTimeInput" class="form-input" placeholder="الدقيقة (مثال 12:30)" dir="ltr" style="width:140px; text-align:center; font-family:monospace;">
              <input type="text" id="noteContentInput" class="form-input" placeholder="اكتب ملاحظتك أو المعادلة المهمة هنا..." required style="flex:1; min-width:200px;">
              <button type="submit" class="btn btn-primary btn-sm" style="gap:6px; padding:0 18px;">
                <span class="material-symbols-rounded">add_task</span> حفظ الملاحظة
              </button>
            </form>
            <div id="lessonNotesList">
              <div style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:10px;">جاري تحميل ملاحظاتك...</div>
            </div>
          </div>

          <!-- Lesson Discussions Form (Only shown if enabled by teacher for this course) -->
          ${allowForum ? `
            <div class="card">
              <h3 class="card-title" style="margin-bottom: 16px;"><span class="material-symbols-rounded" style="color:var(--primary)">forum</span> أسئلة الطلاب على هذا الدرس</h3>
              
              <form id="lessonDiscussionForm" style="display:flex; gap:10px; margin-bottom:20px;">
                <input type="text" id="lessonDiscInput" class="form-input" placeholder="هل لديك سؤال في جزئية معينة من الفيديو؟ اكتبه للمدرس هنا..." required>
                <button type="submit" class="btn btn-primary"><span class="material-symbols-rounded">send</span> اسأل المدرس</button>
              </form>
              
              <div id="lessonDiscussionsList">
                <div class="loading-spinner"><div class="spinner"></div></div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Side Curriculum Accordion ("أنت هنا") -->
        ${sidebarCurriculumHtml}
      </div>

      <!-- Floating Quick Notes Trigger Button (Matching Screenshot: "اضغط هنا عشان تكتب ملاحظاتك") -->
      <div class="floating-lesson-notes-widget" id="floatingNotesWidget">
        <button type="button" class="floating-notes-circle-btn" id="floatingNotesBtn" title="اكتب ملاحظاتك على الدرس">
          <span class="material-symbols-rounded">description</span>
        </button>
        <div class="floating-notes-speech-bubble" id="floatingNotesBubble">
          اضغط هنا عشان تكتب ملاحظاتك
        </div>
      </div>
    `;

    // Load Video URL/Iframe Source securely (if not locked by prerequisite exam)
    let pauseProtectedVideo = () => {};
    let getCurrentVideoTimeSec = () => 0;

    if (!prereqLocked) {
      try {
        const res = await api.getVideoToken(id);
        // Decode obfuscated stream_cipher if present
        let decodedUrl = String(res.video_url || '');
        let vSource = res.video_source || 'custom_shield';
        let vdoId = res.vdocipher_id || '';
        if (res.stream_cipher && res.token) {
          try {
            const keyStr = res.token.slice(0, 16);
            const rawBin = atob(res.stream_cipher);
            const outBytes = new Uint8Array(rawBin.length);
            for (let i = 0; i < rawBin.length; i++) {
              outBytes[i] = rawBin.charCodeAt(i) ^ keyStr.charCodeAt(i % keyStr.length);
            }
            const parsed = JSON.parse(new TextDecoder().decode(outBytes));
            if (parsed.u) decodedUrl = parsed.u;
            if (parsed.s) vSource = parsed.s;
            if (parsed.v) vdoId = parsed.v;
          } catch (_) {}
        }

        const vc = document.getElementById('videoContainer');
        const clickShield = document.getElementById('playerClickShield');
        const pauseMask = document.getElementById('playerPauseMask');
        const controlsBar = document.getElementById('kimyawyPlayerControls');
        const playBtn = document.getElementById('kpPlayBtn');
        const playIcon = document.getElementById('kpPlayIcon');
        const rewindBtn = document.getElementById('kpRewindBtn');
        const forwardBtn = document.getElementById('kpForwardBtn');
        const progressRange = document.getElementById('kpProgressRange');
        const timeDisplay = document.getElementById('kpTimeDisplay');
        const speedSelect = document.getElementById('kpSpeedSelect');
        const muteBtn = document.getElementById('kpMuteBtn');
        const muteIcon = document.getElementById('kpMuteIcon');

        // Case 1: VdoCipher Hardware DRM (OTP + playbackInfo)
        if (vSource === 'vdocipher' && res.vdocipher_otp && res.vdocipher_playback_info) {
          if (clickShield) clickShield.style.display = 'none';
          if (controlsBar) controlsBar.style.display = 'none';
          const drmSrc = `https://player.vdocipher.com/v2/?otp=${encodeURIComponent(res.vdocipher_otp)}&playbackInfo=${encodeURIComponent(res.vdocipher_playback_info)}`;
          if (vc) {
            vc.innerHTML = `<iframe src="${esc(drmSrc)}" style="width:100%;height:100%;border:0;" allow="encrypted-media" allowfullscreen></iframe>`;
          }
        } else if (decodedUrl.includes('youtube.com') || decodedUrl.includes('youtu.be')) {
          // Case 2: Custom Shielded Player for YouTube (Zero YouTube Branding, Cropped Chrome, Custom Controls, Anti-IDM)
          let videoId = '';
          if (decodedUrl.includes('youtu.be/')) videoId = decodedUrl.split('youtu.be/')[1].split('?')[0].split('&')[0];
          else if (decodedUrl.includes('/embed/')) videoId = decodedUrl.split('/embed/')[1].split('?')[0].split('&')[0];
          else if (decodedUrl.includes('v=')) videoId = decodedUrl.split('v=')[1].split('&')[0];
          videoId = videoId.replace(/[^A-Za-z0-9_-]/g, '');
          if (!videoId) throw new Error('رابط الفيديو غير صالح');

          if (vc) {
            // Cropped container (-65px top & bottom) + pointer-events:none completely hides YouTube header/footer & blocks right-click/IDM
            vc.innerHTML = `
              <div style="position:absolute; top:-68px; left:0; width:100%; height:calc(100% + 136px); pointer-events:none; overflow:hidden;">
                <div id="ytShieldTarget" style="width:100%; height:100%;"></div>
              </div>
            `;
          }

          const loadYtApi = () => new Promise((resolve) => {
            if (window.YT && window.YT.Player) return resolve(window.YT);
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
              if (prev) prev();
              resolve(window.YT);
            };
            if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
              const tag = document.createElement('script');
              tag.src = 'https://www.youtube.com/iframe_api';
              document.head.appendChild(tag);
            }
          });

          const YT = await loadYtApi();
          let isPlaying = false;
          let isMuted = false;
          let durationSec = (lesson.duration || 45) * 60;
          let currentSec = 0;
          let uiTimer = null;

          const syncUiState = (playing) => {
            isPlaying = playing;
            if (playIcon) playIcon.textContent = playing ? 'pause' : 'play_arrow';
            if (pauseMask) {
              pauseMask.style.opacity = playing ? '0' : '1';
              pauseMask.style.pointerEvents = playing ? 'none' : 'auto';
            }
          };

          const ytPlayer = new YT.Player('ytShieldTarget', {
            videoId,
            host: 'https://www.youtube-nocookie.com',
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
              origin: window.location.origin
            },
            events: {
              onReady: (ev) => {
                const d = ev.target.getDuration();
                if (d && d > 0) durationSec = Math.floor(d);
                if (timeDisplay) timeDisplay.textContent = `${formatTime(0)} / ${formatTime(durationSec)}`;
                uiTimer = setInterval(() => {
                  try {
                    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
                    currentSec = Math.floor(ytPlayer.getCurrentTime() || 0);
                    const total = Math.floor(ytPlayer.getDuration() || durationSec || 1);
                    durationSec = total;
                    if (timeDisplay) timeDisplay.textContent = `${formatTime(currentSec)} / ${formatTime(total)}`;
                    if (progressRange && total > 0) {
                      progressRange.value = String(Math.min(1000, Math.round((currentSec / total) * 1000)));
                    }
                  } catch (_) {}
                }, 500);
              },
              onStateChange: (ev) => {
                if (ev.data === YT.PlayerState.PLAYING) {
                  syncUiState(true);
                } else if (ev.data === YT.PlayerState.PAUSED || ev.data === YT.PlayerState.ENDED) {
                  syncUiState(false);
                }
              }
            }
          });

          const togglePlay = () => {
            try {
              if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return;
              const st = ytPlayer.getPlayerState();
              if (st === YT.PlayerState.PLAYING) {
                ytPlayer.pauseVideo();
                syncUiState(false);
              } else {
                ytPlayer.playVideo();
                syncUiState(true);
              }
            } catch (_) {}
          };

          pauseProtectedVideo = () => {
            try {
              if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
                ytPlayer.pauseVideo();
                syncUiState(false);
              }
            } catch (_) {}
          };

          getCurrentVideoTimeSec = () => currentSec;

          clickShield?.addEventListener('click', togglePlay);
          playBtn?.addEventListener('click', togglePlay);
          rewindBtn?.addEventListener('click', () => {
            try {
              const target = Math.max(0, (ytPlayer.getCurrentTime() || 0) - 10);
              ytPlayer.seekTo(target, true);
            } catch (_) {}
          });
          forwardBtn?.addEventListener('click', () => {
            try {
              const target = Math.min(durationSec, (ytPlayer.getCurrentTime() || 0) + 10);
              ytPlayer.seekTo(target, true);
            } catch (_) {}
          });
          progressRange?.addEventListener('input', () => {
            try {
              const pct = Number(progressRange.value) / 1000;
              const target = Math.floor(pct * (durationSec || 1));
              ytPlayer.seekTo(target, true);
            } catch (_) {}
          });
          speedSelect?.addEventListener('change', () => {
            try {
              ytPlayer.setPlaybackRate(parseFloat(speedSelect.value) || 1);
            } catch (_) {}
          });
          muteBtn?.addEventListener('click', () => {
            try {
              if (isMuted) {
                ytPlayer.unMute();
                isMuted = false;
                if (muteIcon) muteIcon.textContent = 'volume_up';
              } else {
                ytPlayer.mute();
                isMuted = true;
                if (muteIcon) muteIcon.textContent = 'volume_off';
              }
            } catch (_) {}
          });
          window.addEventListener('popstate', () => { if (uiTimer) clearInterval(uiTimer); }, { once: true });
        } else if (/\.mp4($|\?)/i.test(decodedUrl)) {
          // Case 3: Direct MP4 video inside custom HTML5 encrypted player (controlsList="nodownload" + disablePictureInPicture)
          if (vc) {
            vc.innerHTML = `
              <video id="nativeProtectedVideo" src="${esc(decodedUrl)}" style="width:100%; height:calc(100% - 54px); object-fit:contain; background:#000; pointer-events:none;" playsinline controlsList="nodownload noplaybackrate" disablePictureInPicture oncontextmenu="return false;"></video>
            `;
            const vEl = document.getElementById('nativeProtectedVideo');
            const toggleV = () => {
              if (!vEl) return;
              if (vEl.paused) { vEl.play(); if (playIcon) playIcon.textContent = 'pause'; if (pauseMask) { pauseMask.style.opacity = '0'; pauseMask.style.pointerEvents = 'none'; } }
              else { vEl.pause(); if (playIcon) playIcon.textContent = 'play_arrow'; if (pauseMask) { pauseMask.style.opacity = '1'; pauseMask.style.pointerEvents = 'auto'; } }
            };
            pauseProtectedVideo = () => { if (vEl && !vEl.paused) toggleV(); };
            getCurrentVideoTimeSec = () => Math.floor(vEl?.currentTime || 0);
            clickShield?.addEventListener('click', toggleV);
            playBtn?.addEventListener('click', toggleV);
            rewindBtn?.addEventListener('click', () => { if (vEl) vEl.currentTime = Math.max(0, vEl.currentTime - 10); });
            forwardBtn?.addEventListener('click', () => { if (vEl) vEl.currentTime = Math.min(vEl.duration || 3600, vEl.currentTime + 10); });
            vEl?.addEventListener('timeupdate', () => {
              const c = Math.floor(vEl.currentTime || 0);
              const d = Math.floor(vEl.duration || 1);
              if (timeDisplay) timeDisplay.textContent = `${formatTime(c)} / ${formatTime(d)}`;
              if (progressRange && d > 0) progressRange.value = String(Math.round((c / d) * 1000));
            });
            progressRange?.addEventListener('input', () => {
              if (vEl && vEl.duration) vEl.currentTime = (Number(progressRange.value) / 1000) * vEl.duration;
            });
            speedSelect?.addEventListener('change', () => { if (vEl) vEl.playbackRate = parseFloat(speedSelect.value) || 1; });
            muteBtn?.addEventListener('click', () => {
              if (!vEl) return;
              vEl.muted = !vEl.muted;
              if (muteIcon) muteIcon.textContent = vEl.muted ? 'volume_off' : 'volume_up';
            });
          }
        } else {
          // Case 4: Google Drive video preview or Bunny Stream / VdoCipher Embed URL
          let iframeSrc = decodedUrl;
          if (decodedUrl.includes('drive.google.com')) {
            let fileId = '';
            if (decodedUrl.includes('/d/')) fileId = decodedUrl.split('/d/')[1].split('/')[0];
            else if (decodedUrl.includes('id=')) fileId = decodedUrl.split('id=')[1].split('&')[0];
            fileId = fileId.replace(/[^A-Za-z0-9_-]/g, '');
            if (!fileId) throw new Error('رابط الفيديو غير صالح');
            iframeSrc = `https://drive.google.com/file/d/${fileId}/preview`;
          }
          if (clickShield) clickShield.style.display = 'none';
          if (controlsBar) controlsBar.style.display = 'none';
          if (vc) {
            vc.innerHTML = `
              <iframe
                src="${esc(iframeSrc)}"
                title="فيديو الدرس المشفر"
                style="width:100%; height:100%; border:none;"
                allow="accelerometer; autoplay; encrypted-media; gyroscope"
                referrerpolicy="strict-origin-when-cross-origin"
              ></iframe>
              <div style="position:absolute; top:0; right:0; width:80px; height:60px; z-index:15;"></div>
            `;
          }
        }
      } catch (err) {
        const vc = document.getElementById('videoContainer');
        const clickShield = document.getElementById('playerClickShield');
        if (clickShield) clickShield.style.display = 'none';
        if (vc) {
          vc.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--error); flex-direction:column; gap:12px; background:var(--bg-secondary);">
              <span class="material-symbols-rounded" style="font-size:3rem;">error</span>
              <p style="font-size:0.85rem; font-weight:700;">${esc(err.message)}</p>
            </div>
          `;
        }
      }
    }

    // Security constraints & custom fullscreen & instant watermark movement
    const videoBox = document.getElementById('videoBox');
    const shield = document.getElementById('antiCaptureShield');
    const fsBtn = document.getElementById('customFullscreenBtn');
    const fsIcon = document.getElementById('fullscreenIcon');

    videoBox?.addEventListener('contextmenu', e => e.preventDefault());

    if (fsBtn && videoBox) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          videoBox.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      });
      document.addEventListener('fullscreenchange', () => {
        if (fsIcon) {
          fsIcon.textContent = document.fullscreenElement ? 'fullscreen_exit' : 'fullscreen';
        }
      });
    }

    const activateCaptureShield = () => {
      pauseProtectedVideo();
      if (shield) shield.style.display = 'flex';
    };
    const clearCaptureShield = () => {
      if (shield) shield.style.display = 'none';
    };
    shield?.addEventListener('click', clearCaptureShield);

    // Pause & shield immediately when user switches window/tab or launches a screen snipping/recording tool
    const onVisibilityChange = () => {
      if (document.hidden) activateCaptureShield();
    };
    const onWindowBlur = () => {
      // If focus moved outside the page (e.g. Snipping Tool / OBS / ShareX), pause & shield
      if (document.activeElement?.tagName !== 'IFRAME') {
        activateCaptureShield();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);

    const preventKeys = e => {
      if (
        e.key === 'PrintScreen' ||
        e.key === 'F12' ||
        (e.metaKey && e.shiftKey && (e.key === 'S' || e.key === 's' || e.key === '3' || e.key === '4')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j' || e.key === 'S' || e.key === 's')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's' || e.key === 'P' || e.key === 'p'))
      ) {
        e.preventDefault();
        activateCaptureShield();
        showToast('غير مسموح بالتقاط الشاشة أو نسخ رابط الفيديو لحماية المحتوى', 'warning');
      }
    };
    document.addEventListener('keydown', preventKeys);
    document.addEventListener('keyup', (e) => {
      if (e.key === 'PrintScreen') {
        activateCaptureShield();
        navigator.clipboard?.writeText?.('').catch(() => {});
      }
    });

    // Instant Watermark jump (zero transition animation)
    const watermark = document.getElementById('watermark');
    let wmInterval;
    if (watermark) {
      const moveWm = () => {
        const top = Math.floor(Math.random() * 62) + 18;
        const left = Math.floor(Math.random() * 60) + 20;
        watermark.style.transition = 'none';
        watermark.style.top = `${top}%`;
        watermark.style.left = `${left}%`;
        watermark.style.transform = 'translate(-50%, -50%)';
      };
      moveWm();
      wmInterval = setInterval(moveWm, 3500);
    }

    const cleanupLessonListeners = () => {
      document.removeEventListener('keydown', preventKeys);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      if (wmInterval) clearInterval(wmInterval);
    };
    window.addEventListener('popstate', cleanupLessonListeners, { once: true });

    // Load & bind personal timestamped study notes
    const parseTimeSec = (val) => {
      const s = String(val || '').trim();
      if (!s) return 0;
      if (s.includes(':')) {
        const parts = s.split(':').map(n => parseInt(n, 10) || 0);
        return parts.length === 3 ? (parts[0] * 3600 + parts[1] * 60 + parts[2]) : (parts[0] * 60 + (parts[1] || 0));
      }
      return (parseInt(s, 10) || 0) * 60;
    };

    const loadLessonNotes = async () => {
      const notesEl = document.getElementById('lessonNotesList');
      if (!notesEl) return;
      try {
        const notes = await api.getLessonNotes(id);
        if (!notes || notes.length === 0) {
          notesEl.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:12px; background:var(--bg-secondary); border-radius:10px;">لم تسجل أي ملاحظات على هذه المحاضرة بعد.</div>`;
          return;
        }
        notesEl.innerHTML = notes.map(n => `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; background:var(--bg-secondary); border-radius:10px; margin-bottom:8px; border-right:3px solid var(--accent);">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
              <span class="badge badge-warning" dir="ltr" style="font-family:monospace; font-size:0.78rem; flex-shrink:0; display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-rounded" style="font-size:0.9rem;">schedule</span> ${formatTime(n.timestamp_sec || 0)}</span>
              <span style="font-size:0.88rem; color:var(--text-primary); font-weight:600; word-break:break-word;">${esc(n.content)}</span>
            </div>
            <button type="button" class="btn btn-ghost btn-sm delete-note-btn" data-nid="${n.id}" style="color:var(--error); padding:4px;" title="حذف الملاحظة">
              <span class="material-symbols-rounded" style="font-size:1.1rem;">delete</span>
            </button>
          </div>
        `).join('');

        notesEl.querySelectorAll('.delete-note-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await api.deleteLessonNote(id, btn.dataset.nid);
              loadLessonNotes();
              showToast('تم حذف الملاحظة', 'success');
            } catch (err) { showToast(err.message, 'error'); }
          });
        });
      } catch (e) {
        notesEl.innerHTML = '';
      }
    };
    loadLessonNotes();

    document.getElementById('lessonNoteForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const timeInp = document.getElementById('noteTimeInput');
      const contentInp = document.getElementById('noteContentInput');
      if (!contentInp?.value.trim()) return;
      try {
        await api.addLessonNote(id, {
          timestamp_sec: parseTimeSec(timeInp?.value),
          content: contentInp.value.trim()
        });
        if (timeInp) timeInp.value = '';
        contentInp.value = '';
        loadLessonNotes();
        showToast('تم حفظ ملاحظتك بنجاح', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Bind Protected PDF Viewer triggers
    document.querySelectorAll('.open-lesson-pdf-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        pauseProtectedVideo();
        openProtectedPdfModal(id, lesson.title);
      });
    });

    // Bind Side Curriculum Accordion toggles
    document.querySelectorAll('.lesson-sidebar-unit-card').forEach(card => {
      card.addEventListener('click', () => {
        const wrap = card.closest('.lesson-sidebar-unit-wrap');
        const sub = wrap?.querySelector('.lesson-sidebar-subitems');
        if (!sub) return;
        const hidden = sub.style.display === 'none';
        sub.style.display = hidden ? 'flex' : 'none';
      });
    });

    document.querySelectorAll('.lesson-sidebar-item-link[data-locked="1"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        showToast('هذا المحتوى مغلق حالياً حتى تكمل الدرس السابق', 'warning');
      });
    });

    // Bind Floating Quick Notes button ("اضغط هنا عشان تكتب ملاحظاتك")
    const scrollToPersonalNotes = () => {
      const notesSec = document.getElementById('personalNotesSection');
      const timeInp = document.getElementById('noteTimeInput');
      const contentInp = document.getElementById('noteContentInput');
      const curSec = getCurrentVideoTimeSec();
      if (timeInp && curSec > 0) {
        timeInp.value = formatTime(curSec);
      }
      notesSec?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => contentInp?.focus(), 350);
    };
    document.getElementById('floatingNotesBtn')?.addEventListener('click', scrollToPersonalNotes);
    document.getElementById('floatingNotesBubble')?.addEventListener('click', scrollToPersonalNotes);

    // Completion toggle
    const markBtn = document.getElementById('markCompleteBtn');
    if (markBtn && !lesson.progress?.completed && !prereqLocked) {
      markBtn.addEventListener('click', async () => {
        markBtn.disabled = true;
        markBtn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري الحفظ...';
        try {
          await api.updateProgress(id, { completed: 1 });
          markBtn.innerHTML = '<span class="material-symbols-rounded">check_circle</span> تم مشاهدة الفيديو بنجاح';
          showToast('تم تسجيل مشاهدتك للدرس بنجاح', 'success');
        } catch (err) {
          showToast(err.message, 'error');
          markBtn.disabled = false;
          markBtn.innerHTML = '<span class="material-symbols-rounded">check_circle</span> تم مشاهدة الفيديو';
        }
      });
    }

    // Discussions forum loading (if enabled)
    if (allowForum) {
      const loadLessonDiscussions = async () => {
        try {
          const discs = await api.getDiscussions(lesson.course_id, id);
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          const isT = currentUser.role === 'teacher' || currentUser.role === 'admin';
          const listEl = document.getElementById('lessonDiscussionsList');
          if (!listEl) return;

          if (discs.length === 0) {
            listEl.innerHTML = `
              <p style="color:var(--text-muted); text-align:center; padding:20px; font-size:0.82rem; font-weight:600;">
                لا توجد أسئلة حالياً للدرس. كن أول من يسأل!
              </p>
            `;
            return;
          }

          listEl.innerHTML = discs.map(d => `
            <div class="discussion-card">
              <div class="discussion-header">
                <div class="discussion-avatar" style="background:var(--green-50); color:var(--primary); font-weight:800; border:1px solid var(--green-200);">
                  ${esc(d.user_name.charAt(0))}
                </div>
                <div style="flex:1;">
                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="font-size:0.85rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:5px;">
                      <span>${sanitize(d.user_name)}</span>
                      ${d.user_role === 'teacher' || d.user_role === 'admin' 
                        ? '<span class="badge badge-success" style="font-size:0.6rem; padding:1px 6px;">مُدرّس المنصة</span>' 
                        : ''
                      }
                    </div>
                    ${(isT || currentUser.id === d.user_id) 
                      ? `<button class="btn btn-ghost delete-disc-btn" data-id="${d.id}" style="color:var(--error); padding:4px;" title="حذف السؤال"><span class="material-symbols-rounded" style="font-size:1.15rem;">delete</span></button>` 
                      : ''
                    }
                  </div>
                  <div class="discussion-time">${new Date(d.created_at || Date.now()).toLocaleDateString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
              </div>
              
              <div class="discussion-body">
                ${renderChemMarkdown(d.content)}
              </div>
              
              <div class="discussion-replies">
                ${d.replies.map(r => `
                  <div class="reply-item">
                    <div class="reply-avatar" style="background:var(--gold-50); color:var(--accent); font-weight:800; border:1px solid var(--gold-200);">
                      ${sanitize(r.user_name.charAt(0))}
                    </div>
                    <div class="reply-content">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <strong style="font-size:0.78rem; font-weight:700; color:var(--text-primary);">${sanitize(r.user_name)}</strong>
                        ${(isT || currentUser.id === r.user_id) 
                          ? `<button class="btn btn-ghost delete-reply-btn" data-id="${r.id}" style="color:var(--error); padding:2px;" title="حذف الرد"><span class="material-symbols-rounded" style="font-size:1rem;">close</span></button>` 
                          : ''
                        }
                      </div>
                      <div class="reply-text">${renderChemMarkdown(r.content)}</div>
                    </div>
                  </div>
                `).join('')}
                
                <form class="replyForm" data-id="${d.id}" style="display:flex; gap:8px; margin-top:8px;">
                  <input type="text" class="form-input" placeholder="أضف رداً..." required style="padding:6px 12px; font-size:0.8rem;">
                  <button type="submit" class="btn btn-secondary btn-sm" style="padding: 0 14px;">رد</button>
                </form>
              </div>
            </div>
          `).join('');

          document.querySelectorAll('.delete-disc-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const ok = await confirmModal('تأكيد الحذف', 'هل أنت متأكد من حذف هذا السؤال؟');
              if (!ok) return;
              try {
                await api.deleteDiscussion(btn.dataset.id);
                showToast('تم حذف السؤال', 'success');
                loadLessonDiscussions();
              } catch (err) { showToast(err.message, 'error'); }
            });
          });
          document.querySelectorAll('.delete-reply-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const ok = await confirmModal('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الرد؟');
              if (!ok) return;
              try {
                await api.deleteReply(btn.dataset.id);
                showToast('تم حذف الرد', 'success');
                loadLessonDiscussions();
              } catch (err) { showToast(err.message, 'error'); }
            });
          });
          document.querySelectorAll('.replyForm').forEach(form => {
            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              const input = e.target.querySelector('input');
              try {
                await api.postReply(form.dataset.id, { content: input.value });
                input.value = '';
                loadLessonDiscussions();
              } catch (err) { showToast(err.message, 'error'); }
            });
          });

        } catch (e) {
          const el = document.getElementById('lessonDiscussionsList');
          if (el) el.innerHTML = '<p style="color:var(--error); text-align:center; padding:10px;">فشل تحميل أسئلة الدرس.</p>';
        }
      };

      loadLessonDiscussions();

      const lessonDiscForm = document.getElementById('lessonDiscussionForm');
      lessonDiscForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('lessonDiscInput');
        try {
          await api.postDiscussion({ course_id: lesson.course_id, lesson_id: id, content: input.value });
          input.value = '';
          loadLessonDiscussions();
          showToast('تم نشر سؤالك بنجاح', 'success');
        } catch (err) { showToast(err.message, 'error'); }
      });
    }

    // Bookmark / Save lesson toggle
    document.getElementById('bookmarkBtn')?.addEventListener('click', async () => {
      try {
        const res = await api.toggleBookmark(id);
        showToast(res.message, 'success');
        const icon = document.getElementById('bookmarkIcon');
        const text = document.getElementById('bookmarkText');
        if (icon) icon.style.color = res.is_saved ? '#f59e0b' : 'var(--primary)';
        if (icon) icon.textContent = res.is_saved ? 'favorite' : 'favorite_border';
        if (text) text.textContent = res.is_saved ? 'تمت الإضافة للمفضلة' : 'إضافة إلى المفضلة';
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

  } catch (err) {
    document.getElementById('lessonContent').innerHTML = `
      <div class="card" style="text-align:center; padding:48px 24px; max-width:680px; margin:40px auto; border-top: 4px solid var(--primary); box-shadow: var(--shadow-lg);">
        <div style="width:74px; height:74px; border-radius:50%; background:var(--green-50); border:2px solid var(--green-200); display:flex; align-items:center; justify-content:center; margin:0 auto 18px; color:var(--primary);">
          <span class="material-symbols-rounded" style="font-size:2.8rem;">lock</span>
        </div>
        <h2 style="font-size:1.4rem; font-weight:900; color:var(--text-primary); margin-bottom:10px;">المحتوى مغلق حالياً</h2>
        <p style="color:var(--text-secondary); font-size:0.92rem; line-height:1.7; max-width:520px; margin:0 auto 24px;">
          ${esc(err.message || 'لا يمكنك فتح هذا الدرس إلا بعد استكمال المتطلبات السابقة.')}
        </p>
        <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
          <a href="/courses" class="btn btn-secondary"><span class="material-symbols-rounded">book</span> جدول الكورسات</a>
          <button onclick="window.history.back()" class="btn btn-primary"><span class="material-symbols-rounded">arrow_forward</span> الرجوع واستكمال المطلوب</button>
        </div>
      </div>
    `;
  }
}
