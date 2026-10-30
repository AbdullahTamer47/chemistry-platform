import { esc } from './helpers.js';

// Known chemical elements (1-2 letters) to avoid false positives on random English words
const ELEMENT_SYMBOLS = new Set([
  'H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar',
  'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr',
  'Rb','Sr','Y','Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I','Xe',
  'Cs','Ba','La','Ce','Pr','Nd','Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu',
  'Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg','Tl','Pb','Bi','Po','At','Rn','Fr','Ra','Ac','Th','Pa','U'
]);

/**
 * Checks if a token looks like a valid chemical formula or ion (e.g. H2O, H2SO4, Ca(OH)2, Fe^3+, SO4^2-, Cu2+, 3d5, 4s2)
 */
function isChemicalToken(token) {
  if (!token || token.length < 2) return false;
  // Electron configuration orbital like 4s2, 3d10, 2p6, 3d^5
  if (/^[1-7][spdf]\^?\d{1,2}$/i.test(token)) return true;
  // Equilibrium constants like K_c, K_p, K_sp, K_a, K_b, K_w
  if (/^K_(?:sp|c|p|a|b|w)$/i.test(token)) return true;
  // Contains explicit ion charge ^2+, ^3-, ^+, ^-
  if (/\^\d*[+-]/.test(token)) return true;
  // Standard formula with capital element symbol(s) and digits/parentheses
  if (!/[0-9]/.test(token)) return false;
  // Strip leading stoichiometric number
  const core = token.replace(/^\d+/, '').replace(/\([slgaq]+\)$/i, '');
  if (!core) return false;
  const elements = core.match(/[A-Z][a-z]?/g);
  if (!elements || elements.length === 0) return false;
  return elements.every(el => ELEMENT_SYMBOLS.has(el));
}

/**
 * Formats a single chemical formula/species into HTML with proper <sub>, <sup>, states, and coefficients.
 */
export function formatChemicalSpeciesHtml(rawSpecies) {
  if (!rawSpecies) return '';
  let s = String(rawSpecies).trim();

  // Handle gas evolution / precipitate symbols
  if (s === '^' || s === '↑' || s === '(g)↑') return '<span class="chem-precip-gas" title="تصاعد غاز">↑</span>';
  if (s === 'v' || s === '↓' || s === '(s)↓') return '<span class="chem-precip-gas" title="تكوّن راسب">↓</span>';

  // Extract trailing state like (s), (l), (g), (aq), (v)
  let stateSuffix = '';
  const stateMatch = s.match(/\((s|l|g|aq|v|صلب|سائل|غاز|محلول)\)$/i);
  if (stateMatch) {
    stateSuffix = `<sub class="chem-state">(${esc(stateMatch[1])})</sub>`;
    s = s.slice(0, s.length - stateMatch[0].length).trim();
  }

  // Handle electron orbital notation like 4s2, 3d6, 3d^5
  if (/^[1-7][spdf]\^?\d{1,2}$/i.test(s)) {
    return s.replace(/^([1-7][spdf])\^?(\d{1,2})$/i, (_, orb, cnt) => `${esc(orb)}<sup>${esc(cnt)}</sup>`);
  }

  // Handle K_c, K_p, K_sp, K_a, K_b, K_w
  if (/^K_(sp|c|p|a|b|w)$/i.test(s)) {
    return s.replace(/^K_(sp|c|p|a|b|w)$/i, (_, sub) => `K<sub>${esc(sub)}</sub>`);
  }

  // Extract leading stoichiometric coefficient (e.g. 2FeCl3 -> coeff 2, rest FeCl3)
  let coeffHtml = '';
  const coeffMatch = s.match(/^(\d+(?:\/\d+)?)\s*(?=[A-Z(\[])/);
  if (coeffMatch) {
    coeffHtml = `<span class="chem-coeff">${esc(coeffMatch[1])}</span>`;
    s = s.slice(coeffMatch[0].length);
  }

  // Extract explicit superscript charge at the end: e.g. Fe^3+, SO4^2-, NH4^+, Cl^-, Fe^{3+}
  let chargeHtml = '';
  const explicitCharge = s.match(/\^\{?(\d*[+-]|[+-]\d*)\}?$/);
  if (explicitCharge) {
    const ch = explicitCharge[1].replace('-', '−');
    chargeHtml = `<sup>${esc(ch)}</sup>`;
    s = s.slice(0, s.length - explicitCharge[0].length);
  } else {
    // Implicit charge like Fe3+, Cu2+, Na+, Cl-
    const implicitCharge = s.match(/([A-Za-z0-9)])(\d+[+-]|[+-])$/);
    if (implicitCharge) {
      const ch = implicitCharge[2].replace('-', '−');
      chargeHtml = `<sup>${esc(ch)}</sup>`;
      s = s.slice(0, s.length - implicitCharge[2].length);
    }
  }

  // Escape the core formula and convert subscripts:
  // Any number following an element letter, closing parenthesis ), or closing bracket ] becomes <sub>
  // Also hydrate dots: .5H2O or *5H2O -> ·5H2O
  let formattedCore = esc(s)
    .replace(/[.*](\d+)([A-Z])/g, '·<span class="chem-coeff">$1</span>$2')
    .replace(/([A-Za-z)\]])_?(\d+)/g, '$1<sub>$2</sub>');

  return `${coeffHtml}${formattedCore}${chargeHtml}${stateSuffix}`;
}

