/**
 * Kimyawy Hardware DRM (W3C EME Widevine / PlayReady / FairPlay / ClearKey)
 * + Clean, Zero-Glitch Desktop & Mobile Anti-Screenshot / Anti-Recording Engine
 */

export function isMobileOrTouchDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua)) {
    return true;
  }
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return true;
  }
  return Boolean(navigator.maxTouchPoints > 0 && window.innerWidth <= 920);
}

/**
 * Mounts a lightweight, zero-glitch W3C Encrypted Media Extensions (EME) key session
 * inside `containerEl` without loading any external video stream that could cause a player glitch.
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
 * Attaches clean, non-intrusive mobile & desktop anti-screenshot and anti-recording sensors
 * WITHOUT any fingerprint overlay, WITHOUT breaking player controls, and WITHOUT countdown timers:
 * 1. Multi-touch gesture sensor (3-finger / 2-finger screenshot gesture on mobile).
 * 2. Top status-bar / Control Center pull-down sensor on mobile.
 * 3. `touchcancel` OS interruption sensor (fired by Android/iOS when hardware screenshot buttons or system overlays interrupt the screen).
 * 4. VisualViewport resize / split-screen / floating-recorder overlay detector.
 */
export function attachMobileAndDesktopAntiCapture({
  isActiveGuard = () => true,
  isPlayingGuard = () => false,
  onInstantBlackout = () => {},
  onTriggerViolation = () => {}
} = {}) {
  if (typeof window === 'undefined') return () => {};

  let lastViolationAt = 0;

  const fireViolation = (reason, vType = 'screenshot') => {
    onInstantBlackout();
    const now = Date.now();
    if (now - lastViolationAt > 2000) {
      lastViolationAt = now;
      onTriggerViolation(reason, vType, false);
    }
  };

  // 1. Mobile Multi-Touch Screenshot Gesture (3-finger swipe / 2-finger pinch capture)
  //    + Top Notification Shade / Control Center Pull-Down (where mobile Screen Recorder lives)
  const onTouchStartCapture = (e) => {
    if (!isActiveGuard()) return;
    const touches = e.touches ? e.touches.length : 0;

    if (touches >= 3 || (touches >= 2 && isPlayingGuard())) {
      fireViolation(
        `رصد إيماءة تصوير الشاشة المتعددة اللمس على الهاتف (${touches} أصابع)`,
        'screenshot'
      );
      return;
    }

    // Pulling down the top notification shade / iOS Control Center to start/stop Screen Recorder
    if (touches === 1 && e.touches[0] && isPlayingGuard()) {
      const y = e.touches[0].clientY;
      if (y <= 28) {
        fireViolation(
          'رصد سحب شريط النظام العلوي (شريط التسجيل / الإشعارات) أثناء تشغيل المحاضرة على الهاتف',
          'screen_record'
        );
      }
    }
  };

  const onTouchMoveCapture = (e) => {
    if (!isActiveGuard()) return;
    const touches = e.touches ? e.touches.length : 0;
    if (touches >= 3) {
      fireViolation(
        'رصد سحب ثلاثي الأصابع لأخذ لقطة شاشة (3-Finger Screenshot) على الهاتف',
        'screenshot'
      );
    }
  };

  // 2. OS Touch Interruption (`touchcancel` fires on Android/iOS when hardware screenshot buttons or Control Center interrupt touch)
  const onTouchCancelCapture = () => {
    if (!isActiveGuard() || !isPlayingGuard()) return;
    fireViolation(
      'رصد اعتراض نظام الهاتف للمس الشاشة أثناء المشاهدة (لقطة شاشة بأزرار الهاتف أو مسجل الشاشة)',
      'screenshot'
    );
  };

  document.addEventListener('touchstart', onTouchStartCapture, { capture: true, passive: true });
  document.addEventListener('touchmove', onTouchMoveCapture, { capture: true, passive: true });
  document.addEventListener('touchcancel', onTouchCancelCapture, { capture: true, passive: true });

  // 3. VisualViewport resize / Floating Recorder Toolbar / Split-Screen detector on Mobile
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
      fireViolation(
        'رصد تغيير أبعاد الشاشة أو فتح نافذة عائمة / مسجل شاشة أثناء تشغيل المحاضرة',
        'screen_record'
      );
    }
    baseVpWidth = vv.width;
    baseVpHeight = vv.height;
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onVisualViewportChange);
  }

  return () => {
    document.removeEventListener('touchstart', onTouchStartCapture, { capture: true });
    document.removeEventListener('touchmove', onTouchMoveCapture, { capture: true });
    document.removeEventListener('touchcancel', onTouchCancelCapture, { capture: true });
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onVisualViewportChange);
    }
  };
}
