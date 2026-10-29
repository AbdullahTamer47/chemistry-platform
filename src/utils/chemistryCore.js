/**
 * =========================================================================
 * Chemistry Native Computation Core (نواة المعالجة الكيميائية المنهجية الشاملة)
 * Complete Equations Bank, Automatic Stoichiometric Balancer, Molar Mass,
 * Qualitative Analysis Simulator, and Titration Calculator
 * =========================================================================
 */

export const ATOMIC_MASSES = {
  H: 1.008, He: 4.003, Li: 6.94, Be: 9.012, B: 10.81, C: 12.011, N: 14.007, O: 15.999,
  F: 18.998, Ne: 20.18, Na: 22.990, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06,
  Cl: 35.45, Ar: 39.948, K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996,
  Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Br: 79.904,
  Sr: 87.62, Ag: 107.868, Cd: 112.41, Sn: 118.71, I: 126.904, Ba: 137.327, Pt: 195.08,
  Au: 196.97, Hg: 200.59, Pb: 207.2
};

export function parseChemicalFormula(formula) {
  if (!formula || typeof formula !== 'string') return {};
  const clean = formula.trim().replace(/\s+/g, '');
  const elementCounts = {};

  function parseSegment(str, multiplier = 1) {
    const regex = /([A-Z][a-z]*)(\d*)/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
      const element = match[1];
      const count = (match[2] ? parseInt(match[2], 10) : 1) * multiplier;
      elementCounts[element] = (elementCounts[element] || 0) + count;
    }
  }

  const parenRegex = /\(([^)]+)\)(\d*)/g;
  let remaining = clean;
  let parenMatch;

  while ((parenMatch = parenRegex.exec(clean)) !== null) {
    const subFormula = parenMatch[1];
    const groupMultiplier = parenMatch[2] ? parseInt(parenMatch[2], 10) : 1;
    parseSegment(subFormula, groupMultiplier);
    remaining = remaining.replace(parenMatch[0], '');
  }

  parseSegment(remaining, 1);
  return elementCounts;
}

export function calculateMolarMass(formula) {
  const elements = parseChemicalFormula(formula);
  let totalMass = 0;
  const breakdown = [];

  for (const [element, count] of Object.entries(elements)) {
    const atomicMass = ATOMIC_MASSES[element] || 0;
    const subtotal = atomicMass * count;
    totalMass += subtotal;
    breakdown.push({
      element,
      count,
      atomicMass,
      subtotal: Math.round(subtotal * 100) / 100
    });
  }

  const roundedTotal = Math.round(totalMass * 100) / 100;
  const enrichedBreakdown = breakdown.map(b => ({
    ...b,
    massPercent: roundedTotal > 0 ? Math.round((b.subtotal / totalMass) * 1000) / 10 : 0
  }));

  return {
    formula,
    molarMass: roundedTotal,
    breakdown: enrichedBreakdown
  };
}

// Greatest Common Divisor & Least Common Multiple helpers for Equation Balancer
function gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

function lcm(a, b) {
  return Math.abs((a * b) / gcd(a, b));
}

/**
 * Automatic Chemical Equation Balancer (موازن المعادلات الكيميائية التلقائي)
 * Accepts e.g. "Fe + O2 -> Fe2O3" or "Fe + H2SO4 = Fe2(SO4)3 + SO2 + H2O"
 */
