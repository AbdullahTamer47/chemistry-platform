import drZiadImg from '../assets/dr-ziad.png';
import drZiadMasterclassCartoon from '../assets/dr-ziad-masterclass-cartoon.jpg';
import drZiadPoseBook from '../assets/dr-ziad-pose-book.jpg';
import drZiadPoseFlask from '../assets/dr-ziad-pose-flask.jpg';
import drZiadPoseThumbs from '../assets/dr-ziad-pose-thumbs.jpg';
import { isLoggedIn, isTeacher } from '../utils/auth.js';
import { renderPublicHeader, initPublicHeader } from '../components/publicHeader.js';
import zraLogoFace from '../assets/zra-logo-face.png';
import zraLogoText from '../assets/zra-logo-text.png';

export function renderLanding() {
  return `
  <div class="landing">
    ${renderPublicHeader('home')}

    <!-- Hero Section -->
    <section class="hero-sakr-style" id="hero">
      <div class="hero-sakr-container">
        
        <div class="hero-sakr-content">
          <div class="hero-sakr-badge">
            <span class="material-symbols-rounded">science</span>
            <span>منصة د/ زياد رمزي عياد التعليمية</span>
          </div>

          <h1 class="hero-sakr-title">
            طريقك الأضمن لإتقان الكيمياء وضمان الدرجة النهائية
          </h1>

          <p class="hero-sakr-subtitle">
            مع د/ زياد رمزي عياد.. هتشوف التفاعلات لايف، وتفهم أصل كل معادلة بدل الحفظ، وتتدرب على أدق أفكار امتحانات الثانوية خطوة بخطوة علشان تقفّل المادة وأنت واثق من نفسك.
          </p>
          
          <div class="hero-sakr-actions">
            ${isLoggedIn()
              ? `<a href="/${isTeacher() ? 'admin' : 'dashboard'}" class="btn-sakr-hero-white"><span class="material-symbols-rounded">dashboard</span> الانتقال إلى ${isTeacher() ? 'لوحة المعلم والإدارة' : 'لوحة الطالب'}</a>
                 <a href="/lab" class="btn-sakr-hero-trans" style="display:inline-flex; align-items:center; gap:8px;"><span class="material-symbols-rounded" style="color:#10b981;">science</span> المختبر التفاعلي</a>`
              : `<a href="/register" class="btn-sakr-hero-white"><span class="material-symbols-rounded">rocket_launch</span> اشترك دلوقتي !</a>
                 <a href="/courses" class="btn-sakr-hero-trans"><span class="material-symbols-rounded">school</span> تصفح الكورسات</a>
                 <a href="/parent-portal" class="btn-sakr-hero-trans" style="display:inline-flex; align-items:center; gap:8px;"><span class="material-symbols-rounded" style="color:#10b981;">family_restroom</span> بوابة ولي الأمر</a>`
            }
          </div>

          <div class="hero-sakr-pills">
            <div class="hero-sakr-pill">
              <span class="material-symbols-rounded">verified</span>
              <span>شرح المنهج كاملاً بالتفصيل</span>
            </div>
            <div class="hero-sakr-pill">
              <span class="material-symbols-rounded">biotech</span>
              <span>المختبر التفاعلي ووزن المعادلات</span>
            </div>
            <div class="hero-sakr-pill">
              <span class="material-symbols-rounded">family_restroom</span>
              <span>بوابة متابعة فورية لولي الأمر</span>
            </div>
          </div>
        </div>

        <div class="hero-sakr-visual">
          <div class="hero-sakr-circle-wrap">
            <div class="hero-sakr-circle">
              <svg class="circle-chem-svg" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
                <polygon points="120,90 155,70 190,90 190,130 155,150 120,130" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2.5"/>
                <circle cx="155" cy="110" r="20" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
                <polygon points="320,100 355,80 390,100 390,140 355,160 320,140" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2.5"/>
                <circle cx="355" cy="120" r="20" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
                <line x1="190" y1="90" x2="230" y2="70" stroke="rgba(255,255,255,0.22)" stroke-width="2.5"/>
                <circle cx="230" cy="70" r="6" fill="rgba(255,255,255,0.3)"/>
                <line x1="120" y1="130" x2="80" y2="155" stroke="rgba(255,255,255,0.22)" stroke-width="2.5"/>
                <circle cx="80" cy="155" r="7" fill="rgba(255,255,255,0.3)"/>
                <ellipse cx="250" cy="250" rx="220" ry="90" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2" transform="rotate(-30 250 250)"/>
                <ellipse cx="250" cy="250" rx="220" ry="90" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2" transform="rotate(30 250 250)"/>
                <ellipse cx="250" cy="250" rx="220" ry="90" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2" transform="rotate(90 250 250)"/>
                <circle cx="60" cy="290" r="6" fill="#34D399"/>
                <circle cx="430" cy="200" r="6" fill="#FBBF24"/>
                <circle cx="250" cy="35" r="6" fill="#60A5FA"/>
                <path d="M 400,390 L 385,320 L 385,290 L 375,290 L 375,320 L 360,390 Z" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
                <circle cx="380" cy="355" r="3" fill="rgba(255,255,255,0.25)"/>
                <circle cx="385" cy="375" r="4" fill="rgba(255,255,255,0.25)"/>
              </svg>
            </div>
            <img src="${drZiadImg}" alt="د. زياد رمزي عياد" class="hero-sakr-teacher-img" />
          </div>
        </div>

      </div>
    </section>

    <!-- Section 1: Methodology Cards -->
    <section class="methodology-section reveal">
      <div class="section-container">
        <div style="text-align: center; max-width: 650px; margin: 0 auto 30px;">
          <h2 class="section-title"><span class="material-symbols-rounded">psychology</span> منهجية التعلم الذكية مع د/ زياد</h2>
          <p class="section-subtitle">طريقة تدريس مبتكرة ترتكز على الفهم والاستيعاب والتطبيق العملي لتقفيل المادة</p>
        </div>

        <div class="methodology-grid">
          <div class="methodology-card">
            <div class="methodology-img-wrap">
              <img src="${drZiadPoseBook}" alt="تنظيم الدروس والوحدات" />
            </div>
            <div class="methodology-content">
              <div class="methodology-icon-badge">
                <span class="material-symbols-rounded">folder_special</span>
              </div>
              <h3>تنظيم الدروس والوحدات</h3>
              <p>خريطة تعليمية متكاملة مقسمة لوحدات وفصول صغيرة واضحة عشان تذاكر بترتيب وتفضل متابع تقدمك أولاً بأول وبدون أي تشتت.</p>
            </div>
          </div>

          <div class="methodology-card">
            <div class="methodology-img-wrap card-2">
              <img src="${drZiadPoseFlask}" alt="دروس بالفيديو والتجارب الحية" />
            </div>
            <div class="methodology-content">
              <div class="methodology-icon-badge">
                <span class="material-symbols-rounded">play_circle</span>
              </div>
              <h3>دروس بالفيديو والتجارب الحية</h3>
              <p>شروحات معملية مصورة بجودة فائقة مع تجارب حية ومحاكاة تفاعلية للروابط والتفاعلات الذرية لتثبيت المعلومة بالعين والعقل.</p>
            </div>
          </div>

          <div class="methodology-card">
            <div class="methodology-img-wrap card-3">
              <img src="${drZiadPoseThumbs}" alt="تطبيقات وتمارين لتقفيل المنهج" />
            </div>
            <div class="methodology-content">
              <div class="methodology-icon-badge">
                <span class="material-symbols-rounded">military_tech</span>
              </div>
              <h3>تطبيقات وتمارين لتقفيل المنهج</h3>
              <p>بنك أسئلة متدرج وامتحانات بنظام البابل شيت والمقالي مع تصحيح وتحليل فوري لنقاط القوة والضعف لضمان الـ 60/60 بإذن الله.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 2: Teacher Masterclass Showcase -->
    <section class="teacher-masterclass-section reveal" id="about">
      <div class="section-container">
        <div class="teacher-masterclass-grid">
          
          <div class="teacher-masterclass-info">
            <div class="teacher-tag-pill">
              <span class="material-symbols-rounded" style="font-size:1.15rem; color:#059669;">science</span>
              <span>عن د/ زياد رمزي عياد</span>
            </div>
            
            <h2 class="masterclass-title">الكيمياء مش حفظ معادلات.. <br><span class="highlight">الكيمياء فهم وتجربة حية</span></h2>
            
            <div class="masterclass-quote-box">
              <div class="quote-glyph">“</div>
              <p class="quote-body">
                صحصح شوية وشد حيلك معانا.. هنمشيها سوا خطوة بخطوة لحد ما تلم المنهج وتكون الكيمياء لعبتك في جيبك وتضمن الدرجة النهائية بإذن الله.
              </p>
              <div class="quote-author">
                <span class="author-name">د. زياد رمزي عياد</span>
                <span class="author-title">صيدلي ومحاضر الكيمياء للثانوية العامة واللغات</span>
              </div>
            </div>

            <div class="masterclass-features-list">
              <div class="masterclass-feature-row">
                <div class="feature-row-icon green">
                  <span class="material-symbols-rounded">ondemand_video</span>
                </div>
                <div>
                  <h4>شروحات تفاعلية بأحدث التقنيات</h4>
                  <p>تبسيط أعمق مفاهيم الكيمياء العضوية والكهربية والاتزان بأسلوب سهل ومنطقي.</p>
                </div>
              </div>

              <div class="masterclass-feature-row">
                <div class="feature-row-icon gold">
                  <span class="material-symbols-rounded">biotech</span>
                </div>
                <div>
                  <h4>تجارب معملية مصورة بجودة فائقة</h4>
                  <p>مشاهدة التفاعلات والألوان والغازات بعينك يرسخ نواتج التفاعل في الذاكرة دون نسيان.</p>
                </div>
              </div>

              <div class="masterclass-feature-row">
                <div class="feature-row-icon blue">
                  <span class="material-symbols-rounded">fact_check</span>
                </div>
                <div>
                  <h4>نظام متابعة وبنك أسئلة متدرج</h4>
                  <p>امتحانات دورية تقيس مستويات التفكير العليا مع تقارير فورية لولي الأمر.</p>
                </div>
              </div>
            </div>

          </div>

          <div class="teacher-masterclass-visual">
            <div class="teacher-portrait-frame">
              <img src="${drZiadMasterclassCartoon}" alt="د. زياد رمزي عياد" class="teacher-portrait-img" />
              
              <div class="masterclass-badge top-right">
                <span class="material-symbols-rounded" style="color:#FBBF24;">verified</span>
                <span>صيدلي ومحاضر الكيمياء</span>
              </div>
              <div class="masterclass-badge bottom-left">
                <span class="material-symbols-rounded" style="color:#34D399;">verified_user</span>
                <span>متابعة فردية ودورية مستمرة</span>
              </div>
              <div class="masterclass-badge bottom-right">
                <span class="material-symbols-rounded" style="color:#60A5FA;">military_tech</span>
                <span>ضمان الـ 60/60 بإذن الله</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- Section 3: Why Join Us -->
    <section class="sakr-why-section reveal" id="features">
      <div class="section-container">
        <div style="text-align: center; max-width: 600px; margin: 0 auto 30px;">
          <h2 class="section-title"><span class="material-symbols-rounded">verified</span> ليه تشترك معانا؟</h2>
          <p class="section-subtitle">8 أسباب تجعل منصة كيمياوي اختيارك الأول للتفوق في الكيمياء</p>
        </div>

        <div class="sakr-why-grid">
          <div class="sakr-why-card">
            <div class="sakr-why-num">1</div>
            <div class="sakr-why-title">تبسيط الكيمياء من الصفر للإتقان</div>
            <div class="sakr-why-desc">شرح تأسيسي عميق يفهمك أصل التفاعلات والمعادلات بدل الحفظ والتلقين.</div>
          </div>
          <div class="sakr-why-card">
            <div class="sakr-why-num">2</div>
            <div class="sakr-why-title">شروحات سينمائية وتجارب معملية</div>
            <div class="sakr-why-desc">مشاهدة حية لحركة الذرات والغازات والألوان لتثبيت التفاعل في الذاكرة.</div>
          </div>
          <div class="sakr-why-card">
            <div class="sakr-why-num">3</div>
            <div class="sakr-why-title">امتحان إجباري على كل محاضرة</div>
            <div class="sakr-why-desc">تطبيق فوري على أفكار امتحانات الثانوية بنظام البابل شيت والمقالي قبل فتح المحاضرة التالية.</div>
          </div>
          <div class="sakr-why-card">
            <div class="sakr-why-num">4</div>
            <div class="sakr-why-title">المختبر التفاعلي ومساعد المعادلات</div>
            <div class="sakr-why-desc">موازنة فورية لأي معادلة كيميائية ومحاكاة الكشف عن الشقوق الحامضية والقاعدية.</div>
          </div>
          <div class="sakr-why-card">
            <div class="sakr-why-num">5</div>
            <div class="sakr-why-title">تفسير علمي بالنص والصورة</div>
            <div class="sakr-why-desc">مراجعة تفصيلية لكل سؤال بعد الامتحان مع شرح المعلم نصياً وبالصور الموضحة.</div>
          </div>
          <div class="sakr-why-card">
            <div class="sakr-why-num">6</div>
            <div class="sakr-why-title">خرائط ذهنية وملازم بي دي إف</div>
            <div class="sakr-why-desc">ملازم ملونة شاملة تجمع قوانين وأفكار كل وحدة في ورقات مركزة.</div>
          </div>
          <div class="sakr-why-card">
            <div class="sakr-why-num">7</div>
            <div class="sakr-why-title">شهادات تقدير مصورة للمتفوقين</div>
            <div class="sakr-why-desc">إصدار شهادات تقدير عالية الجودة قابلة للتحميل المباشر عند اجتياز الاختبارات الكبرى.</div>
          </div>
          <div class="sakr-why-card">
            <div class="sakr-why-num">8</div>
            <div class="sakr-why-title">بوابة متابعة خاصة لولي الأمر</div>
            <div class="sakr-why-desc">يمكن لولي الأمر متابعة حضور الطالب ودرجاته في أي وقت برقم الهاتف مباشرة.</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Grades Levels -->
    <section class="grades-section reveal" id="grades">
      <div class="section-container">
        <h2 class="section-title"><span class="material-symbols-rounded">school</span> المراحل الدراسية المتاحة</h2>
        <p class="section-subtitle">شرح متخصص ومرتب لكل مرحلة دراسية</p>
        <div class="grades-grid">
          <div class="grade-card grade-prep">
            <div class="grade-icon" style="display:flex; justify-content:center; margin-bottom:12px;">
              <span class="material-symbols-rounded" style="font-size:3.5rem; color:var(--accent);">school</span>
            </div>
            <h3>المرحلة الإعدادية</h3>
            <p>شرح متكامل لدروس العلوم والتفاعلات الكيميائية بطريقة تفاعلية وعملية مبسطة (الصف الأول، الثاني، والثالث الإعدادي).</p>
            <a href="/courses" class="btn btn-outline btn-sm">عرض الكورسات</a>
          </div>
          <div class="grade-card grade-secondary">
            <div class="grade-icon" style="display:flex; justify-content:center; margin-bottom:12px;">
              <span class="material-symbols-rounded" style="font-size:3.5rem; color:var(--primary);">local_library</span>
            </div>
            <h3>الصف الأول والثاني الثانوي</h3>
            <p>تأسيس قوي في الكيمياء الكمية والحرارية وبنية الذرة والجدول الدوري استعداداً للثانوية العامة.</p>
            <a href="/courses" class="btn btn-outline btn-sm">عرض الكورسات</a>
          </div>
          <div class="grade-card grade-primary">
            <div class="grade-icon" style="display:flex; justify-content:center; margin-bottom:12px;">
              <span class="material-symbols-rounded" style="font-size:3.5rem; color:var(--info);">workspace_premium</span>
            </div>
            <h3>الصف الثالث الثانوي</h3>
            <p>التحضير الشامل للثانوية العامة في الأبواب الخمسة (الانتقالية، التحليلية، الاتزان، الكهربية، والعضوية) مع حل آلاف الأفكار الوزارية.</p>
            <a href="/courses" class="btn btn-primary btn-sm">تصفح كورسات ثالثة ثانوي</a>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section reveal">
      <div class="section-container">
        <div class="cta-card">
          <h2>مستعد لتقفيل الكيمياء؟</h2>
          <p>انضم لطلاب منصة كيمياوي الآن وابدأ مذاكرة المنهج بطريقة ذكية وحديثة مع دكتور زياد رمزي عياد.</p>
          <a href="/register" class="btn btn-accent btn-xl"><span class="material-symbols-rounded">rocket_launch</span> ابدأ رحلتك اليوم</a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer" style="background: var(--bg-card); border-top: 1px solid var(--border-light); padding-top: 60px;">
      <div class="section-container">
        <div class="footer-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 40px; margin-bottom: 40px;">
          <div>
            <div class="footer-logo" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
              <img src="${zraLogoFace}" alt="Z.R.A" class="logo-face-img" style="height: 48px;" />
              <img src="${zraLogoText}" alt="Z.R.A" class="logo-text-img" style="height: 36px;" />
            </div>
            <p class="footer-desc" style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.8; max-width: 380px;">منصة كيمياوي التعليمية - تجربة دراسة كيمياء فريدة وشاملة تضمن للطلاب الفهم الدقيق، التطبيق العملي، والتفوق الأكاديمي مع د. زياد رمزي عياد.</p>
          </div>
          <div>
            <h4 style="font-weight: 800; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 20px;">روابط سريعة</h4>
            <div class="footer-links" style="display: flex; flex-direction: column; gap: 12px;">
              <a href="/courses" style="color: var(--text-secondary); font-weight: 600; font-size: 0.9rem;">تصفح الكورسات</a>
              <a href="/lab" style="color: var(--text-secondary); font-weight: 600; font-size: 0.9rem;">المختبر الكيميائي التفاعلي</a>
              <a href="/parent-portal" style="color: var(--text-secondary); font-weight: 600; font-size: 0.9rem;">بوابة متابعة ولي الأمر</a>
              <a href="/register" style="color: var(--text-secondary); font-weight: 600; font-size: 0.9rem;">إنشاء حساب جديد</a>
              <a href="/login" style="color: var(--text-secondary); font-weight: 600; font-size: 0.9rem;">تسجيل الدخول للمنصة</a>
            </div>
          </div>
          <div>
            <h4 style="font-weight: 800; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 20px;">تواصل معنا</h4>
            <div class="footer-links footer-contact" style="display: flex; flex-direction: column; gap: 14px;">
              <a href="https://wa.me/201000000000" target="_blank" style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-weight: 600; font-size: 0.9rem;">
                <span class="material-symbols-rounded" style="color: #25D366; font-size: 1.3rem;">chat</span> الدعم الفني (واتساب)
              </a>
              <a href="https://facebook.com" target="_blank" style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-weight: 600; font-size: 0.9rem;">
                <span class="material-symbols-rounded" style="color: #1877F2; font-size: 1.3rem;">public</span> صفحة الفيسبوك الرسمية
              </a>
            </div>
          </div>
        </div>
        <div class="footer-bottom" style="padding: 24px 0; border-top: 1px solid var(--border-light); text-align: center; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <p style="color: var(--text-muted); font-size: 0.85rem; font-weight: 600;">© ${new Date().getFullYear()} كيمياوي - د. زياد رمزي عياد | جميع الحقوق محفوظة</p>
          <div style="color: var(--text-muted); font-size: 0.85rem; font-weight: 600;">
            تم التطوير بواسطة <span style="color: var(--primary); font-weight: 800;">Abdullah Yassen</span>
          </div>
        </div>
      </div>
    </footer>
  </div>`;
}

export function initLanding() {
  initPublicHeader();

  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question?.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(i => i.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealElements.forEach(el => revealObserver.observe(el));
}
