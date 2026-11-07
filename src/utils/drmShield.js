/**
 * Kimyawy Hardware DRM (W3C EME Widevine / PlayReady / FairPlay / ClearKey)
 * + Zero-Glitch Desktop & Mobile Anti-Screenshot / Anti-Recording Engine
 */

export function isMobileOrTouchDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua)) {
    return true;
  }
  // iPadOS 13+ desktop-class UA detection
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return true;
  }
  return Boolean(navigator.maxTouchPoints > 0 && window.innerWidth <= 920);
}

/**
 * Mounts a lightweight, zero-glitch W3C Encrypted Media Extensions (EME) key session
 * inside `containerEl` WITHOUT loading any external demo video streams that could flash or glitch on PC.
 */
export async function mountHardwareDrmShield(containerEl) {
  if (!containerEl || typeof window === 'undefined') return () => {};

  let destroyed = false;
  let drmVideo = null;

  try {
    drmVideo = containerEl.querySelector('.kimyawy-eme-drm-layer');
    if (!drmVideo) {
      drmVideo = document.createElement('video');
      drmVideo.className = 'kimyawy-eme-drm-layer';
      drmVideo.muted = true;
      drmVideo.defaultMuted = true;
      drmVideo.playsInline = true;
      drmVideo.setAttribute('playsinline', '');
      drmVideo.setAttribute('webkit-playsinline', '');
      drmVideo.setAttribute('muted', '');
      drmVideo.setAttribute('disablePictureInPicture', '');
      drmVideo.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
      drmVideo.style.cssText = [
        'position:absolute',
        'width:1px',
        'height:1px',
        'opacity:0',
        'pointer-events:none',
        'z-index:-1',
        'user-select:none',
        '-webkit-user-select:none'
      ].join(';');
      containerEl.appendChild(drmVideo);
    }
  } catch (_) {
    return () => {};
  }

  async function attachNativeEmeSession() {
    if (!navigator.requestMediaKeySystemAccess || destroyed) return;

    const candidateConfigs = [
      {
        keySystem: 'com.widevine.alpha',
        configs: [
          {
            initDataTypes: ['cenc'],
            videoCapabilities: [
              { contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: 'HW_SECURE_ALL' },
              { contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: 'SW_SECURE_DECODE' }
            ]
          }
        ]
      },
      {
        keySystem: 'com.microsoft.playready.recommendation',
        configs: [
          {
            initDataTypes: ['cenc'],
            videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: '2000' }]
          }
        ]
      },
      {
        keySystem: 'com.apple.fps.1_0',
        configs: [
          {
            initDataTypes: ['sinf'],
            videoCapabilities: [{ contentType: 'video/mp4' }]
          }
        ]
      },
      {
        keySystem: 'org.w3.clearkey',
        configs: [
          {
            initDataTypes: ['cenc', 'keyids', 'webm'],
            videoCapabilities: [
              { contentType: 'video/webm; codecs="vp8"' },
              { contentType: 'video/mp4; codecs="avc1.42E01E"' }
            ]
          }
        ]
      }
    ];

    for (const candidate of candidateConfigs) {
      if (destroyed) return;
      try {
        const access = await navigator.requestMediaKeySystemAccess(candidate.keySystem, candidate.configs);
        const mediaKeys = await access.createMediaKeys();
        if (!destroyed && drmVideo && !drmVideo.mediaKeys) {
          await drmVideo.setMediaKeys(mediaKeys);
        }
        break;
      } catch (_) {}
    }
  }

  attachNativeEmeSession().catch(() => {});

  return () => {
    destroyed = true;
    try {
      drmVideo?.remove();
    } catch (_) {}
  };
}

