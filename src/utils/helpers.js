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
  'أولى إعدادي',
  'ثانية إعدادي',
  'ثالثة إعدادي',
  'أولى ثانوي',
  'ثانية ثانوي',
  'ثالثة ثانوي',
];

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