export function balanceChemicalEquation(rawEquation) {
  if (!rawEquation || typeof rawEquation !== 'string') {
    return { error: 'يرجى كتابة المعادلة الكيميائية أولاً' };
  }

  const normalized = rawEquation
    .replace(/→|⟶|=>|=/g, '->')
    .replace(/\s+/g, ' ')
    .trim();

  const sides = normalized.split('->');
  if (sides.length !== 2) {
    return { error: 'يرجى الفصل بين المتفاعلات والنواتج بعلامة -> أو =' };
  }

  const parseSide = (sideStr) =>
    sideStr
      .split('+')
      .map(s => s.trim().replace(/^\d+/, '').trim())
      .filter(Boolean);

  const reactants = parseSide(sides[0]);
  const products = parseSide(sides[1]);

  if (reactants.length === 0 || products.length === 0) {
    return { error: 'تأكد من كتابة المتفاعلات والنواتج بشكل صحيح' };
  }

  const allCompounds = [...reactants, ...products];
  const parsedCompounds = allCompounds.map(c => parseChemicalFormula(c));

  const elementSet = new Set();
  parsedCompounds.forEach(map => Object.keys(map).forEach(el => elementSet.add(el)));
  const elements = Array.from(elementSet);

  if (elements.length === 0) {
    return { error: 'لم يتم التعرف على رموز العناصر الكيميائية' };
  }

  // Check if all elements on left appear on right
  const leftEls = new Set();
  const rightEls = new Set();
  reactants.forEach((_, i) => Object.keys(parsedCompounds[i]).forEach(e => leftEls.add(e)));
  products.forEach((_, i) => Object.keys(parsedCompounds[reactants.length + i]).forEach(e => rightEls.add(e)));
  for (const el of elements) {
    if (!leftEls.has(el) || !rightEls.has(el)) {
      return { error: `العنصر (${el}) موجود في طرف واحد فقط من المعادلة` };
    }
  }

  const numCols = allCompounds.length;
  const numRows = elements.length;

  // Build matrix A where rows = elements, cols = compounds (+ for reactants, - for products)
  const matrix = elements.map(el =>
    allCompounds.map((_, colIdx) => {
      const count = parsedCompounds[colIdx][el] || 0;
      return colIdx < reactants.length ? count : -count;
    })
  );

  // Gaussian elimination over rationals (represented as [num, den])
  const rat = (n, d = 1) => {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    return [n / g, d / g];
  };
  const addRat = ([n1, d1], [n2, d2]) => rat(n1 * d2 + n2 * d1, d1 * d2);
  const subRat = ([n1, d1], [n2, d2]) => rat(n1 * d2 - n2 * d1, d1 * d2);
  const mulRat = ([n1, d1], [n2, d2]) => rat(n1 * n2, d1 * d2);
  const divRat = ([n1, d1], [n2, d2]) => rat(n1 * d2, d1 * n2);

  const M = matrix.map(row => row.map(v => rat(v, 1)));
  let pivotRow = 0;
  const pivotCols = [];

  for (let col = 0; col < numCols - 1 && pivotRow < numRows; col++) {
    let sel = pivotRow;
    while (sel < numRows && M[sel][col][0] === 0) sel++;
    if (sel === numRows) continue;

    [M[pivotRow], M[sel]] = [M[sel], M[pivotRow]];
    const pivotVal = M[pivotRow][col];
    for (let j = col; j < numCols; j++) {
      M[pivotRow][j] = divRat(M[pivotRow][j], pivotVal);
    }

    for (let i = 0; i < numRows; i++) {
      if (i !== pivotRow && M[i][col][0] !== 0) {
        const factor = M[i][col];
        for (let j = col; j < numCols; j++) {
          M[i][j] = subRat(M[i][j], mulRat(factor, M[pivotRow][j]));
        }
      }
    }
    pivotCols.push({ row: pivotRow, col });
    pivotRow++;
  }

  // Set last variable = 1, solve pivot variables
  const sol = Array.from({ length: numCols }, () => rat(1, 1));
  for (const { row, col } of pivotCols) {
    let sum = rat(0, 1);
    for (let j = col + 1; j < numCols; j++) {
      sum = addRat(sum, mulRat(M[row][j], sol[j]));
    }
    sol[col] = mulRat(sum, rat(-1, 1));
  }

  let commonDen = 1;
  for (const [, d] of sol) {
    commonDen = lcm(commonDen, d);
  }

  let coeffs = sol.map(([n, d]) => Math.round((n * commonDen) / d));
  if (coeffs.some(c => c <= 0)) {
    return { error: 'تعذر وزن المعادلة تلقائياً — تأكد من صحة الصيغ الكيميائية للمتفاعلات والنواتج' };
  }

  const overallGcd = coeffs.reduce((acc, c) => gcd(acc, c), coeffs[0]);
  coeffs = coeffs.map(c => c / overallGcd);

  const formatSide = (items, offset) =>
    items.map((comp, i) => `${coeffs[offset + i] > 1 ? coeffs[offset + i] : ''}${comp}`).join(' + ');

  const balancedStr = `${formatSide(reactants, 0)} -> ${formatSide(products, reactants.length)}`;

  // Verify atom counts on both sides
  const atomSummary = elements.map(el => {
    const count = reactants.reduce((acc, _, i) => acc + coeffs[i] * (parsedCompounds[i][el] || 0), 0);
    return { element: el, count };
  });

  return {
    balanced: balancedStr,
    reactants: reactants.map((r, i) => ({ formula: r, coefficient: coeffs[i] })),
    products: products.map((p, i) => ({ formula: p, coefficient: coeffs[reactants.length + i] })),
    atomSummary
  };
}

