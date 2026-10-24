/**
 * =========================================================================
 * Chemistry Native Computation Core (نواة المعالجة الكيميائية المنهجية)
 * Recommended by gpt-6.1-sol Architectural Review
 * Tailored for Dr. Ziad Ramzy's Egyptian Thanawya Amma Chemistry Platform
 * =========================================================================
 */

// Atomic Masses for High School Chemistry
export const ATOMIC_MASSES = {
  H: 1.008,
  He: 4.003,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  Na: 22.990,
  Mg: 24.305,
  Al: 26.982,
  Si: 28.085,
  P: 30.974,
  S: 32.06,
  Cl: 35.45,
  K: 39.098,
  Ca: 40.078,
  Sc: 44.956,
  Ti: 47.867,
  V: 50.942,
  Cr: 51.996,
  Mn: 54.938,
  Fe: 55.845,
  Co: 58.933,
  Ni: 58.693,
  Cu: 63.546,
  Zn: 65.38,
  Br: 79.904,
  Ag: 107.868,
  I: 126.904,
  Ba: 137.327,
  Pb: 207.2
};

/**
 * Parses a chemical formula (e.g. Fe2O3, Ca(OH)2, KMnO4) into element counts
 */
export function parseChemicalFormula(formula) {
  if (!formula || typeof formula !== 'string') return {};
  const clean = formula.trim().replace(/\s+/g, '');
  const elementCounts = {};

  // Simple recursive/stack parser for parentheses e.g. Ca(OH)2 or Fe2(SO4)3
  function parseSegment(str, multiplier = 1) {
    const regex = /([A-Z][a-z]*)(\d*)/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
      const element = match[1];
      const count = (match[2] ? parseInt(match[2], 10) : 1) * multiplier;
      elementCounts[element] = (elementCounts[element] || 0) + count;
    }
  }

  // Handle parentheses: e.g. Fe2(SO4)3
  const parenRegex = /\(([^)]+)\)(\d+)/g;
  let remaining = clean;
  let parenMatch;

  while ((parenMatch = parenRegex.exec(clean)) !== null) {
    const subFormula = parenMatch[1];
    const groupMultiplier = parseInt(parenMatch[2], 10);
    parseSegment(subFormula, groupMultiplier);
    remaining = remaining.replace(parenMatch[0], '');
  }

  // Parse remaining elements outside parens
  parseSegment(remaining, 1);

  return elementCounts;
}

/**
 * Calculates molecular mass (الكتلة المولية)
 */
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

  return {
    formula,
    molarMass: Math.round(totalMass * 100) / 100,
    breakdown
  };
}

/**
 * Curriculum Curated Key Reactions (معادلات منهج الثانوية العامة المعتمدة)
 */
