/**
 * bedigital Corporate Brand Identity System (v1.0)
 * "ابدأ بنقطة · Start with a dot." | "رقمي، بنقطة. · Digital, with a nuqta."
 *
 * Strict adherence to the 12-page Brand Identity Guidelines:
 * - Midnight Navy: #0B1F3A
 * - Paper White:   #FFFFFF
 * - Signal Teal:   #0FB5AE (Ramp: #0C4C5D, #0D717A, #0E9797, #0FB5AE, #3FC4BE, #7BD6D3)
 * - Nuqta Gold:    #E0A526 (One gold diamond nuqta per icon/composition)
 * - 24×24 grid icons: 2-unit stroke, stair-step pixel corners (never curves),
 *   one Signal Teal (#0FB5AE) bar, and one Nuqta Gold (#E0A526) diamond.
 */

export function renderMonitorBaSvg({ size = 44 } = {}) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" shape-rendering="crispEdges" aria-label="bedigital Monitor Ba">
      <!-- Outer Pixel-Stepped Monitor Frame -->
      <rect x="2" y="3" width="16" height="2" fill="#0FB5AE"/>
      <rect x="18" y="2" width="2" height="2" fill="#0FB5AE"/>
      <rect x="20" y="1" width="2" height="2" fill="#3FC4BE"/>
      <rect x="22" y="3" width="1" height="1" fill="#7BD6D3"/>
      <rect x="1" y="5" width="20" height="13" fill="#0B1F3A"/>
      <rect x="1" y="4" width="2" height="14" fill="#0FB5AE"/>
      <rect x="19" y="5" width="2" height="13" fill="#0FB5AE"/>
      <rect x="2" y="17" width="18" height="2" fill="#0FB5AE"/>
      <!-- Inner Screen -->
      <rect x="3" y="5" width="16" height="12" fill="#071528"/>
      <!-- Square-Kufic Arabic Letter Ba (ب) in Paper White -->
      <rect x="14" y="7" width="2" height="5" fill="#FFFFFF"/>
      <rect x="6" y="10" width="10" height="2" fill="#FFFFFF"/>
      <rect x="6" y="8" width="2" height="4" fill="#FFFFFF"/>
      <!-- Nuqta Gold Diamond beneath Ba -->
      <polygon points="11,13 12.6,14.6 11,16.2 9.4,14.6" fill="#E0A526" shape-rendering="geometricPrecision"/>
      <!-- Monitor Stand (Pixel Stepped) -->
      <rect x="9" y="19" width="4" height="2" fill="#0FB5AE"/>
      <rect x="6" y="21" width="10" height="2" fill="#0D717A"/>
    </svg>
  `;
}

/**
 * 24×24 Grid Icons — 2-unit stroke, stair-step corners, one Signal Teal bar (#0FB5AE), one Nuqta Gold diamond (#E0A526)
 */
export function bedigitalIcon(name = 'web', size = 22) {
  const icons = {
    web: `
      <!-- Browser Frame (Stair-Step Pixel Corners) -->
      <rect x="3" y="3" width="18" height="2" fill="#FFFFFF"/>
      <rect x="3" y="19" width="18" height="2" fill="#FFFFFF"/>
      <rect x="2" y="5" width="2" height="14" fill="#FFFFFF"/>
      <rect x="20" y="5" width="2" height="14" fill="#FFFFFF"/>
      <!-- Signal Teal Top Bar -->
      <rect x="4" y="6" width="16" height="3" fill="#0FB5AE"/>
      <!-- Nuqta Gold Diamond -->
      <polygon points="12,12 14.2,14.2 12,16.4 9.8,14.2" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `,
    apps: `
      <!-- Top-Left Module -->
      <rect x="3" y="3" width="7" height="2" fill="#FFFFFF"/>
      <rect x="3" y="8" width="7" height="2" fill="#FFFFFF"/>
      <rect x="3" y="3" width="2" height="7" fill="#FFFFFF"/>
      <rect x="8" y="3" width="2" height="7" fill="#FFFFFF"/>
      <!-- Top-Right Signal Teal Accent Block -->
      <rect x="14" y="3" width="7" height="7" fill="#0FB5AE"/>
      <!-- Bottom-Left Module -->
      <rect x="3" y="14" width="7" height="2" fill="#FFFFFF"/>
      <rect x="3" y="19" width="7" height="2" fill="#FFFFFF"/>
      <rect x="3" y="14" width="2" height="7" fill="#FFFFFF"/>
      <rect x="8" y="14" width="2" height="7" fill="#FFFFFF"/>
      <!-- Bottom-Right Nuqta Gold Diamond -->
      <polygon points="17.5,14 21,17.5 17.5,21 14,17.5" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `,
    code: `
      <!-- Terminal Frame -->
      <rect x="3" y="3" width="18" height="2" fill="#FFFFFF"/>
      <rect x="3" y="19" width="18" height="2" fill="#FFFFFF"/>
      <rect x="2" y="5" width="2" height="14" fill="#FFFFFF"/>
      <rect x="20" y="5" width="2" height="14" fill="#FFFFFF"/>
      <!-- Pixel Angle Brackets < > -->
      <rect x="7" y="9" width="2" height="2" fill="#FFFFFF"/>
      <rect x="5" y="11" width="2" height="2" fill="#FFFFFF"/>
      <rect x="7" y="13" width="2" height="2" fill="#FFFFFF"/>
      <rect x="15" y="9" width="2" height="2" fill="#FFFFFF"/>
      <rect x="17" y="11" width="2" height="2" fill="#FFFFFF"/>
      <rect x="15" y="13" width="2" height="2" fill="#FFFFFF"/>
      <!-- Signal Teal Code Bar -->
      <rect x="9" y="16" width="6" height="2" fill="#0FB5AE"/>
      <!-- Nuqta Gold Diamond -->
      <polygon points="12,9.5 14,11.5 12,13.5 10,11.5" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `,
    chat: `
      <!-- Speech Frame with Stair-Step Tail -->
      <rect x="3" y="3" width="18" height="2" fill="#FFFFFF"/>
      <rect x="2" y="5" width="2" height="11" fill="#FFFFFF"/>
      <rect x="20" y="5" width="2" height="11" fill="#FFFFFF"/>
      <rect x="9" y="16" width="11" height="2" fill="#FFFFFF"/>
      <rect x="5" y="16" width="2" height="4" fill="#FFFFFF"/>
      <rect x="7" y="18" width="2" height="2" fill="#FFFFFF"/>
      <!-- Signal Teal Message Bar -->
      <rect x="6" y="7" width="12" height="2" fill="#0FB5AE"/>
      <!-- Nuqta Gold Diamond -->
      <polygon points="12,10.5 14.2,12.5 12,14.5 9.8,12.5" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `,
    growth: `
      <!-- Ascending Pixel Columns -->
      <rect x="3" y="19" width="18" height="2" fill="#FFFFFF"/>
      <rect x="4" y="14" width="3" height="5" fill="#FFFFFF"/>
      <rect x="10" y="10" width="3" height="9" fill="#FFFFFF"/>
      <!-- Signal Teal Peak Bar -->
      <rect x="16" y="6" width="3" height="13" fill="#0FB5AE"/>
      <!-- Nuqta Gold Diamond at Peak -->
      <polygon points="11.5,3.5 13.7,5.7 11.5,7.9 9.3,5.7" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `,
    security: `
      <!-- Stair-Stepped Pixel Shield -->
      <rect x="5" y="2" width="14" height="2" fill="#FFFFFF"/>
      <rect x="3" y="4" width="2" height="9" fill="#FFFFFF"/>
      <rect x="19" y="4" width="2" height="9" fill="#FFFFFF"/>
      <rect x="5" y="13" width="2" height="4" fill="#FFFFFF"/>
      <rect x="17" y="13" width="2" height="4" fill="#FFFFFF"/>
      <rect x="7" y="17" width="3" height="2" fill="#FFFFFF"/>
      <rect x="14" y="17" width="3" height="2" fill="#FFFFFF"/>
      <rect x="10" y="19" width="4" height="2" fill="#FFFFFF"/>
      <!-- Signal Teal Shield Header Bar -->
      <rect x="7" y="6" width="10" height="2" fill="#0FB5AE"/>
      <!-- Nuqta Gold Diamond Keyhole -->
      <polygon points="12,10 14.2,12.2 12,14.4 9.8,12.2" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `,
    flask: `
      <!-- Pixel Chemistry Flask -->
      <rect x="9" y="2" width="6" height="2" fill="#FFFFFF"/>
      <rect x="9" y="4" width="2" height="5" fill="#FFFFFF"/>
      <rect x="13" y="4" width="2" height="5" fill="#FFFFFF"/>
      <rect x="7" y="9" width="2" height="4" fill="#FFFFFF"/>
      <rect x="15" y="9" width="2" height="4" fill="#FFFFFF"/>
      <rect x="5" y="13" width="2" height="6" fill="#FFFFFF"/>
      <rect x="17" y="13" width="2" height="6" fill="#FFFFFF"/>
      <rect x="5" y="19" width="14" height="2" fill="#FFFFFF"/>
      <!-- Signal Teal Liquid Level -->
      <rect x="7" y="16" width="10" height="2" fill="#0FB5AE"/>
      <!-- Nuqta Gold Reaction Diamond -->
      <polygon points="12,10.5 14,12.5 12,14.5 10,12.5" fill="#E0A526" shape-rendering="geometricPrecision"/>
    `
  };

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" shape-rendering="crispEdges" style="flex-shrink:0;display:inline-block;vertical-align:middle;">
      ${icons[name] || icons.web}
    </svg>
  `;
}

