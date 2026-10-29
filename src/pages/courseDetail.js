import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { isLoggedIn, isTeacher } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { confirmModal } from '../components/modal.js';
import { esc } from '../utils/helpers.js';
import { renderPublicHeader, initPublicHeader } from '../components/publicHeader.js';
import { openChemistryLabModal } from '../components/chemistryLabModal.js';

import drZiadThumbs from '../assets/dr-ziad-pose-thumbs.jpg';
import drZiadFlask from '../assets/dr-ziad-pose-flask.jpg';
import drZiadPortrait from '../assets/dr-ziad-portrait.jpg';
import drZiadFace from '../assets/zra-logo-face.png';
import chemCurriculum from '../assets/chem-curriculum-3d.jpg';
import chemExam from '../assets/chem-exam-mastery-3d.jpg';


function getCourseCover(c) {
  if (c.thumbnail && c.thumbnail.startsWith('/')) return c.thumbnail;
  if (c.course_type === 'quarterly' || (c.title && c.title.includes('3 شهور'))) return chemCurriculum;
  if (c.course_type === 'term' || (c.title && c.title.includes('ترم'))) return chemExam;
  if (c.is_free || c.price === 0 || (c.title && c.title.includes('مجاني'))) return drZiadPortrait;
  if (c.title && c.title.includes('انتقالية')) return drZiadFlask;
  return drZiadThumbs;
}

export function renderCourseDetail(id) {
  const logged = isLoggedIn();
  if (!logged) {
    return `
    <div class="landing" style="min-height: 100vh; background: var(--bg-main);">
      ${renderPublicHeader('courses')}
      <main class="section-container" style="padding-top: 110px; padding-bottom: 60px; min-height: 80vh;">
        <div id="courseContent">
          <!-- Initial skeleton -->
          <div class="skeleton" style="height: 240px; border-radius: 24px; margin-bottom: 24px;"></div>
          <div style="display: grid; grid-template-columns: 1fr 340px; gap: 24px;">
            <div>
              <div class="skeleton" style="height: 60px; border-radius: 16px; margin-bottom: 16px;"></div>
              <div class="skeleton" style="height: 120px; border-radius: 16px; margin-bottom: 16px;"></div>
              <div class="skeleton" style="height: 120px; border-radius: 16px; margin-bottom: 16px;"></div>
            </div>
            <div class="skeleton" style="height: 380px; border-radius: 20px;"></div>
          </div>
        </div>
      </main>
    </div>`;
  }

  return `
  <div class="app-layout">
    ${renderNavbar('courses')}
    <main class="main-content">
      <div id="courseContent">
        <!-- Initial skeleton -->
        <div class="skeleton" style="height: 240px; border-radius: 24px; margin-bottom: 24px;"></div>
        <div style="display: grid; grid-template-columns: 1fr 340px; gap: 24px;">
          <div>
            <div class="skeleton" style="height: 60px; border-radius: 16px; margin-bottom: 16px;"></div>
            <div class="skeleton" style="height: 120px; border-radius: 16px; margin-bottom: 16px;"></div>
            <div class="skeleton" style="height: 120px; border-radius: 16px; margin-bottom: 16px;"></div>
          </div>
          <div class="skeleton" style="height: 380px; border-radius: 20px;"></div>
        </div>
      </div>
    </main>
  </div>`;
}

