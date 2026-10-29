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
    const exists = db.prepare('SELECT id FROM saved_lessons WHERE user_id = ? AND lesson_id = ?').get(req.user.id, lessonId);
    if (exists) {
      db.prepare('DELETE FROM saved_lessons WHERE id = ?').run(exists.id);
      res.json({ is_saved: false, message: 'تمت إزالة الفيديو من المحفوظات' });
    } else {
      db.prepare('INSERT INTO saved_lessons (user_id, lesson_id) VALUES (?, ?)').run(req.user.id, lessonId);
      res.json({ is_saved: true, message: 'تم حفظ الفيديو للمراجعة السريعة ⭐' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في حفظ الفيديو' });
  }
});

router.get('/:id', authMiddleware, (req, res) => {
  try {
    const lesson = db.prepare('SELECT l.*, ch.title as chapter_title, c.title as course_title, c.is_free as course_is_free FROM lessons l LEFT JOIN chapters ch ON l.chapter_id = ch.id LEFT JOIN courses c ON l.course_id = c.id WHERE l.id = ?').get(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });

    const allItems = getCourseItems(lesson.course_id);
    const denied = checkLessonAccess(req.user, lesson, allItems);
    if (denied) return res.status(denied.status).json(denied.body);

    lesson.progress = db.prepare('SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').get(req.user.id, lesson.id);
    lesson.is_saved = db.prepare('SELECT 1 FROM saved_lessons WHERE user_id = ? AND lesson_id = ?').get(req.user.id, lesson.id) ? 1 : 0;
    const currentIndex = allItems.findIndex(item => item.item_type === 'lesson' && item.id === lesson.id);
    if (currentIndex > 0) lesson.prev_lesson = allItems[currentIndex - 1];
    if (currentIndex < allItems.length - 1) lesson.next_lesson = allItems[currentIndex + 1];

    // The video URL is only released through /video-token, which enforces the view limit.
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
    res.json({ token, video_url: lesson.video_url, expires_at: expiresAt, watermark: `${req.user.name} • ${req.user.id}` });
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
    const { chapter_id, course_id, title, description, video_url, duration, order_num, max_views, is_free, pdf_url } = req.body;
    const result = db.prepare('INSERT INTO lessons (chapter_id, course_id, title, description, video_url, duration, order_num, max_views, is_free, pdf_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(chapter_id, course_id, title, description, video_url, duration || 0, order_num || 0, max_views || 8, is_free ? 1 : 0, pdf_url || null);
    res.status(201).json(db.prepare('SELECT * FROM lessons WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: 'حدث خطأ في إضافة الدرس' }); }
});

router.put('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { title, description, video_url, duration, order_num, max_views, is_free, chapter_id, pdf_url } = req.body;
    db.prepare('UPDATE lessons SET title=COALESCE(?,title), description=COALESCE(?,description), video_url=COALESCE(?,video_url), duration=COALESCE(?,duration), order_num=COALESCE(?,order_num), max_views=COALESCE(?,max_views), is_free=COALESCE(?,is_free), chapter_id=COALESCE(?,chapter_id), pdf_url=COALESCE(?,pdf_url) WHERE id=?').run(title, description, video_url, duration, order_num, max_views, is_free !== undefined ? (is_free ? 1 : 0) : null, chapter_id, pdf_url !== undefined ? (pdf_url || null) : null, req.params.id);
    res.json(db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

router.delete('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM lessons WHERE id = ?').run(req.params.id); res.json({ message: 'تم حذف الدرس' }); }
  catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

export default router;
