import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { isLoggedIn, isTeacher } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { confirmModal } from '../components/modal.js';
import { sanitize } from '../utils/helpers.js';
import { renderPublicHeader, initPublicHeader } from '../components/publicHeader.js';

export function renderCourseDetail(id) {
  const logged = isLoggedIn();
  if (!logged) {
    return `
    <div class="landing" style="min-height: 100vh; background: var(--bg-main);">
      ${renderPublicHeader('courses')}
      <main class="section-container" style="padding-top: 110px; padding-bottom: 60px; min-height: 80vh;">
        <div id="courseContent">
          <!-- Initial skeleton -->
          <div class="skeleton" style="height: 180px; border-radius: var(--radius-xl); margin-bottom: 24px;"></div>
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
            <div>
              <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg); margin-bottom: 14px;"></div>
              <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg); margin-bottom: 14px;"></div>
            </div>
            <div class="skeleton" style="height: 160px; border-radius: var(--radius-lg);"></div>
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
        <div class="skeleton" style="height: 180px; border-radius: var(--radius-xl); margin-bottom: 24px;"></div>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
          <div>
            <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg); margin-bottom: 14px;"></div>
            <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg); margin-bottom: 14px;"></div>
          </div>
          <div class="skeleton" style="height: 160px; border-radius: var(--radius-lg);"></div>
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
    if (logged) {
      try { enrollment = await api.getEnrollment(id); } catch (e) {}
    }
    const enrolled = enrollment?.enrolled || course.is_free || isTeacher();

    document.getElementById('courseContent').innerHTML = `
      <div style="margin-bottom: 20px;">
        <a href="#/courses" class="btn btn-ghost btn-sm" style="padding-right:0;">
          <span class="material-symbols-rounded">arrow_forward</span> العودة للكورسات
        </a>
      </div>

      <!-- Course Hero Header -->
      <div class="course-detail-header">
        <h1 style="font-size: clamp(1.25rem, 3.5vw, 1.7rem); font-weight: 900; line-height: 1.4; color: var(--text-primary); margin-bottom: 8px;">${course.title}</h1>
        <p style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.7; margin-bottom: 20px; max-width: 800px;">${course.description || 'لا يوجد وصف متاح لهذا الكورس حالياً. شرح شامل ومبسط لمادة الكيمياء.'}</p>
        
        <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">
          <span style="display:inline-flex; align-items:center; gap:6px;"><span class="material-symbols-rounded" style="font-size:1.15rem; color:var(--primary);">person</span> د. ${course.teacher_name}</span>
          <span style="display:inline-flex; align-items:center; gap:6px;"><span class="material-symbols-rounded" style="font-size:1.15rem; color:var(--primary);">school</span> ${course.grade}</span>
          <span style="display:inline-flex; align-items:center; gap:6px;"><span class="material-symbols-rounded" style="font-size:1.15rem; color:var(--primary);">play_circle</span> ${course.total_lessons} محتوى</span>
          <span style="display:inline-flex; align-items:center; gap:6px;"><span class="material-symbols-rounded" style="font-size:1.15rem; color:var(--primary);">group</span> ${course.student_count} طالب مشترك</span>
          ${course.is_free 
            ? '<span class="badge badge-success">مجاني</span>' 
            : `<span class="badge badge-warning">${course.price} جنيه</span>`
          }
        </div>

        ${!enrolled && logged 
          ? `
          <div style="margin-top:24px; padding-top:20px; border-top:1.5px dashed var(--border-light); display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <div class="input-group" style="max-width: 280px; width: 100%;">
              <span class="material-symbols-rounded input-icon">key</span>
              <input type="text" class="form-input" id="activationCode" placeholder="أدخل كود تفعيل الكورس" style="padding-right:44px;">
            </div>
            <button class="btn btn-primary" id="activateBtn"><span class="material-symbols-rounded">offline_bolt</span> تفعيل الاشتراك</button>
          </div>
          ` 
          : ''
        }
        
        ${!logged 
          ? `
          <div style="margin-top:20px;">
            <a href="#/register" class="btn btn-primary"><span class="material-symbols-rounded">person_add</span> أنشئ حساباً وسجل في الكورس</a>
          </div>
          ` 
          : ''
        }

        ${enrolled && !course.is_free && !isTeacher() 
          ? `
          <div style="margin-top: 18px;">
            <span class="chip" style="background:var(--green-50); color:var(--green-800); border-color:var(--green-200); font-weight:700;">
              <span class="material-symbols-rounded" style="font-size:1rem;color:var(--green-600)">verified</span> مشترك في الكورس
            </span>
          </div>
          ` 
          : ''
        }
      </div>

      <div class="course-detail-grid">
        <!-- Chapters & Lessons list -->
        <div>
          <h2 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 18px; display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-rounded" style="color:var(--primary)">checklist</span> محتوى الكورس المنهجي
          </h2>
          
          ${course.chapters && course.chapters.length > 0 
            ? course.chapters.map((ch, idx) => `
              <div class="chapter-item ${idx === 0 ? 'active' : ''}">
                <div class="chapter-header">
                  <span class="material-symbols-rounded" style="color:var(--primary)">folder</span>
                  <span>${ch.title}</span>
                  <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; margin-right: 8px;">(${ch.items?.length || 0} دروس وامتحانات)</span>
                  <span class="material-symbols-rounded chapter-toggle-icon">expand_more</span>
                </div>
                
                <div class="chapter-lessons-list">
                  ${(ch.items || []).map(item => {
                    const isExam = item.item_type === 'exam';
                    const isLocked = item.is_locked;
                    const icon = isLocked ? 'lock' : (isExam ? 'assignment' : 'play_circle');
                    
                    // Route for lessons or exam
                    const link = enrolled && !isLocked 
                      ? (isExam ? `#/exams/${item.id}/take` : `#/lessons/${item.id}`) 
                      : '';
                      
                    return `
                      <div class="lesson-item clickable-lesson-item ${isLocked ? 'locked' : ''}" data-link="${link}" data-locked="${isLocked ? '1' : '0'}" data-enrolled="${enrolled ? '1' : '0'}" style="cursor:pointer;">
                        <span class="material-symbols-rounded" style="${isExam ? 'color:var(--accent)' : 'color:var(--primary)'}">${icon}</span>
                        <span style="flex:1;">${item.title}</span>
                        ${item.is_free ? '<span class="badge badge-success">مجاني</span>' : ''}
                        ${isLocked ? '<span class="badge badge-warning" style="font-size:0.62rem;padding:2px 6px;">مغلق</span>' : ''}
                        <span class="lesson-duration">${isExam ? `${item.duration_minutes || 0} دقيقة` : `${item.duration || 0} دقيقة`}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `).join('') 
            : `
              <div class="empty-state">
                <span class="material-symbols-rounded">folder</span>
                <h3>لا يوجد محتوى في الكورس بعد</h3>
                <p>سيتم رفع الحصص والمحتوى من قبل الإدارة قريباً.</p>
              </div>
            `
          }
          
          <!-- Forum Board Section -->
          ${enrolled || isTeacher() 
            ? `
            <div class="card" style="margin-top: 28px;">
              <h3 class="card-title" style="margin-bottom: 18px;"><span class="material-symbols-rounded" style="color:var(--primary)">forum</span> منتدى النقاش وطرح الأسئلة</h3>
              
              <form id="discussionForm" style="display: flex; gap: 10px; margin-bottom: 24px;">
                <input type="text" id="discussionInput" class="form-input" placeholder="هل لديك استفسار أو سؤال حول الكورس؟ اكتبه هنا..." required>
                <button type="submit" class="btn btn-primary"><span class="material-symbols-rounded">send</span> نشر السؤال</button>
              </form>
              
              <div id="discussionsList">
                <div class="loading-spinner"><div class="spinner"></div></div>
              </div>
            </div>
            ` 
            : ''
          }
        </div>
        
        <!-- Sidebar stats information -->
        <div>
          <div class="card" style="position: sticky; top: 100px; display:flex; flex-direction:column; gap:16px;">
            <h3 class="card-title" style="border-bottom:1px solid var(--border-light); padding-bottom:10px;"><span class="material-symbols-rounded" style="color:var(--accent)">info</span> معلومات وضوابط الكورس</h3>
            
            <ul style="display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem; color: var(--text-secondary);">
              <li style="display: flex; justify-content: space-between; align-items: center;">
                <span>نطاق المحتوى:</span>
                <strong style="color:var(--text-primary); font-weight:800;">${course.course_type === 'quarterly' ? 'محتوى 3 شهور من المنهج' : course.course_type === 'term' ? 'محتوى ترم دراسي كامل' : course.course_type === 'annual' ? 'منهج العام الدراسي كاملاً' : 'محتوى شهر دراسي'}</strong>
              </li>
              <li style="display: flex; justify-content: space-between; align-items: center;">
                <span>صلاحية المشاهدة:</span>
                <strong style="color:var(--emerald-600); font-weight:800; display:flex; align-items:center; gap:4px;">
                  <span class="material-symbols-rounded" style="font-size:1rem;">all_inclusive</span> متاح طوال العام الدراسي
                </strong>
              </li>
              <li style="display: flex; justify-content: space-between; align-items: center;">
                <span>نظام التصفح المنهجي:</span>
                <strong style="color:var(--text-primary); font-weight:700;">${course.sequential_access ? 'ترتيب إجباري' : 'حر ومفتوح'}</strong>
              </li>
              <li style="display: flex; justify-content: space-between; align-items: center;">
                <span>نقاشات الطلاب:</span>
                <strong style="color:var(--text-primary); font-weight:700;">${course.allow_student_replies ? 'مفتوح للجميع' : 'للمعلم فقط'}</strong>
              </li>
              <li style="display: flex; justify-content: space-between; align-items: center;">
                <span>المرحلة الدراسية:</span>
                <strong style="color:var(--text-primary); font-weight:700;">${course.grade || 'ثانوية عامة'}</strong>
              </li>
            </ul>

            <!-- Guarantee Callout -->
            <div style="background:rgba(5, 150, 105, 0.08); border:1px solid rgba(5, 150, 105, 0.2); border-radius:10px; padding:12px; font-size:0.8rem; color:var(--emerald-800); line-height:1.5;">
              <div style="font-weight:800; display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span class="material-symbols-rounded" style="font-size:1.05rem; color:var(--emerald-600);">verified</span> ضمان المشاهدة طوال العام:
              </div>
              بمجرد اشتراكك، يظل الكورس بجميع محاضراته وامتحاناته ومذكراته متاحاً لك بالكامل حتى نهاية امتحانات الثانوية العامة دون أي انتهاء صلاحية.
            </div>

            ${course.sequential_access 
              ? `
              <div class="notice notice-warning" style="font-size:0.75rem; padding:10px;">
                <span class="material-symbols-rounded" style="font-size:1.1rem;">info</span>
                <span>لا يمكنك الانتقال لدرس جديد إلا بعد مشاهدة الدرس الحالي وحل الامتحان الملحق به بالكامل.</span>
              </div>
              ` 
              : ''
            }
          </div>
        </div>
      </div>
    `;

    // Toggle Chapters click handler
    document.querySelectorAll('.chapter-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.chapter-item');
        const isActive = item.classList.contains('active');
        // We can close all or just toggle
        item.classList.toggle('active', !isActive);
      });
    });

    // Handle clicking on lessons or exams
    document.querySelectorAll('.clickable-lesson-item').forEach(el => {
      el.addEventListener('click', () => {
        const link = el.dataset.link;
        const isLocked = el.dataset.locked === '1';
        const isEnr = el.dataset.enrolled === '1';

        if (link) {
          window.location.hash = link;
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

    // Load discussions for enrolled/teachers
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
                لا توجد أسئلة من الطلاب حالياً. شارك بأول سؤال!
              </p>
            `;
            return;
          }

          listContainer.innerHTML = discs.map(d => `
            <div class="discussion-card">
              <div class="discussion-header">
                <div class="discussion-avatar" style="background: var(--green-50); color: var(--primary); font-weight: 800; border: 1px solid var(--green-200);">
                  ${d.user_name.charAt(0)}
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
                    ${(isTeacher() || currentUser.id === d.user_id) 
                      ? `<button class="btn btn-ghost delete-disc-btn" data-id="${d.id}" style="color:var(--error); padding:4px;" title="حذف السؤال"><span class="material-symbols-rounded" style="font-size:1.15rem;">delete</span></button>` 
                      : ''
                    }
                  </div>
                  <div class="discussion-time">${new Date(d.created_at || Date.now()).toLocaleDateString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
              </div>
              
              <div class="discussion-body">
                ${sanitize(d.content)}
              </div>
              
              <!-- Replies block -->
              <div class="discussion-replies">
                ${d.replies.map(r => `
                  <div class="reply-item">
                    <div class="reply-avatar" style="background:var(--gold-50); color:var(--accent); font-weight:800; border:1px solid var(--gold-200);">
                      ${sanitize(r.user_name.charAt(0))}
                    </div>
                    <div class="reply-content">
                      <div style="display:flex; align-items:center; justify-content:space-between;">
                        <strong style="font-size:0.78rem; font-weight:700; color:var(--text-primary);">${sanitize(r.user_name)}</strong>
                        ${(isTeacher() || currentUser.id === r.user_id) 
                          ? `<button class="btn btn-ghost delete-reply-btn" data-id="${r.id}" style="color:var(--error); padding:2px;" title="حذف الرد"><span class="material-symbols-rounded" style="font-size:1rem;">close</span></button>` 
                          : ''
                        }
                      </div>
                      <p class="reply-text">${sanitize(r.content)}</p>
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

    // Activate activation code
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