/**
 * Full Corporate bedigital Footer
 */
export function renderBedigitalFooter() {
  return `
    <footer class="bedigital-corporate-footer" dir="rtl" aria-label="bedigital Brand Footer">
      <!-- Pattern 01: Dissolve Pixel Matrix Strip -->
      <div class="bedigital-dissolve-strip" aria-hidden="true"></div>

      <div class="bedigital-footer-inner">
        <!-- Top Row: Brand Lockup + Hard-Edged Slogan Card -->
        <div class="bedigital-footer-top">
          <!-- Right in RTL: Monitor Ba + Wordmark + Arabic Mission -->
          <div class="bedigital-brand-col">
            <div class="bedigital-lockup" dir="ltr">
              ${renderMonitorBaSvg({ size: 48 })}
              <div class="bedigital-wordmark-wrap">
                <div class="bedigital-wordmark-text">
                  <span class="be-part">be</span><span class="digital-part">digital</span>
                  <span class="nuqta-diamond" aria-hidden="true"></span>
                </div>
                <div class="bedigital-pixel-tag">PIXEL PERFECT · DIGITAL STUDIO</div>
              </div>
            </div>

            <h3 class="bedigital-ar-headline">ابدأ بنقطة · <span dir="ltr">Start with a dot.</span></h3>
            <p class="bedigital-ar-body">
              منصة <strong>كيمياوي</strong> التعليمية مُصممة ومُطورة بالكامل بمعايير <strong>bedigital</strong> الهندسية — نحوّل النقطة الواحدة إلى منظومة تعليمية رقمية متكاملة فائقة السرعة والأمان.
            </p>
          </div>

          <!-- Left in RTL: Hard-Shadow Callout Card (0px radius, 6px 6px 0 #0FB5AE solid shadow) -->
          <div class="bedigital-hard-card">
            <div class="bedigital-hard-card-header">
              <span class="bedigital-silkscreen-badge" dir="ltr">SYSTEM ARCHITECTURE · v2.5</span>
              <span class="bedigital-nuqta-inline" aria-hidden="true"></span>
            </div>
            <div class="bedigital-hard-card-title">رقمي، بنقطة. · <span dir="ltr">Digital, with a nuqta.</span></div>
            <p class="bedigital-hard-card-desc">
              حماية مشفرة للفيديوهات، مختبر كيميائي ذكي، وبنية تحتية سحابية تعمل بأعلى كفاءة على جميع الهواتف والشبكات.
            </p>
            <div class="bedigital-icon-pills">
              <span class="bedigital-icon-pill">${bedigitalIcon('web', 18)} <span>ويب · Web</span></span>
              <span class="bedigital-icon-pill">${bedigitalIcon('apps', 18)} <span>تطبيقات · Apps</span></span>
              <span class="bedigital-icon-pill">${bedigitalIcon('code', 18)} <span>كود · Code</span></span>
              <span class="bedigital-icon-pill">${bedigitalIcon('chat', 18)} <span>محادثة · Chat</span></span>
              <span class="bedigital-icon-pill">${bedigitalIcon('growth', 18)} <span>نمو · Growth</span></span>
              <span class="bedigital-icon-pill">${bedigitalIcon('security', 18)} <span>أمان · Security</span></span>
            </div>
          </div>
        </div>

        <!-- Bottom Bar -->
        <div class="bedigital-footer-bottom">
          <div class="bedigital-footer-links">
            <a href="/courses" class="bedigital-footer-link">${bedigitalIcon('apps', 16)} الكورسات والمحاضرات</a>
            <a href="/lab" class="bedigital-footer-link">${bedigitalIcon('flask', 16)} المختبر الكيميائي التفاعلي</a>
            <a href="/exams" class="bedigital-footer-link">${bedigitalIcon('code', 16)} الامتحانات والتقييمات</a>
          </div>
          <div class="bedigital-copyright" dir="ltr">
            <span>POWERED &amp; ENGINEERED BY</span>
            <strong class="bedigital-badge-inline">bedigital</strong>
            <span class="bedigital-gold-dot" aria-hidden="true"></span>
            <span>ALL RIGHTS RESERVED © ${new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </footer>
  `;
}