/**
 * Formats a full chemical equation string (with reactants, arrows, conditions, and products)
 * Always wrapped in dir="ltr" so RTL Arabic layout never inverts the equation.
 */
export function renderChemEquation(rawEq, conditionText = '') {
  if (!rawEq) return '';
  let eq = String(rawEq).trim();
  // Strip wrapping \ce{...} if present
  const ceMatch = eq.match(/^\\ce\{([\s\S]+)\}$/);
  if (ceMatch) eq = ceMatch[1].trim();

  // Check for inline condition inside arrow like ->[Δ] or ->[\Delta] or ->[Heat]
  let inlineCond = conditionText ? String(conditionText).trim() : '';
  eq = eq.replace(/(?:<=>|<->|->|⟶|→|⇌)\[([^\]]+)\]/g, (full, cond) => {
    if (!inlineCond) {
      inlineCond = cond.replace(/\\Delta/g, 'Δ').replace(/\\text\{([^}]+)\}/g, '$1');
    }
    return full.startsWith('<') || full.startsWith('⇌') ? ' ⇌ ' : ' -> ';
  });

  // Determine arrow type
  let arrowSym = '⟶';
  let arrowSplitter = /\s*(?:->|⟶|→|=)\s*/;
  if (/<=>|<->|⇌|⇄/.test(eq)) {
    arrowSym = '⇌';
    arrowSplitter = /\s*(?:<=>|<->|⇌|⇄)\s*/;
  }

  const sides = eq.split(arrowSplitter);
  if (sides.length < 2) {
    // Single formula or expression
    return `<span class="chem-equation-ltr" dir="ltr">${formatChemicalSpeciesHtml(eq)}</span>`;
  }

  const formatSide = (sideStr) => {
    // Split by ' + ' while preserving charges like Fe^3+
    const parts = sideStr.trim().split(/\s+\+\s+/);
    return parts.map(part => formatChemicalSpeciesHtml(part.trim())).join(' <span class="chem-plus">+</span> ');
  };

  const leftHtml = formatSide(sides[0]);
  const rightHtml = formatSide(sides.slice(1).join(' -> '));

  const arrowHtml = inlineCond
    ? `<span class="chem-arrow-wrap"><span class="chem-arrow-cond">${esc(inlineCond)}</span><span class="chem-arrow-sym">${arrowSym}</span></span>`
    : `<span class="chem-arrow-sym">${arrowSym}</span>`;

  return `<span class="chem-equation-ltr" dir="ltr">${leftHtml} ${arrowHtml} ${rightHtml}</span>`;
}

/**
 * Renders LaTeX/KaTeX expression if KaTeX is loaded in the browser, with a clean scientific HTML fallback.
 */
