/**
 * bedigital Brand Identity Components (Platform-Harmonized Emerald Edition)
 * Blends bedigital's 24×24 pixel-grid geometry & Nuqta Gold (#E0A526)
 * with Kimyawy's signature Emerald Green palette (#064e3b, #059669, #10b981).
 */

export function renderMonitorBaSvg({ size = 40 } = {}) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" shape-rendering="crispEdges" aria-label="bedigital Monitor Ba">
      <!-- Pixel-Stepped Monitor Frame in Platform Emerald -->
      <rect x="2" y="3" width="16" height="2" fill="#10b981"/>
      <rect x="18" y="2" width="2" height="2" fill="#10b981"/>
      <rect x="20" y="1" width="2" height="2" fill="#34d399"/>
      <rect x="22" y="3" width="1" height="1" fill="#6ee7b7"/>
      <rect x="1" y="5" width="20" height="13" fill="#064e3b"/>
      <rect x="1" y="4" width="2" height="14" fill="#10b981"/>
      <rect x="19" y="5" width="2" height="13" fill="#10b981"/>
      <rect x="2" y="17" width="18" height="2" fill="#10b981"/>
      <!-- Inner Screen -->
      <rect x="3" y="5" width="16" height="12" fill="#022c22"/>
      <!-- Square-Kufic Arabic Letter Ba (ب) in Paper White -->
      <rect x="14" y="7" width="2" height="5" fill="#FFFFFF"/>
      <rect x="6" y="10" width="10" height="2" fill="#FFFFFF"/>
      <rect x="6" y="8" width="2" height="4" fill="#FFFFFF"/>
      <!-- Nuqta Gold Diamond beneath Ba -->
      <polygon points="11,13 12.6,14.6 11,16.2 9.4,14.6" fill="#E0A526" shape-rendering="geometricPrecision"/>
      <!-- Monitor Stand -->
      <rect x="9" y="19" width="4" height="2" fill="#10b981"/>
      <rect x="6" y="21" width="10" height="2" fill="#059669"/>
    </svg>
  `;
}

/**
 * 24×24 Grid Icons in Platform Emerald (#10b981) + Nuqta Gold (#E0A526)
 */
export function bedigitalIcon(name = 'web', size = 20) {
  const icons = {
    web: `
      <rect x="3" y="3" width="18" height="2" fill="currentColor"/>
      <rect x="3" y="19" width="18" height="2" fill="currentColor"/>
      <rect x="2" y="5" width="2" height="14" fill="currentColor"/>
      <rect x="20" y="5" width="2" height="14" fill="currentColor"/>
      <rect x="4" y="6" width="16" height="3" fill="#10b981"/>
      <polygon points="12,12 14.2,14.2 12,16.4 9.8,14.2" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `,
    apps: `
      <rect x="3" y="3" width="7" height="2" fill="currentColor"/>
      <rect x="3" y="8" width="7" height="2" fill="currentColor"/>
      <rect x="3" y="3" width="2" height="7" fill="currentColor"/>
      <rect x="8" y="3" width="2" height="7" fill="currentColor"/>
      <rect x="14" y="3" width="7" height="7" fill="#10b981"/>
      <rect x="3" y="14" width="7" height="2" fill="currentColor"/>
      <rect x="3" y="19" width="7" height="2" fill="currentColor"/>
      <rect x="3" y="14" width="2" height="7" fill="currentColor"/>
      <rect x="8" y="14" width="2" height="7" fill="currentColor"/>
      <polygon points="17.5,14 21,17.5 17.5,21 14,17.5" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `,
    code: `
      <rect x="3" y="3" width="18" height="2" fill="currentColor"/>
      <rect x="3" y="19" width="18" height="2" fill="currentColor"/>
      <rect x="2" y="5" width="2" height="14" fill="currentColor"/>
      <rect x="20" y="5" width="2" height="14" fill="currentColor"/>
      <rect x="7" y="9" width="2" height="2" fill="currentColor"/>
      <rect x="5" y="11" width="2" height="2" fill="currentColor"/>
      <rect x="7" y="13" width="2" height="2" fill="currentColor"/>
      <rect x="15" y="9" width="2" height="2" fill="currentColor"/>
      <rect x="17" y="11" width="2" height="2" fill="currentColor"/>
      <rect x="15" y="13" width="2" height="2" fill="currentColor"/>
      <rect x="9" y="16" width="6" height="2" fill="#10b981"/>
      <polygon points="12,9.5 14,11.5 12,13.5 10,11.5" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `,
    chat: `
      <rect x="3" y="3" width="18" height="2" fill="currentColor"/>
      <rect x="2" y="5" width="2" height="11" fill="currentColor"/>
      <rect x="20" y="5" width="2" height="11" fill="currentColor"/>
      <rect x="9" y="16" width="11" height="2" fill="currentColor"/>
      <rect x="5" y="16" width="2" height="4" fill="currentColor"/>
      <rect x="7" y="18" width="2" height="2" fill="currentColor"/>
      <rect x="6" y="7" width="12" height="2" fill="#10b981"/>
      <polygon points="12,10.5 14.2,12.5 12,14.5 9.8,12.5" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `,
    flask: `
      <rect x="9" y="2" width="6" height="2" fill="currentColor"/>
      <rect x="9" y="4" width="2" height="5" fill="currentColor"/>
      <rect x="13" y="4" width="2" height="5" fill="currentColor"/>
      <rect x="7" y="9" width="2" height="4" fill="currentColor"/>
      <rect x="15" y="9" width="2" height="4" fill="currentColor"/>
      <rect x="5" y="13" width="2" height="6" fill="currentColor"/>
      <rect x="17" y="13" width="2" height="6" fill="currentColor"/>
      <rect x="5" y="19" width="14" height="2" fill="currentColor"/>
      <rect x="7" y="16" width="10" height="2" fill="#10b981"/>
      <polygon points="12,10.5 14,12.5 12,14.5 10,12.5" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `
  };

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" shape-rendering="crispEdges" style="flex-shrink:0;display:inline-block;vertical-align:middle;color:#ffffff;">
      ${icons[name] || icons.web}
    </svg>
  `;
}

