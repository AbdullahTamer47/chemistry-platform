import { api } from '../utils/api.js';
import { getUser, isTeacher } from '../utils/auth.js';
import { esc, getShortStudentName } from '../utils/helpers.js';
import { showToast } from './toast.js';

function getStudentWatermarkText() {
  const user = getUser() || {};
  const shortName = getShortStudentName(user.name || 'طالب كيمياوي');
  const phone = user.phone || '';
  return `${shortName} • ${phone}`;
}

function buildTiledWatermarkGridHtml(wmText, count = 18) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(`<span class="shield-tiled-wm-item">${esc(wmText)}</span>`);
  }
  return `<div class="shield-tiled-wm-grid" aria-hidden="true">${items.join('')}</div>`;
}

/**
 * Opens a multi-layered protected PDF / Study Note viewer modal for a lesson.
 * Never exposes the raw PDF URL, disables browser PDF toolbar/download/print,
 * overlays both a tiled diagonal watermark and an instant-jumping watermark,
 * and blacks out on focus loss / screen capture shortcuts.
 */
export async function openProtectedPdfModal(lessonId, lessonTitle = 'مذكرة المحاضرة') {
  try {
    showToast('جاري فتح الملف داخل العارض المشفر المحمي...', 'info');
    const data = await api.getLessonPdfToken(lessonId);

    let targetSrc = data.stream_url || '';
    if (data.pdf_cipher && data.key) {
      try {
        const keyStr = data.key;
        const rawBin = atob(data.pdf_cipher);
        const outBytes = new Uint8Array(rawBin.length);
        for (let i = 0; i < rawBin.length; i++) {
          outBytes[i] = rawBin.charCodeAt(i) ^ keyStr.charCodeAt(i % keyStr.length);
        }
        const parsed = JSON.parse(new TextDecoder().decode(outBytes));
        if (parsed.u) targetSrc = parsed.u;
      } catch (_) {}
    }

    // Append toolbar/print disabling hash parameters for native PDF rendering
    const viewerSrc = targetSrc.includes('drive.google.com')
      ? targetSrc
      : `${targetSrc}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;

    const wmText = data.watermark || getStudentWatermarkText();

    document.getElementById('kimyawyPdfShieldModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'kimyawyPdfShieldModal';
    modal.className = 'pdf-shield-modal-overlay';
    modal.setAttribute('oncontextmenu', 'return false;');
    modal.innerHTML = `
      <div class="pdf-shield-modal-card" oncontextmenu="return false;">
        <!-- Protected Header -->
        <div class="pdf-shield-header">
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            <div style="width:38px; height:38px; border-radius:10px; background:rgba(16,185,129,0.18); color:#34d399; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <span class="material-symbols-rounded">shield_lock</span>
            </div>
            <div style="min-width:0;">
              <h3 style="margin:0; font-size:0.98rem; font-weight:900; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${esc(lessonTitle)} — عارض الملفات المشفر
              </h3>
              <div style="font-size:0.74rem; color:#a7f3d0; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span class="material-symbols-rounded" style="font-size:0.9rem;">verified_user</span>
                <span>مفتوح للمذاكرة والمراجعة بلا حدود (عدد مرات فتح لا نهائي)</span>
              </div>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="btn btn-sm" id="pdfShieldFullscreenBtn" style="background:rgba(255,255,255,0.12); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:6px 12px; gap:4px;">
              <span class="material-symbols-rounded" style="font-size:1.1rem;">fullscreen</span> ملء الشاشة
            </button>
            <button type="button" class="btn btn-sm" id="pdfShieldCloseBtn" style="background:#ef4444; color:#fff; border:none; padding:6px 14px; font-weight:800; gap:4px;">
              <span class="material-symbols-rounded" style="font-size:1.1rem;">close</span> إغلاق
            </button>
          </div>
        </div>

        <!-- Protected Viewport -->
        <div class="pdf-shield-viewport" id="pdfShieldViewport">
          <iframe
            src="${esc(viewerSrc)}"
            title="${esc(lessonTitle)}"
            class="pdf-shield-iframe"
            sandbox="allow-scripts allow-same-origin"
            referrerpolicy="no-referrer"
          ></iframe>

          <!-- Top-right & top-bar blocker to block Google Drive pop-out button and browser PDF toolbar -->
          <div class="pdf-shield-top-blocker" title="محمي بنظام كيمياوي"></div>

          <!-- Layer 1: Diagonal Tiled Watermark Grid -->
          ${buildTiledWatermarkGridHtml(wmText, 24)}

          <!-- Layer 2: Instant-Jumping Dynamic Watermark Pill -->
          <div id="pdfJumpingWatermark" class="video-watermark" style="transition:none !important; z-index:24; pointer-events:none;">
            <span style="font-weight:900;">${esc(wmText)}</span>
          </div>

          <!-- Layer 3: Anti-Screenshot / Focus Loss Blackout Shield -->
          <div id="pdfAntiCaptureShield" class="video-anti-capture-shield" style="display:none; z-index:30;">
            <span class="material-symbols-rounded" style="font-size:3.2rem; color:#f59e0b;">security</span>
            <h4 style="margin:8px 0 4px; font-weight:900;">تم إخفاء الملف مؤقتاً لحماية المحتوى من التصوير أو النسخ</h4>
            <p style="font-size:0.86rem; opacity:0.88; margin:0 0 14px;">يُمنع استخدام أدوات لقطة الشاشة أو الطباعة أو الخروج من نافذة الملف أثناء المذاكرة</p>
            <button type="button" class="btn btn-primary btn-sm" id="pdfResumeViewBtn" style="pointer-events:auto;">استئناف قراءة المذكرة</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const jumpWm = document.getElementById('pdfJumpingWatermark');
    const shield = document.getElementById('pdfAntiCaptureShield');
    const resumeBtn = document.getElementById('pdfResumeViewBtn');
    const pdfIframe = modal.querySelector('.pdf-shield-iframe');
    const card = modal.querySelector('.pdf-shield-modal-card');

    const moveWm = () => {
      if (!jumpWm) return;
      const top = Math.floor(Math.random() * 68) + 16;
      const left = Math.floor(Math.random() * 64) + 18;
      jumpWm.style.transition = 'none';
      jumpWm.style.top = `${top}%`;
      jumpWm.style.left = `${left}%`;
      jumpWm.style.transform = 'translate(-50%, -50%)';
    };
    moveWm();
    const wmTimer = setInterval(moveWm, 3200);

    let lastPdfReport = 0;

    const triggerBlackout = (reportViolation = false, reasonText = 'محاولة تصوير أو نسخ المذكرة المحمية') => {
      if (pdfIframe) {
        pdfIframe.style.transition = 'none';
        pdfIframe.style.visibility = 'hidden';
        pdfIframe.style.opacity = '0';
      }
      if (shield) shield.style.display = 'flex';
      if (resumeBtn) {
        resumeBtn.disabled = false;
        resumeBtn.textContent = 'متابعة قراءة المذكرة';
      }

      const now = Date.now();
      if (reportViolation && !isTeacher() && now - lastPdfReport > 4000) {
        lastPdfReport = now;
        api.reportSecurityViolation({
          violation_type: 'pdf_leak',
          lesson_id: lessonId,
          source_title: lessonTitle,
          details: reasonText
        }).catch(() => {});
      }
    };

    const clearBlackout = (e) => {
      e?.stopPropagation?.();
      if (pdfIframe) {
        pdfIframe.style.visibility = 'visible';
        pdfIframe.style.opacity = '1';
      }
      if (shield) shield.style.display = 'none';
    };

    resumeBtn?.addEventListener('click', clearBlackout);
    shield?.addEventListener('click', clearBlackout);

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        closeViewer();
        return;
      }
      // Only trigger on actual screenshot/print/devtools shortcuts (never on lone Win/Meta key press or Fullscreen!)
      if (
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.key === 'F12' ||
        (e.metaKey && e.shiftKey && ['s', 'S', '3', '4', '5'].includes(e.key)) ||
        (e.ctrlKey && e.shiftKey && ['i', 'I', 'c', 'C', 'j', 'J', 's', 'S'].includes(e.key)) ||
        (e.ctrlKey && ['p', 'P', 's', 'S', 'u', 'U'].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerBlackout(true, 'محاولة تصوير أو طباعة أو حفظ ملف PDF محمي');
        navigator.clipboard?.writeText?.('').catch(() => {});
        showToast('غير مسموح بطباعة أو تصوير الملفات المحمية', 'warning');
      }
    };

    const onKeyUp = (e) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        triggerBlackout(true, 'محاولة التقاط صورة للمذكرة (PrintScreen)');
        navigator.clipboard?.writeText?.('').catch(() => {});
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);

    const fsBtn = document.getElementById('pdfShieldFullscreenBtn');
    fsBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!document.fullscreenElement) {
        card?.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });

    function closeViewer() {
      clearInterval(wmTimer);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      modal.remove();
    }

    document.getElementById('pdfShieldCloseBtn')?.addEventListener('click', closeViewer);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeViewer();
    });
  } catch (err) {
    showToast(err.message || 'تعذر فتح الملف المحمي', 'error');
  }
}

