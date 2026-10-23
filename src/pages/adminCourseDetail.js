import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { showModal, confirmModal } from '../components/modal.js';
import { sanitize } from '../utils/helpers.js';

export function renderAdminCourseDetail(id) {
  return `<div class="app-layout">
    ${renderNavbar('admin-courses')}
    <main class="main-content">
      <div id="acdContent"><div class="loading-spinner"><div class="spinner"></div></div></div>
    </main>
  </div>`;
}

export async function initAdminCourseDetail(id) {
  initNavbar();
  
  async function loadCourse() {
    try {
      const course = await api.getCourse(id);
      document.getElementById('acdContent').innerHTML = `
        <a href="#/admin/courses" style="display:inline-flex;align-items:center;gap:6px;color:var(--text-muted);font-size:0.88rem;margin-bottom:16px"><span class="material-symbols-rounded">arrow_forward</span> الرجوع للكورسات</a>
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
          <div>
            <h1 class="page-title" style="margin-bottom:4px">${course.title}</h1>
            <p class="page-subtitle">${course.grade} · ${course.total_lessons} درس · ${course.student_count} طالب</p>
          </div>
          <div style="display:flex;gap:12px">
            <button class="btn btn-secondary" id="editCourseSettingsBtn"><span class="material-symbols-rounded">settings</span> إعدادات الكورس</button>
            <button class="btn btn-primary" id="addChapterBtn"><span class="material-symbols-rounded">folder_add</span> إضافة فصل جديد</button>
          </div>
        </div>

        <!-- Course Settings Summary Card -->
        <div class="card" style="margin-bottom:24px;background:var(--bg-secondary);border:1px solid var(--border-light)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="font-weight:700;display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--primary)">settings</span> إعدادات الكورس والمنتدى</h3>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:0.9rem">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-main);border-radius:8px">
              <span style="display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--warning);font-size:1.2rem">lock</span> الترتيب الإجباري:</span>
              <span class="badge ${course.sequential_access ? 'badge-success' : 'badge-danger'}">${course.sequential_access ? 'مفعل' : 'مغلق'}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-main);border-radius:8px">
              <span style="display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--info);font-size:1.2rem">forum</span> ردود الطلاب في المنتدى:</span>
              <span class="badge ${course.allow_student_replies ? 'badge-success' : 'badge-danger'}">${course.allow_student_replies ? 'مسموح' : 'المعلم فقط'}</span>
            </div>
          </div>
        </div>

        <div style="margin-top:24px">
          ${(course.chapters || []).length === 0 ? '<div class="empty-state"><span class="material-symbols-rounded">folder</span><h3>لا توجد فصول بعد</h3></div>' : ''}
          ${(course.chapters || []).map(ch => `
            <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden">
              <div style="background:var(--bg-main);padding:16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-light)">
                <h3 style="font-weight:700;display:flex;align-items:center;gap:8px"><span class="material-symbols-rounded" style="color:var(--primary)">folder</span> ${ch.title}</h3>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-primary btn-sm add-lesson-btn" data-chid="${ch.id}"><span class="material-symbols-rounded">add</span> درس جديد</button>
                  <button class="btn btn-ghost btn-sm edit-chapter-btn" data-chid="${ch.id}" data-title="${ch.title}" data-order="${ch.order_num}" title="تعديل"><span class="material-symbols-rounded">edit</span></button>
                  <button class="btn btn-ghost btn-sm text-danger delete-chapter-btn" data-chid="${ch.id}" title="حذف" style="color:var(--error)"><span class="material-symbols-rounded">delete</span></button>
                </div>
              </div>
              <div style="padding:0">
                ${(ch.items || []).length === 0 ? '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.85rem">لا يوجد محتوى في هذا الفصل</div>' : ''}
                ${(ch.items || []).map(item => `
                  <div style="padding:12px 16px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;gap:12px">
                    <div style="width:30px;height:30px;border-radius:var(--radius-sm);background:${item.item_type === 'exam' ? 'var(--gold-50)' : 'var(--green-50)'};color:${item.item_type === 'exam' ? 'var(--gold-800)' : 'var(--green-800)'};display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700">${item.order_num}</div>
                    <div style="flex:1">
                      <div style="font-weight:600;font-size:0.9rem;display:flex;align-items:center;gap:4px">
                        <span class="material-symbols-rounded" style="font-size:1.1rem;color:var(--text-muted)">${item.item_type === 'exam' ? 'assignment' : 'play_circle'}</span>
                        ${item.title}
                      </div>
                      <div style="font-size:0.75rem;color:var(--text-muted)">
                        ${item.item_type === 'exam' ? `${item.duration_minutes} دقيقة · ${item.max_attempts} محاولات` : `${item.duration} دقيقة ${item.is_free ? '· <span style="color:var(--success)">مجاني</span>' : ''}`}
                      </div>
                    </div>
                    <div style="display:flex;gap:6px">
                      ${item.item_type === 'exam' 
                        ? `<a href="#/admin/exams" class="btn btn-ghost btn-sm" title="إدارة الامتحانات"><span class="material-symbols-rounded">edit</span></a>`
                        : `<button class="btn btn-ghost btn-sm edit-lesson-btn" data-lid="${item.id}" title="تعديل"><span class="material-symbols-rounded">edit</span></button>
                           <button class="btn btn-ghost btn-sm text-danger delete-lesson-btn" data-lid="${item.id}" title="حذف" style="color:var(--error)"><span class="material-symbols-rounded">delete</span></button>`
                      }
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Admin Forum Section -->
        <div class="card" style="margin-top:24px;border:1px solid var(--border-light)">
          <h3 style="font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--primary)">forum</span> إدارة منتدى الكورس</h3>
          <form id="adminDiscussionForm" style="margin-bottom:20px;display:flex;gap:10px">
            <input type="text" id="adminDiscussionInput" class="form-input" placeholder="اكتب إعلاناً أو مناقشة جديدة للطلاب..." required style="flex:1">
            <button type="submit" class="btn btn-primary"><span class="material-symbols-rounded">send</span> نشر</button>
          </form>
          <div id="adminDiscussionsList"><div class="spinner"></div></div>
        </div>
      `;

      bindEvents(course);
    } catch (err) {
      document.getElementById('acdContent').innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>${err.message}</h3></div>`;
    }
  }

  function bindEvents(course) {
    // Course Settings
    document.getElementById('editCourseSettingsBtn')?.addEventListener('click', () => {
      showModal('إعدادات الكورس', `
        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" id="ecSequential" ${course.sequential_access ? 'checked' : ''} style="margin-left: 8px;">
            تفعيل الترتيب الإجباري للدروس والامتحانات
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" id="ecReplies" ${course.allow_student_replies ? 'checked' : ''} style="margin-left: 8px;">
            السماح للطلاب بالرد على بعضهم في منتدى الكورس
          </label>
        </div>
        <button class="btn btn-primary btn-block" id="saveCourseSettingsBtn">تحديث الإعدادات</button>
      `);
      document.getElementById('saveCourseSettingsBtn').addEventListener('click', async () => {
        try {
          await api.updateCourse(course.id, { 
            sequential_access: document.getElementById('ecSequential').checked,
            allow_student_replies: document.getElementById('ecReplies').checked
          });
          showToast('تم تحديث الإعدادات بنجاح', 'success');
          document.querySelector('.modal-overlay')?.remove();
          loadCourse();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    // Add Chapter
    document.getElementById('addChapterBtn')?.addEventListener('click', () => {
      showModal('إضافة فصل جديد', `
        <div class="form-group"><label class="form-label">عنوان الفصل</label><input type="text" class="form-input" id="ncTitle" required></div>
        <div class="form-group"><label class="form-label">الترتيب</label><input type="number" class="form-input" id="ncOrder" value="${(course.chapters?.length || 0) + 1}"></div>
        <button class="btn btn-primary btn-block" id="saveChapterBtn">حفظ</button>
      `);
      document.getElementById('saveChapterBtn').addEventListener('click', async () => {
        try {
          await api.addChapter(id, { title: document.getElementById('ncTitle').value, order_num: parseInt(document.getElementById('ncOrder').value) });
          showToast('تم إضافة الفصل', 'success');
          document.querySelector('.modal-overlay')?.remove();
          loadCourse();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    // Edit Chapter
    document.querySelectorAll('.edit-chapter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chId = btn.dataset.chid;
        showModal('تعديل الفصل', `
          <div class="form-group"><label class="form-label">عنوان الفصل</label><input type="text" class="form-input" id="ecTitle" value="${btn.dataset.title}" required></div>
          <div class="form-group"><label class="form-label">الترتيب</label><input type="number" class="form-input" id="ecOrder" value="${btn.dataset.order}"></div>
          <button class="btn btn-primary btn-block" id="updateChapterBtn">تحديث</button>
        `);
        document.getElementById('updateChapterBtn').addEventListener('click', async () => {
          try {
            await api.updateChapter(chId, { title: document.getElementById('ecTitle').value, order_num: parseInt(document.getElementById('ecOrder').value) });
            showToast('تم التحديث', 'success');
            document.querySelector('.modal-overlay')?.remove();
            loadCourse();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    });

    // Delete Chapter
    document.querySelectorAll('.delete-chapter-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal('تأكيد حذف الفصل', 'هل أنت متأكد من حذف هذا الفصل؟ سيتم حذف جميع الدروس بداخله نهائياً!');
        if (ok) {
          try {
            await api.deleteChapter(btn.dataset.chid);
            showToast('تم الحذف', 'success');
            loadCourse();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });

    // Add Lesson
    document.querySelectorAll('.add-lesson-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chId = btn.dataset.chid;
        const chapter = course.chapters.find(c => c.id == chId);
        showModal('إضافة درس جديد', `
          <div class="form-group"><label class="form-label">عنوان الدرس</label><input type="text" class="form-input" id="nlTitle" required></div>
          <div class="form-group"><label class="form-label">رابط الفيديو (منصة الاستضافة)</label><input type="url" class="form-input" id="nlUrl" dir="ltr" required></div>
          <div class="form-group"><label class="form-label">رابط مذكرة أو ملخص الدرس (PDF)</label><input type="url" class="form-input" id="nlPdf" placeholder="https://.../notes.pdf" dir="ltr"></div>
          <div class="form-group"><label class="form-label">الوصف</label><textarea class="form-input" id="nlDesc" rows="3"></textarea></div>
          <div style="display:flex;gap:12px">
            <div class="form-group" style="flex:1"><label class="form-label">المدة (دقائق)</label><input type="number" class="form-input" id="nlDur" value="0"></div>
            <div class="form-group" style="flex:1"><label class="form-label">الترتيب</label><input type="number" class="form-input" id="nlOrder" value="${(chapter.items?.length || 0) + 1}"></div>
            <div class="form-group" style="flex:1"><label class="form-label">المشاهدات المسموحة</label><input type="number" class="form-input" id="nlMaxViews" value="8"></div>
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="nlFree"><label for="nlFree">درس مجاني (متاح للجميع)</label></div>
          <button class="btn btn-primary btn-block" id="saveLessonBtn">حفظ الدرس</button>
        `);
        document.getElementById('saveLessonBtn').addEventListener('click', async () => {
          try {
            await api.createLesson({
              chapter_id: parseInt(chId), course_id: parseInt(id),
              title: document.getElementById('nlTitle').value, description: document.getElementById('nlDesc').value,
              video_url: document.getElementById('nlUrl').value, pdf_url: document.getElementById('nlPdf').value.trim() || null,
              duration: parseInt(document.getElementById('nlDur').value),
              order_num: parseInt(document.getElementById('nlOrder').value), max_views: parseInt(document.getElementById('nlMaxViews').value), is_free: document.getElementById('nlFree').checked
            });
            showToast('تم إضافة الدرس بنجاح', 'success');
            document.querySelector('.modal-overlay')?.remove();
            loadCourse();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    });

    // Edit Lesson
    document.querySelectorAll('.edit-lesson-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lid = btn.dataset.lid;
        let lesson;
        course.chapters.forEach(ch => { const l = ch.items?.find(x => x.id == lid && x.item_type === 'lesson'); if(l) lesson = l; });
        if(!lesson) return;
        
        showModal('تعديل الدرس', `
          <div class="form-group"><label class="form-label">عنوان الدرس</label><input type="text" class="form-input" id="elTitle" value="${lesson.title}" required></div>
          <div class="form-group"><label class="form-label">رابط الفيديو</label><input type="url" class="form-input" id="elUrl" value="${lesson.video_url || ''}" dir="ltr" required></div>
          <div class="form-group"><label class="form-label">رابط مذكرة أو ملخص الدرس (PDF)</label><input type="url" class="form-input" id="elPdf" value="${lesson.pdf_url || ''}" placeholder="https://.../notes.pdf" dir="ltr"></div>
          <div class="form-group"><label class="form-label">الوصف</label><textarea class="form-input" id="elDesc" rows="3">${lesson.description || ''}</textarea></div>
          <div style="display:flex;gap:12px">
            <div class="form-group" style="flex:1"><label class="form-label">المدة (دقائق)</label><input type="number" class="form-input" id="elDur" value="${lesson.duration}"></div>
            <div class="form-group" style="flex:1"><label class="form-label">الترتيب</label><input type="number" class="form-input" id="elOrder" value="${lesson.order_num}"></div>
            <div class="form-group" style="flex:1"><label class="form-label">المشاهدات المسموحة</label><input type="number" class="form-input" id="elMaxViews" value="${lesson.max_views || 8}"></div>
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="elFree" ${lesson.is_free ? 'checked' : ''}><label for="elFree">درس مجاني (متاح للجميع)</label></div>
          <button class="btn btn-primary btn-block" id="updateLessonBtn">تحديث الدرس</button>
        `);
        document.getElementById('updateLessonBtn').addEventListener('click', async () => {
          try {
            await api.updateLesson(lid, {
              title: document.getElementById('elTitle').value, description: document.getElementById('elDesc').value,
              video_url: document.getElementById('elUrl').value, pdf_url: document.getElementById('elPdf').value.trim() || null,
              duration: parseInt(document.getElementById('elDur').value),
              order_num: parseInt(document.getElementById('elOrder').value), max_views: parseInt(document.getElementById('elMaxViews').value), is_free: document.getElementById('elFree').checked
            });
            showToast('تم التحديث بنجاح', 'success');
            document.querySelector('.modal-overlay')?.remove();
            loadCourse();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    });

    // Delete Lesson
    document.querySelectorAll('.delete-lesson-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal('تأكيد حذف الدرس', 'هل أنت متأكد من حذف هذا الدرس نهائياً؟');
        if (ok) {
          try {
            await api.deleteLesson(btn.dataset.lid);
            showToast('تم الحذف', 'success');
            loadCourse();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });

    // Load Discussions
    const loadDiscussions = async () => {
      try {
        const discs = await api.getDiscussions(id);
        document.getElementById('adminDiscussionsList').innerHTML = discs.length === 0 
          ? '<p style="color:var(--text-muted);text-align:center;padding:20px">لا توجد مناقشات بعد.</p>'
          : discs.map(d => `
            <div class="discussion-item" style="border-bottom:1px solid var(--border-color);padding:16px 0">
              <div style="display:flex;gap:12px;margin-bottom:8px">
                <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:bold">${sanitize(d.user_name.charAt(0))}</div>
                <div style="flex:1">
                  <div style="display:flex;justify-content:space-between">
                    <strong style="font-size:0.9rem">${sanitize(d.user_name)} ${d.user_role === 'teacher' || d.user_role === 'admin' ? '<span class="material-symbols-rounded" style="color:var(--primary);font-size:1.1rem;vertical-align:middle">verified</span>' : ''}</strong>
                    <button class="btn btn-ghost delete-disc-btn" data-id="${d.id}" style="color:var(--error);padding:2px 6px"><span class="material-symbols-rounded">delete</span></button>
                  </div>
                  <p style="font-size:0.95rem;margin-top:4px">${sanitize(d.content)}</p>
                </div>
              </div>
              
              <!-- Replies -->
              <div style="margin-right:48px;background:var(--bg-secondary);border-radius:8px;padding:12px;margin-top:8px">
                ${d.replies.map(r => `
                  <div style="display:flex;gap:8px;margin-bottom:8px">
                    <div style="width:24px;height:24px;border-radius:50%;background:var(--accent-light);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold">${sanitize(r.user_name.charAt(0))}</div>
                    <div style="flex:1">
                      <div style="display:flex;justify-content:space-between">
                        <strong style="font-size:0.8rem">${sanitize(r.user_name)} ${r.user_role === 'teacher' || r.user_role === 'admin' ? '<span class="material-symbols-rounded" style="color:var(--primary);font-size:1rem;vertical-align:middle">verified</span>' : ''}</strong>
                        <button class="btn btn-ghost delete-reply-btn" data-id="${r.id}" style="color:var(--error);padding:0"><span class="material-symbols-rounded">close</span></button>
                      </div>
                      <p style="font-size:0.85rem">${sanitize(r.content)}</p>
                    </div>
                  </div>
                `).join('')}
                
                <form class="adminReplyForm" data-id="${d.id}" style="display:flex;gap:8px;margin-top:12px">
                  <input type="text" class="form-input" placeholder="الرد كمعلم..." required style="padding:6px 12px;font-size:0.85rem;flex:1">
                  <button type="submit" class="btn btn-secondary" style="padding:4px 12px;font-size:0.85rem">رد</button>
                </form>
              </div>
            </div>
          `).join('');

        // Bind delete and reply events
        document.querySelectorAll('.delete-disc-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const ok = await confirmModal('تأكيد حذف السؤال', 'هل أنت متأكد من حذف هذا السؤال من المنتدى؟');
            if(!ok) return;
            try { await api.deleteDiscussion(e.currentTarget.dataset.id); loadDiscussions(); } catch(err){ showToast(err.message, 'error'); }
          });
        });
        document.querySelectorAll('.delete-reply-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const ok = await confirmModal('تأكيد حذف الرد', 'هل أنت متأكد من حذف هذا الرد؟');
            if(!ok) return;
            try { await api.deleteReply(e.currentTarget.dataset.id); loadDiscussions(); } catch(err){ showToast(err.message, 'error'); }
          });
        });
        document.querySelectorAll('.adminReplyForm').forEach(form => {
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = e.target.querySelector('input');
            try {
              await api.postReply(e.target.dataset.id, { content: input.value });
              input.value = '';
              loadDiscussions();
            } catch(err) { showToast(err.message, 'error'); }
          });
        });
      } catch (err) {
        document.getElementById('adminDiscussionsList').innerHTML = '<p style="color:var(--error)">تعذر تحميل المنتدى</p>';
      }
    };

    loadDiscussions();

    const discForm = document.getElementById('adminDiscussionForm');
    if (discForm) {
      discForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('adminDiscussionInput');
        try {
          await api.postDiscussion({ course_id: id, content: input.value });
          input.value = '';
          loadDiscussions();
        } catch(err) { showToast(err.message, 'error'); }
      });
    }

  }

  loadCourse();
}