function renderLatexSegment(latex, displayMode = false) {
  const clean = String(latex || '').trim();
  if (!clean) return '';

  // Check if it's a \ce{...} chemical equation
  const ceOnly = clean.match(/^\\ce\{([\s\S]+)\}$/);
  if (ceOnly) {
    if (typeof window !== 'undefined' && window.katex) {
      try {
        return `<span class="chem-katex-wrap" dir="ltr">${window.katex.renderToString(clean, {
          displayMode,
          throwOnError: false,
          trust: true
        })}</span>`;
      } catch (e) {}
    }
    return renderChemEquation(ceOnly[1]);
  }

  if (typeof window !== 'undefined' && window.katex) {
    try {
      return `<span class="chem-katex-wrap" dir="ltr">${window.katex.renderToString(clean, {
        displayMode,
        throwOnError: false,
        trust: true
      })}</span>`;
    } catch (e) {}
  }

  // Fallback scientific formatter for LaTeX when offline or without KaTeX
  const fallback = clean
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\rightarrow|\\to/g, '⟶')
    .replace(/\\rightleftharpoons/g, '⇌')
    .replace(/\\xrightarrow\[?[^\]]*\]?\{([^}]*)\}/g, '->[$1]');

  if (/->|⟶|⇌/.test(fallback)) {
    return renderChemEquation(fallback);
  }

  const html = esc(fallback)
    .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
    .replace(/\^([0-9+-]+)/g, '<sup>$1</sup>')
    .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>')
    .replace(/_([0-9a-zA-Z]+)/g, '<sub>$1</sub>');

  return `<span class="chem-equation-ltr" dir="ltr">${html}</span>`;
}

/**
 * Full Scientific Markdown + Chemical Notation + KaTeX renderer.
 * Safe against XSS: escapes raw HTML first, then transforms placeholders, Markdown, and chemical formulas.
 */
