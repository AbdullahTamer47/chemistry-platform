import { calculateMolarMass, THANAVYA_REACTIONS, calculateTitration } from '../utils/chemistryCore.js';

/**
 * Interactive Chemistry Laboratory & Equation Assistant Modal
 * (المختبر الكيميائي التفاعلي ومساعد المعادلات وحسابات المعايرة)
 */
export function openChemistryLabModal() {
  const existing = document.getElementById('chem-lab-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'chem-lab-modal';
  modal.className = 'chem-lab-overlay';

  modal.innerHTML = `
    <div class="chem-lab-content animate-scale">
      <div class="chem-lab-header">
        <div class="chem-lab-title">
          <span class="chem-lab-icon">⚗️</span>
          <div>
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #10b981;">المختبر الكيميائي ومساعد المعادلات</h3>
            <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">خاص بطلاب د. زياد رمزي عياد - ثانوية عامة</p>
          </div>
        </div>
        <button id="close-chem-lab" class="chem-lab-close">&times;</button>
      </div>

      <div class="chem-lab-tabs">
        <button class="chem-tab-btn active" data-tab="molar-mass">الكتلة المولية والصيغ 🧪</button>
        <button class="chem-tab-btn" data-tab="reactions-bank">معادلات المنهج الموزونة 📑</button>
        <button class="chem-tab-btn" data-tab="titration-calc">حاسبة المعايرة والمسائل ⚖️</button>
      </div>

      <!-- Tab 1: Molar Mass Calculator -->
      <div id="tab-molar-mass" class="chem-tab-content active">
        <p style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 1rem;">
          اكتب الصيغة الكيميائية (مثال: <code style="color: #38bdf8;">Fe2O3</code> أو <code style="color: #38bdf8;">Ca(OH)2</code> أو <code style="color: #38bdf8;">KMnO4</code>) لحساب الكتلة المولية ونسب العناصر:
        </p>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <input type="text" id="formula-input" placeholder="مثال: Fe2O3" style="flex: 1; padding: 0.75rem 1rem; border-radius: 8px; background: rgba(15,23,42,0.8); border: 1px solid #334155; color: #fff; font-size: 1rem;" value="Fe2O3" />
          <button id="calc-mass-btn" style="padding: 0.75rem 1.5rem; background: #10b981; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">احسب</button>
        </div>
        <div id="molar-mass-result" style="background: rgba(15,23,42,0.6); padding: 1rem; border-radius: 8px; border: 1px solid #1e293b;"></div>
      </div>

      <!-- Tab 2: Reactions Bank -->
      <div id="tab-reactions-bank" class="chem-tab-content" style="display: none;">
        <div style="margin-bottom: 1rem;">
          <input type="text" id="reaction-search" placeholder="ابحث في معادلات الحديد أو العضوية أو التحليل الكيميائي..." style="width: 100%; padding: 0.75rem 1rem; border-radius: 8px; background: rgba(15,23,42,0.8); border: 1px solid #334155; color: #fff; font-size: 0.95rem;" />
        </div>
        <div id="reactions-list" style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem;"></div>
      </div>

      <!-- Tab 3: Titration Calculator -->
      <div id="tab-titration-calc" class="chem-tab-content" style="display: none;">
        <p style="font-size: 0.88rem; color: #94a3b8; margin-bottom: 1rem;">
          قانون المعايرة: <strong style="color: #10b981;">(Ma × Va) / na = (Mb × Vb) / nb</strong>. اترك المتغير المجهول فارغاً وسيتم حسابه تلقائياً:
        </p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div style="background: rgba(30,41,59,0.5); padding: 0.75rem; border-radius: 8px;">
            <h4 style="margin: 0 0 0.5rem 0; color: #f43f5e; font-size: 0.95rem;">بيانات الحمض (Acid)</h4>
            <label style="font-size: 0.8rem; color: #94a3b8;">تركيز الحمض Ma (M):</label>
            <input type="number" step="0.01" id="titr-ma" placeholder="مثال: 0.1" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 6px; background: #0f172a; border: 1px solid #334155; color: #fff;" value="0.1" />
            <label style="font-size: 0.8rem; color: #94a3b8;">حجم الحمض Va (mL):</label>
            <input type="number" step="0.1" id="titr-va" placeholder="مثال: 25" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 6px; background: #0f172a; border: 1px solid #334155; color: #fff;" value="25" />
            <label style="font-size: 0.8rem; color: #94a3b8;">معامل الحمض في المعادلة na:</label>
            <input type="number" id="titr-na" style="width: 100%; padding: 0.5rem; border-radius: 6px; background: #0f172a; border: 1px solid #334155; color: #fff;" value="1" />
          </div>

          <div style="background: rgba(30,41,59,0.5); padding: 0.75rem; border-radius: 8px;">
            <h4 style="margin: 0 0 0.5rem 0; color: #3b82f6; font-size: 0.95rem;">بيانات القاعدة (Base)</h4>
            <label style="font-size: 0.8rem; color: #94a3b8;">تركيز القاعدة Mb (M):</label>
            <input type="number" step="0.01" id="titr-mb" placeholder="اتركه فارغاً للحساب" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 6px; background: #0f172a; border: 1px solid #334155; color: #fff;" />
            <label style="font-size: 0.8rem; color: #94a3b8;">حجم القاعدة Vb (mL):</label>
            <input type="number" step="0.1" id="titr-vb" placeholder="مثال: 20" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 6px; background: #0f172a; border: 1px solid #334155; color: #fff;" value="20" />
            <label style="font-size: 0.8rem; color: #94a3b8;">معامل القاعدة في المعادلة nb:</label>
            <input type="number" id="titr-nb" style="width: 100%; padding: 0.5rem; border-radius: 6px; background: #0f172a; border: 1px solid #334155; color: #fff;" value="1" />
          </div>
        </div>
        <button id="calc-titr-btn" style="width: 100%; padding: 0.75rem; background: #3b82f6; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 1rem;">حساب المتغير المجهول</button>
        <div id="titr-result" style="margin-top: 1rem; display: none; background: rgba(16,185,129,0.1); border: 1px solid #10b981; padding: 1rem; border-radius: 8px; text-align: center;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  modal.querySelector('#close-chem-lab').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Tab switching
  const tabBtns = modal.querySelectorAll('.chem-tab-btn');
  const tabContents = modal.querySelectorAll('.chem-tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
      });

      btn.classList.add('active');
      const target = modal.querySelector(`#tab-${btn.dataset.tab}`);
      if (target) {
        target.classList.add('active');
        target.style.display = 'block';
      }
    });
  });

  // Tab 1 Logic: Molar Mass
  const formulaInput = modal.querySelector('#formula-input');
  const molarMassResult = modal.querySelector('#molar-mass-result');
  const calcMassBtn = modal.querySelector('#calc-mass-btn');

  function renderMolarMass() {
    const val = formulaInput.value.trim();
    if (!val) return;
    const res = calculateMolarMass(val);
    molarMassResult.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
        <span style="font-size: 1.1rem; font-weight: 700; color: #fff;">الصيغة: <strong style="color: #38bdf8;">${res.formula}</strong></span>
        <span style="font-size: 1.2rem; font-weight: 800; color: #10b981;">الكتلة المولية: ${res.molarMass} جم/مول</span>
      </div>
      <div style="font-size: 0.85rem; color: #cbd5e1;">
        <strong>تفاصيل الكتل الذرية للعناصر:</strong>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
          ${res.breakdown.map(b => `
            <div style="background: rgba(30,41,59,0.8); border: 1px solid #475569; padding: 0.35rem 0.65rem; border-radius: 6px;">
              <span style="color: #fbbf24; font-weight: 700;">${b.element}</span>: ${b.count} × ${b.atomicMass} = <strong>${b.subtotal}</strong> جم
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  calcMassBtn.addEventListener('click', renderMolarMass);
  formulaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') renderMolarMass(); });
  renderMolarMass();

  // Tab 2 Logic: Reactions Bank
  const reactionSearch = modal.querySelector('#reaction-search');
  const reactionsList = modal.querySelector('#reactions-list');

  function renderReactions(filter = '') {
    const q = filter.toLowerCase().trim();
    const filtered = THANAVYA_REACTIONS.filter(r => 
      !q || r.title.toLowerCase().includes(q) || r.balanced.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
    );

    reactionsList.innerHTML = filtered.map(r => `
      <div style="background: rgba(15,23,42,0.8); border: 1px solid #334155; border-radius: 8px; padding: 0.85rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
          <span style="font-size: 0.75rem; background: rgba(56,189,248,0.1); color: #38bdf8; border: 1px solid rgba(56,189,248,0.25); padding: 0.2rem 0.5rem; border-radius: 4px;">${r.category}</span>
          <span style="font-size: 0.75rem; color: #f59e0b; background: rgba(245,158,11,0.1); padding: 0.2rem 0.5rem; border-radius: 4px;">شروط التفاعل: ${r.conditions}</span>
        </div>
        <h4 style="margin: 0.35rem 0; font-size: 0.95rem; color: #fff;">${r.title}</h4>
        <div style="background: #0f172a; padding: 0.5rem 0.75rem; border-radius: 6px; font-family: monospace; font-size: 1.05rem; font-weight: 700; color: #10b981; direction: ltr; text-align: center; margin: 0.5rem 0; letter-spacing: 1px;">
          ${r.balanced}
        </div>
        <div style="font-size: 0.82rem; color: #94a3b8; display: flex; flex-direction: column; gap: 0.2rem;">
          <span>👁️ <strong>الملاحظة والمشاهدة:</strong> ${r.colorChange}</span>
          <span>💡 <strong>ملاحظة فنية:</strong> ${r.notes}</span>
        </div>
      </div>
    `).join('');
  }

  reactionSearch.addEventListener('input', (e) => renderReactions(e.target.value));
  renderReactions();

  // Tab 3 Logic: Titration
  const calcTitrBtn = modal.querySelector('#calc-titr-btn');
  const titrResult = modal.querySelector('#titr-result');

  calcTitrBtn.addEventListener('click', () => {
    const Ma = modal.querySelector('#titr-ma').value;
    const Va = modal.querySelector('#titr-va').value;
    const na = modal.querySelector('#titr-na').value;
    const Mb = modal.querySelector('#titr-mb').value;
    const Vb = modal.querySelector('#titr-vb').value;
    const nb = modal.querySelector('#titr-nb').value;

    const res = calculateTitration({ Ma, Va, na, Mb, Vb, nb });
    if (res) {
      titrResult.style.display = 'block';
      titrResult.innerHTML = `
        <h4 style="margin: 0 0 0.35rem 0; color: #10b981; font-size: 1rem;">تم الحساب بنجاح ✅</h4>
        <div style="font-size: 1.25rem; font-weight: 800; color: #fff;">
          ${res.label} = <span style="color: #38bdf8;">${res.value}</span> ${res.unit}
        </div>
      `;
    } else {
      titrResult.style.display = 'block';
      titrResult.style.borderColor = '#f43f5e';
      titrResult.style.background = 'rgba(244,63,94,0.1)';
      titrResult.innerHTML = `<span style="color: #f43f5e;">يرجى ترك خانة واحدة فقط فارغة ليتم حسابها!</span>`;
    }
  });
}
