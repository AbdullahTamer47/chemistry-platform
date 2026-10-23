import { renderNavbar, initNavbar } from '../components/navbar.js';
import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderCertificates() {
  return `
    <div class="app-layout">
      ${renderNavbar('certificates')}
      <main class="main-content">
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
          <div>
            <h1 class="page-title"><span class="material-symbols-rounded" style="color:var(--warning)">workspace_premium</span> شهادات التقدير والتفوق المعتمدة</h1>
            <p class="page-subtitle">شهادات إلكترونية رسمية موثقة ومعتمدة من د. زياد رمزي عياد للطلاب المتفوقين</p>
          </div>
          <a href="#/my-results" class="btn btn-outline" style="gap:6px;">
            <span class="material-symbols-rounded">insights</span> تحليلات درجاتي
          </a>
        </div>

        <!-- CERTIFICATE TIERS INTRO -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;margin-bottom:28px;">
          <div class="card" style="padding:16px;border:1px solid #f59e0b;background:linear-gradient(145deg, rgba(245,158,11,0.08), rgba(217,119,6,0.03));display:flex;align-items:center;gap:12px;">
            <div style="font-size:2rem;">🥇</div>
            <div>
              <strong style="color:#f59e0b;font-size:0.95rem;">الشهادة الذهبية (Gold)</strong>
              <div style="font-size:0.78rem;color:var(--text-secondary);">للطلاب الحاصلين على 100% (الدرجة النهائية)</div>
            </div>
          </div>
          <div class="card" style="padding:16px;border:1px solid #94a3b8;background:linear-gradient(145deg, rgba(148,163,184,0.08), rgba(100,116,139,0.03));display:flex;align-items:center;gap:12px;">
            <div style="font-size:2rem;">🥈</div>
            <div>
              <strong style="color:#94a3b8;font-size:0.95rem;">الشهادة الفضية (Silver)</strong>
              <div style="font-size:0.78rem;color:var(--text-secondary);">للمتفوقين الحاصلين على 90% فأكثر</div>
            </div>
          </div>
          <div class="card" style="padding:16px;border:1px solid #b45309;background:linear-gradient(145deg, rgba(180,83,9,0.08), rgba(146,64,14,0.03));display:flex;align-items:center;gap:12px;">
            <div style="font-size:2rem;">🥉</div>
            <div>
              <strong style="color:#b45309;font-size:0.95rem;">الشهادة البرونزية (Bronze)</strong>
              <div style="font-size:0.78rem;color:var(--text-secondary);">لاجتياز الاختبارات المنهجية بنجاح</div>
            </div>
          </div>
        </div>

        <div id="certificatesContainer">
          <div class="loading-spinner"><div class="spinner"></div></div>
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
          <div style="font-size:4.5rem;margin-bottom:12px;">🏆</div>
          <h3 style="font-size:1.3rem;font-weight:800;margin-bottom:8px;">لم تكتسب أي شهادة تقدير حتى الآن</h3>
          <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:24px;line-height:1.6;">
            اجتز أي اختبار منهجي بنسبة 60% أو أكثر، وسيتم إصدار شهادة تقدير معتمدة باسمك فوراً وتوثيقها بكود رسمي وتوقيع د. زياد رمزي عياد!
          </p>
          <a href="#/exams" class="btn btn-primary" style="padding:12px 28px;font-weight:800;gap:8px;">
            <span class="material-symbols-rounded">assignment</span> خوض امتحان الآن للحصول على شهادة
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(420px, 1fr));gap:24px;">
        ${certs.map((c, idx) => {
          const isGold = c.tier === 'gold';
          const isSilver = c.tier === 'silver';
          const medal = isGold ? '🥇' : isSilver ? '🥈' : '🥉';
          const tierName = isGold ? 'الوسام الذهبي - الدرجة الكاملة' : isSilver ? 'الوسام الفضي - المتفوقين' : 'وسام الاجتياز والتميز';
          const borderColor = isGold ? '#f59e0b' : isSilver ? '#94a3b8' : '#b45309';

          return `
            <div class="card certificate-card" style="padding:0;border:2px solid ${borderColor};overflow:hidden;border-radius:16px;background:var(--bg-primary);box-shadow:0 10px 28px rgba(0,0,0,0.15);">
              
              <!-- CERTIFICATE CANVAS RENDER -->
              <div id="cert_box_${c.id}" style="padding:32px 24px;text-align:center;position:relative;background:radial-gradient(circle at center, rgba(245,158,11,0.05), transparent 70%);border-bottom:1px solid var(--border-light);">
                
                <!-- Ornamental Header -->
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                  <div style="font-size:0.75rem;font-weight:900;letter-spacing:1px;color:var(--text-muted);" dir="ltr">${c.cert_code}</div>
                  <div style="font-size:1.8rem;">${medal}</div>
                  <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);">${new Date(c.issued_at).toLocaleDateString('ar-EG')}</div>
                </div>

                <div style="font-size:0.85rem;font-weight:800;color:${borderColor};letter-spacing:1px;margin-bottom:4px;">
                  منصة كيمياوي للتعليم الثانوي
                </div>
                <h2 style="font-size:1.4rem;font-weight:900;color:var(--text-primary);margin:0 0 14px 0;">
                  شهـــــادة تقـــــدير وتفـــــوّق
                </h2>

                <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">
                  تشهد إدارة المنصة والأستاذ الدكتور زياد رمزي عياد بأن الطالب/ـة:
                </p>

                <div style="font-size:1.45rem;font-weight:900;color:var(--primary);margin:10px 0;padding:6px 12px;display:inline-block;border-bottom:2px solid ${borderColor};">
                  ${esc(c.student_name)}
                </div>

                <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.6;margin:12px auto;max-width:380px;">
                  قد اجتاز بنجاح وتفوق اختبار: <strong>"${esc(c.exam_title)}"</strong><br>
                  بنسبة نجاح معتمدة قدرها: <strong style="color:var(--success);font-size:1.15rem;">${c.percentage}%</strong> (${c.score} من ${c.total_points})
                </p>

                <div style="margin-top:16px;display:inline-block;padding:4px 14px;background:rgba(245,158,11,0.12);border:1px solid ${borderColor};border-radius:20px;font-size:0.78rem;font-weight:800;color:${borderColor};">
                  ${tierName}
                </div>

                <!-- Footer Signatures -->
                <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:28px;padding-top:16px;border-top:1px dashed var(--border-light);">
                  <div style="text-align:right;">
                    <div style="font-size:0.75rem;color:var(--text-muted);">التوقيع والاعتماد:</div>
                    <div style="font-weight:900;color:var(--text-primary);font-size:0.92rem;margin-top:2px;">أ/ زياد رمزي عياد</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">خبير ومعد الكيمياء للثانوية العامة</div>
                  </div>
                  
                  <!-- Verified Platform Stamp -->
                  <div style="width:64px;height:64px;border:2px dashed ${borderColor};border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:${borderColor};transform:rotate(-12deg);">
                    <span class="material-symbols-rounded" style="font-size:1.3rem;">verified</span>
                    <span style="font-size:0.55rem;font-weight:900;">معتمد رسمي</span>
                  </div>
                </div>

              </div>

              <!-- ACTION BUTTONS -->
              <div style="padding:14px 20px;background:var(--bg-secondary);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                <button type="button" class="btn btn-outline btn-sm print-cert-btn" data-cert-id="${c.id}" style="gap:6px;">
                  <span class="material-symbols-rounded">print</span> طباعة الشهادة
                </button>
                <a href="https://wa.me/?text=${encodeURIComponent(`حصلت بحمد الله على شهادة تفوق معتمدة من د. زياد رمزي عياد في الكيمياء بنسبة ${c.percentage}%! 🎓 كود التحقق: ${c.cert_code}`)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="gap:6px;background:#25D366;border-color:#25D366;color:#fff;">
                  <span class="material-symbols-rounded">share</span> مشاركة على واتساب
                </a>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    // Bind Print buttons
    document.querySelectorAll('.print-cert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const certId = btn.dataset.certId;
        const box = document.getElementById(`cert_box_${certId}`);
        if (!box) return;

        const printWindow = window.open('', '_blank', 'width=800,height=700');
        printWindow.document.write(`
          <html dir="rtl" lang="ar">
            <head>
              <title>شهادة تقدير معتمدة - د. زياد رمزي عياد</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
                body { font-family: 'Cairo', sans-serif; margin: 40px; text-align: center; color: #1e293b; }
                .cert-box { border: 4px double #f59e0b; padding: 40px 30px; border-radius: 12px; background: #fff; }
              </style>
            </head>
            <body>
              <div class="cert-box">${box.innerHTML}</div>
              <script>window.onload = function() { window.print(); window.close(); }<\/script>
            </body>
          </html>
        `);
        printWindow.document.close();
      });
    });

  } catch (err) {
    container.innerHTML = `<p style="color:var(--error);text-align:center;padding:30px;">حدث خطأ في تحميل الشهادات: ${err.message}</p>`;
  }
}