export function renderChemMarkdown(rawText) {
  if (rawText === null || rawText === undefined) return '';
  const str = String(rawText);
  if (!str.trim()) return '';

  const placeholders = [];
  const addPlaceholder = (html) => {
    const key = `@@CHEM_PH_${placeholders.length}@@`;
    placeholders.push(html);
    return key;
  };

  // 1. Extract explicit \ce{...} blocks
  let processed = str.replace(/\\ce\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, inner) => {
    return addPlaceholder(renderChemEquation(inner));
  });

  // 2. Extract display math $$...$$
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    return addPlaceholder(`<div class="chem-math-block" dir="ltr">${renderLatexSegment(math, true)}</div>`);
  });

  // 3. Extract inline math $...$
  processed = processed.replace(/\$([^\n$]+?)\$/g, (_, math) => {
    return addPlaceholder(renderLatexSegment(math, false));
  });

  // 4. Extract inline code `...`
  processed = processed.replace(/`([^`\n]+)`/g, (_, code) => {
    const trimmed = code.trim();
    if (/->|⇌|<=>/.test(trimmed)) {
      return addPlaceholder(renderChemEquation(trimmed));
    }
    return addPlaceholder(`<code class="chem-inline-code" dir="ltr">${ formatChemicalSpeciesHtml(trimmed) }</code>`);
  });

  // 5. Auto-detect plain-text chemical equations (e.g. 2H2 + O2 -> 2H2O or N2 + 3H2 <=> 2NH3)
  processed = processed.replace(
    /(?:^|(?=\s))([0-9A-Za-z()[\].+\s]{2,45}(?:->|<=>|<->|⟶|→|⇌)(?:\[[^\]]+\])?\s*[0-9A-Za-z()[\].+\s↑↓^v]{2,45})(?=$|\s|[،.؟!])/g,
    (match, eqPart) => {
      // Verify at least one side has a valid chemical symbol
      const tokens = eqPart.split(/[\s+->=⇌⟶→[\]]+/).filter(Boolean);
      if (tokens.some(t => isChemicalToken(t) || ELEMENT_SYMBOLS.has(t.replace(/^\d+/, '')))) {
        const leadingSpace = match.startsWith(' ') ? ' ' : '';
        return leadingSpace + addPlaceholder(renderChemEquation(eqPart.trim()));
      }
      return match;
    }
  );

  // 6. Escape remaining plain text for XSS safety
  let safe = esc(processed);

  // 7. Auto-detect standalone chemical formulas / ions inside text (e.g. H2SO4, Fe3O4, Ca(OH)2, Fe^3+, SO4^2-, 3d^5)
  safe = safe.replace(
    /(^|[\s(،:«"])(\d*[A-Z][A-Za-z0-9()]*\^\d*[+-]|\d*[A-Z][A-Za-z0-9()]+[0-9][A-Za-z0-9()^+-]*|[1-7][spdf]\^?\d{1,2}|K_(?:sp|c|p|a|b|w))(?=[\s)،.!؟:»"]|$)/g,
    (full, prefix, token) => {
      if (isChemicalToken(token)) {
        return `${prefix}<span class="chem-formula-inline" dir="ltr">${formatChemicalSpeciesHtml(token)}</span>`;
      }
      return full;
    }
  );

  // 8. Format standalone arrows in text
  safe = safe
    .replace(/\s*-&gt;\s*/g, ' <span class="chem-formula-inline" dir="ltr">⟶</span> ')
    .replace(/\s*&lt;=&gt;\s*/g, ' <span class="chem-formula-inline" dir="ltr">⇌</span> ');

  // 9. Apply Markdown formatting (Bold, Italic, Lists, Line breaks)
  safe = safe
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');

  // 10. Restore placeholders
  placeholders.forEach((html, idx) => {
    safe = safe.replace(`@@CHEM_PH_${idx}@@`, html);
  });

  return safe;
}

/**
 * Renders a quick chemical & scientific insertion toolbar for any input or textarea.
 */
export function renderChemToolbar(targetInputId, { compact = false } = {}) {
  const chips = [
    { label: '→ سهم تفاعل', insert: ' -> ' },
    { label: '⇌ اتزان', insert: ' <=> ' },
    { label: 'Δ تسخين', insert: ' ->[Δ] ' },
    { label: '↑ غاز', insert: ' ↑ ' },
    { label: '↓ راسب', insert: ' ↓ ' },
    { label: 'H₂SO₄', insert: 'H2SO4' },
    { label: 'Fe₃O₄', insert: 'Fe3O4' },
    { label: 'Ca(OH)₂', insert: 'Ca(OH)2' },
    { label: 'Fe³⁺', insert: 'Fe^3+' },
    { label: 'SO₄²⁻', insert: 'SO4^2-' },
    { label: '(aq)', insert: '(aq)' },
    { label: '(s)', insert: '(s)' },
    { label: '3d⁵', insert: '3d^5' },
  ];

  return `
    <div class="chem-quick-toolbar ${compact ? 'compact' : ''}" data-target-input="${esc(targetInputId)}">
      <span class="chem-toolbar-label">
        <span class="material-symbols-rounded" style="font-size:0.95rem;">science</span>
        رموز وصيغ كيميائية:
      </span>
      <div class="chem-toolbar-Row">
        ${chips.map(c => `
          <button type="button" class="chem-toolbar-chip" data-insert="${esc(c.insert)}" title="إدراج ${esc(c.label)}">
            <span dir="ltr">${esc(c.label)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Binds click events on all .chem-quick-toolbar instances inside container.
 */
export function bindChemToolbars(container = document) {
  if (!container) return;
  container.querySelectorAll('.chem-quick-toolbar').forEach(toolbar => {
    if (toolbar.dataset.bound === '1') return;
    toolbar.dataset.bound = '1';
    const targetId = toolbar.dataset.targetInput;
    toolbar.querySelectorAll('.chem-toolbar-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const textToInsert = btn.dataset?.insert || '';
        const input = document.getElementById(targetId);
        if (!input) return;
        const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
        const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
        const val = input.value || '';
        input.value = val.slice(0, start) + textToInsert + val.slice(end);
        input.focus();
        const nextPos = start + textToInsert.length;
        try { input.setSelectionRange(nextPos, nextPos); } catch (_) {}
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  });
}

