import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authMiddleware, teacherMiddleware } from '../middleware/auth.js';

const router = Router();

// ======================================================
// IMPORTANT: All SPECIFIC routes MUST come before /:id
// ======================================================

// Get dashboard stats (teacher)
router.get('/stats/dashboard', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const stats = {
      total_students: db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('student').c,
      total_courses: db.prepare('SELECT COUNT(*) as c FROM courses').get().c,
      total_lessons: db.prepare('SELECT COUNT(*) as c FROM lessons').get().c,
      total_exams: db.prepare('SELECT COUNT(*) as c FROM exams').get().c,
      total_enrollments: db.prepare('SELECT COUNT(*) as c FROM enrollments').get().c,
      active_codes: db.prepare('SELECT COUNT(*) as c FROM activation_codes WHERE is_active = 1').get().c,
      used_codes: db.prepare('SELECT COUNT(*) as c FROM activation_codes WHERE used_count > 0').get().c,
      avg_exam_score: db.prepare('SELECT ROUND(AVG(score),1) as a FROM exam_attempts WHERE completed_at IS NOT NULL').get().a || 0,
      recent_students: db.prepare('SELECT id, name, phone, grade, created_at FROM users WHERE role = ? ORDER BY created_at DESC LIMIT 5').all('student'),
      grade_distribution: db.prepare("SELECT grade, COUNT(*) as count FROM users WHERE role = 'student' AND grade IS NOT NULL GROUP BY grade").all()
    };
    res.json(stats);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ' }); }
});

