import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { authMiddleware, teacherMiddleware, optionalAuth, isTeacher, canAccessCourse } from '../middleware/auth.js';

const router = Router();

// Public lesson list (course outline). Never includes video URLs for non-teachers.
router.get('/course/:courseId', optionalAuth, (req, res) => {
  try {
    const lessons = db.prepare('SELECT l.*, ch.title as chapter_title FROM lessons l LEFT JOIN chapters ch ON l.chapter_id = ch.id WHERE l.course_id = ? ORDER BY l.order_num').all(req.params.courseId);
    res.json(isTeacher(req.user) ? lessons : lessons.map(({ video_url, ...rest }) => rest));
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
    lesson.is_saved = db.prepare('SELECT 1 FROM saved_lessons WHERE user_id = ? AND lesson_id = ?').get(req.user.id, lesson.id) ? 1 : 0;
    const currentIndex = allItems.findIndex(item => item.item_type === 'lesson' && item.id === lesson.id);
    if (currentIndex > 0) lesson.prev_lesson = allItems[currentIndex - 1];
    if (currentIndex < allItems.length - 1) lesson.next_lesson = allItems[currentIndex + 1];

    // The video URL is only released through /video-token, which enforces the view limit and prerequisite exam gate.
    if (!isTeacher(req.user)) delete lesson.video_url;
    res.json(lesson);
  } catch (err) { console.error('Lesson error:', err); res.status(500).json({ error: 'حدث خطأ' }); }
});

router.post('/:id/video-token', authMiddleware, (req, res) => {
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

    if (!isTeacher(req.user)) {
      const progress = db.prepare('SELECT views_count, extra_views FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').get(req.user.id, lesson.id);
      const viewsCount = progress?.views_count || 0;
      const extraViews = progress?.extra_views || 0;
      const maxViews = lesson.max_views || 8;
      if (viewsCount >= (maxViews + extraViews)) {
        return res.status(403).json({ error: 'لقد استنفذت عدد المشاهدات المسموح بها لهذا الدرس' });
      }
      if (progress) {
        db.prepare('UPDATE lesson_progress SET views_count = views_count + 1 WHERE user_id = ? AND lesson_id = ?').run(req.user.id, lesson.id);
      } else {
        db.prepare('INSERT INTO lesson_progress (user_id, lesson_id, views_count) VALUES (?, ?, 1)').run(req.user.id, lesson.id);
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 4 * 3600000).toISOString();
    db.prepare('DELETE FROM video_tokens WHERE user_id = ? AND lesson_id = ?').run(req.user.id, lesson.id);
    db.prepare('INSERT INTO video_tokens (token, user_id, lesson_id, expires_at) VALUES (?, ?, ?, ?)').run(token, req.user.id, lesson.id, expiresAt);
    const shortName = String(req.user.name || '').trim().split(/\s+/).slice(0, 2).join(' ');
    res.json({ token, video_url: lesson.video_url, expires_at: expiresAt, watermark: `${shortName} • ${req.user.phone || ''}` });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ' }); }
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
    const { chapter_id, course_id, title, description, video_url, duration, order_num, max_views, is_free, pdf_url, prerequisite_exam_id, prerequisite_passing_score } = req.body;
    const prereqId = prerequisite_exam_id ? parseInt(prerequisite_exam_id, 10) : null;
    const prereqScore = prerequisite_passing_score ? parseInt(prerequisite_passing_score, 10) : 60;
    const result = db.prepare('INSERT INTO lessons (chapter_id, course_id, title, description, video_url, duration, order_num, max_views, is_free, pdf_url, prerequisite_exam_id, prerequisite_passing_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(chapter_id, course_id, title, description, video_url, duration || 0, order_num || 0, max_views || 8, is_free ? 1 : 0, pdf_url || null, prereqId, prereqScore);
    try { db.prepare('UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(course_id); } catch (e) {}
    res.status(201).json(db.prepare('SELECT * FROM lessons WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: 'حدث خطأ في إضافة الدرس' }); }
});

router.put('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { title, description, video_url, duration, order_num, max_views, is_free, chapter_id, pdf_url, prerequisite_exam_id, prerequisite_passing_score } = req.body;
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
          duration=COALESCE(?,duration), order_num=COALESCE(?,order_num), max_views=COALESCE(?,max_views),
          is_free=COALESCE(?,is_free), chapter_id=COALESCE(?,chapter_id),
          pdf_url=?, prerequisite_exam_id=?, prerequisite_passing_score=?
      WHERE id=?
    `).run(
      title,
      description,
      video_url,
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