export const FIRST_TRANSITION_SERIES = [
  { z: 21, symbol: 'Sc', name: 'السكانديوم', config: '[Ar] 4s² 3d¹', states: '+3 فقط', unpaired: 1, magnetic: 'بارامغناطيسي (الذرة) / دايامغناطيسي (Sc³⁺)', color: 'عديم اللون (Sc³⁺)', uses: 'سبائك الطائرات المقاتلة (الميج) مع الألومنيوم، ومصابيح أبخرة الزئبق للتصوير التلفزيوني الليلي.' },
  { z: 22, symbol: 'Ti', name: 'التيتانيوم', config: '[Ar] 4s² 3d²', states: '+2, +3, +4 (الأكثر ثباتاً)', unpaired: 2, magnetic: 'بارامغناطيسي (Ti³⁺) / دايامغناطيسي (Ti⁴⁺)', color: 'Ti³⁺ بنفسجي محمر / Ti⁴⁺ عديم اللون', uses: 'زراعة الأسنان والمفاصل الصناعية، مركبات الفضاء، ومستحضرات الحماية من أشعة الشمس (TiO₂).' },
  { z: 23, symbol: 'V', name: 'الفاناديوم', config: '[Ar] 4s² 3d³', states: '+2, +3, +4, +5 (الأعلى)', unpaired: 3, magnetic: 'بارامغناطيسي (الذرة) / دايامغناطيسي (V⁵⁺)', color: 'V³⁺ أخضر / V²⁺ بنفسجي', uses: 'نوابض السيارات (مع الصلب)، وخامس أكسيد الفاناديوم (V₂O₅) عامل حفاز في تحضير حمض الكبريتيك بالتلامس.' },
  { z: 24, symbol: 'Cr', name: 'الكروم', config: '[Ar] 4s¹ 3d⁵ (شذوذ للاستقرار)', states: '+2, +3 (الأكثر استقراراً), +6', unpaired: 6, magnetic: 'بارامغناطيسي قوي جداً (6 إلكترونات مفردة)', color: 'Cr³⁺ أخضر (يمتص الأحمر)', uses: 'طلاء المعادن ودباغة الجلود، وثاني كرومات البوتاسيوم (K₂Cr₂O₇) مادة مؤكسدة برتقالية تتحول للأخضر.' },
  { z: 25, symbol: 'Mn', name: 'المنجنيز', config: '[Ar] 4s² 3d⁵', states: '+2, +3, +4, +6, +7 (الأعلى في السلسلة)', unpaired: 5, magnetic: 'بارامغناطيسي قوي (5 إلكترونات مفردة في Mn²⁺)', color: 'Mn²⁺ وردي فاتح / MnO₄⁻ بنفسجي', uses: 'سبائك خطوط السكك الحديدية (مع الحديد)، وعلب المشروبات الغازية (مع الألومنيوم)، و KMnO₄ مادة مؤكسدة ومطهرة.' },
  { z: 26, symbol: 'Fe', name: 'الحديد', config: '[Ar] 4s² 3d⁶', states: '+2, +3 (الأكثر استقراراً 3d⁵), +6', unpaired: 4, magnetic: 'بارامغناطيسي (Fe²⁺ به 4 مفردة، Fe³⁺ به 5 مفردة)', color: 'Fe²⁺ أخضر فاتح / Fe³⁺ أصفر باهت', uses: 'عصب الصناعات الثقيلة والخرسانة المسلحة، وعامل حفاز في تحضير النشادر بطريقة هابر-بوش.' },
  { z: 27, symbol: 'Co', name: 'الكوبالت', config: '[Ar] 4s² 3d⁷', states: '+2, +3, +4', unpaired: 3, magnetic: 'بارامغناطيسي وقابل للتمغنط مثل الحديد', color: 'Co²⁺ أحمر وردي', uses: 'صناعة المغناطيسات والبطاريات الجافة، ونظير الكوبالت 60 المشع يصدر أشعة جاما لحفظ الأغذية وعلاج الأورام.' },
  { z: 28, symbol: 'Ni', name: 'النيكل', config: '[Ar] 4s² 3d⁸', states: '+2 (الأكثر شيوعاً), +3, +4', unpaired: 2, magnetic: 'بارامغناطيسي', color: 'Ni²⁺ أخضر', uses: 'بطاريات النيكل-كادميوم القابلة لإعادة الشحن، والنيكل المجزأ عامل حفاز في هدرجة الزيوت.' },
  { z: 29, symbol: 'Cu', name: 'النحاس', config: '[Ar] 4s¹ 3d¹⁰ (شذوذ للاستقرار)', states: '+1, +2 (يتعدى رقم مجموعته 1B)', unpaired: 1, magnetic: 'Cu²⁺ بارامغناطيسي (3d⁹) / Cu⁺ دايامغناطيسي (3d¹⁰)', color: 'Cu²⁺ أزرق / Cu⁺ عديم اللون', uses: 'الكابلات الكهربائية وسبائك العملات والبرونز، ومحلول فهلنج للكشف عن سكر الجلوكوز.' },
  { z: 30, symbol: 'Zn', name: 'الخارصين', config: '[Ar] 4s² 3d¹⁰', states: '+2 فقط (عنصر غير انتقالي)', unpaired: 0, magnetic: 'دايامغناطيسي في الحالة الذرية وحالة التأكسد +2', color: 'جميع مركباته عديمة اللون', uses: 'جلفنة الفلزات لحمايتها من الصدأ، وأكسيد الخارصين (ZnO) في الدهانات والمطاط، وكبريتيد الخارصين (ZnS) في الطلاءات المضيئة.' }
];