export const THANAVYA_REACTIONS = [
  {
    category: 'الباب الأول: العناصر الانتقالية وخامات الحديد',
    title: 'أكسدة الحديد المسخن لدرجة الاحمرار في الهواء',
    unbalanced: 'Fe + O2 -> Fe3O4',
    balanced: '3Fe + 2O2 -> Fe3O4',
    coefficients: { reactants: [3, 2], products: [1] },
    conditions: '500°C (حرارة شديدة)',
    colorChange: 'يتكون أكسيد الحديد المغناطيسي (الأسود)',
    notes: 'لا يتكون Fe2O3 مباشرة، بل يتوقف التفاعل عند الأكسيد المغناطيسي الأسود.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية وخامات الحديد',
    title: 'تفاعل الحديد مع بخار الماء الساخن',
    unbalanced: 'Fe + H2O -> Fe3O4 + H2',
    balanced: '3Fe + 4H2O -> Fe3O4 + 4H2',
    coefficients: { reactants: [3, 4], products: [1, 4] },
    conditions: '500°C',
    colorChange: 'تصاعد غاز الهيدروجين الذي يشتعل بفرقعة',
    notes: 'يعمل بخار الماء كعامل مؤكسد لأكسدة الحديد إلى ماجنتيت مع تحرر غاز الهيدروجين.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية وخامات الحديد',
    title: 'تفاعل الحديد مع غاز الكلور الجاف',
    unbalanced: 'Fe + Cl2 -> FeCl3',
    balanced: '2Fe + 3Cl2 -> 2FeCl3',
    coefficients: { reactants: [2, 3], products: [2] },
    conditions: 'حرارة (Δ)',
    colorChange: 'يتكون كلوريد الحديد III بني محمر',
    notes: 'الكلور عامل مؤكسد قوي يؤكسد أي Fe+2 يتكون إلى Fe+3، ولذلك لا ينتج FeCl2.'
  },
  {
    category: 'الباب الأول: العناصر الانتقالية وخامات الحديد',
    title: 'تفاعل الحديد مع حمض الهيدروكلوريك المخفف',
    unbalanced: 'Fe + HCl -> FeCl2 + H2',
    balanced: 'Fe + 2HCl -> FeCl2 + H2',
    coefficients: { reactants: [1, 2], products: [1, 1] },
    conditions: 'مخفف (dil)',
    colorChange: 'محلول كلوريد الحديد II أخضر فاتح',
    notes: 'ينتج كلوريد الحديد II لأن غاز الهيدروجين المتصاعد عامل مختزل يمنع تكون كلوريد الحديد III.'
  },
  {
    category: 'الباب الثاني: التحليل الكيميائي والمعايرة',
    title: 'معايرة حمض الهيدروكلوريك مع هيدروكسيد الصوديوم (التعادل)',
    unbalanced: 'HCl + NaOH -> NaCl + H2O',
    balanced: 'HCl + NaOH -> NaCl + H2O',
    coefficients: { reactants: [1, 1], products: [1, 1] },
    conditions: 'نقطة التعادل pH = 7',
    colorChange: 'تغير لون دليل البروموثيمول الأزرق إلى الأخضر الفاتح',
    notes: 'قانون المعايرة: (Ma * Va) / 1 = (Mb * Vb) / 1'
  },
  {
    category: 'الباب الثاني: التحليل الكيميائي والمعايرة',
    title: 'معايرة حمض الكبريتيك مع هيدروكسيد الصوديوم',
    unbalanced: 'H2SO4 + NaOH -> Na2SO4 + H2O',
    balanced: 'H2SO4 + 2NaOH -> Na2SO4 + 2H2O',
    coefficients: { reactants: [1, 2], products: [1, 2] },
    conditions: 'معايرة حمض ثنائي البروتون',
    colorChange: 'na = 1, nb = 2 في قانون المعايرة',
    notes: 'قانون المعايرة: (Ma * Va) / 1 = (Mb * Vb) / 2'
  },
  {
    category: 'الباب الخامس: الكيمياء العضوية',
    title: 'احتراق غاز الميثان في وفرة من الأكسجين',
    unbalanced: 'CH4 + O2 -> CO2 + H2O',
    balanced: 'CH4 + 2O2 -> CO2 + 2H2O',
    coefficients: { reactants: [1, 2], products: [1, 2] },
    conditions: 'اشتعال / طاقة حرارية منطلقة (طارد للحرارة)',
    colorChange: 'لهب غير دخاني أزرق باهت',
    notes: 'كل 1 مول من الألكان CnH2n+2 يستهلك (3n+1)/2 مول من الأكسجين.'
  },
  {
    category: 'الباب الخامس: الكيمياء العضوية',
    title: 'تفاعل الإيثين مع ماء البروم الأحمر (كشف عدم التشبع)',
    unbalanced: 'C2H4 + Br2 -> C2H4Br2',
    balanced: 'C2H4 + Br2 -> C2H4Br2',
    coefficients: { reactants: [1, 1], products: [1] },
    conditions: 'مذاب في رابع كلوريد الكربون (CCl4)',
    colorChange: 'يزول لون ماء البروم الأحمر تماماً',
    notes: 'تفاعل إضافة يُستخدم للتمييز العملي بين الألكانات والألكينات، ويتكون 1,2-ثنائي برومو إيثان عديم اللون.'
  }
];

/**
 * Calculates Titration Equivalence (حسابات المعايرة الكمية)
 * Formula: (Ma * Va) / na = (Mb * Vb) / nb
 */
export function calculateTitration({ Ma, Va, na, Mb, Vb, nb }) {
  const parsed = {
    Ma: parseFloat(Ma) || null,
    Va: parseFloat(Va) || null,
    na: parseFloat(na) || 1,
    Mb: parseFloat(Mb) || null,
    Vb: parseFloat(Vb) || null,
    nb: parseFloat(nb) || 1
  };

  // Solve for missing variable
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
