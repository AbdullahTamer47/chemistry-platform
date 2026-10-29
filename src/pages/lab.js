import { renderNavbar, initNavbar } from '../components/navbar.js';
import { renderPublicHeader, initPublicHeader } from '../components/publicHeader.js';
import { isLoggedIn } from '../utils/auth.js';
import { esc } from '../utils/helpers.js';
import {
  calculateMolarMass,
  balanceChemicalEquation,
  THANAVYA_REACTIONS,
  QUALITATIVE_TESTS,
  FIRST_TRANSITION_SERIES,
  calculateTitration
} from '../utils/chemistryCore.js';

export function renderLab() {
  const logged = isLoggedIn();
  const headerHtml = logged ? renderNavbar('lab') : renderPublicHeader('lab');
  const wrapperClass = logged ? 'app-layout' : 'landing';
  const mainStyle = logged ? '' : 'padding-top: 110px; padding-bottom: 60px; min-height: 85vh;';
  const containerClass = logged ? 'main-content' : 'section-container';

  const categories = ['الكل', ...Array.from(new Set(THANAVYA_REACTIONS.map(r => r.category)))];
  const qualGroups = ['الكل', ...Array.from(new Set(QUALITATIVE_TESTS.map(q => q.group)))];

  return `
    <div class="${wrapperClass}" style="min-height: 100vh;">
      ${headerHtml}
      <main class="${containerClass}" style="${mainStyle}">
        <div class="page-header" style="margin-bottom: 24px;">
          <h1 class="page-title" style="display:flex; align-items:center; gap:10px;">
            <span class="material-symbols-rounded" style="color:var(--primary); font-size:2rem;">science</span>
            المختبر الكيميائي التفاعلي ومساعد المعادلات
          </h1>
          <p class="page-subtitle">موسوعة معادلات المنهج كاملة، موازن المعادلات الفوري، محاكي الكشف الكيفي، وحاسبات الكتلة المولية والمعايرة</p>
        </div>

        <!-- Lab Navigation Tabs (Google Material Icons Only) -->
        <div class="course-bassthalk-tabs" id="labTabs" style="margin-bottom: 24px;">
          <button type="button" class="course-bassthalk-tab-btn active" data-lab-tab="equations-bank">
            <span class="material-symbols-rounded">menu_book</span> بنك معادلات المنهج (${THANAVYA_REACTIONS.length})
          </button>
          <button type="button" class="course-bassthalk-tab-btn" data-lab-tab="equation-balancer">
            <span class="material-symbols-rounded">balance</span> موازن المعادلات الفوري
          </button>
          <button type="button" class="course-bassthalk-tab-btn" data-lab-tab="qualitative-lab">
            <span class="material-symbols-rounded">biotech</span> معمل الكشف الكيفي والكواشف
          </button>
          <button type="button" class="course-bassthalk-tab-btn" data-lab-tab="molar-calc">
            <span class="material-symbols-rounded">calculate</span> الكتلة المولية وعدد المولات
          </button>
          <button type="button" class="course-bassthalk-tab-btn" data-lab-tab="transition-titration">
            <span class="material-symbols-rounded">experiment</span> السلسلة الانتقالية والمعايرة
          </button>
        </div>

        <!-- TAB 1: EQUATIONS BANK -->
        <section id="lab-pane-equations-bank" class="lab-pane">
          <div class="card" style="margin-bottom: 20px;">
            <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between; margin-bottom:16px;">
              <div class="search-wrapper" style="flex:1; min-width:260px;">
                <span class="material-symbols-rounded search-icon">search</span>
                <input type="text" id="eqBankSearch" class="form-input" placeholder="ابحث باسم التفاعل، الصيغة الكيميائية، اللون، أو شروط التفاعل...">
              </div>
              <select id="eqBankCategory" class="form-select" style="max-width:340px;">
                ${categories.map(cat => `<option value="${esc(cat)}">${esc(cat)}</option>`).join('')}
              </select>
            </div>
            <div id="eqBankResults" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap:16px;"></div>
          </div>
        </section>

        <!-- TAB 2: AUTOMATIC EQUATION BALANCER -->
        <section id="lab-pane-equation-balancer" class="lab-pane" style="display:none;">
          <div class="card" style="max-width: 860px; margin: 0 auto;">
            <h3 style="font-size:1.15rem; font-weight:900; margin:0 0 8px; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
              <span class="material-symbols-rounded" style="color:var(--primary);">balance</span>
              موازن المعادلات الكيميائية التلقائي
            </h3>
            <p style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:16px;">
              اكتب المتفاعلات والنواتج مفصولة بعلامة <code dir="ltr">-&gt;</code> أو <code dir="ltr">=</code> وسيقوم المساعد بوزن المعادلة وحساب المعاملات وعدد الذرات فوراً:
            </p>

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
              <input type="text" id="balancerInput" class="form-input" dir="ltr" value="Fe + O2 -> Fe3O4" placeholder="مثال: Fe + H2O -> Fe3O4 + H2" style="flex:1; min-width:240px; font-family:monospace; font-size:1.05rem; font-weight:700;">
              <button type="button" id="balanceBtn" class="btn btn-primary" style="gap:6px; font-weight:800; padding:0 24px;">
                <span class="material-symbols-rounded">auto_fix_high</span> اوزن المعادلة الآن
              </button>
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; align-items:center;">
              <span style="font-size:0.8rem; color:var(--text-muted); font-weight:700;">أمثلة سريعة للتجربة:</span>
              ${[
                'Fe + H2O -> Fe3O4 + H2',
                'Fe2O3 + CO -> Fe + CO2',
                'Al + HCl -> AlCl3 + H2',
                'C2H6 + O2 -> CO2 + H2O',
                'Fe + H2SO4 -> FeSO4 + Fe2(SO4)3 + SO2 + H2O'
              ].map(ex => `<button type="button" class="btn btn-outline btn-sm eq-example-chip" data-eq="${esc(ex)}" dir="ltr" style="font-family:monospace; font-size:0.78rem;">${esc(ex)}</button>`).join('')}
            </div>

            <div id="balancerResult"></div>
          </div>
        </section>

        <!-- TAB 3: QUALITATIVE ANALYSIS SIMULATOR -->
        <section id="lab-pane-qualitative-lab" class="lab-pane" style="display:none;">
          <div class="card">
            <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between; margin-bottom:18px;">
              <div>
                <h3 style="font-size:1.15rem; font-weight:900; margin:0 0 4px; display:flex; align-items:center; gap:8px;">
                  <span class="material-symbols-rounded" style="color:var(--primary);">biotech</span>
                  دليل الكشف الكيفي عن الأنيونات والكاتيونات
                </h3>
                <p style="font-size:0.84rem; color:var(--text-secondary); margin:0;">التجارب الأساسية والتأكيدية وألوان الرواسب والغازات المتصاعدة</p>
              </div>
              <select id="qualGroupFilter" class="form-select" style="max-width:320px;">
                ${qualGroups.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}
              </select>
            </div>
            <div id="qualResultsGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap:16px;"></div>
          </div>
        </section>

        <!-- TAB 4: MOLAR MASS & STOICHIOMETRY CALCULATOR -->
        <section id="lab-pane-molar-calc" class="lab-pane" style="display:none;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap:24px;">
            <div class="card">
              <h3 style="font-size:1.1rem; font-weight:900; margin:0 0 8px; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--primary);">calculate</span>
                حاسبة الكتلة المولية والنسب المئوية للعناصر
              </h3>
              <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:14px;">
                أدخل الصيغة الكيميائية للمركب (مثال: <code dir="ltr">Fe2(SO4)3</code> أو <code dir="ltr">KMnO4</code> أو <code dir="ltr">Ca(OH)2</code>):
              </p>
              <div style="display:flex; gap:10px; margin-bottom:16px;">
                <input type="text" id="molarFormulaInput" class="form-input" dir="ltr" value="Fe2(SO4)3" style="flex:1; font-family:monospace; font-weight:700; font-size:1rem;">
                <button type="button" id="calcMolarBtn" class="btn btn-primary" style="font-weight:800;">احسب الكتلة المولية</button>
              </div>
              <div id="molarCalcResult"></div>
            </div>

            <div class="card">
              <h3 style="font-size:1.1rem; font-weight:900; margin:0 0 8px; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--accent);">scale</span>
                حاسبة عدد المولات والكتلة بالجرام
              </h3>
              <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:14px;">
                احسب عدد المولات <code dir="ltr">n = m / M</code> لأي كتلة معطاة من المركب الحالي:
              </p>
              <div class="form-group">
                <label class="form-label">الكتلة بالجرام (m)</label>
                <input type="number" step="any" id="sampleMassGrams" class="form-input" value="20" dir="ltr">
              </div>
              <button type="button" id="calcMolesBtn" class="btn btn-outline btn-block" style="font-weight:800; margin-bottom:14px;">
                <span class="material-symbols-rounded">functions</span> احسب عدد المولات وعدد الجزيئات
              </button>
              <div id="molesCalcResult"></div>
            </div>
          </div>
        </section>

        <!-- TAB 5: TRANSITION SERIES & TITRATION -->
        <section id="lab-pane-transition-titration" class="lab-pane" style="display:none;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap:24px;">
            <div class="card">
              <h3 style="font-size:1.1rem; font-weight:900; margin:0 0 10px; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--primary);">hub</span>
                مستكشف عناصر السلسلة الانتقالية الأولى (3d)
              </h3>
              <div id="transitionPillsGrid" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px; margin-bottom:16px;">
                ${FIRST_TRANSITION_SERIES.map((el, i) => `
                  <button type="button" class="btn ${i === 5 ? 'btn-primary' : 'btn-outline'} btn-sm trans-el-btn" data-z="${el.z}" style="display:flex; flex-direction:column; padding:8px 4px; gap:2px;">
                    <small style="font-size:0.68rem; opacity:0.8;" dir="ltr">Z=${el.z}</small>
                    <strong style="font-size:1rem;" dir="ltr">${el.symbol}</strong>
                    <span style="font-size:0.72rem;">${el.name}</span>
                  </button>
                `).join('')}
              </div>
              <div id="transitionElementCard"></div>
            </div>

            <div class="card">
              <h3 style="font-size:1.1rem; font-weight:900; margin:0 0 8px; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-rounded" style="color:var(--accent);">science</span>
                حاسبة مسائل المعايرة الكمية
              </h3>
              <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:14px;">
                اترك المتغير المجهول فارغاً لحسابه تلقائياً وفق القانون <code dir="ltr">(Ma × Va) / na = (Mb × Vb) / nb</code>:
              </p>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px;">
                <div style="background:var(--bg-secondary); padding:14px; border-radius:12px; border:1px solid var(--border-light);">
                  <div style="font-weight:800; color:#ef4444; margin-bottom:8px; font-size:0.88rem;">بيانات الحمض (Acid)</div>
                  <div class="form-group"><label class="form-label">تركيز الحمض Ma (M)</label><input type="number" step="any" id="titMa" class="form-input" placeholder="مجهول" dir="ltr"></div>
                  <div class="form-group"><label class="form-label">حجم الحمض Va (mL)</label><input type="number" step="any" id="titVa" class="form-input" value="25" dir="ltr"></div>
                  <div class="form-group" style="margin-bottom:0;"><label class="form-label">عدد المولات na</label><input type="number" step="1" id="titNa" class="form-input" value="1" dir="ltr"></div>
                </div>
                <div style="background:var(--bg-secondary); padding:14px; border-radius:12px; border:1px solid var(--border-light);">
                  <div style="font-weight:800; color:#3b82f6; margin-bottom:8px; font-size:0.88rem;">بيانات القاعدة (Base)</div>
                  <div class="form-group"><label class="form-label">تركيز القاعدة Mb (M)</label><input type="number" step="any" id="titMb" class="form-input" value="0.2" dir="ltr"></div>
                  <div class="form-group"><label class="form-label">حجم القاعدة Vb (mL)</label><input type="number" step="any" id="titVb" class="form-input" value="20" dir="ltr"></div>
                  <div class="form-group" style="margin-bottom:0;"><label class="form-label">عدد المولات nb</label><input type="number" step="1" id="titNb" class="form-input" value="2" dir="ltr"></div>
                </div>
              </div>
              <button type="button" id="runTitrationBtn" class="btn btn-primary btn-block" style="font-weight:800;">
                <span class="material-symbols-rounded">calculate</span> احسب المجهول في المعايرة
              </button>
              <div id="titrationResultBox" style="margin-top:14px;"></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}

export function initLab() {
  if (isLoggedIn()) {
    initNavbar();
  } else {
    initPublicHeader();
  }

  // Tab switching
  const tabBtns = document.querySelectorAll('[data-lab-tab]');
  const panes = ['equations-bank', 'equation-balancer', 'qualitative-lab', 'molar-calc', 'transition-titration'];
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.labTab;
      panes.forEach(p => {
        const el = document.getElementById(`lab-pane-${p}`);
        if (el) el.style.display = p === target ? 'block' : 'none';
      });
    });
  });

  // 1. Equations Bank rendering & filtering
  const eqSearch = document.getElementById('eqBankSearch');
  const eqCat = document.getElementById('eqBankCategory');
  const eqGrid = document.getElementById('eqBankResults');

  function renderEquationsBank() {
    if (!eqGrid) return;
    const q = (eqSearch?.value || '').trim().toLowerCase();
    const cat = eqCat?.value || 'الكل';

    const filtered = THANAVYA_REACTIONS.filter(r => {
      if (cat !== 'الكل' && r.category !== cat) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.balanced.toLowerCase().includes(q) ||
        (r.conditions && r.conditions.toLowerCase().includes(q)) ||
        (r.colorChange && r.colorChange.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    });

    if (filtered.length === 0) {
      eqGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:36px;"><span class="material-symbols-rounded">search_off</span><h3>لا توجد معادلات مطابقة للبحث</h3></div>`;
      return;
    }

    eqGrid.innerHTML = filtered.map(r => `
      <div style="background:var(--bg-secondary); border:1px solid var(--border-light); border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <span class="badge badge-info" style="font-size:0.72rem; font-weight:800;">${esc(r.category)}</span>
          <span class="badge badge-warning" style="font-size:0.72rem; font-weight:700;">${esc(r.conditions)}</span>
        </div>
        <h4 style="margin:0; font-size:0.98rem; font-weight:800; color:var(--text-primary);">${esc(r.title)}</h4>
        <div dir="ltr" style="background:#0f172a; color:#34d399; padding:12px 14px; border-radius:10px; font-family:monospace; font-size:1rem; font-weight:800; text-align:center; letter-spacing:0.5px;">
          ${esc(r.balanced)}
        </div>
        <div style="font-size:0.82rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px;">
          <div><strong style="color:var(--primary);">المشاهدة والناتج:</strong> ${esc(r.colorChange)}</div>
          <div><strong style="color:var(--text-primary);">ملاحظة هامة:</strong> ${esc(r.notes)}</div>
        </div>
      </div>
    `).join('');
  }

  eqSearch?.addEventListener('input', renderEquationsBank);
  eqCat?.addEventListener('change', renderEquationsBank);
  renderEquationsBank();

  // 2. Automatic Equation Balancer
  const balancerInput = document.getElementById('balancerInput');
  const balancerResult = document.getElementById('balancerResult');

  function runBalancer() {
    if (!balancerInput || !balancerResult) return;
    const res = balanceChemicalEquation(balancerInput.value);
    if (res.error) {
      balancerResult.innerHTML = `<div class="notice notice-warning"><span class="material-symbols-rounded">warning</span><span>${esc(res.error)}</span></div>`;
      return;
    }

    balancerResult.innerHTML = `
      <div style="background:var(--bg-secondary); border:1.5px solid var(--primary); border-radius:16px; padding:20px;">
        <div style="font-size:0.82rem; color:var(--text-muted); font-weight:700; margin-bottom:6px;">المعادلة الموزونة بأبسط معاملات صحيحة:</div>
        <div dir="ltr" style="background:#0f172a; color:#34d399; padding:16px; border-radius:12px; font-family:monospace; font-size:1.25rem; font-weight:900; text-align:center; margin-bottom:16px;">
          ${esc(res.balanced)}
        </div>
        <div style="font-size:0.84rem; font-weight:800; margin-bottom:8px; color:var(--text-primary);">جدول التحقق من تساوي عدد الذرات في الطرفين:</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${res.atomSummary.map(a => `
            <div style="background:var(--bg-card); border:1px solid var(--border-light); border-radius:10px; padding:8px 14px; display:flex; align-items:center; gap:8px;">
              <strong dir="ltr" style="color:var(--primary); font-size:1rem;">${esc(a.element)}</strong>
              <span style="font-size:0.82rem; color:var(--text-secondary);">${a.count} ذرة في كل طرف</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  document.getElementById('balanceBtn')?.addEventListener('click', runBalancer);
  document.querySelectorAll('.eq-example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (balancerInput) {
        balancerInput.value = chip.dataset.eq;
        runBalancer();
      }
    });
  });
  runBalancer();

  // 3. Qualitative Analysis Lab
  const qualFilter = document.getElementById('qualGroupFilter');
  const qualGrid = document.getElementById('qualResultsGrid');

  function renderQualLab() {
    if (!qualGrid) return;
    const g = qualFilter?.value || 'الكل';
    const items = QUALITATIVE_TESTS.filter(item => g === 'الكل' || item.group === g);
    qualGrid.innerHTML = items.map(item => `
      <div style="background:var(--bg-secondary); border:1px solid var(--border-light); border-radius:14px; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="font-size:1rem; color:var(--primary);">${esc(item.ion)}</strong>
          <span class="badge badge-info" style="font-size:0.7rem;">${esc(item.group)}</span>
        </div>
        <div style="font-size:0.84rem; color:var(--text-primary); margin-bottom:6px;">
          <strong>التجربة الأساسية:</strong> ${esc(item.mainTest)}
        </div>
        <div style="font-size:0.84rem; color:var(--text-secondary);">
          <strong>التجربة التأكيدية:</strong> ${esc(item.confirmTest)}
        </div>
      </div>
    `).join('');
  }

  qualFilter?.addEventListener('change', renderQualLab);
  renderQualLab();

  // 4. Molar Mass & Moles Calculator
  const molarInput = document.getElementById('molarFormulaInput');
  const molarResult = document.getElementById('molarCalcResult');
  const sampleMassInput = document.getElementById('sampleMassGrams');
  const molesResult = document.getElementById('molesCalcResult');

  function updateMolarAndMoles() {
    if (!molarInput || !molarResult) return;
    const res = calculateMolarMass(molarInput.value);
    if (!res.molarMass || res.breakdown.length === 0) {
      molarResult.innerHTML = `<div class="notice notice-warning"><span class="material-symbols-rounded">warning</span><span>أدخل صيغة كيميائية صحيحة بحروف كبيرة لرموز العناصر (مثل Fe2O3).</span></div>`;
      return;
    }

    molarResult.innerHTML = `
      <div style="background:var(--bg-secondary); border-radius:12px; padding:14px; border:1px solid var(--border-light);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-weight:700;">الكتلة المولية لـ <code dir="ltr">${esc(res.formula)}</code>:</span>
          <strong style="font-size:1.25rem; color:var(--primary);">${res.molarMass} جم/مول</strong>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${res.breakdown.map(b => `
            <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:var(--text-secondary); padding-top:4px; border-top:1px dashed var(--border-light);">
              <span dir="ltr">${esc(b.element)} × ${b.count} (${b.atomicMass})</span>
              <strong>${b.subtotal} جم (${b.massPercent}%)</strong>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (molesResult && sampleMassInput) {
      const m = parseFloat(sampleMassInput.value) || 0;
      const n = res.molarMass > 0 ? Math.round((m / res.molarMass) * 10000) / 10000 : 0;
      const molecules = (n * 6.022).toFixed(3);
      molesResult.innerHTML = `
        <div style="background:var(--bg-secondary); border-radius:12px; padding:14px; border:1px solid var(--border-light); display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between;">
            <span>عدد المولات (n):</span>
            <strong style="color:var(--primary); font-size:1.1rem;">${n} مول</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-secondary);">
            <span>عدد الجزيئات / وحدات الصيغة:</span>
            <strong dir="ltr">${molecules} × 10²³</strong>
          </div>
        </div>
      `;
    }
  }

  document.getElementById('calcMolarBtn')?.addEventListener('click', updateMolarAndMoles);
  document.getElementById('calcMolesBtn')?.addEventListener('click', updateMolarAndMoles);
  updateMolarAndMoles();

  // 5. Transition Elements & Titration
  const transCard = document.getElementById('transitionElementCard');
  function renderTransitionEl(z) {
    const el = FIRST_TRANSITION_SERIES.find(item => item.z === Number(z)) || FIRST_TRANSITION_SERIES[5];
    if (!transCard) return;
    transCard.innerHTML = `
      <div style="background:var(--bg-secondary); border:1px solid var(--border-light); border-radius:14px; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h4 style="margin:0; font-size:1.05rem; font-weight:900; color:var(--primary);">${esc(el.name)} (${esc(el.symbol)}) — العدد الذري ${el.z}</h4>
          <code dir="ltr" style="background:#0f172a; color:#38bdf8; padding:4px 10px; border-radius:8px; font-weight:700;">${esc(el.config)}</code>
        </div>
        <div style="font-size:0.84rem; display:flex; flex-direction:column; gap:6px; color:var(--text-secondary);">
          <div><strong style="color:var(--text-primary);">حالات التأكسد:</strong> ${esc(el.states)}</div>
          <div><strong style="color:var(--text-primary);">الخواص المغناطيسية:</strong> ${esc(el.magnetic)}</div>
          <div><strong style="color:var(--text-primary);">الألوان المميزة:</strong> ${esc(el.color)}</div>
          <div><strong style="color:var(--text-primary);">الأهمية الاقتصادية:</strong> ${esc(el.uses)}</div>
        </div>
      </div>
    `;
  }

  document.querySelectorAll('.trans-el-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.trans-el-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
      });
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
      renderTransitionEl(btn.dataset.z);
    });
  });
  renderTransitionEl(26);

  document.getElementById('runTitrationBtn')?.addEventListener('click', () => {
    const resBox = document.getElementById('titrationResultBox');
    if (!resBox) return;
    const res = calculateTitration({
      Ma: document.getElementById('titMa')?.value,
      Va: document.getElementById('titVa')?.value,
      na: document.getElementById('titNa')?.value,
      Mb: document.getElementById('titMb')?.value,
      Vb: document.getElementById('titVb')?.value,
      nb: document.getElementById('titNb')?.value
    });
    if (!res) {
      resBox.innerHTML = `<div class="notice notice-warning"><span class="material-symbols-rounded">info</span><span>اترك خانة واحدة فقط فارغة (Ma أو Va أو Mb أو Vb) لحسابها.</span></div>`;
      return;
    }
    resBox.innerHTML = `
      <div class="notice notice-success" style="font-weight:800;">
        <span class="material-symbols-rounded">check_circle</span>
        <span>${esc(res.label)} = <strong>${res.value} ${esc(res.unit)}</strong></span>
      </div>
    `;
  });
}