export const THANAVYA_REACTIONS = [
  // ================= الباب الأول: العناصر الانتقالية والحديد =================
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'تحميص خام السدريت (كربونات الحديد II) بمعزل عن الهواء ثم في الهواء',
    balanced: '2FeCO3 + 1/2 O2 -> Fe2O3 + 2CO2',
    conditions: 'تحميص في الهواء الساخن (Δ)',
    colorChange: 'يتحول اللون الرمادي المصفر إلى الأحمر الداكن (الهيماتيت)',
    notes: 'ينحل FeCO3 أولاً إلى FeO + CO2 ثم يتأكسد FeO في الهواء إلى Fe2O3 لرفع نسبة الحديد في الخام.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'تحميص خام الليمونيت (أكسيد الحديد III المتهدرت)',
    balanced: '2Fe2O3.3H2O -> 2Fe2O3 + 3H2O',
    conditions: 'تسخين شديد (Δ)',
    colorChange: 'يتحول اللون الأصفر إلى اللون الأحمر (الهيماتيت)',
    notes: 'التخلص من الرطوبة وماء التبلر ورفع نسبة الحديد من 40% إلى 69.6%.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'اختزال الهيماتيت في الفرن العالي',
    balanced: 'Fe2O3 + 3CO -> 2Fe + 3CO2',
    conditions: 'أعلى من 700°C في الفرن العالي',
    colorChange: 'يتكون الحديد المنصهر',
    notes: 'العامل المختزل في الفرن العالي هو غاز أول أكسيد الكربون الناتج من فحم الكوك.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'اختزال الهيماتيت في فرن مدركس بالغاز المائي',
    balanced: '2Fe2O3 + 3CO + 3H2 -> 4Fe + 3CO2 + 3H2O',
    conditions: 'فرن مدركس (خليط CO + H2)',
    colorChange: 'يتكون الحديد الإسفنجي الصلب',
    notes: 'الغاز المائي يُحضر من الغاز الطبيعي (الميثان).'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'أكسدة الحديد المسخن لدرجة الاحمرار في الهواء',
    balanced: '3Fe + 2O2 -> Fe3O4',
    conditions: '500°C (حرارة شديدة)',
    colorChange: 'يتكون أكسيد الحديد المغناطيسي الأسود (الماجنتيت)',
    notes: 'لا يتكون Fe2O3 مباشرة من تسخين الحديد في الهواء.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'تفاعل الحديد المسخن مع بخار الماء',
    balanced: '3Fe + 4H2O -> Fe3O4 + 4H2',
    conditions: '500°C',
    colorChange: 'يتكون أكسيد الحديد المغناطيسي الأسود ويتصاعد غاز الهيدروجين',
    notes: 'يشتعل غاز الهيدروجين المتصاعد بفرقعة عند تقريب شظية مشتعلة.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'تفاعل الحديد مع غاز الكلور',
    balanced: '2Fe + 3Cl2 -> 2FeCl3',
    conditions: 'تسخين (Δ)',
    colorChange: 'يتكون كلوريد الحديد III فقط',
    notes: 'لأن غاز الكلور عامل مؤكسد قوي يؤكسد كلوريد الحديد II إلى III.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'تفاعل الحديد مع حمض الهيدروكلوريك المخفف',
    balanced: 'Fe + 2HCl -> FeCl2 + H2',
    conditions: 'مخفف (dil)',
    colorChange: 'محلول كلوريد الحديد II أخضر فاتح',
    notes: 'ينتج ملح الحديد II لأن الهيدروجين الناتج عامل مختزل.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'تفاعل الحديد مع حمض الكبريتيك المركز الساخن',
    balanced: '3Fe + 8H2SO4 -> FeSO4 + Fe2(SO4)3 + 4SO2 + 8H2O',
    conditions: 'مركز ساخن (conc / Δ)',
    colorChange: 'تصاعد غاز SO2 ذو الرائحة النفاذة الذي يخضر ورقة مبللة بثاني كرومات البوتاسيوم',
    notes: 'ينتج خليط من كبريتات الحديد II وكبريتات الحديد III.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'الانحلال الحراري لكبريتات الحديد II',
    balanced: '2FeSO4 -> Fe2O3 + SO2 + SO3',
    conditions: 'تسخين شديد (Δ)',
    colorChange: 'يتحول اللون الأخضر إلى اللون الأحمر (أكسيد الحديد III)',
    notes: 'تفاعل ذاتي الأكسدة والاختزال حيث يؤكسد SO3 أكسيد الحديد II المتكون إلى Fe2O3.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'الانحلال الحراري لأوكسالات الحديد II بمعزل عن الهواء',
    balanced: '(COO)2Fe -> FeO + CO + CO2',
    conditions: 'بمعزل عن الهواء (Δ)',
    colorChange: 'يتكون مسحوق أسود من أكسيد الحديد II',
    notes: 'لا يتأكسد FeO المتكون لأن غاز أول أكسيد الكربون CO عامل مختزل.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية والحديد',
    title: 'الانحلال الحراري لهيدروكسيد الحديد III',
    balanced: '2Fe(OH)3 -> Fe2O3 + 3H2O',
    conditions: 'أعلى من 200°C',
    colorChange: 'يتحول الراسب البني المحمر إلى أكسيد الحديد III الأحمر',
    notes: 'يُحضر هيدروكسيد الحديد III من تفاعل أملاح الحديد III مع القلويات مثل NH4OH.'
  },

  // ================= الباب الثاني: التحليل الكيميائي =================
  {
    category: 'الباب الثاني: التحليل الكيميائي الكيفي والكمي',
    title: 'الكشف عن أنيون الكربونات والبيكربونات بحمض HCl المخفف',
    balanced: 'Na2CO3 + 2HCl -> 2NaCl + H2O + CO2',
    conditions: 'مخفف (dil)',
    colorChange: 'فوران وتصاعد غاز CO2 يعكر ماء الجير الرائق لفترة قصيرة',
    notes: 'للتمييز بينهما نستخدم كبريتات المغنيسيوم MgSO4: راسب أبيض على البارد مع الكربونات وبعد التسخين مع البيكربونات.'
  },
  {
    category: 'الباب الثاني: التحليل الكيميائي الكيفي والكمي',
    title: 'الكشف عن أنيون الثيوكبريتات بحمض HCl المخفف',
    balanced: 'Na2S2O3 + 2HCl -> 2NaCl + H2O + SO2 + S',
    conditions: 'مخفف (dil)',
    colorChange: 'يتكون معلق أصفر من الكبريت ويتصاعد غاز SO2',
    notes: 'التجربة التأكيدية: محلول الثيوكبريتات يزيل اللون البني لمحلول اليود (2Na2S2O3 + I2 -> Na2S4O6 + 2NaI).'
  },
  {
    category: 'الباب الثاني: التحليل الكيميائي الكيفي والكمي',
    title: 'تجربة الحلقة البنية للكشف عن أنيون النترات',
    balanced: '2NaNO3 + 6FeSO4 + 4H2SO4 -> 3Fe2(SO4)3 + Na2SO4 + 4H2O + 2NO',
    conditions: 'كبريتات حديد II حديثة التحضير + قطرات H2SO4 مركز',
    colorChange: 'تتكون حلقة بنية (FeSO4.NO) عند السطح الفاصل تزول بالرج أو التسخين',
    notes: 'يجب أن تكون كبريتات الحديد II حديثة التحضير حتى لا تكون متأكسدة إلى حديد III.'
  },
  {
    category: 'الباب الثاني: التحليل الكيميائي الكيفي والكمي',
    title: 'الكشف عن أنيون الكبريتات بمحلول كلوريد الباريوم',
    balanced: 'Na2SO4 + BaCl2 -> 2NaCl + BaSO4',
    conditions: 'محلول كلوريد الباريوم المائي',
    colorChange: 'راسب أبيض من كبريتات الباريوم لا يذوب في حمض الهيدروكلوريك المخفف',
    notes: 'مع الفوسفات يتكون راسب أبيض من Ba3(PO4)2 يذوب في حمض الهيدروكلوريك المخفف.'
  },
  {
    category: 'الباب الثاني: التحليل الكيميائي الكيفي والكمي',
    title: 'الكشف عن كاتيون الألومنيوم Al3+ بمحلول هيدروكسيد الصوديوم',
    balanced: 'AlCl3 + 3NaOH -> 3NaCl + Al(OH)3',
    conditions: 'إضافة NaOH قطرة قطرة ثم وفرة',
    colorChange: 'راسب أبيض جيلاتيني يذوب في وفرة من NaOH لتكون ميتا ألومينات الصوديوم NaAlO2',
    notes: 'هيدروكسيد الألومنيوم متردد يذوب في الأحماض وفي الصودا الكاوية ولا يذوب في NH4OH.'
  },
  {
    category: 'الباب الثاني: التحليل الكيميائي الكيفي والكمي',
    title: 'معايرة حمض الكبريتيك مع هيدروكسيد الصوديوم',
    balanced: 'H2SO4 + 2NaOH -> Na2SO4 + 2H2O',
    conditions: 'معايرة تعادل (na = 1, nb = 2)',
    colorChange: 'تغير لون الدليل عند نقطة التعادل',
    notes: 'قانون المعايرة: (Ma * Va) / 1 = (Mb * Vb) / 2.'
  },

  // ================= الباب الثالث: الاتزان الكيميائي =================
  {
    category: 'الباب الثالث: الاتزان الكيميائي والأيوني',
    title: 'تفاعل كلوريد الحديد III مع ثيوسيانات الأمونيوم (قانون فعل الكتلة)',
    balanced: 'FeCl3 + 3NH4SCN <-> Fe(SCN)3 + 3NH4Cl',
    conditions: 'تفاعل انعكاسي متزن',
    colorChange: 'يتحول اللون الأصفر الباهت إلى الأحمر الدموي ثيوسيانات الحديد III',
    notes: 'عند إضافة المزيد من FeCl3 يزداد اللون الأحمر الدموي طبقاً لمبدأ لوشاتلييه.'
  },
  {
    category: 'الباب الثالث: الاتزان الكيميائي والأيوني',
    title: 'تحضير غاز النشادر في الصناعة بطريقة هابر-بوش',
    balanced: 'N2 + 3H2 <-> 2NH3 + Heat',
    conditions: 'حديد كعامل حفاز / 500°C / ضغط 200 atm',
    colorChange: 'تفاعل طارد للحرارة مصحوب بنقص في عدد مولات الغاز',
    notes: 'يزداد إنتاج النشادر بزيادة الضغط وخفض درجة الحرارة وسحب النشادر من حيز التفاعل.'
  },
  {
    category: 'الباب الثالث: الاتزان الكيميائي والأيوني',
    title: 'أثر درجة الحرارة على اتزان غاز ثاني أكسيد النيتروجين',
    balanced: '2NO2 <-> N2O4 + Heat',
    conditions: 'تبريد أو تسخين إناء التفاعل المغلق',
    colorChange: 'بالتبريد يزول اللون البني المحمر ليتكون N2O4 عديم اللون، وبالتسخين يزداد اللون البني المحمر',
    notes: 'تتغير قيمة ثابت الاتزان Kc فقط بتغير درجة الحرارة.'
  },

  // ================= الباب الرابع: الكيمياء الكهربية =================
  {
    category: 'الباب الرابع: الكيمياء الكهربية',
    title: 'التفاعل الكلي في خلية دانيال الجلفانية',
    balanced: 'Zn + CuSO4 -> ZnSO4 + Cu',
    conditions: 'خلية جلفانية أنودها الخارصين وكاثودها النحاس',
    colorChange: 'يبهت اللون الأزرق لمحلول كبريتات النحاس تدريجياً ويترسب النحاس الأحمر',
    notes: 'القوة الدافعة الكهربية للخلية EMF = 1.1 Volt (الرمز الاصطلاحي: Zn | Zn2+ || Cu2+ | Cu).'
  },
  {
    category: 'الباب الرابع: الكيمياء الكهربية',
    title: 'تفاعل التفريغ والشحن في بطارية الرصاص الحامضية (المركم الرصاصي)',
    balanced: 'Pb + PbO2 + 4H+ + 2SO4(2-) <-> 2PbSO4 + 2H2O',
    conditions: 'تفريغ (خلية جلفانية EMF = 2.05V للخلية الواحدة) / شحن (تحليل كهربي)',
    colorChange: 'أثناء التفريغ تقل كثافة حمض الكبريتيك وتزداد قيمة pH',
    notes: 'بطارية السيارة تتكون من 6 خلايا متصلة على التوالي فتعطي قوة دافعة كلية 12 فولت.'
  },
  {
    category: 'الباب الرابع: الكيمياء الكهربية',
    title: 'التفاعل الكلي لخلية الوقود (الهيدروجين والأكسجين)',
    balanced: '2H2 + O2 -> 2H2O',
    conditions: 'إلكتروليت هيدروكسيد البوتاسيوم المائي KOH',
    colorChange: 'ينتج بخار ماء نقي يُستخدم كمياه شرب لرواد الفضاء',
    notes: 'القوة الدافعة الكهربية EMF = 1.23 Volt (جهد الأكسدة = 0.83V وجهد الاختزال = 0.40V).'
  },
  {
    category: 'الباب الرابع: الكيمياء الكهربية',
    title: 'استخلاص فلز الألومنيوم من البوكسيت (خلية هول-هيرولت)',
    balanced: '2Al2O3 -> 4Al + 3O2',
    conditions: 'تحليل كهربي لمصهور البوكسيت المذاب في الكريوليت والفلوسبار عند 950°C',
    colorChange: 'يتجمع الألومنيوم المنصهر عند الكاثود ويتصاعد الأكسجين عند أنودات الجرافيت',
    notes: 'تتآكل أقطاب الجرافيت الموجبة بسبب تفاعلها مع الأكسجين المتصاعد مكونة CO و CO2.'
  },

  // ================= الباب الخامس: الكيمياء العضوية =================
  {
    category: 'الباب الخامس: الكيمياء العضوية',
    title: 'تجربة فوهلر لتحضير اليوريا (تحطيم نظرية القوة الحيوية)',
    balanced: 'NH4CNO -> NH2CONH2',
    conditions: 'تسخين محلول سيانات الأمونيوم (Δ)',
    colorChange: 'إعادة ترتيب ذري لتكوين مركب اليوريا العضوي',
    notes: 'أول مركب عضوي يتم تحضيره في المختبر من مركبات غير عضوية (AgCNO + NH4Cl -> AgCl + NH4CNO).'
  },
  {
    category: 'الباب الخامس: الكيمياء العضوية',
    title: 'تحضير غاز الميثان في المعمل (التقطير الجاف لأسيتات الصوديوم اللامائية)',
    balanced: 'CH3COONa + NaOH -> CH4 + Na2CO3',
    conditions: 'الجير الصودي (NaOH + CaO) مع التسخين (Δ)',
    colorChange: 'يتصاعد غاز الميثان المستنقعات',
    notes: 'وظيفة أكسيد الكالسيوم CaO هي خفض درجة انصهار الخليط وعدم دخوله في التفاعل.'
  },
  {
    category: 'الباب الخامس: الكيمياء العضوية',
    title: 'تحضير غاز الإيثين (الإيثيلين) من الكحول الإيثيلي',
    balanced: 'C2H5OH -> C2H4 + H2O',
    conditions: 'حمض الكبريتيك المركز عند 180°C (نزع ماء)',
    colorChange: 'يتكون كبريتات إيثيل هيدروجينية عند 80°C ثم تتحلل حرارياً عند 180°C إلى إيثين',
    notes: 'عند 140°C لكل 2 مول كحول ينتج الأثير ثنائي الإيثيل (C2H5-O-C2H5).'
  },
  {
    category: 'الباب الخامس: الكيمياء العضوية',
    title: 'تفاعل باير (أكسدة الإيثين بمحلول برمنجنات البوتاسيوم القلوية)',
    balanced: 'C2H4 + H2O + [O] -> C2H4(OH)2',
    conditions: 'محلول KMnO4 في وسط قلوي بارد',
    colorChange: 'يزول اللون البنفسجي للبرمنجنات ويتكون الإيثيلين جليكول (مادة مانعة لتجمد المياه في مبردات السيارات)',
    notes: 'يُستخدم تفاعل باير للكشف عن وجود الرابطة المزدوجة.'
  },
  {
    category: 'الباب الخامس: الكيمياء العضوية',
    title: 'تحضير غاز الإيثاين (الأسيتيلين) من كربيد الكالسيوم',
    balanced: 'CaC2 + 2H2O -> C2H2 + Ca(OH)2',
    conditions: 'تنقيط الماء على كربيد الكالسيوم',
    colorChange: 'يمرر الغاز على محلول CuSO4 في H2SO4 المخفف لإزالة غازي الفوسفين PH3 وكبريتيد الهيدروجين H2S',
    notes: 'الهيدرة الحفزية للإيثاين في وجود HgSO4 و H2SO4 عند 60°C تعطي الأسيتالدهيد (الإيثانال) CH3CHO.'
  },
  {
    category: 'الباب الخامس: الكيمياء العضوية',
    title: 'البلمرة الحلقية الثلاثية للإيثاين لتحضير البنزين العطري',
    balanced: '3C2H2 -> C6H6',
    conditions: 'أنبوبة من النيكل مسخنة لدرجة الاحمرار (Red Hot Ni Tube)',
    colorChange: 'يتحول غاز الأسيتيلين إلى سائل البنزين العطري',
    notes: 'ويمكن تحضير البنزين أيضاً باختزال الفينول بمسحوق الخارصين الساخن (C6H5OH + Zn -> C6H6 + ZnO).'
  },
  {
    category: 'الباب الخامس: الكيمياء العضوية',
    title: 'نيترة البنزين العطري',
    balanced: 'C6H6 + HNO3 -> C6H5NO2 + H2O',
    conditions: 'حمض الكبريتيك المركز عند 50°C',
    colorChange: 'يتكون سائل نيتروبنزين زيتي مصفر',
    notes: 'خليط النيترة يتكون من حمض النيتريك المركز وحمض الكبريتيك المركز بنسبة 1 : 1.'
  },
  {
    category: 'الباب الخامس: الكيمياء العضوية',
    title: 'تفاعل القسطرة (تحضير إستر أسيتات الإيثيل)',
    balanced: 'CH3COOH + C2H5OH <-> CH3COOC2H5 + H2O',
    conditions: 'حمض الكبريتيك المركز الساخن أو غاز HCl الجاف لنزع الماء ومنع التفاعل العكسي',
    colorChange: 'تتصاعد رائحة ذكية مميزة للإستر',
    notes: 'الأكسجين في الماء الناتج مصدره مجموعة OH من الحمض الكربوكسيلي وليس من الكحول.'
  },
  {
    category: 'الباب الخامس: الكيمياء العضوية',
    title: 'تحضير الأسبرين (إستر أسيتيل حمض الساليسيليك)',
    balanced: 'C7H6O3 + CH3COOH -> C9H8O4 + H2O',
    conditions: 'تفاعل حمض الساليسيليك كفينول مع حمض الأسيتيك',
    colorChange: 'يتكون مركب الأسبرين المسكن للآلام ومانع تجلط الدم',
    notes: 'بينما تفاعل حمض الساليسيليك كحمض مع الميثانول يعطي زيت المروخ (ساليسيلات الميثيل C8H8O3).'
  }
];