/**
 * Attaches multi-layered anti-leak protection (dynamic + tiled watermarks,
 * anti-copy/right-click, anti-print/save/screenshot, and focus-loss blur shield)
 * to Homework and Exam containers.
 */
export function attachContentProtectionShield(containerEl) {
  if (!containerEl) return () => {};
  const wmText = getStudentWatermarkText();

  containerEl.classList.add('protected-homework-exam-surface');
  containerEl.setAttribute('oncontextmenu', 'return false;');

  // Inject Tiled + Jumping Watermark Overlay if not already inside
  let overlay = containerEl.querySelector('.homework-watermark-layer');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'homework-watermark-layer';
    overlay.innerHTML = `
      ${buildTiledWatermarkGridHtml(wmText, 16)}
      <div class="video-watermark homework-jumping-wm" style="transition:none !important; z-index:20; pointer-events:none;">
        <span>${esc(wmText)}</span>
      </div>
    `;
    containerEl.style.position = 'relative';
    containerEl.appendChild(overlay);
  }

  const jumpEl = overlay.querySelector('.homework-jumping-wm');
  const moveWm = () => {
    if (!jumpEl) return;
    const top = Math.floor(Math.random() * 72) + 14;
    const left = Math.floor(Math.random() * 64) + 18;
    jumpEl.style.transition = 'none';
    jumpEl.style.top = `${top}%`;
    jumpEl.style.left = `${left}%`;
    jumpEl.style.transform = 'translate(-50%, -50%)';
  };
  moveWm();
  const wmTimer = setInterval(moveWm, 3500);

  const blockEvent = (e) => {
    // Allow typing inside input/textarea for answering fill-in-the-blank or essay questions
    const tag = e.target?.tagName;
    if ((tag === 'INPUT' || tag === 'TEXTAREA') && e.type !== 'contextmenu') return;
    e.preventDefault();
  };

  let lastExamReport = 0;
  const reportExamLeak = (details) => {
    const now = Date.now();
    if (!isTeacher() && now - lastExamReport > 4000) {
      lastExamReport = now;
      api.reportSecurityViolation({
        violation_type: 'exam_leak',
        source_title: document.title || 'اختبار إلكتروني محمي',
        details
      }).catch(() => {});
    }
  };

  const onKeyDown = (e) => {
    if (
      e.key === 'PrintScreen' ||
      e.code === 'PrintScreen' ||
      e.key === 'F12' ||
      (e.metaKey && e.shiftKey && ['s', 'S', '3', '4', '5'].includes(e.key)) ||
      (e.ctrlKey && e.shiftKey && ['i', 'I', 'c', 'C', 'j', 'J', 's', 'S'].includes(e.key)) ||
      (e.ctrlKey && ['p', 'P', 's', 'S', 'u', 'U', 'c', 'C'].includes(e.key))
    ) {
      e.preventDefault();
      e.stopPropagation();
      containerEl.classList.add('shield-blurred');
      navigator.clipboard?.writeText?.('').catch(() => {});
      reportExamLeak('محاولة تصوير أو نسخ أو طباعة أسئلة الامتحان');
      showToast('أسئلة الواجبات والامتحانات محمية ضد النسخ وتصوير الشاشة', 'warning');
      setTimeout(() => containerEl.classList.remove('shield-blurred'), 2500);
    }
  };

  const onKeyUp = (e) => {
    if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
      containerEl.classList.add('shield-blurred');
      navigator.clipboard?.writeText?.('').catch(() => {});
      reportExamLeak('محاولة التقاط شاشة الامتحان (PrintScreen)');
      setTimeout(() => containerEl.classList.remove('shield-blurred'), 2500);
    }
  };

  const onBlur = () => {
    if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      containerEl.classList.add('shield-blurred');
    }
  };
  const onFocus = () => {
    containerEl.classList.remove('shield-blurred');
  };

  containerEl.addEventListener('contextmenu', blockEvent);
  containerEl.addEventListener('copy', blockEvent);
  containerEl.addEventListener('cut', blockEvent);
  containerEl.addEventListener('dragstart', blockEvent);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);

  const cleanup = () => {
    clearInterval(wmTimer);
    containerEl.removeEventListener('contextmenu', blockEvent);
    containerEl.removeEventListener('copy', blockEvent);
    containerEl.removeEventListener('cut', blockEvent);
    containerEl.removeEventListener('dragstart', blockEvent);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
  };

  window.addEventListener('popstate', cleanup, { once: true });
  return cleanup;
}

