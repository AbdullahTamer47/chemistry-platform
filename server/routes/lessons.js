import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import db from '../db.js';
import { authMiddleware, teacherMiddleware, optionalAuth, isTeacher, canAccessCourse, SECRET_KEY } from '../middleware/auth.js';

const router = Router();

// Public lesson list (course outline). Never includes video URLs or raw PDF URLs for non-teachers.
router.get('/course/:courseId', optionalAuth, (req, res) => {
  try {
    const lessons = db.prepare('SELECT l.*, ch.title as chapter_title FROM lessons l LEFT JOIN chapters ch ON l.chapter_id = ch.id WHERE l.course_id = ? ORDER BY l.order_num').all(req.params.courseId);
    res.json(isTeacher(req.user)
      ? lessons.map(l => ({ ...l, has_pdf: Boolean(l.pdf_url) }))
      : lessons.map(({ video_url, pdf_url, ...rest }) => ({ ...rest, has_pdf: Boolean(pdf_url) }))
    );
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

function getCourseItems(courseId) {
  const allLessons = db.prepare("SELECT id, title, order_num, 'lesson' as item_type FROM lessons WHERE course_id = ?").all(courseId);
  const allExams = db.prepare("SELECT id, title, order_num, 'exam' as item_type FROM exams WHERE course_id = ? AND chapter_id IS NOT NULL").all(courseId);
  return [...allLessons, ...allExams].sort((a, b) => a.order_num - b.order_num);
}

// Returns null if allowed, otherwise { status, body }.
function checkLessonAccess(user, lesson, allItems) {
  if (isTeacher(user)) return null;
  const uRow = db.prepare('SELECT COALESCE(is_blocked, 0) as is_blocked FROM users WHERE id = ?').get(user.id);
  if (uRow?.is_blocked) {
    return { status: 403, body: { error: 'تم إيقاف حسابك مؤقتاً. يرجى التواصل مع الدعم الفني للمنصة.', account_blocked: true } };
  }
  if (!lesson.is_free && !canAccessCourse(user, lesson.course_id)) {
    return { status: 403, body: { error: 'يجب الاشتراك في الكورس أولاً' } };
  }
  const currentIndex = allItems.findIndex(item => item.item_type === 'lesson' && item.id === lesson.id);
  if (currentIndex <= 0) return null;
  const courseInfo = db.prepare('SELECT sequential_access, is_free FROM courses WHERE id = ?').get(lesson.course_id);
  if (!courseInfo || !courseInfo.sequential_access || courseInfo.is_free) return null;

  const prevItem = allItems[currentIndex - 1];
  if (prevItem.item_type === 'lesson') {
    const prevProg = db.prepare('SELECT completed FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').get(user.id, prevItem.id);
    if (!prevProg || !prevProg.completed) {
      return { status: 403, body: { error: `عفواً، هذا الدرس مغلق بنظام التسلسل الإجباري للمنهج. يجب إتمام درس "${prevItem.title}" أولاً.`, is_gated: true, prev_item: prevItem } };
    }
  } else {
    const prevAttempt = db.prepare('SELECT score FROM exam_attempts WHERE user_id = ? AND exam_id = ? AND is_graded = 1 ORDER BY score DESC').get(user.id, prevItem.id);
    const examData = db.prepare('SELECT passing_score FROM exams WHERE id = ?').get(prevItem.id);
    const passThreshold = examData?.passing_score || 60;
    if (!prevAttempt || prevAttempt.score < passThreshold) {
      return { status: 403, body: { error: `عفواً، لا يمكنك فتح هذا الدرس إلا بعد اجتياز كويز "${prevItem.title}" بنسبة ${passThreshold}% على الأقل!`, is_gated: true, prev_item: prevItem } };
    }
  }
  return null;
}

// Re-opening a lecture within this window after a counted view does NOT consume another view
// (e.g. browser closed / page reloaded / internet dropped mid-lecture).
const VIEW_GRACE_HOURS = 6;

function getViewQuota(userId, lesson) {
  const progress = db.prepare('SELECT views_count, extra_views, last_view_at FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').get(userId, lesson.id);
  const rawMax = lesson.max_views !== undefined && lesson.max_views !== null ? Number(lesson.max_views) : 8;
  const unlimited = rawMax <= 0;
  const maxViews = unlimited ? 0 : rawMax;
  const extra = Number(progress?.extra_views || 0);
  const used = Number(progress?.views_count || 0);
  const allowed = unlimited ? 0 : Math.max(1, maxViews + extra);
  let inGrace = false;
  if (progress?.last_view_at) {
    const last = new Date(progress.last_view_at).getTime();
    inGrace = Number.isFinite(last) && (Date.now() - last) < VIEW_GRACE_HOURS * 3600000;
  }
  return {
    unlimited,
    used,
    allowed,
    remaining: unlimited ? 999999 : Math.max(0, allowed - used),
    in_grace: inGrace,
    grace_hours: VIEW_GRACE_HOURS
  };
}

function checkPrerequisiteExam(user, lesson) {
  if (!lesson.prerequisite_exam_id) return { locked: false, exam: null };
  const prereqExam = db.prepare('SELECT id, title, passing_score, duration_minutes FROM exams WHERE id = ?').get(lesson.prerequisite_exam_id);
  if (!prereqExam) return { locked: false, exam: null };

  const requiredScore = Number(lesson.prerequisite_passing_score) > 0
    ? Number(lesson.prerequisite_passing_score)
    : (prereqExam.passing_score || 60);

  if (isTeacher(user)) {
    return {
      locked: false,
      exam: {
        id: prereqExam.id,
        title: prereqExam.title,
        duration_minutes: prereqExam.duration_minutes,
        required_score: requiredScore,
        best_score: 100,
        passed: true
      }
    };
  }

  const row = db.prepare(`
    SELECT MAX(score) as best_score
    FROM exam_attempts
    WHERE user_id = ? AND exam_id = ? AND completed_at IS NOT NULL AND (is_graded = 1 OR is_graded IS NULL)
  `).get(user.id, prereqExam.id);

  const bestScore = row && row.best_score !== null && row.best_score !== undefined ? Number(row.best_score) : null;
  const passed = bestScore !== null && bestScore >= requiredScore;

  return {
    locked: !passed,
    exam: {
      id: prereqExam.id,
      title: prereqExam.title,
      duration_minutes: prereqExam.duration_minutes,
      required_score: requiredScore,
      best_score: bestScore,
      passed
    }
  };
}

// Student: get all saved lessons (bookmarks for fast revision)
router.get('/saved', authMiddleware, (req, res) => {
  try {
    const saved = db.prepare(`
      SELECT sl.id as saved_id, sl.created_at as saved_at,
             l.id, l.title, l.description, l.duration, l.order_num, l.course_id, l.chapter_id,
             c.title as course_title, ch.title as chapter_title
      FROM saved_lessons sl
      JOIN lessons l ON sl.lesson_id = l.id
      JOIN courses c ON l.course_id = c.id
      LEFT JOIN chapters ch ON l.chapter_id = ch.id
      WHERE sl.user_id = ?
      ORDER BY sl.created_at DESC
    `).all(req.user.id);
    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في جلب المحفوظات' });
  }
});

// Student: toggle bookmark / save lesson
router.post('/:id/bookmark', authMiddleware, (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = db.prepare('SELECT id, course_id, is_free FROM lessons WHERE id = ?').get(lessonId);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
    if (!isTeacher(req.user) && !lesson.is_free && !canAccessCourse(req.user, lesson.course_id)) {
      return res.status(403).json({ error: 'يجب الاشتراك في الكورس أولاً لحفظ هذا الدرس' });
    }

    const exists = db.prepare('SELECT id FROM saved_lessons WHERE user_id = ? AND lesson_id = ?').get(req.user.id, lessonId);
    if (exists) {
      db.prepare('DELETE FROM saved_lessons WHERE id = ?').run(exists.id);
      res.json({ is_saved: false, message: 'تمت إزالة الفيديو من المحفوظات' });
    } else {
      db.prepare('INSERT INTO saved_lessons (user_id, lesson_id) VALUES (?, ?)').run(req.user.id, lessonId);
      res.json({ is_saved: true, message: 'تم حفظ الفيديو للمراجعة السريعة' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في حفظ الفيديو' });
  }
});

// Student: get personal timestamped notes for a lesson
router.get('/:id/notes', authMiddleware, (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM lesson_notes WHERE user_id = ? AND lesson_id = ? ORDER BY timestamp_sec ASC, id DESC').all(req.user.id, req.params.id);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في جلب الملاحظات' });
  }
});

// Student: add a personal timestamped note
router.post('/:id/notes', authMiddleware, (req, res) => {
  try {
    const lesson = db.prepare('SELECT id, course_id, is_free FROM lessons WHERE id = ?').get(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
    if (!isTeacher(req.user) && !lesson.is_free && !canAccessCourse(req.user, lesson.course_id)) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'يرجى كتابة نص الملاحظة' });
    if (content.length > 1000) return res.status(400).json({ error: 'الملاحظة طويلة جداً (الحد الأقصى 1000 حرف)' });

    const timestamp_sec = Math.max(0, Math.min(86400, parseInt(req.body.timestamp_sec, 10) || 0));
    const result = db.prepare('INSERT INTO lesson_notes (user_id, lesson_id, timestamp_sec, content) VALUES (?, ?, ?, ?)')
      .run(req.user.id, lesson.id, timestamp_sec, content);
    const created = db.prepare('SELECT * FROM lesson_notes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في حفظ الملاحظة' });
  }
});