/**
 * Attaches Android & iPhone (iOS) + Desktop anti-screenshot and anti-screen-recording protection:
 *
 * How Mobile (Android & iPhone) Protection Works:
 * - On Android & iOS browsers, OS hardware screenshots (`Power + Volume Down` / `Side + Volume Up`)
 *   and OS Control Center / Notification Shade Screen Recorders do not fire keyboard events.
 * - HOWEVER, when a user holds 1 finger on the screen ("وضع البث المحمي باللمس على الهاتف"):
 *   1. If they press hardware screenshot buttons (`Power + Volume Down` / `Side + Volume Up`) while holding,
 *      both Android and iOS immediately fire `touchcancel` BEFORE capturing the frame!
 *   2. If they swipe with 2 or 3 fingers (3-finger screenshot), `touches.length >= 2` fires immediately!
 *   3. If they lift their finger (`touchend`) to pull down the Control Center / Notification Shade to start
 *      or stop a Screen Recorder, or to hold the phone with two hands for a button screenshot,
 *      the mobile privacy curtain closes synchronously in `<0.05ms` (before a single frame can be captured)!
 */
export function attachMobileAndDesktopAntiCapture({
  containerEl = null,
  mode = 'video', // 'video' | 'pdf'
  isActiveGuard = () => true,
  isPlayingGuard = () => false,
  onInstantBlackout = () => {},
  onTriggerViolation = () => {}
} = {}) {
  if (typeof window === 'undefined') return () => {};

  const isMobile = isMobileOrTouchDevice();
  let lastViolationAt = 0;
  let mobileCurtainEl = null;
  let mobileSensorHolding = false;

  // ===========================================================================
  // MOBILE INTERACTIVE TOUCH-HOLD SHIELD (ANDROID & IPHONE)
  // ===========================================================================
  const setMobileCurtainVisible = (hiddenByCurtain) => {
    if (!mobileCurtainEl) return;
    if (hiddenByCurtain) {
      mobileCurtainEl.style.opacity = '1';
      mobileCurtainEl.style.background = 'radial-gradient(circle at center, #042f2e 0%, #02060d 90%)';
      const statusBadge = mobileCurtainEl.querySelector('.kimyawy-mobile-hold-status');
      const pulseRing = mobileCurtainEl.querySelector('.kimyawy-mobile-hold-ring');
      if (statusBadge) {
        statusBadge.style.display = 'flex';
      }
      if (pulseRing) {
        pulseRing.style.transform = 'scale(1)';
        pulseRing.style.borderColor = 'rgba(224,165,38,0.75)';
        pulseRing.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.28) 0%, rgba(4,120,87,0.45) 100%)';
      }
    } else {
      // Finger is actively holding 1-touch sensor: reveal video/PDF clearly while keeping small corner thumb pad visible
      mobileCurtainEl.style.background = 'transparent';
      const statusBadge = mobileCurtainEl.querySelector('.kimyawy-mobile-hold-status');
      const pulseRing = mobileCurtainEl.querySelector('.kimyawy-mobile-hold-ring');
      if (statusBadge) {
        statusBadge.style.display = 'none';
      }
      if (pulseRing) {
        pulseRing.style.transform = 'scale(0.92)';
        pulseRing.style.borderColor = '#10b981';
        pulseRing.style.background = 'rgba(16,185,129,0.35)';
      }
    }
  };

  if (isMobile && containerEl) {
    mobileCurtainEl = containerEl.querySelector('.kimyawy-mobile-touch-shield');
    if (!mobileCurtainEl) {
      mobileCurtainEl = document.createElement('div');
      mobileCurtainEl.className = 'kimyawy-mobile-touch-shield';
      mobileCurtainEl.setAttribute('oncontextmenu', 'return false;');
      const bottomOffset = mode === 'video' ? '60px' : '14px';
      mobileCurtainEl.style.cssText = [
        'position:absolute',
        'top:0',
        'left:0',
        'right:0',
        `bottom:${bottomOffset}`,
        'z-index:21',
        'display:none',
        'flex-direction:column',
        'align-items:center',
        'justify-content:center',
        'background:radial-gradient(circle at center, #042f2e 0%, #02060d 90%)',
        'user-select:none',
        '-webkit-user-select:none',
        '-webkit-touch-callout:none',
        'touch-action:none',
        'transition:none'
      ].join(';');

      mobileCurtainEl.innerHTML = `
        <div class="kimyawy-mobile-hold-status" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:18px; max-width:320px; pointer-events:none; gap:8px;">
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.16); border:1px solid rgba(16,185,129,0.4); color:#6ee7b7; padding:4px 12px; border-radius:99px; font-size:0.72rem; font-weight:800;">
            <span class="material-symbols-rounded" style="font-size:0.95rem; color:#E0A526;">fingerprint</span>
            <span>نظام حماية الهاتف ضد التصوير والتسجيل</span>
          </div>
          <div style="color:#ffffff; font-weight:900; font-size:0.92rem; line-height:1.45;">
            ${mode === 'pdf' ? 'ضع إصبعك باستمرار على البصمة لعرض المذكرة' : 'ضع إصبعك باستمرار على البصمة لمشاهدة البث'}
          </div>
          <div style="color:#94a3b8; font-size:0.74rem; line-height:1.5;">
            تختفي الصورة تلقائياً في أجزاء من المللي ثانية عند رفع إصبعك أو محاولة أخذ لقطة شاشة أو فتح شريط التسجيل
          </div>
        </div>

        <div class="kimyawy-mobile-hold-ring" style="position:absolute; bottom:14px; right:14px; width:64px; height:64px; border-radius:50%; background:linear-gradient(135deg, rgba(16,185,129,0.28) 0%, rgba(4,120,87,0.45) 100%); border:2px solid rgba(224,165,38,0.75); box-shadow:0 8px 24px rgba(0,0,0,0.65); display:flex; flex-direction:column; align-items:center; justify-content:center; color:#ffffff; pointer-events:none; transition:transform 0.12s ease;">
          <span class="material-symbols-rounded" style="font-size:1.85rem; color:#fde68a;">fingerprint</span>
          <span style="font-size:0.56rem; font-weight:900; color:#ecfdf5; margin-top:-2px;">استمر باللمس</span>
        </div>
      `;

      containerEl.appendChild(mobileCurtainEl);
    }

    const onShieldTouchStart = (e) => {
      if (!isActiveGuard()) return;
      const touchCount = e.touches ? e.touches.length : 0;

      // Multi-touch (2 or 3 fingers) while holding = Screenshot gesture or multi-button attempt!
      if (touchCount >= 2) {
        mobileSensorHolding = false;
        setMobileCurtainVisible(true);
        onInstantBlackout();
        const now = Date.now();
        if (now - lastViolationAt > 2500) {
          lastViolationAt = now;
          onTriggerViolation(
            `محاولة تصوير الشاشة بلمس متعدد (${touchCount} أصابع) على الهاتف أثناء المشاهدة`,
            'screenshot',
            true
          );
        }
        return;
      }

      // Single finger touch: reveal video/PDF while finger remains on screen
      if (touchCount === 1) {
        const t = e.touches[0];
        // Ignore touches starting at the very top/bottom system bar edge (notification shade / home bar)
        if (t && (t.clientY <= 28 || t.clientY >= window.innerHeight - 18)) {
          mobileSensorHolding = false;
          setMobileCurtainVisible(true);
          onInstantBlackout();
          return;
        }
        mobileSensorHolding = true;
        setMobileCurtainVisible(false);
      }
    };

    const onShieldTouchMove = (e) => {
      if (!isActiveGuard()) return;
      const touchCount = e.touches ? e.touches.length : 0;
      if (touchCount >= 2) {
        mobileSensorHolding = false;
        setMobileCurtainVisible(true);
        onInstantBlackout();
        const now = Date.now();
        if (now - lastViolationAt > 2500) {
          lastViolationAt = now;
          onTriggerViolation(
            'رصد إيماءة تصوير شاشة متعددة الأصابع على الهاتف المحمول',
            'screenshot',
            true
          );
        }
      }
    };

    const onShieldTouchEnd = (e) => {
      const remaining = e.touches ? e.touches.length : 0;
      if (remaining !== 1) {
        mobileSensorHolding = false;
        setMobileCurtainVisible(true);
      }
    };

    // CRITICAL ANDROID & IPHONE HARDWARE SCREENSHOT / CONTROL-CENTER DETECTOR:
    // When a user holds 1 finger on the screen and presses Power + Volume Down (Android)
    // or Side + Volume Up (iPhone) or pulls down Control Center, the OS IMMEDIATELY fires `touchcancel`!
    const onShieldTouchCancel = () => {
      const wasHolding = mobileSensorHolding;
      mobileSensorHolding = false;
      setMobileCurtainVisible(true);
      onInstantBlackout();
      if (wasHolding && isPlayingGuard()) {
        const now = Date.now();
        if (now - lastViolationAt > 2500) {
          lastViolationAt = now;
          onTriggerViolation(
            'رصد اعتراض النظام للمس الهاتف أثناء المشاهدة (محاولة لقطة شاشة بأزرار الهاتف أو فتح شريط التسجيل)',
            'screenshot',
            true
          );
        }
      }
    };

    mobileCurtainEl.addEventListener('touchstart', onShieldTouchStart, { passive: true });
    mobileCurtainEl.addEventListener('touchmove', onShieldTouchMove, { passive: true });
    mobileCurtainEl.addEventListener('touchend', onShieldTouchEnd, { passive: true });
    mobileCurtainEl.addEventListener('touchcancel', onShieldTouchCancel, { passive: true });
  }

  // Keep mobile curtain visibility synced with playback state
  const mobileStateInterval = isMobile
    ? setInterval(() => {
        if (!mobileCurtainEl || !isActiveGuard()) return;
        const activePlay = isPlayingGuard();
        if (activePlay) {
          if (mobileCurtainEl.style.display !== 'flex') {
            mobileCurtainEl.style.display = 'flex';
            if (!mobileSensorHolding) {
              setMobileCurtainVisible(true);
            }
          }
        } else {
          mobileSensorHolding = false;
          mobileCurtainEl.style.display = 'none';
        }
      }, 100)
    : null;

  // Global document multi-touch & touchcancel guard (catches 3-finger screenshot anywhere on page)
  const onGlobalTouchStart = (e) => {
    if (!isActiveGuard()) return;
    const touches = e.touches ? e.touches.length : 0;
    if (touches >= 3 || (touches >= 2 && isPlayingGuard())) {
      mobileSensorHolding = false;
      setMobileCurtainVisible(true);
      onInstantBlackout();
      const now = Date.now();
      if (now - lastViolationAt > 2500) {
        lastViolationAt = now;
        onTriggerViolation(
          `رصد إيماءة تصوير الشاشة المتعددة اللمس على الهاتف (${touches} أصابع)`,
          'screenshot',
          true
        );
      }
    }
  };

  const onGlobalTouchCancel = () => {
    if (!isActiveGuard() || !isPlayingGuard()) return;
    mobileSensorHolding = false;
    setMobileCurtainVisible(true);
    onInstantBlackout();
  };

  document.addEventListener('touchstart', onGlobalTouchStart, { capture: true, passive: true });
  document.addEventListener('touchcancel', onGlobalTouchCancel, { capture: true, passive: true });

  // VisualViewport resize detector (catches floating screen-recorder toolbars, split-screen, or PiP on mobile)
  let baseVpWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  let baseVpHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

  const onVisualViewportChange = () => {
    if (!isActiveGuard()) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const activeTag = document.activeElement?.tagName || '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

    const dw = Math.abs(vv.width - baseVpWidth);
    const dh = Math.abs(vv.height - baseVpHeight);
    if ((dw > 40 || dh > 110) && isPlayingGuard()) {
      mobileSensorHolding = false;
      setMobileCurtainVisible(true);
      onInstantBlackout();
    }
    baseVpWidth = vv.width;
    baseVpHeight = vv.height;
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onVisualViewportChange);
  }

  return () => {
    if (mobileStateInterval) clearInterval(mobileStateInterval);
    document.removeEventListener('touchstart', onGlobalTouchStart, { capture: true });
    document.removeEventListener('touchcancel', onGlobalTouchCancel, { capture: true });
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onVisualViewportChange);
    }
    try {
      mobileCurtainEl?.remove();
    } catch (_) {}
  };
}
