import { showModal } from '../components/modal.js';

/**
 * Loads a File, Blob, or DataURL into an HTMLImageElement
 */
function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    if (typeof src === 'string') {
      img.src = src;
    } else {
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result; };
      reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
      reader.readAsDataURL(src);
    }
  });
}

/**
 * Exports a canvas to WebP DataURL (with JPEG fallback for older browsers)
 */
function canvasToCompressedDataUrl(canvas, quality = 0.84) {
  let dataUrl = canvas.toDataURL('image/webp', quality);
  if (!dataUrl || !dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

/**
 * Compresses any image File/Blob/DataURL in the browser to WebP/JPEG
 * Reduces bandwidth usage by ~75% for exams, payment receipts, and course covers.
 */
export async function compressImageFile(fileOrDataUrl, { maxWidth = 1280, maxHeight = 1280, quality = 0.82 } = {}) {
  const img = await loadImageElement(fileOrDataUrl);
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  return canvasToCompressedDataUrl(canvas, quality);
}

/**
 * Converts a DataURL to a File object so it can also be sent via FormData to /api/upload
 */
export function dataUrlToFile(dataUrl, baseName = 'compressed_image') {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/webp';
  const ext = mime === 'image/webp' ? '.webp' : mime === 'image/png' ? '.png' : '.jpg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], `${baseName}${ext}`, { type: mime });
}

/**
 * Interactive Image Cropper & Resizer Modal for Course Thumbnails
 * Lets the teacher pan, zoom, align top/center, or fit the entire image without cutting off heads.
 */
export async function openImageCropperModal(file, { targetWidth = 960, targetHeight = 600 } = {}) {
  const img = await loadImageElement(file);

  return new Promise((resolve) => {
    const modalHtml = `
      <div style="text-align:right;">
        <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:10px;">
          اسحب الصورة بالماوس أو الإصبع لضبط الكادر تماماً كما سيظهر في كارت الكورس، أو اختر وضع الاحتواء الكامل:
        </p>

        <div style="position:relative; width:100%; max-width:480px; margin:0 auto 14px; border-radius:16px; overflow:hidden; border:2px solid var(--primary); background:#064e3b; box-shadow:0 8px 24px rgba(0,0,0,0.18);">
          <canvas id="cropperPreviewCanvas" width="${targetWidth}" height="${targetHeight}" style="width:100%; height:auto; display:block; cursor:grab; touch-action:none;"></canvas>
          <div style="position:absolute; bottom:8px; left:8px; background:rgba(0,0,0,0.65); color:#fff; font-size:0.72rem; padding:4px 10px; border-radius:99px; pointer-events:none; display:flex; align-items:center; gap:4px;">
            <span class="material-symbols-rounded" style="font-size:0.95rem;">pan_tool</span> اسحب لتحريك الكادر
          </div>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
          <button type="button" class="btn btn-secondary btn-sm" id="cropAlignTopBtn" style="flex:1; font-size:0.78rem; gap:4px;">
            <span class="material-symbols-rounded" style="font-size:1rem;">vertical_align_top</span> محاذاة للأعلى (إظهار الوجه)
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="cropAlignCenterBtn" style="flex:1; font-size:0.78rem; gap:4px;">
            <span class="material-symbols-rounded" style="font-size:1rem;">vertical_align_center</span> توسيط الكادر
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="cropFitAllBtn" style="flex:1; font-size:0.78rem; gap:4px;">
            <span class="material-symbols-rounded" style="font-size:1rem;">fit_screen</span> احتواء كامل بدون قص
          </button>
        </div>

        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; background:var(--bg-secondary); padding:10px 14px; border-radius:12px;">
          <span class="material-symbols-rounded" style="color:var(--primary);">zoom_in</span>
          <label style="font-size:0.82rem; font-weight:700; white-space:nowrap;">التكبير والتصغير:</label>
          <input type="range" id="cropZoomSlider" min="0.5" max="2.5" step="0.02" value="1" style="flex:1; accent-color:var(--primary);">
        </div>

        <div style="display:flex; gap:10px;">
          <button type="button" class="btn btn-primary" id="confirmCropBtn" style="flex:2; justify-content:center; gap:6px; font-weight:800;">
            <span class="material-symbols-rounded">check_circle</span> اعتماد وحفظ الصورة
          </button>
          <button type="button" class="btn btn-ghost" id="cancelCropBtn" style="flex:1; justify-content:center;">
            إلغاء
          </button>
        </div>
      </div>
    `;

    const { overlay, close } = showModal('ضبط وقص صورة غلاف الكورس', modalHtml);
    const canvas = overlay.querySelector('#cropperPreviewCanvas');
    const ctx = canvas.getContext('2d');
    const zoomSlider = overlay.querySelector('#cropZoomSlider');

    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;

    // Cover scale vs Fit scale
    const coverScale = Math.max(targetWidth / imgW, targetHeight / imgH);
    const fitScale = Math.min(targetWidth / imgW, targetHeight / imgH);

    let currentBaseScale = coverScale;
    let zoom = 1;
    // Default to top-center alignment so faces/heads are never cropped!
    let offsetX = (targetWidth - imgW * currentBaseScale) / 2;
    let offsetY = 0;

    const renderFrame = () => {
      ctx.clearRect(0, 0, targetWidth, targetHeight);
      // Draw blurred dark emerald background for "fit" mode
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();
      ctx.filter = 'blur(18px) brightness(0.45)';
      ctx.drawImage(
        img,
        (targetWidth - imgW * coverScale * 1.1) / 2,
        (targetHeight - imgH * coverScale * 1.1) / 2,
        imgW * coverScale * 1.1,
        imgH * coverScale * 1.1
      );
      ctx.restore();

      const drawW = imgW * currentBaseScale * zoom;
      const drawH = imgH * currentBaseScale * zoom;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    };

    renderFrame();

    // Drag / Pan logic (Mouse + Touch)
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const getPointerPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = targetWidth / rect.width;
      const scaleY = targetHeight / rect.height;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const onDown = (e) => {
      isDragging = true;
      canvas.style.cursor = 'grabbing';
      const pos = getPointerPos(e);
      startX = pos.x - offsetX;
      startY = pos.y - offsetY;
    };

    const onMove = (e) => {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();
      const pos = getPointerPos(e);
      offsetX = pos.x - startX;
      offsetY = pos.y - startY;
      renderFrame();
    };

    const onUp = () => {
      isDragging = false;
      canvas.style.cursor = 'grab';
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp);

    zoomSlider.addEventListener('input', () => {
      const nextZoom = parseFloat(zoomSlider.value) || 1;
      // Zoom around center of canvas
      const prevW = imgW * currentBaseScale * zoom;
      const prevH = imgH * currentBaseScale * zoom;
      const nextW = imgW * currentBaseScale * nextZoom;
      const nextH = imgH * currentBaseScale * nextZoom;
      offsetX -= (nextW - prevW) / 2;
      offsetY -= (nextH - prevH) / 2;
      zoom = nextZoom;
      renderFrame();
    });

    overlay.querySelector('#cropAlignTopBtn')?.addEventListener('click', () => {
      currentBaseScale = coverScale;
      zoom = 1;
      zoomSlider.value = '1';
      offsetX = (targetWidth - imgW * currentBaseScale) / 2;
      offsetY = 0; // Top aligned so head is fully visible
      renderFrame();
    });

    overlay.querySelector('#cropAlignCenterBtn')?.addEventListener('click', () => {
      currentBaseScale = coverScale;
      zoom = 1;
      zoomSlider.value = '1';
      offsetX = (targetWidth - imgW * currentBaseScale) / 2;
      offsetY = (targetHeight - imgH * currentBaseScale) / 2;
      renderFrame();
    });

    overlay.querySelector('#cropFitAllBtn')?.addEventListener('click', () => {
      currentBaseScale = fitScale;
      zoom = 1;
      zoomSlider.value = '1';
      offsetX = (targetWidth - imgW * currentBaseScale) / 2;
      offsetY = (targetHeight - imgH * currentBaseScale) / 2;
      renderFrame();
    });

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    overlay.querySelector('#confirmCropBtn')?.addEventListener('click', () => {
      cleanup();
      const outDataUrl = canvasToCompressedDataUrl(canvas, 0.85);
      close();
      resolve(outDataUrl);
    });

    overlay.querySelector('#cancelCropBtn')?.addEventListener('click', () => {
      cleanup();
      close();
      resolve(null);
    });
  });
}

