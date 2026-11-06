import { esc } from '../utils/helpers.js';
import { renderNavbar, initNavbar } from '../components/navbar.js';
import { renderBrandErrorIllustration, renderBrandLoader } from '../components/bedigitalBrand.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

function generateCertificateImage(cert) {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');

  const isGold = cert.tier === 'gold';
  const isSilver = cert.tier === 'silver';
  const accentColor = isGold ? '#d97706' : isSilver ? '#475569' : '#059669';
  const primaryEmerald = '#065f46';

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGrad.addColorStop(0, '#f8fafc');
  bgGrad.addColorStop(0.5, '#ffffff');
  bgGrad.addColorStop(1, '#f0fdf4');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle decorative background circles
  ctx.save();
  ctx.fillStyle = 'rgba(5, 150, 105, 0.035)';
  ctx.beginPath();
  ctx.arc(200, 200, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(1200, 760, 280, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Outer Royal Frame
  ctx.strokeStyle = primaryEmerald;
  ctx.lineWidth = 14;
  ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

  // Inner Gold/Accent Frame
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(58, 58, canvas.width - 116, canvas.height - 116);

  // Corner Ornaments
  const corners = [
    [58, 58, 1, 1],
    [canvas.width - 58, 58, -1, 1],
    [58, canvas.height - 58, 1, -1],
    [canvas.width - 58, canvas.height - 58, -1, -1]
  ];
  corners.forEach(([cx, cy, dx, dy]) => {
    ctx.fillStyle = accentColor;
    ctx.fillRect(cx, cy, dx * 45, dy * 8);
    ctx.fillRect(cx, cy, dx * 8, dy * 45);
  });

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  // Top Header Badge
  ctx.fillStyle = primaryEmerald;
  ctx.font = '800 26px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('منصة كيمياوي لتدريس علوم الكيمياء — د. زياد رمزي عياد', canvas.width / 2, 145);

  // Certificate Main Title
  ctx.fillStyle = accentColor;
  ctx.font = '900 58px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('شهـــــادة تقـــــدير وتفـــــوّق علمي', canvas.width / 2, 235);

  // Ornamental divider
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 220, 265);
  ctx.lineTo(canvas.width / 2 + 220, 265);
  ctx.stroke();

  // Subtitle
  ctx.fillStyle = '#334155';
  ctx.font = '700 28px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText('تشهد إدارة منصة كيمياوي والأستاذ الدكتور / زياد رمزي عياد بأن الطالب المتفوق:', canvas.width / 2, 340);

  // Student Name Box
  ctx.fillStyle = 'rgba(5, 150, 105, 0.07)';
  ctx.fillRect(canvas.width / 2 - 420, 375, 840, 95);
  ctx.strokeStyle = primaryEmerald;
  ctx.lineWidth = 2;
  ctx.strokeRect(canvas.width / 2 - 420, 375, 840, 95);

  ctx.fillStyle = primaryEmerald;
  ctx.font = '900 48px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(cert.student_name || 'طالب متفوق', canvas.width / 2, 438);

  // Exam & Achievement Description
  ctx.fillStyle = '#1e293b';
  ctx.font = '700 29px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(`قد اجتاز بتفوق وامتياز تقييم: "${cert.exam_title || 'الاختبار المنهجي'}"`, canvas.width / 2, 545);

  const courseLine = cert.course_title ? `ضمن مقرر: ${cert.course_title} — ` : '';
  ctx.fillStyle = '#059669';
  ctx.font = '900 34px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(`${courseLine}بنسبة نجاح معتمدة: ${cert.percentage}% (${cert.score} من ${cert.total_points})`, canvas.width / 2, 610);

  // Tier Pill
  const tierLabel = isGold ? 'الوسام الذهبي — الدرجة النهائية الكاملة' : isSilver ? 'الوسام الفضي — لوحة الشرف والمتفوقين' : 'وسام التفوق والاجتياز العلمي';
  ctx.fillStyle = accentColor;
  ctx.font = '800 24px "Cairo", "IBM Plex Sans Arabic", sans-serif';
  ctx.fillText(`[ ${tierLabel} ]`, canvas.width / 2, 675);

  // Footer: Right (Signature), Center (Official Stamp), Left (Verification Code & Date)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = '700 20px "Cairo", sans-serif';
  ctx.fillText('إشراف واعتماد أستاذ المادة:', canvas.width - 120, 775);
  ctx.fillStyle = primaryEmerald;
  ctx.font = '900 30px "Cairo", sans-serif';
  ctx.fillText('د. زياد رمزي عياد', canvas.width - 120, 818);
  ctx.fillStyle = '#475569';
  ctx.font = '600 18px "Cairo", sans-serif';
  ctx.fillText('خبير ومعد الكيمياء للمرحلة الثانوية', canvas.width - 120, 850);

  // Center Official Seal
  ctx.save();
  ctx.translate(canvas.width / 2, 810);
  ctx.rotate(-0.12);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 68, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = accentColor;
  ctx.font = '900 20px "Cairo", sans-serif';
  ctx.fillText('معتمد رسمياً', 0, -4);
  ctx.font = '800 15px "Cairo", sans-serif';
  ctx.fillText('KIMYAWY SEAL', 0, 22);
  ctx.restore();

  // Left: Verification Code & Date
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '700 19px "Cairo", monospace';
  ctx.fillText(`CODE: ${cert.cert_code}`, 120, 795);
  const dateStr = cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  ctx.direction = 'rtl';
  ctx.textAlign = 'left';
  ctx.font = '700 20px "Cairo", sans-serif';
  ctx.fillText(`تاريخ الإصدار: ${dateStr}`, 120, 835);

  return canvas.toDataURL('image/png');
}

export function renderCertificates() {
  return `
    <div class="app-layout">
      ${renderNavbar('certificates')}
      <main class="main-content">
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
          <div>
            <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--warning)">workspace_premium</span> شهادات التقدير والتفوق المعتمدة</h1>
            <p class="page-subtitle">شهادات مصورة عالية الجودة موثقة ومعتمدة من د. زياد رمزي عياد للامتحانات المحددة بشهادة داخل كورساتك</p>
          </div>
          <a href="/my-results" class="btn btn-outline" style="gap:6px;">
            <span class="material-symbols-rounded">insights</span> تحليلات درجاتي
          </a>
        </div>

        <div id="certificatesContainer">
          ${renderBrandLoader('جاري تحميل شهادات التقدير...')}
        </div>
      </main>
    </div>
  `;
}

export async function initCertificates() {
  initNavbar();
  const container = document.getElementById('certificatesContainer');
  if (!container) return;

  try {
    const certs = await api.getMyCertificates();

    if (!certs || certs.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:50px 24px;max-width:680px;margin:30px auto;">
          ${renderBrandErrorIllustration('empty')}
          <h3 style="font-size:1.3rem;font-weight:800;margin:12px 0 8px;">لم تحصل على شهادة تقدير حتى الآن</h3>
          <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:24px;line-height:1.6;">
            تُصدر شهادات التقدير المصورة تلقائياً عند اجتياز الامتحانات المحددة بشهادة داخل الكورسات المشترك بها.
          </p>
          <a href="/courses" class="btn btn-primary" style="padding:12px 28px;font-weight:800;gap:8px;">
            <span class="material-symbols-rounded">school</span> تصفح الكورسات والمحاضرات
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(min(100%, 460px), 1fr));gap:24px;">
        ${certs.map((c) => {
          const dataUrl = generateCertificateImage(c);
          return `
            <div class="card certificate-card" style="padding:16px;border:1.5px solid var(--border);border-radius:20px;background:var(--bg-card);box-shadow:var(--shadow-md);">
              <div style="border-radius:14px;overflow:hidden;border:1px solid var(--border-light);background:#fff;margin-bottom:14px;">
                <img src="${dataUrl}" alt="شهادة تقدير ${esc(c.student_name)}" style="width:100%;height:auto;display:block;" />
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                <div>
                  <strong style="font-size:0.95rem;color:var(--text-primary);display:block;">${esc(c.exam_title)}</strong>
                  <span style="font-size:0.78rem;color:var(--text-muted);font-family:monospace;" dir="ltr">${esc(c.cert_code)}</span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <a href="${dataUrl}" download="Kimyawy-Certificate-${esc(c.cert_code)}.png" class="btn btn-primary btn-sm" style="gap:6px;font-weight:800;">
                    <span class="material-symbols-rounded">download</span> تحميل الشهادة كصورة (PNG)
                  </a>
                  <a href="https://wa.me/?text=${encodeURIComponent(`حصلت بحمد الله على شهادة تفوق معتمدة من د. زياد رمزي عياد في الكيمياء (${c.exam_title}) بنسبة ${c.percentage}% — كود التحقق: ${c.cert_code}`)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="gap:6px;">
                    <span class="material-symbols-rounded">share</span> مشاركة
                  </a>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    showToast(err.message, 'error');
    container.innerHTML = `<p style="color:var(--error);text-align:center;padding:30px;">حدث خطأ في تحميل الشهادات: ${esc(err.message)}</p>`;
  }
}
