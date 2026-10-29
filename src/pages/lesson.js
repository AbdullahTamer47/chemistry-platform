import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { getUser } from '../utils/auth.js';
import { showToast } from '../components/toast.js';
import { confirmModal } from '../components/modal.js';
import { esc, sanitize, safeUrl, formatTime } from '../utils/helpers.js';

export function renderLesson(id) {
  return `
  <div class="app-layout">
    ${renderNavbar('courses')}
    <main class="main-content">
      <div id="lessonContent">
        <!-- Lesson skeleton -->
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
    
    document.getElementById('lessonContent').innerHTML = `
      <div style="margin-bottom: 20px;">
        <a href="#/courses/${lesson.course_id}" class="btn btn-ghost btn-sm" style="padding-right:0;">
          <span class="material-symbols-rounded">arrow_forward</span> العودة للكورس
        </a>
      </div>

      <div class="page-header" style="margin-bottom: 20px;">
        <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--primary)">play_circle</span> ${esc(lesson.title)}</h1>
        <p class="page-subtitle">${esc(lesson.chapter_title || 'شرح الدرس الحالي من الكورس المنهجي')}</p>
      </div>

      <!-- Secure Video Box -->
      <div class="video-container" id="videoBox" oncontextmenu="return false;">
        <div id="videoContainer" style="width:100%; height:100%;">
          <div style="display:flex; align-items:center; justify-content:center; height:100%; color:white; flex-direction:column; gap:12px;">
            <div class="spinner"></div>
            <p style="font-size:0.85rem; opacity:0.8;">جاري تحميل مشغل الفيديو الآمن...</p>
          </div>
        </div>
        
        <!-- Anti-leak Moving Watermark (Anti-Piracy DRM) -->
        <div id="watermark" class="video-watermark">
          <span style="font-weight:800;">${esc(user.name)}</span>
          <span style="opacity:0.6; margin: 0 6px;">•</span>
          <span style="direction:ltr; display:inline-block;">${esc(user.phone)}</span>
          <span style="opacity:0.6; margin: 0 6px;">•</span>
          <span style="color:#FBBF24; font-weight:800;">ID:#${user.id}</span>
        </div>
        
        <!-- Protection Overlays -->
        <div class="video-protection-overlay" style="height: 60px;"></div>
        <div class="video-protection-overlay" style="bottom:0; top:auto; right:0; width:120px; height:60px;"></div>
      </div>

      <!-- Navigation & Completion Controls -->
      <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:24px; flex-wrap:wrap;">
        <div style="display:flex; gap:10px;">
          ${lesson.prev_lesson 
            ? `<a href="#/${lesson.prev_lesson.item_type === 'exam' ? 'exams' : 'lessons'}/${lesson.prev_lesson.id}${lesson.prev_lesson.item_type === 'exam' ? '/take' : ''}" class="btn btn-secondary btn-sm"><span class="material-symbols-rounded">arrow_forward</span> الدرس السابق</a>` 
            : ''
          }
          ${lesson.next_lesson 
            ? `<a href="#/${lesson.next_lesson.item_type === 'exam' ? 'exams' : 'lessons'}/${lesson.next_lesson.id}${lesson.next_lesson.item_type === 'exam' ? '/take' : ''}" class="btn btn-secondary btn-sm">الدرس التالي <span class="material-symbols-rounded">arrow_back</span></a>` 
            : ''
          }
        </div>

        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline btn-sm" id="bookmarkBtn" style="gap:6px; font-weight:700;">
            <span class="material-symbols-rounded" id="bookmarkIcon" style="color:${lesson.is_saved ? '#f59e0b' : 'inherit'};">
              ${lesson.is_saved ? 'bookmark_added' : 'bookmark_add'}
            </span>
            <span id="bookmarkText">${lesson.is_saved ? 'محفوظ للمراجعة ⭐' : 'حفظ للمراجعة السريعة'}</span>
          </button>
          <button class="btn btn-primary btn-sm" id="markCompleteBtn" ${lesson.progress?.completed ? 'disabled' : ''}>
            <span class="material-symbols-rounded">check</span> ${lesson.progress?.completed ? 'تم إكمال المشاهدة بنجاح' : 'تحديد كتمت المشاهدة'}
          </button>
        </div>
      </div>

      <!-- Views metrics notice -->
      ${(lesson.progress && (lesson.max_views || 8)) 
        ? `
        <div class="notice notice-info" style="margin-bottom:24px; font-size:0.82rem; font-weight:600;">
          <span class="material-symbols-rounded" style="font-size:1.15rem;">visibility</span>
          <span>عدد المشاهدات المتبقية لك: <strong>${Math.max(0, ((lesson.max_views || 8) + (lesson.progress.extra_views || 0)) - (lesson.progress.views_count || 0))}</strong> من أصل ${(lesson.max_views || 8) + (lesson.progress.extra_views || 0)} مشاهدة مسموحة.</span>
        </div>
        ` 
        : ''
      }

      <!-- Description card -->
      ${lesson.description 
        ? `
        <div class="card" style="margin-bottom: 24px;">
          <h3 class="card-title" style="margin-bottom: 10px;"><span class="material-symbols-rounded">description</span> مذكرات وتفاصيل الحصة</h3>
          <p style="color:var(--text-secondary); font-size:0.88rem; line-height:1.75;">${esc(lesson.description)}</p>
        </div>
        ` 
        : ''
      }

      <!-- Lesson PDF / Study Notes Material -->
      ${lesson.pdf_url 
        ? `
        <div class="card" style="margin-bottom: 24px; border: 1.5px solid rgba(16,185,129,0.25); background: var(--bg-card);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:44px; height:44px; border-radius:10px; background:rgba(239,68,68,0.1); color:#ef4444; display:flex; align-items:center; justify-content:center;">
                <span class="material-symbols-rounded" style="font-size:1.6rem;">picture_as_pdf</span>
              </div>
              <div>
                <h4 style="font-size:0.95rem; font-weight:800; color:var(--text-primary); margin:0 0 2px;">مذكرة وملخص الحصة المنهجي (PDF)</h4>
                <p style="font-size:0.78rem; color:var(--text-muted); margin:0;">الملخص المعتمد وتدريبات الدرس من إعداد د. زياد رمزي عياد</p>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <a href="${safeUrl(lesson.pdf_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
                <span class="material-symbols-rounded">visibility</span> معاينة الملف
              </a>
              <a href="${safeUrl(lesson.pdf_url)}" download class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
                <span class="material-symbols-rounded">download</span> تحميل المذكرة
              </a>
            </div>
          </div>
        </div>
        ` 
        : ''
      }

      <!-- Personal Timestamped Study Notes Card -->
      <div class="card" style="margin-bottom: 24px; border: 1.5px solid var(--border);">
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

      <!-- Lesson Discussions Form -->
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
    `;

    // Load Video URL/Iframe Source securely
    try {
      const res = await api.getVideoToken(id);
      const url = String(res.video_url || '');
      let iframeSrc = '';

      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
        else if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
        videoId = videoId.replace(/[^A-Za-z0-9_-]/g, '');
        if (!videoId) throw new Error('رابط الفيديو غير صالح');

        iframeSrc = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0&fs=0&controls=1&disablekb=1`;
      } else if (url.includes('drive.google.com')) {
        let fileId = '';
        if (url.includes('/d/')) fileId = url.split('/d/')[1].split('/')[0];
        else if (url.includes('id=')) fileId = url.split('id=')[1].split('&')[0];
        fileId = fileId.replace(/[^A-Za-z0-9_-]/g, '');
        if (!fileId) throw new Error('رابط الفيديو غير صالح');

        iframeSrc = `https://drive.google.com/file/d/${fileId}/preview`;
      } else if (/^https:\/\//i.test(url)) {
        iframeSrc = url;
      } else {
        throw new Error('رابط الفيديو غير صالح');
      }

      // Fullscreen stays disabled simply by omitting the allowfullscreen attribute.
      document.getElementById('videoContainer').innerHTML = `
        <iframe src="${esc(iframeSrc)}" title="فيديو الدرس" style="width:100%; height:100%; border:none;" allow="autoplay; encrypted-media" referrerpolicy="no-referrer"></iframe>
      `;
    } catch (err) {
      document.getElementById('videoContainer').innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--error); flex-direction:column; gap:12px; background:var(--bg-secondary);">
          <span class="material-symbols-rounded" style="font-size:3rem;">error</span>
          <p style="font-size:0.85rem; font-weight:700;">${esc(err.message)}</p>
        </div>
      `;
    }

    // Security constraints against key triggers
    const videoBox = document.getElementById('videoBox');
    videoBox?.addEventListener('contextmenu', e => e.preventDefault());

    const preventKeys = e => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's'))
      ) {
        e.preventDefault();
        showToast('غير مسموح بهذا الإجراء لحماية محتوى المنصة', 'warning');
      }
    };
    document.addEventListener('keydown', preventKeys);

    // Watermark dynamic movement (Anti-piracy moving watermark)
    const watermark = document.getElementById('watermark');
    let wmInterval;
    if (watermark) {
      const moveWm = () => {
        const top = Math.floor(Math.random() * 65) + 15;
        const left = Math.floor(Math.random() * 65) + 15;
        const rot = Math.floor(Math.random() * 24) - 12;
        watermark.style.top = `${top}%`;
        watermark.style.left = `${left}%`;
        watermark.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
      };
      moveWm();
      wmInterval = setInterval(moveWm, 4000);
    }

    const cleanupLessonListeners = () => {
      document.removeEventListener('keydown', preventKeys);
      if (wmInterval) clearInterval(wmInterval);
    };
    window.addEventListener('hashchange', cleanupLessonListeners, { once: true });

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
              <span class="badge badge-warning" dir="ltr" style="font-family:monospace; font-size:0.78rem; flex-shrink:0;">⏱ ${formatTime(n.timestamp_sec || 0)}</span>
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
        showToast('تم حفظ ملاحظتك بنجاح 📝', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Completion toggle
    const markBtn = document.getElementById('markCompleteBtn');
    if (markBtn && !lesson.progress?.completed) {
      markBtn.addEventListener('click', async () => {
        markBtn.disabled = true;
        markBtn.innerHTML = '<span class="material-symbols-rounded spin-icon">sync</span> جاري الحفظ...';
        try {
          await api.updateProgress(id, { completed: 1 });
          markBtn.innerHTML = '<span class="material-symbols-rounded">check</span> تم إكمال المشاهدة بنجاح';
          showToast('تم تسجيل مشاهدتك للدرس بنجاح', 'success');
        } catch (err) {
          showToast(err.message, 'error');
          markBtn.disabled = false;
          markBtn.innerHTML = '<span class="material-symbols-rounded">check</span> تحديد كتمت المشاهدة';
        }
      });
    }

    // Discussions forum loading
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
              ${sanitize(d.content)}
            </div>
            
            <!-- Replies -->
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
                    <p class="reply-text">${sanitize(r.content)}</p>
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

        // Bind delete & reply actions
        document.querySelectorAll('.delete-disc-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const ok = await confirmModal('تأكيد الحذف', 'هل أنت متأكد من حذف هذا السؤال؟');
            if (!ok) return;
            try {
              await api.deleteDiscussion(e.currentTarget.dataset.id);
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
              await api.deleteReply(e.currentTarget.dataset.id);
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
              await api.postReply(e.target.dataset.id, { content: input.value });
              input.value = '';
              loadLessonDiscussions();
            } catch (err) { showToast(err.message, 'error'); }
          });
        });

      } catch (e) {
        document.getElementById('lessonDiscussionsList').innerHTML = '<p style="color:var(--error); text-align:center; padding:10px;">فشل تحميل أسئلة الدرس.</p>';
      }
    };

    loadLessonDiscussions();

    // Discussion submission
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

    // Bookmark / Save lesson toggle
    document.getElementById('bookmarkBtn')?.addEventListener('click', async () => {
      try {
        const res = await api.toggleBookmark(id);
        showToast(res.message, 'success');
        const icon = document.getElementById('bookmarkIcon');
        const text = document.getElementById('bookmarkText');
        if (icon) icon.style.color = res.is_saved ? '#f59e0b' : 'inherit';
        if (icon) icon.textContent = res.is_saved ? 'bookmark_added' : 'bookmark_add';
        if (text) text.textContent = res.is_saved ? 'محفوظ للمراجعة ⭐' : 'حفظ للمراجعة السريعة';
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
        <h2 style="font-size:1.4rem; font-weight:900; color:var(--text-primary); margin-bottom:10px;">عفواً، المحتوى مغلق (نظام التسلسل الإجباري)</h2>
        <p style="color:var(--text-secondary); font-size:0.92rem; line-height:1.7; max-width:520px; margin:0 auto 24px;">
          ${esc(err.message || 'لا يمكنك فتح هذا الدرس إلا بعد اجتياز المحاضرة أو الكويز السابق بنجاح وفقاً لنظام المتابعة الصارم.')}
        </p>
        <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
          <a href="#/courses" class="btn btn-secondary"><span class="material-symbols-rounded">book</span> جدول الكورسات</a>
          <button onclick="window.history.back()" class="btn btn-primary"><span class="material-symbols-rounded">arrow_forward</span> الرجوع واستكمال المطلوب</button>
        </div>
      </div>
    `;
  }
}
