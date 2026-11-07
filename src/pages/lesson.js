import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { getUser, isTeacher } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { confirmModal } from '../components/modal.js';
import { esc, sanitize, safeUrl, formatTime, getShortStudentName, getInitials } from '../utils/helpers.js';
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
            <div class="video-container kimyawy-custom-player" id="videoBox" oncontextmenu="return false;" style="user-select:none;-webkit-user-select:none; margin-bottom:14px; border-radius:18px; border:1.5px solid rgba(16,185,129,0.35); box-shadow:0 20px 45px rgba(2,12,27,0.35); overflow:hidden; background:#030914;">
              <!-- Top Encrypted Cinema HUD Bar -->
              <div id="kimyawyPlayerTopBar" style="position:absolute; top:0; left:0; right:0; height:44px; padding:0 16px; background:linear-gradient(to bottom, rgba(3,9,20,0.92) 0%, rgba(3,9,20,0.4) 75%, transparent 100%); z-index:19; display:flex; align-items:center; justify-content:space-between; pointer-events:none; color:#f8fafc; font-size:0.76rem;">
                <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(6,78,59,0.75); border:1px solid rgba(16,185,129,0.4); padding:4px 11px; border-radius:99px; backdrop-filter:blur(8px);">
                  <span style="width:8px; height:8px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981; display:inline-block;"></span>
                  <span style="font-weight:800; color:#ecfdf5;">مشغل كيمياوي المشفر</span>
                  <span style="color:#E0A526; font-weight:900;">◆</span>
                  <span style="color:#a7f3d0; font-size:0.7rem;">حماية نشطة ضد التحميل والتسجيل</span>
                </div>
                <div style="display:inline-flex; align-items:center; gap:8px;">
                  <span id="playerStrikeBadge" style="display:none; background:rgba(225,29,72,0.85); color:#fff; padding:3px 10px; border-radius:99px; font-weight:800; font-size:0.7rem;"></span>
                  <span style="background:rgba(15,23,42,0.78); border:1px solid rgba(224,165,38,0.35); color:#fde68a; padding:3px 10px; border-radius:99px; font-weight:800; font-size:0.72rem;" dir="ltr">
                    ${esc(shortName)} • ${esc(user.phone || '')}
                  </span>
                </div>
              </div>

              <div id="videoContainer" style="width:100%; height:100%; position:relative; overflow:hidden; background:#030914;">
                <div style="display:flex; align-items:center; justify-content:center; height:100%; color:white; flex-direction:column; gap:12px;">
                  <div class="spinner"></div>
                  <p style="font-size:0.85rem; opacity:0.85; font-weight:700;">جاري فك تشفير البث الآمن للمحاضرة...</p>
                </div>
              </div>

              <!-- Permanent Diagonal Forensic Watermark Grid (Always burned over video frame against external/screen recording) -->
              <div id="videoWatermarkMatrix" style="position:absolute; inset:0 0 58px 0; z-index:15; pointer-events:none; overflow:hidden; display:grid; grid-template-columns:repeat(3, 1fr); grid-template-rows:repeat(3, 1fr); place-items:center; opacity:0.16; user-select:none;">
                ${Array.from({ length: 9 }).map(() => `
                  <div style="transform:rotate(-24deg); color:#ffffff; font-weight:900; font-size:0.78rem; white-space:nowrap; text-shadow:0 1px 3px rgba(0,0,0,0.9); font-family:monospace;" dir="ltr">
                    ${esc(shortName)} • ${esc(user.phone || '')}
                  </div>
                `).join('')}
              </div>

              <!-- Transparent Click & Gesture Shield (Blocks all direct iframe hover/clicks, right-clicks, and IDM hooks) -->
              <div id="playerClickShield" style="position:absolute; inset:0 0 58px 0; z-index:16; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                <!-- Sleek Cinema Pause Overlay -->
                <div id="playerPauseMask" style="position:absolute; inset:0; background:radial-gradient(circle at center, rgba(6,78,59,0.84) 0%, rgba(3,9,20,0.96) 100%); backdrop-filter:blur(6px); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; color:#fff; transition:opacity 0.18s ease;">
                  <div style="position:relative; width:82px; height:82px; border-radius:24px; background:linear-gradient(135deg, #059669 0%, #047857 100%); border:2px solid rgba(224,165,38,0.65); color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 0 0 12px rgba(16,185,129,0.15), 0 16px 36px rgba(0,0,0,0.6); transform:rotate(0deg);">
                    <span class="material-symbols-rounded" id="centerPlayIcon" style="font-size:3.1rem;">play_arrow</span>
                    <span style="position:absolute; top:-5px; right:-5px; width:12px; height:12px; background:#E0A526; transform:rotate(45deg); border:2px solid #030914;"></span>
                  </div>
                  <div style="text-align:center; padding:0 16px;">
                    <div style="font-weight:900; font-size:1.05rem; letter-spacing:0.2px; margin-bottom:4px;">${esc(lesson.title)}</div>
                    <div style="font-size:0.78rem; color:#a7f3d0; display:inline-flex; align-items:center; gap:6px; background:rgba(0,0,0,0.35); padding:5px 14px; border-radius:99px; border:1px solid rgba(16,185,129,0.25);">
                      <span class="material-symbols-rounded" style="font-size:1rem; color:#E0A526;">shield_lock</span>
                      <span>اضغط لتشغيل البث المشفر • محمي بمعايير bedigital الأمنية</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Anti-leak Instant-Jumping Watermark Badge (Zero transition animation) -->
              <div id="watermark" class="video-watermark" style="transition: none !important; z-index:18; pointer-events:none;">
                <span style="font-weight:800;">${esc(shortName)}</span>
                <span style="opacity:0.6; margin: 0 6px;">•</span>
                <span style="direction:ltr; display:inline-block;">${esc(user.phone || '')}</span>
              </div>

              <!-- Upgraded Custom Kimyawy Cinema Control Bar -->
              <div id="kimyawyPlayerControls" dir="ltr" style="position:absolute; bottom:0; left:0; right:0; height:58px; background:linear-gradient(to top, rgba(3,9,20,0.98) 0%, rgba(6,22,38,0.92) 100%); border-top:1px solid rgba(16,185,129,0.22); z-index:17; display:flex; align-items:center; gap:10px; padding:0 16px; color:#fff;">
                <button type="button" id="kpPlayBtn" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%); border:1px solid rgba(255,255,255,0.15); color:#fff; width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; box-shadow:0 4px 12px rgba(16,185,129,0.3);" title="تشغيل / إيقاف">
                  <span class="material-symbols-rounded" id="kpPlayIcon" style="font-size:1.45rem;">play_arrow</span>
                </button>
                <button type="button" id="kpRewindBtn" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:#e2e8f0; height:34px; padding:0 9px; border-radius:8px; display:flex; align-items:center; gap:2px; cursor:pointer; font-size:0.72rem; font-weight:700; flex-shrink:0;" title="رجوع 10 ثوانٍ">
                  <span class="material-symbols-rounded" style="font-size:1.1rem;">replay_10</span>
                </button>
                <button type="button" id="kpForwardBtn" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:#e2e8f0; height:34px; padding:0 9px; border-radius:8px; display:flex; align-items:center; gap:2px; cursor:pointer; font-size:0.72rem; font-weight:700; flex-shrink:0;" title="تقديم 10 ثوانٍ">
                  <span class="material-symbols-rounded" style="font-size:1.1rem;">forward_10</span>
                </button>

                <span id="kpTimeDisplay" style="font-family:monospace; font-size:0.78rem; font-weight:700; color:#e2e8f0; background:rgba(255,255,255,0.06); padding:4px 8px; border-radius:6px; white-space:nowrap; min-width:92px; text-align:center;">00:00 / 00:00</span>

                <input type="range" id="kpProgressRange" min="0" max="1000" value="0" style="flex:1; accent-color:#10b981; height:6px; cursor:pointer;">

                <select id="kpSpeedSelect" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(16,185,129,0.3); border-radius:8px; padding:5px 8px; font-size:0.75rem; font-weight:800; cursor:pointer;" title="سرعة التشغيل">
                  <option value="0.75" style="color:#000;">0.75x</option>
                  <option value="1" selected style="color:#000;">1x</option>
                  <option value="1.25" style="color:#000;">1.25x</option>
                  <option value="1.5" style="color:#000;">1.5x</option>
                  <option value="2" style="color:#000;">2x</option>
                </select>

                <button type="button" id="kpMuteBtn" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:#fff; width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="الصوت">
                  <span class="material-symbols-rounded" id="kpMuteIcon" style="font-size:1.25rem;">volume_up</span>
                </button>

                <button type="button" id="customFullscreenBtn" style="background:rgba(224,165,38,0.16); border:1px solid rgba(224,165,38,0.4); color:#fde68a; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;" title="ملء الشاشة">
                  <span class="material-symbols-rounded" id="fullscreenIcon" style="font-size:1.3rem;">fullscreen</span>
                </button>
              </div>

              <!-- Pre-emptive Anti-Screenshot / Screen-Record / IDM Lockout Shield -->
              <div id="antiCaptureShield" class="video-anti-capture-shield" style="display:none; z-index:30; background:#02060d; padding:24px; text-align:center;">
                <div style="width:68px; height:68px; border-radius:20px; background:rgba(225,29,72,0.16); border:2px solid rgba(225,29,72,0.5); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; color:#f43f5e;">
                  <span class="material-symbols-rounded" style="font-size:2.6rem;">gpp_bad</span>
                </div>
                <h4 id="antiCaptureTitle" style="margin:0 0 6px; font-weight:900; font-size:1.1rem; color:#fff;">تم إعتام وإيقاف البث فوراً لحماية المحتوى!</h4>
                <p id="antiCaptureDesc" style="font-size:0.84rem; color:#cbd5e1; max-width:480px; margin:0 auto 10px; line-height:1.6;">
                  رصد النظام محاولة التبديل لنافذة خارجية أو تشغيل أداة تصوير/تسجيل شاشة أو برنامج تحميل. تم تسجيل التنبيه في سجل الأمان الخاص بالمعلم.
                </p>
                <div id="antiCaptureStrikeNotice" style="font-size:0.76rem; color:#fda4af; background:rgba(225,29,72,0.18); border:1px solid rgba(225,29,72,0.35); padding:5px 14px; border-radius:99px; margin-bottom:14px; font-weight:800;">
                  تحذير أمني: تكرار المحاولة يؤدي إلى حظر الحساب تلقائياً وإيقاف الاشتراك
                </div>
                <button type="button" id="resumeSafePlayBtn" class="btn btn-primary btn-sm" style="pointer-events:auto; font-weight:900; padding:10px 24px; border-radius:10px;" disabled>
                  جاري فحص بيئة التشغيل الآمنة...
                </button>
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
    let isProtectedVideoPlaying = () => false;
    let getCurrentVideoTimeSec = () => 0;

    if (!prereqLocked) {
      try {
        const res = await api.getVideoToken(id);
        // Decode obfuscated stream_cipher if present (never exposed in plain JSON)
        let decodedUrl = '';
        let decodedYtId = '';
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
            if (parsed.y) decodedYtId = String(parsed.y).split('').reverse().join('');
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
        } else if (decodedYtId || decodedUrl.includes('youtube.com') || decodedUrl.includes('youtu.be')) {
          // Case 2: Custom Shielded Player for YouTube (Zero YouTube Branding, Cropped Chrome, No Video ID in initial iframe.src, Anti-IDM)
          let videoId = decodedYtId;
          if (!videoId) {
            if (decodedUrl.includes('youtu.be/')) videoId = decodedUrl.split('youtu.be/')[1].split('?')[0].split('&')[0];
            else if (decodedUrl.includes('/embed/')) videoId = decodedUrl.split('/embed/')[1].split('?')[0].split('&')[0];
            else if (decodedUrl.includes('v=')) videoId = decodedUrl.split('v=')[1].split('&')[0];
            videoId = videoId.replace(/[^A-Za-z0-9_-]/g, '');
          }
          if (!videoId) throw new Error('رابط الفيديو غير صالح');

          if (vc) {
            // Cropped container (-72px top & bottom) + pointer-events:none completely hides YouTube header/footer & blocks right-click/IDM hover
            vc.innerHTML = `
              <div style="position:absolute; top:-72px; left:0; width:100%; height:calc(100% + 144px); pointer-events:none; overflow:hidden; user-select:none;">
                <div id="ytShieldTarget" style="width:100%; height:100%; pointer-events:none;"></div>
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

          isProtectedVideoPlaying = () => isPlaying;

          // Initialize YT.Player WITHOUT videoId in the constructor so the DOM iframe.src attribute never exposes the video ID to IDM!
          const ytPlayer = new YT.Player('ytShieldTarget', {
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
              origin: window.location.origin,
              widget_referrer: window.location.origin
            },
            events: {
              onReady: (ev) => {
                try {
                  ev.target.cueVideoById({ videoId, suggestedQuality: 'hd1080' });
                  const iframeEl = document.getElementById('ytShieldTarget');
                  if (iframeEl) {
                    iframeEl.style.pointerEvents = 'none';
                    iframeEl.setAttribute('tabindex', '-1');
                    iframeEl.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
                  }
                } catch (_) {}
                if (timeDisplay) timeDisplay.textContent = `${formatTime(0)} / ${formatTime(durationSec)}`;
                uiTimer = setInterval(() => {
                  try {
                    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
                    currentSec = Math.floor(ytPlayer.getCurrentTime() || 0);
                    const total = Math.floor(ytPlayer.getDuration() || durationSec || 1);
                    if (total > 0) durationSec = total;
                    if (timeDisplay) timeDisplay.textContent = `${formatTime(currentSec)} / ${formatTime(durationSec)}`;
                    if (progressRange && durationSec > 0) {
                      progressRange.value = String(Math.min(1000, Math.round((currentSec / durationSec) * 1000)));
                    }
                  } catch (_) {}
                }, 500);
              },
              onStateChange: (ev) => {
                if (ev.data === YT.PlayerState.PLAYING) {
                  const d = ev.target.getDuration();
                  if (d && d > 0) durationSec = Math.floor(d);
                  syncUiState(true);
                } else if (ev.data === YT.PlayerState.PAUSED || ev.data === YT.PlayerState.ENDED || ev.data === YT.PlayerState.CUED) {
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
          // Case 3: Direct MP4 video inside custom HTML5 encrypted player (Blob URL obfuscation + controlsList="nodownload" + disablePictureInPicture)
          if (vc) {
            vc.innerHTML = `
              <video id="nativeProtectedVideo" style="width:100%; height:calc(100% - 58px); object-fit:contain; background:#000; pointer-events:none;" playsinline controlsList="nodownload nofullscreen noremoteplayback noplaybackrate" disablePictureInPicture disableRemotePlayback oncontextmenu="return false;"></video>
            `;
            const vEl = document.getElementById('nativeProtectedVideo');
            // Convert same-origin or CORS-enabled MP4 into an ephemeral Blob URL so IDM cannot read a direct .mp4 src attribute
            fetch(decodedUrl)
              .then(r => r.ok ? r.blob() : Promise.reject())
              .then(blob => {
                if (vEl) {
                  const blobUrl = URL.createObjectURL(blob);
                  vEl.src = blobUrl;
                }
              })
              .catch(() => {
                if (vEl) vEl.src = decodedUrl;
              });

            const toggleV = () => {
              if (!vEl) return;
              if (vEl.paused) { vEl.play(); if (playIcon) playIcon.textContent = 'pause'; if (pauseMask) { pauseMask.style.opacity = '0'; pauseMask.style.pointerEvents = 'none'; } }
              else { vEl.pause(); if (playIcon) playIcon.textContent = 'play_arrow'; if (pauseMask) { pauseMask.style.opacity = '1'; pauseMask.style.pointerEvents = 'auto'; } }
            };
            isProtectedVideoPlaying = () => Boolean(vEl && !vEl.paused);
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

    // =========================================================================
    // PRE-EMPTIVE ZERO-LATENCY ANTI-SCREENSHOT, ANTI-SCREEN-RECORD & ANTI-IDM SHIELD
    // =========================================================================
    const videoBox = document.getElementById('videoBox');
    const vcEl = document.getElementById('videoContainer');
    const shield = document.getElementById('antiCaptureShield');
    const shieldTitle = document.getElementById('antiCaptureTitle');
    const shieldDesc = document.getElementById('antiCaptureDesc');
    const shieldStrikeNotice = document.getElementById('antiCaptureStrikeNotice');
    const resumeBtn = document.getElementById('resumeSafePlayBtn');
    const strikeBadge = document.getElementById('playerStrikeBadge');
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

    let isPermanentlyBlocked = false;
    let cooldownInterval = null;
    let cooldownRemaining = 0;
    let lastReportTime = 0;

    // 1. Synchronous <1ms Blackout (executes BEFORE OS snipping tool or PrintScreen captures the frame!)
    const instantBlackoutFrame = () => {
      if (vcEl) {
        vcEl.style.transition = 'none';
        vcEl.style.visibility = 'hidden';
        vcEl.style.opacity = '0';
        vcEl.style.filter = 'brightness(0)';
      }
      if (shield) {
        shield.style.display = 'flex';
      }
      pauseProtectedVideo();
    };

    const restoreFrameVisibility = () => {
      if (isPermanentlyBlocked) return;
      if (vcEl) {
        vcEl.style.visibility = 'visible';
        vcEl.style.opacity = '1';
        vcEl.style.filter = 'none';
      }
      if (shield) {
        shield.style.display = 'none';
      }
    };

    // 2. Violation Reporter + Mandatory Cooldown Lockout
    const triggerSecurityLockout = (violationType, customTitle, customDesc, cooldownSecs = 8, shouldReportToServer = true) => {
      if (isPermanentlyBlocked) return;
      instantBlackoutFrame();

      if (shieldTitle && customTitle) shieldTitle.textContent = customTitle;
      if (shieldDesc && customDesc) shieldDesc.textContent = customDesc;

      // Start or extend mandatory cooldown timer (cannot resume until timer hits 0 AND window is focused!)
      cooldownRemaining = Math.max(cooldownRemaining, cooldownSecs);
      if (resumeBtn) {
        resumeBtn.disabled = true;
        resumeBtn.style.opacity = '0.6';
        resumeBtn.style.cursor = 'not-allowed';
        resumeBtn.textContent = `لا يمكن الاستئناف قبل ${cooldownRemaining} ثوانٍ (تأكد من إغلاق أي أداة تسجيل/تصوير)...`;
      }

      if (cooldownInterval) clearInterval(cooldownInterval);
      cooldownInterval = setInterval(() => {
        if (isPermanentlyBlocked) {
          clearInterval(cooldownInterval);
          return;
        }
        // Only count down while the user is actively focused on the platform window and no DevTools is docked
        const devToolsDocked = (window.outerWidth - window.innerWidth > 180) || (window.outerHeight - window.innerHeight > 220);
        if (document.hidden || !document.hasFocus() || devToolsDocked) {
          if (resumeBtn) {
            resumeBtn.disabled = true;
            resumeBtn.textContent = devToolsDocked
              ? 'يرجى إغلاق أدوات المطور (DevTools) أولاً لاستئناف المشاهدة'
              : 'يرجى إبقاء نافذة المنصة نشطة وإغلاق أي برنامج خارجي لاستكمال العد التنازلي...';
          }
          return;
        }

        cooldownRemaining -= 1;
        if (cooldownRemaining > 0) {
          if (resumeBtn) {
            resumeBtn.disabled = true;
            resumeBtn.textContent = `إعادة فحص الأمان... يمكنك الاستئناف بعد ${cooldownRemaining} ثوانٍ`;
          }
        } else {
          clearInterval(cooldownInterval);
          cooldownInterval = null;
          if (resumeBtn) {
            resumeBtn.disabled = false;
            resumeBtn.style.opacity = '1';
            resumeBtn.style.cursor = 'pointer';
            resumeBtn.textContent = 'استئناف المشاهدة الآمنة الآن';
          }
        }
      }, 1000);

      // Report confirmed violation to Teacher Security Center (throttled to avoid duplicate burst spam)
      const now = Date.now();
      if (shouldReportToServer && !isTeacher() && (now - lastReportTime > 3500)) {
        lastReportTime = now;
        api.reportSecurityViolation({
          violation_type: violationType,
          course_id: lesson.course_id,
          lesson_id: id,
          source_title: lesson.title,
          details: customTitle || violationType
        }).then((rep) => {
          if (rep?.strikes) {
            if (strikeBadge) {
              strikeBadge.style.display = 'inline-block';
              strikeBadge.textContent = `إنذارات الأمان: ${rep.strikes}/5`;
            }
            if (shieldStrikeNotice) {
              shieldStrikeNotice.textContent = `تم تسجيل مخالفة أمنية في ملفك لدى المدرس (الإنذار رقم ${rep.strikes} من 5 — يتم حظر الحساب تلقائياً عند 5 إنذارات)`;
            }
          }
          if (rep?.is_blocked) {
            isPermanentlyBlocked = true;
            if (vcEl) vcEl.innerHTML = '';
            if (shieldTitle) shieldTitle.textContent = '🚫 تم حظر حسابك تلقائياً وإيقاف البث!';
            if (shieldDesc) shieldDesc.textContent = rep.message || 'تم رصد تكرار محاولات تصوير أو تسجيل أو تحميل المحتوى المحمي، وتم إرسال تقرير كامل للمعلم.';
            if (resumeBtn) {
              resumeBtn.disabled = true;
              resumeBtn.style.background = '#e11d48';
              resumeBtn.textContent = 'الحساب موقوف أمنياً — تواصل مع إدارة المنصة';
            }
          }
        }).catch(() => {});
      }
    };

    resumeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (cooldownRemaining > 0 || isPermanentlyBlocked || document.hidden || !document.hasFocus()) return;
      restoreFrameVisibility();
    });

    // 3. Block Browser Screen Capture APIs (getDisplayMedia & captureStream)
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      navigator.mediaDevices.getDisplayMedia = async () => {
        triggerSecurityLockout(
          'screen_record',
          'تم رصد محاولة تسجيل الشاشة عبر المتصفح!',
          'يُمنع منعاً باتاً استخدام أدوات تسجيل الشاشة أثناء مشاهدة المحاضرات المشفرة.',
          12,
          true
        );
        throw new DOMException('Screen recording is disabled by Kimyawy DRM Shield', 'NotAllowedError');
      };
    }

    // 4. Pre-emptive Keydown Capture (Fires on the VERY FIRST key of Win+Shift+S, Win+Alt+R, Alt+F9, PrintScreen, F12)
    const onPreemptiveKeyDown = (e) => {
      const k = e.key || '';
      const code = e.code || '';

      // Instant synchronous blackout on Meta (Windows/Cmd) or Alt press so Win+Shift+S / Win+G / Win+Alt+R sees a black frame BEFORE snipping overlay opens!
      if (k === 'Meta' || k === 'OS' || k === 'Super' || code === 'MetaLeft' || code === 'MetaRight') {
        instantBlackoutFrame();
        triggerSecurityLockout(
          'screenshot',
          'تم إعتام الشاشة فوراً لمنع لقطات الشاشة وتسجيل النظام (Win+Shift+S / Game Bar)',
          'عند الضغط على زر النظام (Windows/Command) يتم إعتام الفيديو تلقائياً في أجزاء من المللي ثانية لمنع التقاط أو تسجيل الشاشة.',
          6,
          isProtectedVideoPlaying()
        );
        return;
      }

      // PrintScreen or Mac/Windows screenshot/recording combos
      if (
        k === 'PrintScreen' ||
        code === 'PrintScreen' ||
        (e.metaKey && e.shiftKey) ||
        (e.metaKey && e.altKey) ||
        (e.altKey && (k === 'F9' || k === 'F10' || k === 'PrintScreen')) ||
        (e.ctrlKey && e.shiftKey && (k === 'S' || k === 's' || k === 'E' || k === 'e' || k === 'R' || k === 'r'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        instantBlackoutFrame();
        navigator.clipboard?.writeText?.('محتوى محمي — منصة كيمياوي').catch(() => {});
        triggerSecurityLockout(
          (e.metaKey && e.altKey) || (e.altKey && k === 'F9') ? 'screen_record' : 'screenshot',
          'تم إحباط محاولة تصوير أو تسجيل الشاشة وإبلاغ المعلم!',
          'تم إعتام الفيديو قبل التقاط الصورة وتسجيل المخالفة باسمك ورقم هاتفك في لوحة تحكم المعلم.',
          10,
          true
        );
        showToast('تم إعتام الفيديو وإرسال تنبيه للمعلم بمحاولة تصوير الشاشة!', 'error');
        return;
      }

      // DevTools & Source Inspection shortcuts
      if (
        k === 'F12' ||
        (e.ctrlKey && e.shiftKey && (k === 'I' || k === 'i' || k === 'C' || k === 'c' || k === 'J' || k === 'j')) ||
        (e.ctrlKey && (k === 'U' || k === 'u' || k === 'S' || k === 's' || k === 'P' || k === 'p'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        instantBlackoutFrame();
        triggerSecurityLockout(
          'devtools',
          'تم رصد محاولة فتح أدوات الفحص أو حفظ الصفحة!',
          'محاولة فحص الكود المصدري أو استخراج روابط البث المشفر تُعد مخالفة أمنية جسيمة.',
          10,
          true
        );
        showToast('غير مسموح بفتح أدوات المطور أو حفظ الصفحة', 'error');
      }
    };

    const onPreemptiveKeyUp = (e) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.key === 'Meta' || e.key === 'OS') {
        instantBlackoutFrame();
        navigator.clipboard?.writeText?.('محتوى محمي — منصة كيمياوي').catch(() => {});
        if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
          triggerSecurityLockout(
            'screenshot',
            'تم إحباط محاولة التقاط الشاشة (PrintScreen) وإبلاغ المعلم!',
            'تم مسح الحافظة وإعتام المشغل وتسجيل المخالفة في لوحة المعلم.',
            10,
            true
          );
        }
      }
    };

    window.addEventListener('keydown', onPreemptiveKeyDown, { capture: true });
    window.addEventListener('keyup', onPreemptiveKeyUp, { capture: true });

    // 5. Instant Blackout on Window Blur, Visibility Hidden, or Mouse Leaving Viewport While Playing
    const onVisibilityChange = () => {
      if (document.hidden) {
        const wasPlaying = isProtectedVideoPlaying();
        instantBlackoutFrame();
        triggerSecurityLockout(
          'screen_record',
          'تم إيقاف البث مؤقتاً لمغادرة تبويب المحاضرة',
          'يتم إعتام وإيقاف البث فور مغادرة التبويب لمنع التسجيل في الخلفية.',
          6,
          wasPlaying
        );
      }
    };

    const onWindowBlur = () => {
      if (document.activeElement?.tagName === 'IFRAME') {
        // Immediately return focus to window so keyboard & blur listeners stay active!
        setTimeout(() => window.focus(), 0);
        return;
      }
      const wasPlaying = isProtectedVideoPlaying();
      instantBlackoutFrame();
      triggerSecurityLockout(
        'screen_record',
        'تم إعتام وإيقاف البث فوراً لانتقال التركيز إلى أداة أو نافذة خارجية!',
        'إذا كنت تحاول تشغيل أداة اقتصاص الشاشة (Snipping Tool) أو برنامج تسجيل خارجي (OBS / ShareX / Game Bar)، فقد تم إعتام الفيديو تلقائياً.',
        8,
        wasPlaying
      );
    };

    document.addEventListener('visibilitychange', onVisibilityChange, { capture: true });
    window.addEventListener('blur', onWindowBlur, { capture: true });

    // 6. Active Anti-IDM & Video Downloader Extension Detector (MutationObserver + Heartbeat)
    const idmObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const el = node;
          const idStr = String(el.id || '').toLowerCase();
          const clsStr = String(el.className || '').toLowerCase();
          const srcStr = String(el.getAttribute?.('src') || '').toLowerCase();
          const htmlStr = String(el.outerHTML || '').slice(0, 300).toLowerCase();

          if (
            idStr.includes('idm') ||
            clsStr.includes('idm') ||
            srcStr.includes('idm') ||
            htmlStr.includes('__idm') ||
            htmlStr.includes('idm_download') ||
            htmlStr.includes('download this video') ||
            idStr.includes('vdh-') ||
            clsStr.includes('savefrom')
          ) {
            try { el.remove(); } catch (_) {}
            instantBlackoutFrame();
            triggerSecurityLockout(
              'idm_download',
              'تم رصد وإحباط محاولة التقاط الفيديو بواسطة برنامج تحميل (IDM)!',
              'يُمنع استخدام إضافات التحميل مثل Internet Download Manager. يرجى تعطيل إضافة IDM من المتصفح لتجنب حظر حسابك.',
              12,
              true
            );
            return;
          }
        }
      }
    });
    idmObserver.observe(document.documentElement, { childList: true, subtree: true });

    // 7. Continuous 250ms Focus & DevTools Heartbeat (Ensures video NEVER plays while unfocused or while recorder overlay has focus)
    const focusHeartbeat = setInterval(() => {
      if (isPermanentlyBlocked) return;
      const devToolsOpen = (window.outerWidth - window.innerWidth > 180) || (window.outerHeight - window.innerHeight > 220);
      if (devToolsOpen && isProtectedVideoPlaying()) {
        instantBlackoutFrame();
        triggerSecurityLockout(
          'devtools',
          'تم رصد فتح أدوات المطور (DevTools) أثناء تشغيل المحاضرة!',
          'يرجى إغلاق أدوات المطور فوراً لاستئناف المشاهدة الآمنة.',
          10,
          true
        );
        return;
      }
      if (isProtectedVideoPlaying() && (document.hidden || (!document.hasFocus() && document.activeElement?.tagName !== 'IFRAME'))) {
        instantBlackoutFrame();
        triggerSecurityLockout(
          'screen_record',
          'تم إيقاف البث لعدم تواجدك داخل نافذة المنصة النشطة',
          'لا يعمل الفيديو في الخلفية أو أثناء تفعيل نافذة برنامج تسجيل خارجي.',
          8,
          true
        );
      }
    }, 250);

    // 8. Instant Watermark jump (zero transition animation)
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
      wmInterval = setInterval(moveWm, 3000);
    }

    const cleanupLessonListeners = () => {
      window.removeEventListener('keydown', onPreemptiveKeyDown, { capture: true });
      window.removeEventListener('keyup', onPreemptiveKeyUp, { capture: true });
      document.removeEventListener('visibilitychange', onVisibilityChange, { capture: true });
      window.removeEventListener('blur', onWindowBlur, { capture: true });
      idmObserver.disconnect();
      clearInterval(focusHeartbeat);
      if (cooldownInterval) clearInterval(cooldownInterval);
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
                  ${getInitials(d.user_name)}
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
                      ${getInitials(r.user_name)}
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