export const QUALITATIVE_TESTS = [
  {
    group: 'مجموعة حمض الهيدروكلوريك المخفف (HCl)',
    ion: 'الكربونات (CO3²⁻)',
    mainTest: 'فوران وتصاعد غاز CO2 يعكر ماء الجير الرائق لفترة قصيرة.',
    confirmTest: 'مع محلول MgSO4 يتكون راسب أبيض على البارد من MgCO3 يذوب في HCl.'
  },
  {
    group: 'مجموعة حمض الهيدروكلوريك المخفف (HCl)',
    ion: 'البيكربونات (HCO3⁻)',
    mainTest: 'فوران وتصاعد غاز CO2 يعكر ماء الجير الرائق.',
    confirmTest: 'مع محلول MgSO4 يتكون راسب أبيض بعد التسخين فقط.'
  },
  {
    group: 'مجموعة حمض الهيدروكلوريك المخفف (HCl)',
    ion: 'الكبريتيت (SO3²⁻)',
    mainTest: 'يتصاعد غاز SO2 ذو الرائحة النفاذة الذي يخضر ورقة مبللة بثاني كرومات البوتاسيوم البرتقالية المحمضة.',
    confirmTest: 'مع محلول نترات الفضة AgNO3 يتكون راسب أبيض يسود بالتسخين.'
  },
  {
    group: 'مجموعة حمض الهيدروكلوريك المخفف (HCl)',
    ion: 'الكبريتيد (S²⁻)',
    mainTest: 'يتصاعد غاز H2S كريه الرائحة يسود ورقة مبللة بمحلول أسيتات الرصاص II.',
    confirmTest: 'مع محلول نترات الفضة AgNO3 يتكون راسب أسود من كبريتيد الفضة Ag2S.'
  },
  {
    group: 'مجموعة حمض الهيدروكلوريك المخفف (HCl)',
    ion: 'الثيوكبريتات (S2O3²⁻)',
    mainTest: 'يتصاعد غاز SO2 مع ظهور راسب أصفر معلق من الكبريت (S).',
    confirmTest: 'يزيل اللون البني لمحلول اليود لتكون رباعي ثيونات الصوديوم عديمة اللون.'
  },
  {
    group: 'مجموعة حمض الهيدروكلوريك المخفف (HCl)',
    ion: 'النيتريت (NO2⁻)',
    mainTest: 'يتصاعد غاز NO عديم اللون يتحول عند فوهة الأنبوبة إلى أبخرة بنية حمراء من NO2.',
    confirmTest: 'يزيل اللون البنفسجي لمحلول برمنجنات البوتاسيوم المحمضة بحمض الكبريتيك.'
  },
  {
    group: 'مجموعة حمض الكبريتيك المركز (H2SO4)',
    ion: 'الكلوريد (Cl⁻)',
    mainTest: 'يتصاعد غاز HCl عديم اللون يكون سحباً بيضاء كثيفة مع ساق مبللة بمحلول النشادر.',
    confirmTest: 'مع AgNO3 يتكون راسب أبيض من AgCl يصير بنفسجياً في الضوء ويذوب سريعاً في محلول النشادر المركز.'
  },
  {
    group: 'مجموعة حمض الكبريتيك المركز (H2SO4)',
    ion: 'البروميد (Br⁻)',
    mainTest: 'يتصاعد غاز HBr ويتأكسد جزئياً مكوناً أبخرة برتقالية حمراء من البروم تصفر ورقة مبللة بالنشا.',
    confirmTest: 'مع AgNO3 يتكون راسب أبيض مصفر من AgBr يقتات لونه في الضوء ويذوب ببطء في محلول النشادر المركز.'
  },
  {
    group: 'مجموعة حمض الكبريتيك المركز (H2SO4)',
    ion: 'اليوديد (I⁻)',
    mainTest: 'يتصاعد غاز HI ويتأكسد جزئياً مكوناً أبخرة بنفسجية من اليود تزرق ورقة مبللة بمحلول النشا.',
    confirmTest: 'مع AgNO3 يتكون راسب أصفر من AgI لا يذوب في محلول النشادر.'
  },
  {
    group: 'مجموعة حمض الكبريتيك المركز (H2SO4)',
    ion: 'النترات (NO3⁻)',
    mainTest: 'تتصاعد أبخرة بنية حمراء كثيفة من NO2 تزداد بإضافة خراطة النحاس.',
    confirmTest: 'تجربة الحلقة البنية: إضافة كبريتات حديد II حديثة التحضير ثم قطرات H2SO4 مركز فتتكون حلقة بنية تزول بالرج أو التسخين.'
  },
  {
    group: 'مجموعة محلول كلوريد الباريوم (BaCl2)',
    ion: 'الفوسفات (PO4³⁻)',
    mainTest: 'راسب أبيض من فوسفات الباريوم Ba3(PO4)2 يذوب في حمض الهيدروكلوريك المخفف.',
    confirmTest: 'مع AgNO3 يتكون راسب أصفر من فوسفات الفضة Ag3PO4 يذوب في محلول النشادر وفي حمض النيتريك.'
  },
  {
    group: 'مجموعة محلول كلوريد الباريوم (BaCl2)',
    ion: 'الكبريتات (SO4²⁻)',
    mainTest: 'راسب أبيض من كبريتات الباريوم BaSO4 لا يذوب في حمض الهيدروكلوريك المخفف.',
    confirmTest: 'مع محلول أسيتات الرصاص II يتكون راسب أبيض من كبريتات الرصاص PbSO4.'
  },
  {
    group: 'الكشف عن الشقوق القاعدية (الكاتيونات)',
    ion: 'الألومنيوم (Al³⁺)',
    mainTest: 'مع هيدروكسيد الأمونيوم NH4OH يتكون راسب أبيض جيلاتيني من Al(OH)3.',
    confirmTest: 'مع هيدروكسيد الصوديوم NaOH يتكون راسب أبيض جيلاتيني يذوب في وفرة من NaOH لتكون ميتا ألومينات الصوديوم.'
  },
  {
    group: 'الكشف عن الشقوق القاعدية (الكاتيونات)',
    ion: 'الحديد II (Fe²⁺)',
    mainTest: 'مع NH4OH يتكون راسب أبيض يتحول إلى أبيض مخضر من Fe(OH)2 بالتعرض للهواء.',
    confirmTest: 'مع NaOH يتكون راسب أبيض مخضر من هيدروكسيد الحديد II يذوب في الأحماض.'
  },
  {
    group: 'الكشف عن الشقوق القاعدية (الكاتيونات)',
    ion: 'الحديد III (Fe³⁺)',
    mainTest: 'مع NH4OH يتكون راسب جيلاتيني بني محمر من Fe(OH)3.',
    confirmTest: 'مع NaOH يتكون راسب جيلاتيني بني محمر يذوب في الأحماض.'
  },
  {
    group: 'الكشف عن الشقوق القاعدية (الكاتيونات)',
    ion: 'الكالسيوم (Ca²⁺)',
    mainTest: 'مع كربونات الأمونيوم (NH4)2CO3 يتكون راسب أبيض من CaCO3 يذوب في الماء المحتوي على CO2.',
    confirmTest: 'مع حمض الكبريتيك المخفف راسب أبيض من CaSO4، وفي الكشف الجاف يلون لهب بنزن باللون الأحمر الطوبي.'
  }
];