// Notifications endpoints (MUST be before /:id)
router.get('/notifications/unread-count', authMiddleware, (req, res) => {
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0').get(req.user.id);
    res.json({ count: result.count });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

router.get('/notifications/my', authMiddleware, (req, res) => {
  try {
    const notifs = db.prepare('SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50').all(req.user.id);
    res.json(notifs);
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

router.put('/notifications/read-all', authMiddleware, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL').run(req.user.id);
    res.json({ message: 'تم تحديد الكل كمقروء' });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

router.put('/notifications/:id/read', authMiddleware, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)').run(req.params.id, req.user.id);
    res.json({ message: 'تم' });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

router.post('/notifications/send', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { title, message, type, user_id, course_id } = req.body;
    if (user_id) {
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(user_id, title, message, type || 'info');
    } else if (course_id) {
      const students = db.prepare("SELECT user_id FROM enrollments WHERE course_id = ?").all(course_id);
      students.forEach(s => db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(s.user_id, title, message, type || 'info'));
    } else {
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (NULL, ?, ?, ?)').run(title, message, type || 'info');
    }
    res.json({ message: 'تم إرسال الإشعار' });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Student: Comprehensive visual analytics (Curriculum Donut + Score Progression Chart)
router.get('/analytics', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Curriculum & Lessons progress
    const totalLessons = db.prepare(`
      SELECT COUNT(DISTINCT l.id) as count
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      JOIN enrollments e ON e.course_id = c.id
      WHERE e.user_id = ?
    `).get(userId).count || 0;

    const completedLessons = db.prepare(`
      SELECT COUNT(DISTINCT lesson_id) as count
      FROM lesson_progress
      WHERE user_id = ? AND completed = 1
    `).get(userId).count || 0;

    const curriculumPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // 2. Exam attempts & progression
    const attempts = db.prepare(`
      SELECT ea.id, ea.exam_id, ea.score, ea.total_points, ea.time_spent, ea.completed_at,
             e.title as exam_title, e.passing_score, c.title as course_title
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      LEFT JOIN courses c ON e.course_id = c.id
      WHERE ea.user_id = ? AND ea.completed_at IS NOT NULL
      ORDER BY ea.completed_at ASC
    `).all(userId);

    const totalExamsTaken = attempts.length;
    let totalScore = 0;
    let passedCount = 0;
    let maxPercent = 0;
    let minPercent = 100;
    let weakestExam = null;
    let bestExam = null;

    const progression = attempts.map((a, idx) => {
      const pts = a.total_points > 0 ? a.total_points : 100;
      const pct = Math.max(0, Math.min(100, Math.round(Number(a.score) || 0)));
      const passed = pct >= (a.passing_score || 60);
      if (passed) passedCount++;

      totalScore += pct;

      if (pct >= maxPercent) {
        maxPercent = pct;
        bestExam = { title: a.exam_title, percent: pct };
      }
      if (pct <= minPercent) {
        minPercent = pct;
        weakestExam = { title: a.exam_title, percent: pct };
      }

      return {
        id: a.id,
        attempt_number: idx + 1,
        exam_id: a.exam_id,
        exam_title: a.exam_title,
        course_title: a.course_title || 'كيمياء',
        score: pct,
        total_points: pts,
        percent: pct,
        passed,
        time_spent: a.time_spent || 0,
        completed_at: a.completed_at
      };
    });

    if (totalExamsTaken === 0) {
      minPercent = 0;
    }

    const averagePercent = totalExamsTaken > 0 ? Math.round(totalScore / totalExamsTaken) : 0;

    // 3. Weekly activity (last 7 days breakdown)
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const weeklyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = dayNames[d.getDay()];

      const lessonsWatched = db.prepare(`
        SELECT COUNT(*) as c FROM lesson_progress
        WHERE user_id = ? AND date(completed_at) = date(?)
      `).get(userId, dateStr).c || 0;

      const examsDone = db.prepare(`
        SELECT COUNT(*) as c FROM exam_attempts
        WHERE user_id = ? AND date(completed_at) = date(?)
      `).get(userId, dateStr).c || 0;

      weeklyActivity.push({
        date: dateStr,
        day: dayName,
        lessons: lessonsWatched,
        exams: examsDone,
        activity_score: lessonsWatched * 2 + examsDone * 3
      });
    }

    // 4. Certificates count
    const certificatesCount = db.prepare('SELECT COUNT(*) as c FROM certificates WHERE user_id = ?').get(userId).c || 0;

    res.json({
      curriculum: {
        total_lessons: totalLessons,
        completed_lessons: completedLessons,
        remaining_lessons: Math.max(0, totalLessons - completedLessons),
        percent: curriculumPercent
      },
      exams: {
        total_taken: totalExamsTaken,
        passed_count: passedCount,
        failed_count: totalExamsTaken - passedCount,
        average_percent: averagePercent,
        max_percent: maxPercent,
        min_percent: minPercent,
        best_exam: bestExam,
        weakest_exam: weakestExam
      },
      progression,
      weekly_activity: weeklyActivity,
      certificates_count: certificatesCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في استخراج الإحصائيات' });
  }
});

// Get all students (teacher)
router.get('/', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { grade, course_id } = req.query;
    let query = `SELECT u.id, u.name, u.phone, u.grade, u.parent_phone, u.created_at,
      (SELECT COUNT(*) FROM enrollments WHERE user_id = u.id) as enrolled_courses,
      (SELECT ROUND(AVG(score),1) FROM exam_attempts WHERE user_id = u.id AND completed_at IS NOT NULL) as avg_score
      FROM users u WHERE u.role = 'student'`;
    const params = [];
    if (grade) { query += ' AND u.grade = ?'; params.push(grade); }
    if (course_id) { query += ' AND u.id IN (SELECT user_id FROM enrollments WHERE course_id = ?)'; params.push(course_id); }
    query += ' ORDER BY u.created_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Teacher: Get manual WhatsApp Progress Report for a student
router.get('/:id/whatsapp-report', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const student = db.prepare('SELECT id, name, phone, grade, parent_phone, parent_phone_secondary FROM users WHERE id = ? AND role = ?').get(req.params.id, 'student');
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    const stats = db.prepare(`
      SELECT COUNT(*) as exams_taken, ROUND(AVG(score), 1) as avg_score
      FROM exam_attempts WHERE user_id = ? AND completed_at IS NOT NULL
    `).get(student.id);

    const activeCourses = db.prepare(`
      SELECT c.title FROM courses c JOIN enrollments e ON c.id = e.course_id WHERE e.user_id = ?
    `).all(student.id).map(c => c.title).join('، ');

    const msg = `تقرير متابعة الطالب/ة: ${student.name} (${student.grade})\n` +
      `-----------------------------------\n` +
      `عدد الاختبارات المنجزة: ${stats.exams_taken || 0}\n` +
      `متوسط الدرجات الكلي: ${stats.avg_score || 0}%\n` +
      `الكورسات المفعلة: ${activeCourses || 'لا يوجد كورسات مفعلة حالياً'}\n` +
      `-----------------------------------\n` +
      `نتمنى له المزيد من التوفيق والنجاح! منصة د. زياد رمزي عياد للكيمياء.`;

    let whatsapp_parent_url = null;
    let whatsapp_parent_secondary_url = null;

    const formatWa = (ph) => {
      const digits = String(ph || '').replace(/\D/g, '');
      if (!digits) return '';
      if (digits.startsWith('20')) return digits;
      return `20${digits.replace(/^0+/, '')}`;
    };

    if (student.parent_phone) {
      const text = encodeURIComponent(`السلام عليكم ورحمة الله، ولي أمر الطالب/ة ${student.name}.\n\n${msg}`);
      whatsapp_parent_url = `https://wa.me/${formatWa(student.parent_phone)}?text=${text}`;
    }

    if (student.parent_phone_secondary) {
      const textSecondary = encodeURIComponent(`السلام عليكم ورحمة الله، والدة الطالب/ة ${student.name}.\n\n${msg}`);
      whatsapp_parent_secondary_url = `https://wa.me/${formatWa(student.parent_phone_secondary)}?text=${textSecondary}`;
    }

    res.json({
      student_id: student.id,
      student_name: student.name,
      report_text: msg,
      whatsapp_parent_url,
      whatsapp_parent_secondary_url
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في إنشاء تقرير الواتساب' });
  }
});

// Teacher: Clear registered devices for a student (Device Binding Reset)
router.delete('/:id/devices', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM user_devices WHERE user_id = ?').run(req.params.id);
    res.json({ message: 'تم إعادة ضبط وتسجيل أجهزة الطالب بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في إعادة ضبط أجهزة الطالب' });
  }
});

// Get student details (AFTER specific routes)
router.get('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const student = db.prepare('SELECT id, name, phone, grade, parent_phone, created_at FROM users WHERE id = ? AND role = ?').get(req.params.id, 'student');
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
    student.enrollments = db.prepare('SELECT e.*, c.title as course_title FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.user_id = ?').all(student.id);
    student.exam_attempts = db.prepare('SELECT ea.*, ex.title as exam_title FROM exam_attempts ea JOIN exams ex ON ea.exam_id = ex.id WHERE ea.user_id = ? ORDER BY ea.completed_at DESC LIMIT 20').all(student.id);
    student.lesson_progress = db.prepare('SELECT lp.*, l.title as lesson_title, l.max_views, c.title as course_title FROM lesson_progress lp JOIN lessons l ON lp.lesson_id = l.id JOIN courses c ON l.course_id = c.id WHERE lp.user_id = ? ORDER BY lp.completed_at DESC LIMIT 30').all(student.id);
    res.json(student);
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Update student
router.put('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { name, phone, grade, parent_phone, password } = req.body;
    let query = 'UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone), grade=COALESCE(?,grade), parent_phone=COALESCE(?,parent_phone)';
    const params = [name ?? null, phone ?? null, grade ?? null, parent_phone ?? null];
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      }
      const hash = bcrypt.hashSync(String(password), 10);
      db.prepare(query + ', password=? WHERE id=? AND role=?').run(...params, hash, req.params.id, 'student');
      return res.json({ message: 'تم التحديث بنجاح' });
    } else {
      query += ' WHERE id=? AND role=?';
      params.push(req.params.id, 'student');
      db.prepare(query).run(...params);
      return res.json({ message: 'تم التحديث بنجاح' });
    }
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ error: 'رقم الهاتف مستخدم بالفعل' });
    res.status(500).json({ error: 'حدث خطأ في تحديث الطالب' });
  }
});

// Delete student
router.delete('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(req.params.id, 'student');
    res.json({ message: 'تم حذف الطالب بنجاح' });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ في الحذف' }); }
});

// Toggle student suspension from a course
router.put('/:id/enrollments/:courseId/suspend', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { is_suspended } = req.body;
    db.prepare('UPDATE enrollments SET is_suspended = ? WHERE user_id = ? AND course_id = ?').run(
      is_suspended ? 1 : 0, req.params.id, req.params.courseId
    );
    res.json({ message: is_suspended ? 'تم إيقاف الطالب من الكورس' : 'تم تفعيل الطالب في الكورس' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في تعديل حالة الطالب' });
  }
});

export default router;