/**
 * Animated Pixel-Art Loader in Platform Emerald + Nuqta Gold
 */
export function renderBrandLoader(label = 'جاري التحميل...') {
  return `
    <div class="brand-pixel-loader-wrap">
      <svg class="brand-pixel-loader-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64" shape-rendering="crispEdges">
        <!-- Pixel Flask Outline -->
        <rect x="12" y="3" width="8" height="2" fill="#059669"/>
        <rect x="13" y="5" width="2" height="6" fill="#059669"/>
        <rect x="17" y="5" width="2" height="6" fill="#059669"/>
        <rect x="10" y="11" width="3" height="4" fill="#059669"/>
        <rect x="19" y="11" width="3" height="4" fill="#059669"/>
        <rect x="7" y="15" width="3" height="10" fill="#059669"/>
        <rect x="22" y="15" width="3" height="10" fill="#059669"/>
        <rect x="7" y="25" width="18" height="3" fill="#059669"/>
        <!-- Animated Emerald Liquid -->
        <rect class="pixel-liquid-bar" x="10" y="20" width="12" height="5" fill="#10b981"/>
        <!-- Rising Pixel Bubbles -->
        <rect class="pixel-bubble b1" x="12" y="17" width="2" height="2" fill="#34d399"/>
        <rect class="pixel-bubble b2" x="17" y="15" width="2" height="2" fill="#6ee7b7"/>
        <!-- Pulsing Gold Diamond Nuqta -->
        <polygon class="pixel-nuqta-pulse" points="16,10 18.5,12.5 16,15 13.5,12.5" fill="#E0A526" shape-rendering="geometricPrecision"/>
      </svg>
      <div class="brand-pixel-loader-text">${label}</div>
    </div>
  `;
}