export function calculateTitration({ Ma, Va, na, Mb, Vb, nb }) {
  const parsed = {
    Ma: parseFloat(Ma) || null,
    Va: parseFloat(Va) || null,
    na: parseFloat(na) || 1,
    Mb: parseFloat(Mb) || null,
    Vb: parseFloat(Vb) || null,
    nb: parseFloat(nb) || 1
  };

  if (parsed.Ma === null && parsed.Va && parsed.Mb && parsed.Vb) {
    const calculated = (parsed.Mb * parsed.Vb * parsed.na) / (parsed.Va * parsed.nb);
    return { target: 'Ma', label: 'تركيز الحمض (Ma)', value: Math.round(calculated * 1000) / 1000, unit: 'مول/لتر (M)' };
  }

  if (parsed.Va === null && parsed.Ma && parsed.Mb && parsed.Vb) {
    const calculated = (parsed.Mb * parsed.Vb * parsed.na) / (parsed.Ma * parsed.nb);
    return { target: 'Va', label: 'حجم الحمض (Va)', value: Math.round(calculated * 1000) / 1000, unit: 'مللتر (mL)' };
  }

  if (parsed.Mb === null && parsed.Ma && parsed.Va && parsed.Vb) {
    const calculated = (parsed.Ma * parsed.Va * parsed.nb) / (parsed.Vb * parsed.na);
    return { target: 'Mb', label: 'تركيز القاعدة (Mb)', value: Math.round(calculated * 1000) / 1000, unit: 'مول/لتر (M)' };
  }

  if (parsed.Vb === null && parsed.Ma && parsed.Va && parsed.Mb) {
    const calculated = (parsed.Ma * parsed.Va * parsed.nb) / (parsed.Mb * parsed.na);
    return { target: 'Vb', label: 'حجم القاعدة (Vb)', value: Math.round(calculated * 1000) / 1000, unit: 'مللتر (mL)' };
  }

  return null;
}