export async function initCourseDetail(id) {
  const logged = isLoggedIn();
  if (logged) {
    initNavbar();
  } else {
    initPublicHeader();
  }

  try {
    const course = await api.getCourse(id);
    let enrollment = null;
    let userBalance = 0;
    if (logged) {
      try { enrollment = await api.getEnrollment(id); } catch (e) {}
      try {
        const dash = await api.getDashboard();
        userBalance = Number(dash?.user?.balance || 0);
      } catch (e) {}
    }
    const enrolled = enrollment?.enrolled || course.is_free || isTeacher();

    // Calculate total items and completed items
    const totalItems = course.total_items || (course.chapters || []).reduce((acc, c) => acc + (c.items?.length || 0), 0);
    const completedItems = course.completed_items || (course.chapters || []).reduce((acc, c) => acc + (c.items?.filter(i => i.is_completed)?.length || 0), 0);
    const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const coverImg = getCourseCover(course);

    // Extract exams and PDF materials
    const allExams = [];
    const allPdfs = [];
    (course.chapters || []).forEach(ch => {
      (ch.items || []).forEach(item => {
        if (item.item_type === 'exam') {
          allExams.push({ ...item, chapter_title: ch.title });
        }
        if (item.pdf_url) {
          allPdfs.push({
            id: item.id,
            title: item.title,
            chapter_title: ch.title,
            pdf_url: item.pdf_url
          });
        }
      });
    });

    document.getElementById('courseContent').innerHTML = `
      <div class="course-bassthalk-container">
        <!-- Breadcrumbs Navigation -->
        <div class="course-bassthalk-breadcrumbs">
          <a href="/"><span class="material-symbols-rounded" style="font-size:1.1rem; vertical-align:middle;">home</span> الرئيسية</a>
          <span class="material-symbols-rounded" style="font-size:0.85rem;">arrow_back_ios</span>
          <a href="/courses">الكورسات</a>
          <span class="material-symbols-rounded" style="font-size:0.85rem;">arrow_back_ios</span>
          <span style="color:var(--text-primary); font-weight:800;">${esc(course.title)}</span>
        </div>

        <!-- Course Hero Header (Mohamed Salah / Bassthalk Style) -->
        <div class="course-bassthalk-header">
          <div class="course-bassthalk-header-content">
            <div>
              <div class="course-bassthalk-header-badges">
                <span class="badge" style="background:rgba(255,255,255,0.18); color:#fff; border:1px solid rgba(255,255,255,0.3); font-size:0.78rem;">
                  <span class="material-symbols-rounded" style="font-size:0.95rem;">school</span> ${esc(course.grade || 'ثانوية عامة')}
                </span>
                <span class="badge" style="background:#f59e0b; color:#1e293b; font-weight:900; font-size:0.78rem;">
                  ${course.course_type === 'quarterly' ? 'محتوى 3 شهور من المنهج' : course.course_type === 'term' ? 'محتوى ترم دراسي كامل' : course.course_type === 'annual' ? 'منهج العام الدراسي كاملاً' : 'محتوى شهر دراسي'}
                </span>
                <span class="badge" style="background:rgba(52, 211, 153, 0.25); color:#a7f3d0; border:1px solid rgba(52, 211, 153, 0.4); font-size:0.78rem;">
                  <span class="material-symbols-rounded" style="font-size:0.95rem;">verified</span> مفتوح طوال العام الدراسي حتى ليلة الامتحان
                </span>
                ${enrolled 
                  ? '<span class="badge" style="background:#10b981; color:#fff; font-weight:800; font-size:0.78rem;"><span class="material-symbols-rounded" style="font-size:0.95rem;">verified</span> أنت مشترك بالفعل</span>'
                  : (course.is_free ? '<span class="badge badge-success" style="font-size:0.78rem;">مجاني بالكامل</span>' : `<span class="badge" style="background:rgba(255,255,255,0.9); color:#064e3b; font-weight:900; font-size:0.82rem;">${course.price} جنيه</span>`)
                }
              </div>

              <h1 class="course-bassthalk-header-title">${esc(course.title)}</h1>
              <p class="course-bassthalk-header-desc">${esc(course.description || 'شرح شامل وتفصيلي لمنهج الكيمياء للثانوية العامة مع د. زياد رمزي عياد، يتضمن المحاضرات والتدريبات العملية وامتحانات تقييمية مستمرة ومذكرات PDF.')}</p>

              ${enrolled && totalItems > 0 ? `
                <div class="course-bassthalk-progress-box">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.85rem; font-weight:800;">
                    <span style="display:flex; align-items:center; gap:6px;">
                      <span class="material-symbols-rounded" style="font-size:1.15rem; color:#34d399;">trending_up</span>
                      نسبة إنجازك في الكورس:
                    </span>
                    <span style="color:#a7f3d0; font-size:0.92rem; font-weight:900;">${progressPercent}% (${completedItems} من ${totalItems} مكتمل)</span>
                  </div>
                  <div style="width:100%; height:8px; background:rgba(0,0,0,0.3); border-radius:99px; overflow:hidden;">
                    <div style="height:100%; width:${progressPercent}%; background:linear-gradient(90deg, #34d399, #10b981); border-radius:99px; transition:width 0.4s ease;"></div>
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- Hero Left: Visual preview & key teacher card -->
            <div style="display:flex; flex-direction:column; gap:12px; align-items:center; background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.15); border-radius:20px; padding:18px; backdrop-filter:blur(10px);">
              <div style="width:100%; border-radius:14px; overflow:hidden; aspect-ratio:16/9; position:relative; box-shadow:0 8px 24px rgba(0,0,0,0.3);">
                <img src="${coverImg}" alt="${esc(course.title)}" style="width:100%; height:100%; object-fit:cover;">
                <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%); display:flex; align-items:flex-end; padding:12px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <img src="${drZiadFace}" alt="د. زياد رمزي" style="width:34px; height:34px; border-radius:50%; border:2px solid #fff; background:#fff;">
                    <div>
                      <div style="font-size:0.85rem; font-weight:900; color:#fff; display:flex; align-items:center; gap:4px;">
                        د. زياد رمزي عياد <span class="material-symbols-rounded" style="font-size:0.95rem; color:#34d399;">verified</span>
                      </div>
                      <div style="font-size:0.7rem; color:rgba(255,255,255,0.85); font-weight:600;">خبير ومدرس أول الكيمياء</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; width:100%; font-size:0.78rem;">
                <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:8px 12px; text-align:center;">
                  <span class="material-symbols-rounded" style="font-size:1.15rem; color:#34d399; display:block; margin:0 auto 2px;">play_lesson</span>
                  <strong style="font-size:0.95rem; display:block;">${course.total_lessons || 0}</strong>
                  <span style="opacity:0.85;">حصة ومحاضرة</span>
                </div>
                <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:8px 12px; text-align:center;">
                  <span class="material-symbols-rounded" style="font-size:1.15rem; color:#f59e0b; display:block; margin:0 auto 2px;">assignment</span>
                  <strong style="font-size:0.95rem; display:block;">${course.exam_count || allExams.length}</strong>
                  <span style="opacity:0.85;">امتحان وواجب</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bassthalk Course Tabs -->
        <div class="course-bassthalk-tabs" role="tablist">
          <button class="course-bassthalk-tab-btn active" data-tab="curriculum">
            <span class="material-symbols-rounded">play_lesson</span> المحاضرات والدروس المنهجية
          </button>
          <button class="course-bassthalk-tab-btn" data-tab="materials">
            <span class="material-symbols-rounded">description</span> بنك المذكرات والملخصات PDF
            <span class="unit-header-badge" style="background:rgba(5, 150, 105, 0.15); color:var(--primary); font-size:0.7rem;">${allPdfs.length > 0 ? allPdfs.length : 'شامل'}</span>
          </button>
          <button class="course-bassthalk-tab-btn" data-tab="exams">
            <span class="material-symbols-rounded">assignment</span> الواجبات والامتحانات الدورية
            <span class="unit-header-badge" style="background:rgba(245, 158, 11, 0.15); color:#d97706; font-size:0.7rem;">${allExams.length}</span>
          </button>
          ${(course.live_sessions && course.live_sessions.length > 0) ? `
            <button class="course-bassthalk-tab-btn" data-tab="live">
              <span class="material-symbols-rounded">live_tv</span> الحصص اللايف (${course.live_sessions.length})
            </button>
          ` : ''}
          ${(course.allow_student_replies || isTeacher()) ? `
            <button class="course-bassthalk-tab-btn" data-tab="forum">
              <span class="material-symbols-rounded">forum</span> منتدى النقاش وسؤال المعلم
            </button>
          ` : ''}
          <a href="/lab" class="btn btn-sm" style="background:linear-gradient(135deg, #059669 0%, #10b981 100%); color:#fff; font-weight:800; border-radius:12px; margin-right:auto; gap:6px; box-shadow:0 4px 12px rgba(16, 185, 129, 0.25); text-decoration:none;">
            <span class="material-symbols-rounded">science</span> المختبر وحاسبة المعادلات
          </a>
        </div>

        <!-- Main Layout Grid -->
        <div class="course-bassthalk-layout">
          <!-- Main Content (Tabs) -->
          <div>
            <!-- TAB 1: CURRICULUM -->
            <div id="tab-pane-curriculum" class="course-tab-pane">
              ${course.chapters && course.chapters.length > 0 
                ? course.chapters.map((ch, idx) => `
                  <div class="unit-box-bassthalk" data-unit-id="${ch.id}">
                    <div class="unit-header-bassthalk">
                      <div class="unit-header-title">
                        <span class="material-symbols-rounded" style="color:var(--primary); font-size:1.35rem;">folder</span>
                        <span>${esc(ch.title)}</span>
                      </div>
                      <div style="display:flex; align-items:center; gap:10px;">
                        <span class="unit-header-badge">${ch.items?.length || 0} حصة ومحتوى</span>
                        <span class="material-symbols-rounded unit-toggle-arrow" style="color:var(--text-muted); transition:transform 0.25s;">expand_more</span>
                      </div>
                    </div>

                    <div class="unit-body-bassthalk" style="${idx === 0 ? '' : 'display:none;'}">
                      ${(ch.items || []).map((item, itemIdx) => {
                        const isExam = item.item_type === 'exam';
                        const isLocked = item.is_locked;
                        const isDone = item.is_completed;
                        const hasPrereqExam = !isExam && item.prerequisite_exam_id;
                        const prereqPassed = !hasPrereqExam || item.prerequisite_passed;
                        const link = enrolled && !isLocked 
                          ? (isExam ? `/exams/${item.id}/take` : `/lessons/${item.id}`) 
                          : '';

                        return `
                          <div class="lecture-card-bassthalk clickable-lecture-row ${isLocked ? 'locked-row' : ''}" 
                               data-link="${link}" 
                               data-locked="${isLocked ? '1' : '0'}" 
                               data-enrolled="${enrolled ? '1' : '0'}"
                               style="cursor:pointer;">
                            
                            <div class="lecture-info-col">
                              <div class="lecture-index-icon ${isExam ? 'exam' : 'video'}">
                                <span class="material-symbols-rounded">
                                  ${isLocked ? 'lock' : (isExam ? 'assignment' : (isDone ? 'check_circle' : 'play_circle'))}
                                </span>
                              </div>
                              
                              <div style="min-width:0;">
                                <div class="lecture-title-text">
                                  ${isExam ? `امتحان تقييمي: ${esc(item.title)}` : `محاضرة ${itemIdx + 1}: ${esc(item.title)}`}
                                </div>
                                
                                <div class="lecture-tags-row">
                                  <span style="display:inline-flex; align-items:center; gap:4px;">
                                    <span class="material-symbols-rounded" style="font-size:0.95rem; color:var(--text-muted);">schedule</span>
                                    ${isExam ? `${item.duration_minutes || 30} دقيقة` : `${item.duration || 45} دقيقة`}
                                  </span>
                                  
                                  ${item.pdf_url ? `
                                    <span style="display:inline-flex; align-items:center; gap:4px; color:var(--primary); font-weight:700;">
                                      <span class="material-symbols-rounded" style="font-size:0.95rem;">description</span> مذكرة PDF
                                    </span>
                                  ` : ''}

                                  ${hasPrereqExam ? `
                                    <span class="badge ${prereqPassed ? 'badge-success' : 'badge-warning'}" style="font-size:0.7rem; padding:2px 8px; display:inline-flex; align-items:center; gap:4px;">
                                      <span class="material-symbols-rounded" style="font-size:0.85rem;">${prereqPassed ? 'task_alt' : 'quiz'}</span>
                                      ${prereqPassed ? `اجتزت امتحان المحاضرة` : `يشترط حل امتحان المحاضرة (${item.prerequisite_passing_score || 60}%)`}
                                    </span>
                                  ` : ''}

                                  ${item.is_free ? '<span class="badge badge-success" style="font-size:0.68rem; padding:1px 6px;">حصة مجانية</span>' : ''}
                                  ${isDone ? '<span class="badge badge-success" style="font-size:0.68rem; padding:1px 6px; font-weight:800;"><span class="material-symbols-rounded" style="font-size:0.8rem;">done</span> تمت المشاهدة</span>' : ''}
                                </div>
                              </div>
                            </div>

                            <div class="lecture-action-col">
                              ${enrolled && !isLocked 
                                ? `<a href="${link}" class="btn btn-sm btn-primary" style="padding:7px 14px; font-size:0.82rem; gap:4px;">
                                    ${isExam ? 'دخول الامتحان' : (isDone ? 'إعادة المشاهدة' : 'بدء الحصة')}
                                    <span class="material-symbols-rounded" style="font-size:1.05rem;">${isExam ? 'arrow_back' : 'play_arrow'}</span>
                                   </a>`
                                : isLocked 
                                  ? `<span class="badge badge-warning" style="font-size:0.75rem; padding:5px 10px; display:inline-flex; align-items:center; gap:4px;">
                                      <span class="material-symbols-rounded" style="font-size:0.9rem;">lock</span> محتوى مغلق
                                     </span>`
                                  : `<button class="btn btn-sm btn-secondary enroll-prompt-btn" style="padding:7px 14px; font-size:0.82rem; gap:4px;">
                                      <span class="material-symbols-rounded" style="font-size:0.95rem;">lock</span> تفعيل للاشتراك
                                     </button>`
                              }
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `).join('') 
                : `
                  <div class="empty-state">
                    <span class="material-symbols-rounded">folder_open</span>
                    <h3>لا يوجد محتوى في الكورس بعد</h3>
                    <p>سيتم رفع الحصص والمحتوى من قبل الإدارة قريباً.</p>
                  </div>
                `
              }
            </div>

            <!-- TAB 2: MATERIALS (BANK OF PDFS) -->
            <div id="tab-pane-materials" class="course-tab-pane" style="display:none;">
              <div class="card" style="margin-bottom:20px;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
                  <div>
                    <h3 style="font-size:1.15rem; font-weight:900; margin:0 0 4px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                      <span class="material-symbols-rounded" style="color:var(--primary);">description</span> بنك مذكرات وتلخيصات الكورس
                    </h3>
                    <p style="font-size:0.84rem; color:var(--text-secondary); margin:0;">
                      مذكرات الشرح الكاملة، كراسات الواجبات، وجداول التلخيص الملونة بصيغة PDF عالية الجودة جاهزة للطباعة.
                    </p>
                  </div>
                  <span class="badge badge-success" style="font-weight:800;">تحميل مجاني للمشتركين</span>
                </div>

                ${allPdfs.length > 0 ? `
                  <div style="display:flex; flex-direction:column; gap:10px;">
                    ${allPdfs.map((pdf, idx) => `
                      <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:var(--bg-secondary); border-radius:14px; border:1px solid var(--border-light); flex-wrap:wrap; gap:12px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                          <div style="width:40px; height:40px; border-radius:10px; background:rgba(239, 68, 68, 0.1); color:#ef4444; display:flex; align-items:center; justify-content:center;">
                            <span class="material-symbols-rounded">picture_as_pdf</span>
                          </div>
                          <div>
                            <div style="font-weight:800; font-size:0.92rem; color:var(--text-primary); margin-bottom:2px;">
                              ${esc(pdf.title)} (مذكرة المحاضرة)
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-secondary);">
                              ${esc(pdf.chapter_title)} • بصيغة PDF عالية الجودة
                            </div>
                          </div>
                        </div>

                        <div>
                          ${enrolled ? `
                            <a href="${pdf.pdf_url}" target="_blank" download class="btn btn-sm btn-primary" style="gap:6px;">
                              <span class="material-symbols-rounded">download</span> تحميل المذكرة
                            </a>
                          ` : `
                            <button class="btn btn-sm btn-secondary enroll-prompt-btn" style="gap:6px;">
                              <span class="material-symbols-rounded">lock</span> اشترك للتحميل
                            </button>
                          `}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div style="background:rgba(5, 150, 105, 0.05); border:1px dashed rgba(5, 150, 105, 0.3); border-radius:14px; padding:24px; text-align:center;">
                    <span class="material-symbols-rounded" style="font-size:2.4rem; color:var(--primary); margin-bottom:8px;">picture_as_pdf</span>
                    <h4 style="font-weight:800; font-size:1rem; margin-bottom:6px;">المذكرات والملخصات ملحقة مع كل محاضرة</h4>
                    <p style="font-size:0.84rem; color:var(--text-secondary); max-width:550px; margin:0 auto;">
                      يتم إرفاق مذكرة الشرح وتدريبات الواجب الخاصة بكل درس داخل صفحة الفيديو، ويمكنك تحميلها بضغطة زر فور دخول الحصة.
                    </p>
                  </div>
                `}
              </div>
            </div>

            <!-- TAB 3: EXAMS & ASSIGNMENTS -->
            <div id="tab-pane-exams" class="course-tab-pane" style="display:none;">
              <div class="card">
                <div style="margin-bottom:18px;">
                  <h3 style="font-size:1.15rem; font-weight:900; margin:0 0 4px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                    <span class="material-symbols-rounded" style="color:var(--accent);">assignment</span> الواجبات والامتحانات الدورية الشاملة
                  </h3>
                  <p style="font-size:0.84rem; color:var(--text-secondary); margin:0;">
                    امتحانات إلكترونية تفاعلية مع تصحيح فوري ونموذج إجابة مفصل لكل سؤال ومحاكاة دقيقة لأسئلة وزارة التربية والتعليم.
                  </p>
                </div>

                ${allExams.length > 0 ? `
                  <div style="display:flex; flex-direction:column; gap:12px;">
                    ${allExams.map((exam, idx) => `
                      <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:var(--bg-secondary); border-radius:16px; border:1px solid var(--border-light); flex-wrap:wrap; gap:14px;">
                        <div style="display:flex; align-items:center; gap:14px;">
                          <div style="width:44px; height:44px; border-radius:12px; background:rgba(245, 158, 11, 0.12); color:#d97706; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
                            <span class="material-symbols-rounded">assignment</span>
                          </div>
                          <div>
                            <div style="font-weight:900; font-size:0.96rem; color:var(--text-primary); margin-bottom:4px;">
                              ${esc(exam.title)}
                            </div>
                            <div style="font-size:0.78rem; color:var(--text-secondary); display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                              <span>${esc(exam.chapter_title)}</span>
                              <span>• مدة الامتحان: ${exam.duration_minutes || 30} دقيقة</span>
                              <span>• درجة النجاح: ${exam.passing_score || 60}%</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          ${enrolled && !exam.is_locked ? `
                            <a href="#/exams/${exam.id}/take" class="btn btn-sm btn-primary" style="gap:6px;">
                              <span class="material-symbols-rounded">edit_note</span> دخول الامتحان الآن
                            </a>
                          ` : exam.is_locked ? `
                            <span class="badge badge-warning" style="padding:6px 12px; font-weight:700;">
                              <span class="material-symbols-rounded" style="font-size:0.95rem;">lock</span> أكمل الدروس السابقة أولاً
                            </span>
                          ` : `
                            <button class="btn btn-sm btn-secondary enroll-prompt-btn" style="gap:6px;">
                              <span class="material-symbols-rounded">lock</span> اشترك لدخول الامتحان
                            </button>
                          `}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div class="empty-state">
                    <span class="material-symbols-rounded">assignment</span>
                    <h3>لا توجد امتحانات مضافة في هذا الكورس حالياً</h3>
                    <p>سيتم رفع الامتحانات التقييمية بالتزامن مع جدول الحصص.</p>
                  </div>
                `}
              </div>
            </div>

            <!-- TAB 3.5: COURSE LIVE SESSIONS -->
            <div id="tab-pane-live" class="course-tab-pane" style="display:none;">
              <div class="card">
                <h3 style="font-size:1.15rem; font-weight:900; margin:0 0 14px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                  <span class="material-symbols-rounded" style="color:#ef4444;">live_tv</span> الحصص اللايف الخاصة بالكورس
                </h3>
                ${(course.live_sessions && course.live_sessions.length > 0) ? `
                  <div style="display:flex; flex-direction:column; gap:12px;">
                    ${course.live_sessions.map(ls => `
                      <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:var(--bg-secondary); border-radius:16px; border:1px solid var(--border-light); flex-wrap:wrap; gap:14px;">
                        <div>
                          <div style="font-weight:900; font-size:0.96rem; color:var(--text-primary); margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                            <span class="material-symbols-rounded" style="color:${ls.status === 'live' ? '#ef4444' : 'var(--primary)'};">podcasts</span>
                            ${esc(ls.title)}
                            ${ls.status === 'live' ? '<span class="badge badge-danger">مباشر الآن</span>' : ''}
                          </div>
                          <div style="font-size:0.8rem; color:var(--text-secondary);">
                            ${esc(ls.description || '')} • الموعد: ${ls.scheduled_at ? new Date(ls.scheduled_at).toLocaleString('ar-EG') : 'قريباً'}
                          </div>
                        </div>
                        <div>
                          ${ls.stream_url && enrolled ? `
                            <a href="${esc(ls.stream_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary" style="gap:6px;">
                              <span class="material-symbols-rounded">open_in_new</span> دخول البث المباشر
                            </a>
                          ` : `
                            <span class="badge badge-warning" style="padding:6px 12px;">متاح للمشتركين بالكورس</span>
                          `}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : '<p style="color:var(--text-muted);">لا توجد حصص لايف مجدولة لهذا الكورس حالياً.</p>'}
              </div>
            </div>

            <!-- TAB 4: DISCUSSION FORUM -->
            <div id="tab-pane-forum" class="course-tab-pane" style="display:none;">
              ${enrolled || isTeacher() ? `
                <div class="card">
                  <h3 class="card-title" style="margin-bottom: 8px;"><span class="material-symbols-rounded" style="color:var(--primary)">forum</span> منتدى النقاش وسؤال المعلم</h3>
                  <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:18px;">
                    اطرح أي سؤال أو نقطة غير واضحة وسيقوم د. زياد رمزي عياد وفريق المساعدين بالرد العلمي الفوري عليك.
                  </p>
                  
                  <form id="discussionForm" style="display: flex; gap: 10px; margin-bottom: 24px;">
                    <input type="text" id="discussionInput" class="form-input" placeholder="هل لديك استفسار أو سؤال حول الكورس؟ اكتبه هنا..." required>
                    <button type="submit" class="btn btn-primary" style="white-space:nowrap;"><span class="material-symbols-rounded">send</span> نشر السؤال</button>
                  </form>
                  
                  <div id="discussionsList">
                    <div class="loading-spinner"><div class="spinner"></div></div>
                  </div>
                </div>
              ` : `
                <div class="card" style="text-align:center; padding:40px 20px;">
                  <span class="material-symbols-rounded" style="font-size:3rem; color:var(--primary); margin-bottom:12px;">lock</span>
                  <h3 style="font-weight:900; margin-bottom:8px;">منتدى النقاش مخصص لطلاب الكورس فقط</h3>
                  <p style="font-size:0.88rem; color:var(--text-secondary); max-width:480px; margin:0 auto 16px;">
                    فعل اشتراكك في الكورس لتتمكن من طرح أسئلتك على الدكتور زياد رمزي عياد ومناقشة زملائك في التمارين والمسائل.
                  </p>
                  <button class="btn btn-primary enroll-prompt-btn">تفعيل الاشتراك بالكود</button>
                </div>
              `}
            </div>
          </div>

          <!-- Sticky Sidebar in Bassthalk Style -->
          <div>
            <!-- Teacher Bio Card -->
            <div class="course-sidebar-card" style="text-align:center;">
              <div style="position:relative; width:80px; height:80px; margin:0 auto 12px;">
                <img src="${drZiadFace}" alt="د. زياد رمزي عياد" style="width:100%; height:100%; border-radius:50%; object-fit:cover; border:3px solid var(--primary); box-shadow:0 4px 14px rgba(5, 150, 105, 0.25);">
                <span class="material-symbols-rounded" style="position:absolute; bottom:0; left:0; background:var(--primary); color:#fff; font-size:1.1rem; border-radius:50%; padding:2px; border:2px solid #fff;">verified</span>
              </div>
              <h3 style="font-size:1.1rem; font-weight:900; color:var(--text-primary); margin-bottom:4px;">د. زياد رمزي عياد</h3>
              <p style="font-size:0.8rem; color:var(--primary); font-weight:800; margin-bottom:10px;">دكتوراه الكيمياء الحيوية • خبير ومدرس أول الثانوية العامة</p>
              <p style="font-size:0.78rem; color:var(--text-secondary); line-height:1.6; margin-bottom:14px;">
                خبرة تتجاوز 15 عاماً في تدريس كيمياء الثانوية العامة ومدارس اللغات، وإعداد أوائل الجمهورية بأساليب الفهم والربط الذهني.
              </p>
              <div style="display:flex; gap:6px; justify-content:center;">
                <a href="#/about" class="btn btn-ghost btn-sm" style="font-size:0.75rem;">السيرة الذاتية الكاملة</a>
              </div>
            </div>

            <!-- Activation / Enrollment Card -->
            <div class="course-sidebar-card">
              ${enrolled ? `
                <div style="text-align:center; padding:10px 0;">
                  <div style="width:50px; height:50px; border-radius:50%; background:rgba(5, 150, 105, 0.12); color:#059669; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; font-size:1.8rem;">
                    <span class="material-symbols-rounded">verified</span>
                  </div>
                  <h4 style="font-weight:900; color:var(--text-primary); margin-bottom:6px;">أنت مشترك بنجاح</h4>
                  <p style="font-size:0.78rem; color:var(--text-secondary); line-height:1.6; margin-bottom:12px;">
                    يمكنك مشاهدة جميع المحاضرات وتنزيل المذكرات ودخول الامتحانات دون قيود طوال العام الدراسي.
                  </p>
                  <span class="badge badge-success" style="font-size:0.75rem; padding:6px 12px;">
                    <span class="material-symbols-rounded" style="font-size:0.95rem;">all_inclusive</span> متاح حتى نهاية الامتحانات
                  </span>
                </div>
              ` : logged ? `
                <div style="margin-bottom:16px;">
                  ${course.is_free ? `
                    <button class="btn btn-primary" id="freeEnrollBtn" style="width:100%; justify-content:center; margin-bottom:10px; font-weight:800; gap:6px;">
                      <span class="material-symbols-rounded">verified</span> اشترك في الكورس المجاني الآن
                    </button>
                  ` : `
                    <div style="background:var(--bg-secondary); border:1px solid var(--border-light); border-radius:12px; padding:12px 14px; margin-bottom:12px;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:0.84rem;">
                        <span style="color:var(--text-secondary);">سعر الكورس:</span>
                        <strong style="color:var(--primary); font-size:1.05rem;">${course.price} ج.م</strong>
                      </div>
                      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
                        <span style="color:var(--text-muted);">رصيد محفظتك الحالي:</span>
                        <strong style="color:${userBalance >= course.price ? '#16a34a' : '#dc2626'}; font-weight:800;">${userBalance} ج.م</strong>
                      </div>
                    </div>

                    ${userBalance >= course.price ? `
                      <button class="btn btn-primary" id="walletEnrollBtn" style="width:100%; justify-content:center; margin-bottom:10px; font-weight:800; gap:6px;">
                        <span class="material-symbols-rounded">account_balance_wallet</span> تأكيد الشراء من المحفظة (${course.price} ج)
                      </button>
                    ` : `
                      <a href="#/wallet" class="btn btn-outline" style="width:100%; justify-content:center; margin-bottom:10px; font-weight:800; gap:6px;">
                        <span class="material-symbols-rounded">payments</span> شحن المحفظة لشراء الكورس
                      </a>
                    `}
                  `}
                </div>

                <div style="position:relative; text-align:center; margin:16px 0; border-top:1px dashed var(--border-light);">
                  <span style="position:relative; top:-10px; background:var(--bg-card); padding:0 10px; font-size:0.75rem; color:var(--text-muted); font-weight:700;">أو التفعيل بكود السنتر</span>
                </div>

                <div class="input-group" style="margin-bottom:10px;">
                  <span class="material-symbols-rounded input-icon">key</span>
                  <input type="text" class="form-input" id="activationCode" placeholder="أدخل كود السنتر / الشحن" style="padding-right:44px; font-weight:700;" dir="ltr">
                </div>
                
                <button class="btn btn-secondary" id="activateBtn" style="width:100%; justify-content:center; margin-bottom:10px; font-weight:700;">
                  <span class="material-symbols-rounded">bolt</span> تفعيل الاشتراك بالكود
                </button>

                <p style="font-size:0.72rem; color:var(--text-muted); text-align:center; margin:0;">
                  ليس لديك كود؟ يمكنك الحصول عليه من مساعد المنصة أو منافذ البيع.
                </p>
              ` : `
                <div style="text-align:center;">
                  <h4 style="font-weight:900; margin-bottom:8px;">اشترك الآن في الكورس</h4>
                  <p style="font-size:0.78rem; color:var(--text-secondary); margin-bottom:16px;">
                    أنشئ حسابك المجاني أو سجل الدخول لتفعيل الاشتراك ومتابعة منهج الكيمياء.
                  </p>
                  <a href="#/register" class="btn btn-primary" style="width:100%; justify-content:center; margin-bottom:8px;">
                    <span class="material-symbols-rounded">person_add</span> إنشاء حساب جديد
                  </a>
                  <a href="#/login" class="btn btn-outline" style="width:100%; justify-content:center;">
                    تسجيل الدخول
                  </a>
                </div>
              `}
            </div>

            <!-- Academic Year Guarantee Card -->
            <div class="course-sidebar-card">
              <h4 style="font-weight:900; font-size:0.95rem; margin-bottom:12px; display:flex; align-items:center; gap:6px; color:#065f46;">
                <span class="material-symbols-rounded" style="color:#059669;">verified_user</span> ضوابط وضمانات المنصة:
              </h4>

              <ul style="display:flex; flex-direction:column; gap:10px; font-size:0.78rem; color:var(--text-secondary); padding:0; margin:0; list-style:none;">
                <li style="display:flex; align-items:flex-start; gap:8px;">
                  <span class="material-symbols-rounded" style="font-size:1.05rem; color:#059669; flex-shrink:0;">done_all</span>
                  <span><strong>نطاق المحتوى:</strong> ${course.course_type === 'quarterly' ? 'محتوى 3 شهور من المنهج' : course.course_type === 'term' ? 'محتوى ترم دراسي كامل' : 'منهج العام كاملاً'}</span>
                </li>
                <li style="display:flex; align-items:flex-start; gap:8px;">
                  <span class="material-symbols-rounded" style="font-size:1.05rem; color:#059669; flex-shrink:0;">all_inclusive</span>
                  <span><strong>صلاحية المشاهدة:</strong> تظل الحصص والامتحانات مفتوحة لك حتى نهاية امتحانات الثانوية العامة دون أي تاريخ انتهاء.</span>
                </li>
                <li style="display:flex; align-items:flex-start; gap:8px;">
                  <span class="material-symbols-rounded" style="font-size:1.05rem; color:#059669; flex-shrink:0;">hd</span>
                  <span><strong>جودة الفيديو:</strong> بث فائق السرعة سيرفرات CDN بدون تقطيع تعمل على كافة الشبكات.</span>
                </li>
              </ul>
            </div>

            <!-- WhatsApp Direct Helpline -->
            <div class="course-sidebar-card" style="background:linear-gradient(135deg, rgba(37, 211, 102, 0.08) 0%, rgba(18, 140, 126, 0.08) 100%); border-color:rgba(37, 211, 102, 0.25);">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <span class="material-symbols-rounded" style="color:#25d366; font-size:1.5rem;">support_agent</span>
                <div>
                  <h5 style="font-weight:900; margin:0; font-size:0.9rem; color:var(--text-primary);">الدعم والمساعدة الفورية</h5>
                  <span style="font-size:0.72rem; color:var(--text-secondary);">فريق مساعدة د. زياد رمزي عياد</span>
                </div>
              </div>
              <p style="font-size:0.76rem; color:var(--text-secondary); margin-bottom:12px; line-height:1.6;">
                واجهتك أي مشكلة في التفعيل أو تريد شراء كود؟ تواصل مع المساعد عبر واتساب مباشرة:
              </p>
              <a href="https://wa.me/201011400827" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background:#25d366; color:#fff; width:100%; justify-content:center; font-weight:800; gap:6px;">
                <span class="material-symbols-rounded">chat</span> محادثة واتساب الآن
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    // 1. Tab Switching Handler (Bassthalk Tabs)
    document.querySelectorAll('.course-bassthalk-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Update active tab button
        document.querySelectorAll('.course-bassthalk-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show matching pane and hide others
        ['curriculum', 'materials', 'exams', 'live', 'forum'].forEach(tabName => {
          const pane = document.getElementById(`tab-pane-${tabName}`);
          if (pane) {
            pane.style.display = tabName === targetTab ? 'block' : 'none';
          }
        });
      });
    });

    const openChemLabBtn = document.getElementById('open-chem-lab-btn');
    if (openChemLabBtn) {
      openChemLabBtn.addEventListener('click', () => openChemistryLabModal());
    }

    // 2. Unit Accordion Toggling Handler
    document.querySelectorAll('.unit-header-bassthalk').forEach(header => {
      header.addEventListener('click', () => {
        const unitBox = header.closest('.unit-box-bassthalk');
        const body = unitBox.querySelector('.unit-body-bassthalk');
        const arrow = header.querySelector('.unit-toggle-arrow');
        
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        if (arrow) {
          arrow.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }
      });
    });

    // 3. Lesson / Exam row click handler
    document.querySelectorAll('.clickable-lecture-row').forEach(el => {
      el.addEventListener('click', (e) => {
        // If clicked directly on the anchor inside, let it navigate
        if (e.target.closest('a')) return;

        const link = el.dataset.link;
        const isLocked = el.dataset.locked === '1';
        const isEnr = el.dataset.enrolled === '1';

        if (link) {
          window.navigateTo ? window.navigateTo(link) : (window.location.href = link);
        } else if (!isEnr) {
          showToast('يرجى تفعيل الاشتراك في الكورس أولاً لمشاهدة هذا الدرس', 'warning');
          const codeInput = document.getElementById('activationCode');
          if (codeInput) {
            codeInput.focus();
            codeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (isLocked) {
          showToast('هذا المحتوى مغلق حالياً حتى تكمل المحتوى السابق وتجتاز امتحانه', 'info');
        }
      });
    });

    // 4. Enroll prompt button click handler
    document.querySelectorAll('.enroll-prompt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!logged) {
          window.location.hash = '#/register';
          return;
        }
        const codeInput = document.getElementById('activationCode');
        if (codeInput) {
          codeInput.focus();
          codeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          showToast('أدخل كود التفعيل في الحقل المخصص لتفعيل اشتراكك', 'info');
        }
      });
    });

    // 5. Discussion Forum system
    if (enrolled || isTeacher()) {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      const loadDiscussions = async () => {
        try {
          const discs = await api.getDiscussions(id);
          const listContainer = document.getElementById('discussionsList');
          if (!listContainer) return;

          if (discs.length === 0) {
            listContainer.innerHTML = `
              <p style="color: var(--text-muted); text-align: center; padding: 20px; font-size: 0.85rem; font-weight: 600;">
                لا توجد أسئلة من الطلاب حالياً. شارك بأول سؤال لدكتور زياد!
              </p>
            `;
            return;
          }

          listContainer.innerHTML = discs.map(d => `
            <div class="discussion-card">
              <div class="discussion-header">
                <div class="discussion-avatar" style="background: var(--green-50); color: var(--primary); font-weight: 800; border: 1px solid var(--green-200);">
                  ${esc((d.user_name || 'ط').charAt(0))}
                </div>
                <div style="flex:1;">
                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="font-size:0.85rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:5px;">
                      <span>${esc(d.user_name)}</span>
                      ${d.user_role === 'teacher' || d.user_role === 'admin' 
                        ? '<span class="badge badge-success" style="font-size:0.6rem; padding:1px 6px;">مُدرّس المنصة</span>' 
                        : ''
                      }
                    </div>
                    ${(isTeacher() || currentUser.id === d.user_id) 
                      ? `<button class="btn btn-ghost delete-disc-btn" data-id="${d.id}" style="color:var(--error); padding:4px;" title="حذف السؤال"><span class="material-symbols-rounded" style="font-size:1.15rem;">delete</span></button>` 
                      : ''
                    }
                  </div>
                  <div class="discussion-time">${new Date(d.created_at || Date.now()).toLocaleDateString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
              </div>
              
              <div class="discussion-body">
                ${esc(d.content)}
              </div>
              
              <!-- Replies block -->
              <div class="discussion-replies">
                ${(d.replies || []).map(r => `
                  <div class="reply-item">
                    <div class="reply-avatar" style="background:var(--gold-50); color:var(--accent); font-weight:800; border:1px solid var(--gold-200);">
                      ${esc(r.user_name.charAt(0))}
                    </div>
                    <div class="reply-content">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <strong style="font-size:0.78rem; font-weight:700; color:var(--text-primary);">${esc(r.user_name)}</strong>
                        ${(isTeacher() || currentUser.id === r.user_id) 
                          ? `<button class="btn btn-ghost delete-reply-btn" data-id="${r.id}" style="color:var(--error); padding:2px;" title="حذف الرد"><span class="material-symbols-rounded" style="font-size:1rem;">close</span></button>` 
                          : ''
                        }
                      </div>
                      <p class="reply-text">${esc(r.content)}</p>
                    </div>
                  </div>
                `).join('')}
                
                ${(isTeacher() || course.allow_student_replies) 
                  ? `
                  <form class="replyForm" data-id="${d.id}" style="display:flex; gap:8px; margin-top:8px;">
                    <input type="text" class="form-input" placeholder="أضف رداً علمياً..." required style="padding:6px 12px; font-size:0.8rem;">
                    <button type="submit" class="btn btn-secondary btn-sm" style="padding: 0 14px;">رد</button>
                  </form>
                  ` 
                  : ''
                }
              </div>
            </div>
          `).join('');

          // Events binding
          document.querySelectorAll('.delete-disc-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const ok = await confirmModal('تأكيد الحذف', 'هل أنت متأكد من حذف هذا السؤال نهائياً؟');
              if (!ok) return;
              try {
                await api.deleteDiscussion(e.currentTarget.dataset.id);
                showToast('تم حذف السؤال', 'success');
                loadDiscussions();
              } catch (err) { showToast(err.message, 'error'); }
            });
          });

          document.querySelectorAll('.delete-reply-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const ok = await confirmModal('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الرد؟');
              if (!ok) return;
              try {
                await api.deleteReply(e.currentTarget.dataset.id);
                showToast('تم حذف الرد', 'success');
                loadDiscussions();
              } catch (err) { showToast(err.message, 'error'); }
            });
          });

          document.querySelectorAll('.replyForm').forEach(form => {
            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              const input = e.target.querySelector('input');
              try {
                await api.postReply(e.target.dataset.id, { content: input.value });
                input.value = '';
                loadDiscussions();
              } catch (err) { showToast(err.message, 'error'); }
            });
          });

        } catch (e) {
          const listContainer = document.getElementById('discussionsList');
          if (listContainer) {
            listContainer.innerHTML = '<p style="color:var(--error); text-align:center; padding:10px;">حدث خطأ في تحميل الأسئلة.</p>';
          }
        }
      };

      loadDiscussions();

      const discForm = document.getElementById('discussionForm');
      discForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('discussionInput');
        try {
          await api.postDiscussion({ course_id: id, content: input.value });
          input.value = '';
          loadDiscussions();
          showToast('تم نشر سؤالك بنجاح', 'success');
        } catch (err) { showToast(err.message, 'error'); }
      });
    }

    // 6. Direct Wallet Purchase Handler
    const walletEnrollBtn = document.getElementById('walletEnrollBtn');
    walletEnrollBtn?.addEventListener('click', async () => {
      const confirmed = await confirmModal(
        'تأكيد شراء الكورس من المحفظة',
        `هل تريد تأكيد خصم ${course.price} ج.م من رصيدك والاشتراك في كورس "${esc(course.title)}"؟`
      );
      if (!confirmed) return;

      walletEnrollBtn.disabled = true;
      walletEnrollBtn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري الشراء...';
      try {
        const res = await api.enrollCourse(id);
        showToast(res.message || 'تم الاشتراك بنجاح', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        showToast(err.message, 'error');
        walletEnrollBtn.disabled = false;
        walletEnrollBtn.innerHTML = `<span class="material-symbols-rounded">account_balance_wallet</span> تأكيد الشراء من المحفظة (${course.price} ج)`;
      }
    });

    // 7. Free Course Direct Enroll Handler
    const freeEnrollBtn = document.getElementById('freeEnrollBtn');
    freeEnrollBtn?.addEventListener('click', async () => {
      freeEnrollBtn.disabled = true;
      freeEnrollBtn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري الاشتراك...';
      try {
        const res = await api.enrollCourse(id);
        showToast(res.message || 'تم الاشتراك في الكورس المجاني بنجاح', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        showToast(err.message, 'error');
        freeEnrollBtn.disabled = false;
        freeEnrollBtn.innerHTML = '<span class="material-symbols-rounded">verified</span> اشترك في الكورس المجاني الآن';
      }
    });

    // 8. Activation code submit handler
    const activateBtn = document.getElementById('activateBtn');
    activateBtn?.addEventListener('click', async () => {
      const inputEl = document.getElementById('activationCode');
      const code = inputEl.value.trim();
      if (!code) return showToast('فضلاً أدخل كود التفعيل أولاً', 'warning');
      
      activateBtn.disabled = true;
      activateBtn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري التفعيل...';
      
      try {
        await api.activateCode(code);
        showToast('تهانينا! تم تفعيل اشتراكك في الكورس بنجاح', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        showToast(err.message, 'error');
        activateBtn.disabled = false;
        activateBtn.innerHTML = '<span class="material-symbols-rounded">offline_bolt</span> تفعيل الاشتراك';
      }
    });

  } catch (err) {
    showToast(err.message, 'error');
  }
}

