export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatFullArabicDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function getShortGradeBadge(grade) {
  const g = String(grade || '');
  if (g.includes('ثالث') && g.includes('ثانوي')) return '٣ ث';
  if (g.includes('ثاني') && g.includes('ثانوي')) return '٢ ث';
  if (g.includes('أول') && g.includes('ثانوي')) return '١ ث';
  if (g.includes('ثالث') && g.includes('إعدادي')) return '٣ ع';
  if (g.includes('ثاني') && g.includes('إعدادي')) return '٢ ع';
  if (g.includes('أول') && g.includes('إعدادي')) return '١ ع';
  if (g.includes('سادس') && g.includes('ابتدائي')) return '٦ ب';
  if (g.includes('خامس') && g.includes('ابتدائي')) return '٥ ب';
  if (g.includes('رابع') && g.includes('ابتدائي')) return '٤ ب';
  return g || 'عام';
}

export function getShortStudentName(name) {
  if (!name) return 'طالب';
  return String(name).trim().split(/\s+/).slice(0, 2).join(' ');
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

export function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff/60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff/3600)} ساعة`;
  if (diff < 604800) return `منذ ${Math.floor(diff/86400)} يوم`;
  return formatDate(dateStr);
}

export function getGradeColor(grade) {
  if (!grade) return 'var(--text-muted)';
  if (grade.includes('ثانوي')) return 'var(--primary)';
  if (grade.includes('إعدادي')) return 'var(--accent)';
  if (grade.includes('ابتدائي')) return 'var(--info)';
  return 'var(--text-muted)';
}

export function getInitials(name) {
  if (!name) return '?';
  return esc(String(name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join(''));
}

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

/** Escape any value for safe use inside HTML text OR quoted attribute values. */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"'`]/g, c => ESC_MAP[c]);
}

/** Kept for backwards compatibility: same as esc(). */
export function sanitize(str) {
  return esc(str);
}

/**
 * For teacher-authored question text: escapes everything, then restores a tiny
 * whitelist of formatting tags used for chemistry formulas (H<sub>2</sub>O, x<sup>2</sup>).
 */
export function escRich(v) {
  return esc(v).replace(/&lt;(\/?)(sub|sup|b|i|strong|em)&gt;/gi, '<$1$2>').replace(/&lt;br\s*\/?&gt;/gi, '<br>');
}

/** Only allow http(s)/relative URLs in href/src; anything else (javascript:, data:) becomes '#'. */
export function safeUrl(u) {
  const s = String(u ?? '').trim();
  if (/^(https?:\/\/|\/(?!\/)|#\/)/i.test(s)) return esc(s);
  return '#';
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export const gradesList = [
  'رابعة ابتدائي',
  'خامسة ابتدائي',
  'سادسة ابتدائي',
  'أولى إعدادي',
  'ثانية إعدادي',
  'ثالثة إعدادي',
  'أولى ثانوي',
  'ثانية ثانوي',
  'ثالثة ثانوي',
];

export const studyTracksList = ['عام', 'لغات'];

export function getCourseGrades(course) {
  if (!course) return [];
  const raw = course.target_grades || course.grade || '';
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (_) {}
  }
  const list = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  if (list.length > 0) return list;
  return course.grade ? [course.grade] : [];
}

export function getCourseTracks(course) {
  if (!course) return ['عام', 'لغات'];
  const raw = course.study_tracks || 'عام,لغات';
  if (Array.isArray(raw)) return raw.filter(Boolean);
  const list = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  return list.length > 0 ? list : ['عام', 'لغات'];
}

export function courseMatchesGrade(course, grade) {
  if (!grade) return true;
  if (grade === 'stage:primary') {
    return getCourseGrades(course).some(g => g.includes('ابتدائي'));
  }
  if (grade === 'stage:prep') {
    return getCourseGrades(course).some(g => g.includes('إعدادي'));
  }
  if (grade === 'stage:secondary') {
    return getCourseGrades(course).some(g => g.includes('ثانوي'));
  }
  return getCourseGrades(course).includes(grade) || course?.grade === grade;
}

export function courseMatchesTrack(course, track) {
  if (!track || track === 'all') return true;
  return getCourseTracks(course).includes(track);
}

export function createPaginatedList({ data, containerId, renderList, filterFn, itemsPerPage = 10, searchPlaceholder = 'بحث...', onRender }) {
  let currentPage = 1;
  let currentSearch = '';
  const container = document.getElementById(containerId);
  
  container.innerHTML = `
    <div style="margin-bottom:16px;display:flex;gap:12px;align-items:center">
      <div class="search-box" style="flex:1;position:relative">
        <span class="material-symbols-rounded" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--text-muted)">search</span>
        <input type="text" class="form-input" id="search_${containerId}" placeholder="${searchPlaceholder}" style="padding-right:36px">
      </div>
    </div>
    <div id="list_${containerId}"></div>
    <div id="pagination_${containerId}" style="display:flex;justify-content:center;gap:8px;margin-top:16px;align-items:center"></div>
  `;

  const listContainer = document.getElementById(`list_${containerId}`);
  const paginationContainer = document.getElementById(`pagination_${containerId}`);
  const searchInput = document.getElementById(`search_${containerId}`);

  function render() {
    const filtered = data.filter(item => filterFn(item, currentSearch.toLowerCase()));
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    
    const start = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);
    
    listContainer.innerHTML = renderList(paginated, filtered.length);
    
    if (totalPages > 1) {
      paginationContainer.innerHTML = `
        <button class="btn btn-ghost btn-sm" id="prev_${containerId}" ${currentPage === 1 ? 'disabled' : ''}>السابق</button>
        <span style="font-size:0.9rem;font-weight:600;min-width:100px;text-align:center">صفحة ${currentPage} من ${totalPages}</span>
        <button class="btn btn-ghost btn-sm" id="next_${containerId}" ${currentPage === totalPages ? 'disabled' : ''}>التالي</button>
      `;
      document.getElementById(`prev_${containerId}`)?.addEventListener('click', () => { currentPage--; render(); });
      document.getElementById(`next_${containerId}`)?.addEventListener('click', () => { currentPage++; render(); });
    } else {
      paginationContainer.innerHTML = '';
    }
    
    if (onRender) onRender(paginated);
  }

  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    currentPage = 1;
    render();
  });

  render();
}