// Student: delete a personal note
router.delete('/:id/notes/:noteId', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM lesson_notes WHERE id = ? AND user_id = ? AND lesson_id = ?')
      .run(req.params.noteId, req.user.id, req.params.id);
    res.json({ message: 'تم حذف الملاحظة' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في حذف الملاحظة' });
  }
});

// Verify a signed video token and resolve stream URL
router.get('/video/:token', authMiddleware, (req, res) => {
  try {
    const record = db.prepare(`
      SELECT vt.*, l.video_url
      FROM video_tokens vt
      JOIN lessons l ON vt.lesson_id = l.id
      WHERE vt.token = ? AND vt.user_id = ? AND datetime(vt.expires_at) > datetime('now')
    `).get(req.params.token, req.user.id);

    if (!record) {
      return res.status(403).json({ error: 'انتهت صلاحية جلسة المشاهدة أو التوكن غير صالح' });
    }
    res.json({
      valid: true,
      lesson_id: record.lesson_id,
      video_url: record.video_url,
      expires_at: record.expires_at
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في التحقق من التوكن' });
  }
});

router.get('/:id', authMiddleware, (req, res) => {
  try {
    const lesson = db.prepare('SELECT l.*, ch.title as chapter_title, c.title as course_title, c.is_free as course_is_free, c.allow_student_replies FROM lessons l LEFT JOIN chapters ch ON l.chapter_id = ch.id LEFT JOIN courses c ON l.course_id = c.id WHERE l.id = ?').get(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });

    const allItems = getCourseItems(lesson.course_id);
    const denied = checkLessonAccess(req.user, lesson, allItems);
    if (denied) return res.status(denied.status).json(denied.body);

    const prereq = checkPrerequisiteExam(req.user, lesson);
    lesson.prerequisite_locked = prereq.locked;
    lesson.prerequisite_exam = prereq.exam;

    lesson.progress = db.prepare('SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').get(req.user.id, lesson.id);
    if (!isTeacher(req.user)) lesson.views = getViewQuota(req.user.id, lesson);
    lesson.is_saved = db.prepare('SELECT 1 FROM saved_lessons WHERE user_id = ? AND lesson_id = ?').get(req.user.id, lesson.id) ? 1 : 0;
    const currentIndex = allItems.findIndex(item => item.item_type === 'lesson' && item.id === lesson.id);
    if (currentIndex > 0) lesson.prev_lesson = allItems[currentIndex - 1];
    if (currentIndex < allItems.length - 1) lesson.next_lesson = allItems[currentIndex + 1];

    lesson.has_pdf = Boolean(lesson.pdf_url);
    // The video URL and raw PDF URL are only released through signed tokens to prevent scraping/leaks.
    if (!isTeacher(req.user)) {
      delete lesson.video_url;
      delete lesson.pdf_url;
    }
    res.json(lesson);
  } catch (err) { console.error('Lesson error:', err); res.status(500).json({ error: 'حدث خطأ' }); }
});

// Issue a short-lived signed token for protected PDF / File viewing
router.post('/:id/pdf-token', authMiddleware, (req, res) => {
  try {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
    if (!lesson.pdf_url) return res.status(404).json({ error: 'لا يوجد ملف PDF مرفق بهذا الدرس' });

    const denied = checkLessonAccess(req.user, lesson, getCourseItems(lesson.course_id));
    if (denied) return res.status(denied.status).json(denied.body);

    const exp = Date.now() + 30 * 60 * 1000; // 30 minutes
    const payload = `${req.user.id}:${lesson.id}:${exp}`;
    const sig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
    const token = Buffer.from(`${payload}:${sig}`).toString('base64url');

    const shortName = String(req.user.name || '').trim().split(/\s+/).slice(0, 2).join(' ');
    const wmText = `${shortName} • ${req.user.phone || ''}`;

    // Also provide XOR-obfuscated embed info in case it's a Google Drive preview
    let embedMode = 'stream';
    let targetUrl = `/api/lessons/${lesson.id}/pdf-stream?token=${encodeURIComponent(token)}`;
    const rawPdf = String(lesson.pdf_url || '').trim();
    if (rawPdf.includes('drive.google.com')) {
      let fileId = '';
      if (rawPdf.includes('/d/')) fileId = rawPdf.split('/d/')[1].split('/')[0].split('?')[0];
      else if (rawPdf.includes('id=')) fileId = rawPdf.split('id=')[1].split('&')[0];
      fileId = fileId.replace(/[^A-Za-z0-9_-]/g, '');
      if (fileId) {
        embedMode = 'drive_preview';
        targetUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }

    const rawCipherPayload = JSON.stringify({ u: targetUrl, m: embedMode, t: lesson.title });
    const keyBytes = Buffer.from(sig.slice(0, 16), 'utf8');
    const srcBytes = Buffer.from(rawCipherPayload, 'utf8');
    const xored = Buffer.alloc(srcBytes.length);
    for (let i = 0; i < srcBytes.length; i++) {
      xored[i] = srcBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    res.json({
      token,
      key: sig.slice(0, 16),
      pdf_cipher: xored.toString('base64'),
      stream_url: `/api/lessons/${lesson.id}/pdf-stream?token=${encodeURIComponent(token)}`,
      embed_mode: embedMode,
      watermark: wmText,
      expires_at: new Date(exp).toISOString()
    });
  } catch (err) {
    console.error('PDF token error:', err);
    res.status(500).json({ error: 'حدث خطأ في تجهيز الملف المحمي' });
  }
});

// Stream protected PDF inline without exposing raw URL or download headers
router.get('/:id/pdf-stream', async (req, res) => {
  try {
    const rawToken = String(req.query.token || '');
    if (!rawToken) return res.status(403).send('غير مصرح بالوصول للملف');

    const decoded = Buffer.from(rawToken, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return res.status(403).send('توكن غير صالح');
    const [userId, lessonId, expStr, sig] = parts;
    if (String(lessonId) !== String(req.params.id)) return res.status(403).send('توكن غير مطابق للدرس');
    if (Date.now() > Number(expStr)) return res.status(403).send('انتهت صلاحية جلسة عرض الملف');

    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(`${userId}:${lessonId}:${expStr}`).digest('hex');
    if (sig !== expectedSig) return res.status(403).send('توقيع غير صالح');

    const lesson = db.prepare('SELECT id, title, pdf_url FROM lessons WHERE id = ?').get(lessonId);
    if (!lesson || !lesson.pdf_url) return res.status(404).send('الملف غير موجود');

    const pdfUrl = String(lesson.pdf_url).trim();
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Disposition', 'inline; filename="kimyawy-protected.pdf"');

    if (pdfUrl.startsWith('data:application/pdf;base64,')) {
      const b64 = pdfUrl.split(',')[1] || '';
      const buf = Buffer.from(b64, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(buf);
    }

    if (pdfUrl.startsWith('/uploads/')) {
      const safeFile = path.basename(pdfUrl);
      const localPath = path.join(process.cwd(), 'uploads', safeFile);
      if (fs.existsSync(localPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        return fs.createReadStream(localPath).pipe(res);
      }
    }

    if (pdfUrl.includes('drive.google.com')) {
      let fileId = '';
      if (pdfUrl.includes('/d/')) fileId = pdfUrl.split('/d/')[1].split('/')[0].split('?')[0];
      else if (pdfUrl.includes('id=')) fileId = pdfUrl.split('id=')[1].split('&')[0];
      fileId = fileId.replace(/[^A-Za-z0-9_-]/g, '');
      if (fileId) {
        return res.redirect(`https://drive.google.com/file/d/${fileId}/preview`);
      }
    }

    if (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
      const upstream = await fetch(pdfUrl);
      if (!upstream.ok) return res.status(502).send('تعذر جلب الملف من المصدر');
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/pdf');
      const arrBuf = await upstream.arrayBuffer();
      return res.send(Buffer.from(arrBuf));
    }

    return res.status(404).send('رابط الملف غير مدعوم');
  } catch (err) {
    console.error('PDF stream error:', err);
    res.status(500).send('حدث خطأ أثناء بث الملف المحمي');
  }
});

router.post('/:id/video-token', authMiddleware, async (req, res) => {
  try {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });

    const denied = checkLessonAccess(req.user, lesson, getCourseItems(lesson.course_id));
    if (denied) return res.status(denied.status).json(denied.body);

    const prereq = checkPrerequisiteExam(req.user, lesson);
    if (prereq.locked) {
      return res.status(403).json({
        error: `يجب حل امتحان المحاضرة "${prereq.exam.title}" أولاً والحصول على درجة النجاح (${prereq.exam.required_score}%) لفتح الفيديو`,
        prerequisite_locked: true,
        prerequisite_exam: prereq.exam
      });
    }

    // Views are NOT consumed by opening the page or requesting a token.
    // A view is only counted later via POST /:id/view-commit after real playback,
    // and re-opening the lecture within VIEW_GRACE_HOURS of the last counted view is free.
    if (!isTeacher(req.user)) {
      const quota = getViewQuota(req.user.id, lesson);
      if (quota.remaining <= 0 && !quota.in_grace) {
        return res.status(403).json({
          error: 'لقد استنفدت عدد المشاهدات المسموح بها لهذه المحاضرة. يمكنك طلب مشاهدات إضافية من المدرس.',
          views_exhausted: true,
          views: quota
        });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 4 * 3600000).toISOString();
    db.prepare('DELETE FROM video_tokens WHERE user_id = ? AND lesson_id = ?').run(req.user.id, lesson.id);
    db.prepare('INSERT INTO video_tokens (token, user_id, lesson_id, expires_at) VALUES (?, ?, ?, ?)').run(token, req.user.id, lesson.id, expiresAt);
    const shortName = String(req.user.name || '').trim().split(/\s+/).slice(0, 2).join(' ');
    const wmText = `${shortName} • ${req.user.phone || ''}`;

    // Extract 11-char YouTube ID server-side if applicable so raw youtube.com URLs never travel in JSON
    const rawVideoUrl = String(lesson.video_url || '').trim();
    let ytId = '';
    const ytMatch = rawVideoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (ytMatch && ytMatch[1]) {
      ytId = ytMatch[1];
    } else if (/^[a-zA-Z0-9_-]{11}$/.test(rawVideoUrl)) {
      ytId = rawVideoUrl;
    }

    // XOR-obfuscate stream payload using token prefix so plain URLs aren't scraped by IDM or network sniffers
    const rawPayload = JSON.stringify({
      y: ytId ? ytId.split('').reverse().join('') : '',
      u: ytId ? '' : rawVideoUrl,
      s: lesson.video_source || 'custom_shield',
      v: lesson.vdocipher_id || ''
    });
    const keyBytes = Buffer.from(token.slice(0, 16), 'utf8');
    const srcBytes = Buffer.from(rawPayload, 'utf8');
    const xored = Buffer.alloc(srcBytes.length);
    for (let i = 0; i < srcBytes.length; i++) {
      xored[i] = srcBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    const streamCipher = xored.toString('base64');

    // Optional VdoCipher Hardware DRM OTP generation if configured
    let vdocipherOtp = null;
    let vdocipherPlaybackInfo = null;
    const vdoSecretRow = db.prepare("SELECT value FROM platform_settings WHERE key = 'vdocipher_api_secret'").get();
    const vdoSecret = (vdoSecretRow?.value || process.env.VDOCIPHER_API_SECRET || '').trim();
    const vdoId = (lesson.vdocipher_id || '').trim();
    if (lesson.video_source === 'vdocipher' && vdoId && vdoSecret && !vdoId.startsWith('http')) {
      try {
        const otpRes = await fetch(`https://dev.vdocipher.com/api/videos/${encodeURIComponent(vdoId)}/otp`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Apisecret ${vdoSecret}`
          },
          body: JSON.stringify({
            ttl: 3600,
            annotate: JSON.stringify([
              { type: 'rtext', text: wmText, alpha: '0.75', color: '0xFFFFFF', size: '15', interval: '4000' }
            ])
          })
        });
        if (otpRes.ok) {
          const otpData = await otpRes.json();
          vdocipherOtp = otpData.otp || null;
          vdocipherPlaybackInfo = otpData.playbackInfo || null;
        }
      } catch (e) {}
    }

    const currentQuota = isTeacher(req.user) ? null : getViewQuota(req.user.id, lesson);
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.json({
      token,
      video_source: lesson.video_source || 'custom_shield',
      vdocipher_id: lesson.vdocipher_id || null,
      vdocipher_otp: vdocipherOtp,
      vdocipher_playback_info: vdocipherPlaybackInfo,
      stream_cipher: streamCipher,
      expires_at: expiresAt,
      watermark: wmText,
      views_used: currentQuota ? currentQuota.used : 0,
      views: currentQuota
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ' }); }
});

// Commit ONE view after the student actually watched a meaningful part of the lecture.
// Idempotent per video token; free if within the grace window of the last counted view.
router.post('/:id/view-commit', authMiddleware, (req, res) => {
  try {
    const lesson = db.prepare('SELECT id, course_id, max_views FROM lessons WHERE id = ?').get(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
    if (isTeacher(req.user)) return res.json({ counted: false, views: null });

    const tokenStr = String(req.body?.token || '');
    const vt = db.prepare("SELECT id, COALESCE(view_counted, 0) as view_counted FROM video_tokens WHERE token = ? AND user_id = ? AND lesson_id = ? AND datetime(expires_at) > datetime('now')").get(tokenStr, req.user.id, lesson.id);
    if (!vt) return res.status(403).json({ error: 'جلسة مشاهدة غير صالحة' });
    if (vt.view_counted) {
      const q = getViewQuota(req.user.id, lesson);
      return res.json({ counted: false, views_used: q.used, ...q, views: q });
    }

    const quota = getViewQuota(req.user.id, lesson);
    db.prepare('UPDATE video_tokens SET view_counted = 1 WHERE id = ?').run(vt.id);

    if (quota.in_grace) {
      return res.json({ counted: false, reason: 'grace', views_used: quota.used, ...quota, views: quota });
    }

    const nowIso = new Date().toISOString();
    const existing = db.prepare('SELECT id FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').get(req.user.id, lesson.id);
    if (existing) {
      db.prepare('UPDATE lesson_progress SET views_count = COALESCE(views_count, 0) + 1, last_view_at = ? WHERE id = ?').run(nowIso, existing.id);
    } else {
      db.prepare('INSERT INTO lesson_progress (user_id, lesson_id, views_count, last_view_at) VALUES (?, ?, 1, ?)').run(req.user.id, lesson.id, nowIso);
    }
    const updatedQuota = getViewQuota(req.user.id, lesson);
    res.json({ counted: true, views_used: updatedQuota.used, ...updatedQuota, views: updatedQuota });
  } catch (err) {
    console.error('View commit error:', err);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Student requests extra views from the teacher after exhausting the quota
router.post('/:id/request-views', authMiddleware, (req, res) => {
  try {
    const lesson = db.prepare('SELECT l.id, l.title, c.title as course_title FROM lessons l LEFT JOIN courses c ON l.course_id = c.id WHERE l.id = ?').get(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
    const recent = db.prepare("SELECT id FROM notifications WHERE title = ? AND message LIKE ? AND datetime(created_at) > datetime('now', '-6 hours') LIMIT 1")
      .get('طلب مشاهدات إضافية', `%#${req.user.id}#%${lesson.id}%`);
    if (recent) return res.json({ message: 'تم إرسال طلبك بالفعل، سيتم مراجعته قريباً' });

    const teachers = db.prepare("SELECT id FROM users WHERE role IN ('teacher', 'admin')").all();
    const msg = `الطالب "${req.user.name}" (#${req.user.id}#) يطلب مشاهدات إضافية لمحاضرة "${lesson.title}" (رقم ${lesson.id}) — ${lesson.course_title || ''}. يمكنك زيادة المشاهدات من سجل الطلاب ← تقرير الطالب.`;
    for (const t of teachers) {
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(t.id, 'طلب مشاهدات إضافية', msg, 'info');
    }
    res.json({ message: 'تم إرسال طلبك للمدرس، وسيتم إشعارك عند إضافة المشاهدات' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في إرسال الطلب' });
  }
});


router.post('/:id/progress', authMiddleware, (req, res) => {
  try {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
    const denied = checkLessonAccess(req.user, lesson, getCourseItems(lesson.course_id));
    if (denied) return res.status(denied.status).json(denied.body);

    const completed = req.body.completed ? 1 : (req.body.completed === 0 || req.body.completed === false ? 0 : null);
    const rawWatch = Number(req.body.watch_time);
    const watch_time = Number.isFinite(rawWatch) && rawWatch >= 0 ? Math.min(Math.floor(rawWatch), 86400) : null;
    const existing = db.prepare('SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').get(req.user.id, lesson.id);
    if (existing) {
      db.prepare('UPDATE lesson_progress SET completed = COALESCE(?, completed), watch_time = COALESCE(?, watch_time), completed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE user_id = ? AND lesson_id = ?').run(completed, watch_time, completed, req.user.id, lesson.id);
    } else {
      db.prepare('INSERT INTO lesson_progress (user_id, lesson_id, completed, watch_time, completed_at) VALUES (?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)').run(req.user.id, lesson.id, completed || 0, watch_time || 0, completed);
    }
    res.json({ message: 'تم تحديث التقدم' });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

router.post('/', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { chapter_id, course_id, title, description, video_url, video_source, vdocipher_id, duration, order_num, max_views, is_free, pdf_url, prerequisite_exam_id, prerequisite_passing_score } = req.body;
    const prereqId = prerequisite_exam_id ? parseInt(prerequisite_exam_id, 10) : null;
    const prereqScore = prerequisite_passing_score ? parseInt(prerequisite_passing_score, 10) : 60;
    const parsedMaxViews = max_views !== undefined && max_views !== null && max_views !== '' ? parseInt(max_views, 10) : 8;
    const result = db.prepare('INSERT INTO lessons (chapter_id, course_id, title, description, video_url, video_source, vdocipher_id, duration, order_num, max_views, is_free, pdf_url, prerequisite_exam_id, prerequisite_passing_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(chapter_id, course_id, title, description, video_url || '', video_source || 'custom_shield', vdocipher_id || null, duration || 0, order_num || 0, Number.isFinite(parsedMaxViews) ? parsedMaxViews : 8, is_free ? 1 : 0, pdf_url || null, prereqId, prereqScore);
    try { db.prepare('UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(course_id); } catch (e) {}
    res.status(201).json(db.prepare('SELECT * FROM lessons WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: 'حدث خطأ في إضافة الدرس' }); }
});

router.put('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { title, description, video_url, video_source, vdocipher_id, duration, order_num, max_views, is_free, chapter_id, pdf_url, prerequisite_exam_id, prerequisite_passing_score } = req.body;
    const existing = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'الدرس غير موجود' });

    const prereqId = prerequisite_exam_id !== undefined
      ? (prerequisite_exam_id ? parseInt(prerequisite_exam_id, 10) : null)
      : existing.prerequisite_exam_id;
    const prereqScore = prerequisite_passing_score !== undefined
      ? (parseInt(prerequisite_passing_score, 10) || 60)
      : (existing.prerequisite_passing_score || 60);

    db.prepare(`
      UPDATE lessons
      SET title=COALESCE(?,title), description=COALESCE(?,description), video_url=COALESCE(?,video_url),
          video_source=COALESCE(?,video_source), vdocipher_id=?,
          duration=COALESCE(?,duration), order_num=COALESCE(?,order_num), max_views=COALESCE(?,max_views),
          is_free=COALESCE(?,is_free), chapter_id=COALESCE(?,chapter_id),
          pdf_url=?, prerequisite_exam_id=?, prerequisite_passing_score=?
      WHERE id=?
    `).run(
      title,
      description,
      video_url,
      video_source || existing.video_source || 'custom_shield',
      vdocipher_id !== undefined ? (vdocipher_id || null) : existing.vdocipher_id,
      duration,
      order_num,
      max_views,
      is_free !== undefined ? (is_free ? 1 : 0) : null,
      chapter_id,
      pdf_url !== undefined ? (pdf_url || null) : existing.pdf_url,
      prereqId,
      prereqScore,
      req.params.id
    );
    try { db.prepare('UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(existing.course_id); } catch (e) {}
    res.json(db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

router.delete('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM lessons WHERE id = ?').run(req.params.id); res.json({ message: 'تم حذف الدرس' }); }
  catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

export default router;
