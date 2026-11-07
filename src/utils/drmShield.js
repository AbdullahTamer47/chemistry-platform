/**
 * Kimyawy Hardware DRM (W3C EME Widevine / PlayReady / FairPlay / ClearKey)
 * + Zero-Latency Desktop & Mobile Anti-Screenshot / Anti-Recording Engine
 */

let shakaLoadPromise = null;

function loadShakaPlayerScript() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.shaka) return Promise.resolve(window.shaka);
  if (shakaLoadPromise) return shakaLoadPromise;

  shakaLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(window.shaka || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return shakaLoadPromise;
}

/**
 * Mounts an invisible W3C Encrypted Media Extensions (EME) protected <video> layer
 * inside `containerEl`. On Android Chrome, an active Widevine CENC session triggers
 * Chromium's `SurfaceView.setSecure(true)` (`FLAG_SECURE`), causing the OS to block
 * hardware screenshots (Power + Volume Down) and turn screen recordings black.
 * On Windows Edge/Chrome, PlayReady/Widevine EME activates DWM protected overlay paths.
 */
export async function mountHardwareDrmShield(containerEl) {
  if (!containerEl || typeof window === 'undefined') return () => {};

  let destroyed = false;
  let shakaPlayer = null;
  let drmVideo = null;

  try {
    drmVideo = containerEl.querySelector('.kimyawy-eme-drm-layer');
    if (!drmVideo) {
      drmVideo = document.createElement('video');
      drmVideo.className = 'kimyawy-eme-drm-layer';
      drmVideo.muted = true;
      drmVideo.defaultMuted = true;
      drmVideo.loop = true;
      drmVideo.playsInline = true;
      drmVideo.setAttribute('playsinline', '');
      drmVideo.setAttribute('webkit-playsinline', '');
      drmVideo.setAttribute('muted', '');
      drmVideo.setAttribute('disablePictureInPicture', '');
      drmVideo.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
      drmVideo.style.cssText = [
        'position:absolute',
        'inset:0',
        'width:100%',
        'height:100%',
        'object-fit:cover',
        'opacity:0.012',
        'pointer-events:none',
        'z-index:17',
        'user-select:none',
        '-webkit-user-select:none'
      ].join(';');
      containerEl.appendChild(drmVideo);
    }
  } catch (_) {
    return () => {};
  }

  // 1. Immediate W3C EME KeySystem negotiation (Widevine -> PlayReady -> FairPlay -> ClearKey)
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
              { contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: 'HW_SECURE_DECODE' },
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
            videoCapabilities: [
              { contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: '3000' },
              { contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: '2000' }
            ]
          }
        ]
      },
      {
        keySystem: 'com.microsoft.playready',
        configs: [
          {
            initDataTypes: ['cenc'],
            videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }]
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

  // 2. Load Shaka Player with Widevine CENC stream so Android Chrome enforces FLAG_SECURE on the surface
  loadShakaPlayerScript().then(async (shaka) => {
    if (destroyed || !shaka || !drmVideo) return;
    try {
      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) return;
      shakaPlayer = new shaka.Player();
      await shakaPlayer.attach(drmVideo);
      shakaPlayer.configure({
        drm: {
          servers: {
            'com.widevine.alpha': 'https://cwip-shaka-proxy.appspot.com/no_auth',
            'com.microsoft.playready': 'https://test.playready.microsoft.com/service/rightsmanager.asmx?PlayRight=1&UseSimpleNonPersistentLicense=1'
          },
          advanced: {
            'com.widevine.alpha': {
              videoRobustness: 'HW_SECURE_ALL',
              audioRobustness: 'SW_SECURE_CRYPTO'
            }
          }
        },
        streaming: {
          bufferingGoal: 2,
          rebufferingGoal: 1
        }
      });

      await shakaPlayer.load('https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd');
      if (!destroyed && drmVideo) {
        drmVideo.play().catch(() => {});
      }
    } catch (_) {
      // Fallback: retry with SW_SECURE_DECODE if device L1 is unavailable (L3 Widevine still triggers setSecure in Chromium)
      try {
        if (shakaPlayer && !destroyed) {
          shakaPlayer.configure({
            drm: {
              servers: {
                'com.widevine.alpha': 'https://cwip-shaka-proxy.appspot.com/no_auth'
              },
              advanced: {
                'com.widevine.alpha': {
                  videoRobustness: 'SW_SECURE_DECODE',
                  audioRobustness: 'SW_SECURE_CRYPTO'
                }
              }
            }
          });
          await shakaPlayer.load('https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd');
          drmVideo?.play().catch(() => {});
        }
      } catch (_err2) {}
    }
  });

  // Ensure the DRM video resumes on first user interaction inside the container
  const resumeDrmOnInteract = () => {
    if (!destroyed && drmVideo && drmVideo.paused) {
      drmVideo.play().catch(() => {});
    }
  };
  containerEl.addEventListener('pointerdown', resumeDrmOnInteract, { passive: true });
  containerEl.addEventListener('touchstart', resumeDrmOnInteract, { passive: true });

  return () => {
    destroyed = true;
    containerEl.removeEventListener('pointerdown', resumeDrmOnInteract);
    containerEl.removeEventListener('touchstart', resumeDrmOnInteract);
    try {
      if (shakaPlayer) {
        shakaPlayer.destroy();
        shakaPlayer = null;
      }
    } catch (_) {}
    try {
      drmVideo?.remove();
    } catch (_) {}
  };
}