/**
 * Animated Pixel-Art Error / Empty State Illustration in Platform Emerald + Gold
 */
export function renderBrandErrorIllustration(type = 'error') {
  const isError = type === 'error';
  const mainColor = isError ? '#ef4444' : '#059669';
  const accentColor = isError ? '#fca5a5' : '#10b981';
  return `
    <svg class="brand-pixel-state-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="76" height="76" shape-rendering="crispEdges">
      <!-- Stepped Pixel Monitor Frame -->
      <rect x="5" y="6" width="22" height="2" fill="${mainColor}"/>
      <rect x="27" y="4" width="3" height="3" fill="${accentColor}"/>
      <rect x="31" y="2" width="2" height="2" fill="#E0A526"/>
      <rect x="3" y="8" width="2" height="16" fill="${mainColor}"/>
      <rect x="27" y="8" width="2" height="16" fill="${mainColor}"/>
      <rect x="5" y="24" width="22" height="2" fill="${mainColor}"/>
      <rect x="5" y="8" width="22" height="16" fill="rgba(5,150,105,0.08)"/>
      <!-- Exclamation / Flask Symbol Inside -->
      <rect x="15" y="11" width="2" height="6" fill="${mainColor}"/>
      <polygon class="pixel-nuqta-pulse" points="16,19 18.2,21.2 16,23.4 13.8,21.2" fill="#E0A526" shape-rendering="geometricPrecision"/>
      <!-- Stand -->
      <rect x="13" y="26" width="6" height="2" fill="${accentColor}"/>
      <rect x="9" y="28" width="14" height="2" fill="${mainColor}"/>
    </svg>
  `;
}

/**
 * Compact Sidebar Bottom Logo Badge (Shown after login at the very bottom of the sidebar)
 */
export function renderBedigitalSidebarBadge() {
  return `
    <div class="bedigital-sidebar-footer" dir="ltr">
      ${renderMonitorBaSvg({ size: 28 })}
      <div class="bedigital-sidebar-footer-text">
        <div class="bedigital-sidebar-wordmark">
          <span class="be-part">be</span><span class="digital-part">digital</span>
          <span class="nuqta-diamond"></span>
        </div>
        <div class="bedigital-sidebar-sub">ابدأ بنقطة · Start with a dot.</div>
      </div>
    </div>
  `;
}

/**
 * Clean, Subtle Landing Page Footer (Shown ONLY on the Landing Page '/')
 */
export function renderBedigitalFooter() {
  return `
    <div class="bedigital-corporate-footer" dir="rtl" aria-label="bedigital Brand Footer">
      <div class="bedigital-dissolve-strip" aria-hidden="true"></div>
      <div class="bedigital-footer-inner" style="padding: 24px 24px 20px;">
        <div class="bedigital-footer-bottom" style="border-top:none; padding-top:0;">
          <div class="bedigital-lockup" dir="ltr" style="margin-bottom:0;">
            ${renderMonitorBaSvg({ size: 38 })}
            <div class="bedigital-wordmark-wrap">
              <div class="bedigital-wordmark-text" style="font-size:1.5rem;">
                <span class="be-part">be</span><span class="digital-part">digital</span>
                <span class="nuqta-diamond" aria-hidden="true"></span>
              </div>
              <div class="bedigital-pixel-tag">ابدأ بنقطة · START WITH A DOT</div>
            </div>
          </div>

          <div class="bedigital-copyright" dir="ltr">
            <span>POWERED BY</span>
            <strong class="bedigital-badge-inline">bedigital</strong>
            <span class="bedigital-gold-dot" aria-hidden="true"></span>
            <span>© ${new Date().getFullYear()} KIMYAWY PLATFORM</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