export function formatCurrency(amount) {
  return `${amount} جنيه`;
}

/** Normalize an Egyptian phone number into international WhatsApp digits (201XXXXXXXXX). */
export function formatWhatsAppPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('20')) return digits;
  return `20${digits.replace(/^0+/, '')}`;
}

/**
 * Extracts a Google Drive File ID from any Drive sharing/preview/uc/thumbnail URL
 */
export function extractGoogleDriveId(url) {
  const s = String(url ?? '').trim();
  if (!s) return null;
  if (!/drive\.google\.com|docs\.google\.com|googleusercontent\.com/i.test(s)) return null;
  const fileMatch = s.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch) return fileMatch[1];
  const dMatch = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (dMatch) return dMatch[1];
  const idMatch = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch) return idMatch[1];
  return null;
}

/**
 * Converts Google Drive sharing links or relative paths into a direct renderable image URL
 * routed through our server-side caching proxy (/api/upload/gdrive/:fileId) to bypass ORB/CORP blocks.
 */
export function normalizeImageUrl(url) {
  const s = String(url ?? '').trim();
  if (!s) return '';
  if (s.startsWith('data:image/')) return s;
  if (s.startsWith('/api/upload/gdrive/')) return s;
  const driveId = extractGoogleDriveId(s);
  if (driveId) {
    return `/api/upload/gdrive/${driveId}`;
  }
  return s;
}

/**
 * Generates a clean SVG Data URI cover for a course when no custom thumbnail is uploaded,
 * avoiding any old/unrelated fallback photos.
 */
export function generateCourseFallbackSvg(course = {}) {
  const grade = String(course.grade || 'الثانوية العامة').replace(/[<>&"']/g, '');
  const title = String(course.title || 'كورس الكيمياء').slice(0, 38).replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" width="960" height="600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="55%" stop-color="#047857"/>
        <stop offset="100%" stop-color="#0B1F3A"/>
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="960" height="600" fill="url(#bg)"/>
    <rect width="960" height="600" fill="url(#grid)"/>
    <circle cx="150" cy="120" r="180" fill="rgba(16,185,129,0.14)"/>
    <circle cx="820" cy="480" r="220" fill="rgba(15,181,174,0.15)"/>
    <g transform="translate(480, 225)" fill="none" stroke="#34d399" stroke-width="4">
      <polygon points="0,-70 60,-35 60,35 0,70 -60,35 -60,-35" fill="rgba(6,78,59,0.55)"/>
      <polygon points="0,-48 41,-24 41,24 0,48 -41,24 -41,-24" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
      <circle cx="0" cy="-70" r="6" fill="#E0A526" stroke="none"/>
      <circle cx="60" cy="-35" r="6" fill="#34d399" stroke="none"/>
      <circle cx="60" cy="35" r="6" fill="#34d399" stroke="none"/>
      <circle cx="0" cy="70" r="6" fill="#0FB5AE" stroke="none"/>
      <circle cx="-60" cy="35" r="6" fill="#34d399" stroke="none"/>
      <circle cx="-60" cy="-35" r="6" fill="#34d399" stroke="none"/>
    </g>
    <text x="480" y="236" text-anchor="middle" fill="#ffffff" font-family="Cairo, sans-serif" font-weight="900" font-size="30">H₂SO₄</text>
    <rect x="370" y="330" width="220" height="38" rx="19" fill="rgba(224,165,38,0.2)" stroke="#E0A526" stroke-width="1.5"/>
    <text x="480" y="355" text-anchor="middle" fill="#fcd34d" font-family="Cairo, sans-serif" font-weight="800" font-size="20">${grade}</text>
    <text x="480" y="425" text-anchor="middle" fill="#ffffff" font-family="Cairo, sans-serif" font-weight="900" font-size="34">${title}</text>
    <text x="480" y="475" text-anchor="middle" fill="#a7f3d0" font-family="Cairo, sans-serif" font-weight="700" font-size="22">منصة كيمياوي — د. زياد رمزي عياد</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}