/**
 * Attaches mobile & desktop anti-screenshot and anti-screen-recording sensors:
 * 1. Multi-touch gesture sensor (2+ fingers on mobile = 3-finger screenshot gesture on Android/iOS).
 * 2. Top status-bar / Control Center pull-down sensor (touch starting near top edge of screen).
 * 3. Mobile OS Screenshot Compositor Freeze / Frame-Jank detector (detects sudden 280ms+ main-thread/GPU stall while playing).
 * 4. VisualViewport resize & split-screen / floating-recorder window detector.
 */
export function attachMobileAndDesktopAntiCapture({
  isActiveGuard = () => true,
  isPlayingGuard = () => false,
  onInstantBlackout = () => {},
  onTriggerViolation = () => {}
} = {}) {
  if (typeof window === 'undefined') return () => {};

  let lastUserScrollOrTouchAt = 0;
  let lastViolationAt = 0;

  const markBenignScroll = () => {
    lastUserScrollOrTouchAt = performance.now();
  };
  window.addEventListener('scroll', markBenignScroll, { passive: true });

  // 1. Mobile Multi-Touch Screenshot Gesture (3-finger swipe / 2-finger pinch capture)
  //    + Top Notification Shade / Control Center Pull-Down (where mobile Screen Recorder lives)
  const onTouchStartCapture = (e) => {
    if (!isActiveGuard()) return;
    const touches = e.touches ? e.touches.length : 0;

    // 3-finger screenshot gesture (or 2+ fingers while watching protected content)
    if (touches >= 3 || (touches >= 2 && isPlayingGuard())) {
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
      return;
    }

    // Pulling down the top notification shade / iOS Control Center to start Screen Recorder
    if (touches === 1 && e.touches[0]) {
      const y = e.touches[0].clientY;
      if (y <= 32 && isPlayingGuard()) {
        onInstantBlackout();
      }
    }
  };

  const onTouchMoveCapture = (e) => {
    if (!isActiveGuard()) return;
    const touches = e.touches ? e.touches.length : 0;
    if (touches >= 3) {
      onInstantBlackout();
      const now = Date.now();
      if (now - lastViolationAt > 2500) {
        lastViolationAt = now;
        onTriggerViolation(
          'رصد سحب ثلاثي الأصابع لأخذ لقطة شاشة (3-Finger Screenshot) على الهاتف',
          'screenshot',
          true
        );
      }
    }
  };

  document.addEventListener('touchstart', onTouchStartCapture, { capture: true, passive: true });
  document.addEventListener('touchmove', onTouchMoveCapture, { capture: true, passive: true });

  // 2. VisualViewport resize / Floating Recorder Overlay / Split-Screen detector on Mobile
  let baseVpWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  let baseVpHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

  const onVisualViewportChange = () => {
    if (!isActiveGuard()) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const activeTag = document.activeElement?.tagName || '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return; // virtual keyboard is benign

    const dw = Math.abs(vv.width - baseVpWidth);
    const dh = Math.abs(vv.height - baseVpHeight);
    if ((dw > 40 || dh > 110) && isPlayingGuard()) {
      onInstantBlackout();
    }
    baseVpWidth = vv.width;
    baseVpHeight = vv.height;
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onVisualViewportChange);
  }

  // 3. Mobile Hardware Screenshot (Power + Volume Down) Compositor Stall Detector
  // When Android/iOS captures the screen buffer via hardware buttons, the display compositor stalls rAF for ~280-750ms.
  let rafId = null;
  let lastFrameTime = performance.now();

  const monitorFrameStall = (now) => {
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    if (isActiveGuard() && isPlayingGuard()) {
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 900;
      const timeSinceScroll = now - lastUserScrollOrTouchAt;
      // If mobile compositor stalled between 310ms and 1400ms while video was playing smoothly without user scroll
      if (isMobile && dt >= 310 && dt <= 1400 && timeSinceScroll > 450 && document.visibilityState === 'visible') {
        onInstantBlackout();
        const ts = Date.now();
        if (ts - lastViolationAt > 4000) {
          lastViolationAt = ts;
          onTriggerViolation(
            `رصد تجميد مكون الشاشة على الهاتف المحمول أثناء التشغيل (اشتباه لقطة شاشة أو بدء تسجيل شاشة - ${Math.round(dt)}ms)`,
            'screenshot',
            true
          );
        }
      }
    }
    rafId = window.requestAnimationFrame(monitorFrameStall);
  };
  rafId = window.requestAnimationFrame(monitorFrameStall);

  return () => {
    window.removeEventListener('scroll', markBenignScroll);
    document.removeEventListener('touchstart', onTouchStartCapture, { capture: true });
    document.removeEventListener('touchmove', onTouchMoveCapture, { capture: true });
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onVisualViewportChange);
    }
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
  };
}

