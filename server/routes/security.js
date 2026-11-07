import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, teacherMiddleware, isTeacher } from '../middleware/auth.js';

const router = Router();

const VIOLATION_LABELS = {
  screenshot: 'محاولة أخذ لقطة شاشة (Screenshot)',
  screen_record: 'محاولة تسجيل الشاشة فيديو (Screen Record)',
  idm_download: 'محاولة تحميل المحتوى ببرامج التحميل (IDM / Sniffer)',
  devtools: 'فتح أدوات المطورين أو فحص الكود (DevTools)',
  pdf_leak: 'محاولة طباعة أو تسريب ملف PDF محمي',
  exam_leak: 'محاولة نسخ أو تصوير أسئلة امتحان / واجب'
};

// Student client reports a security violation (screenshot, screen record, IDM, PDF print, etc.)
router.post('/report', authMiddleware, (req, res) => {
  try {
    if (isTeacher(req.user)) {
      return res.json({ logged: false, strikes: 0, is_blocked: 0 });
    }

    const {
      violation_type = 'screenshot',
      severity = 'high',
      course_id = null,
      lesson_id = null,
      exam_id = null,
      source_title = '',
      details = ''
    } = req.body || {};

    const cleanType = String(violation_type).slice(0, 50);
    const label = VIOLATION_LABELS[cleanType] || cleanType;
    const ua = String(req.headers['user-agent'] || '').slice(0, 220);
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();

    // Throttle duplicate reports within 4 seconds from the same user & type
    const recent = db.prepare(`
      SELECT id FROM security_violations
      WHERE user_id = ? AND violation_type = ?
        AND datetime(created_at) > datetime('now', '-4 seconds')
      LIMIT 1
    `).get(req.user.id, cleanType);

    if (!recent) {
      db.prepare(`
        INSERT INTO security_violations
          (user_id, course_id, lesson_id, exam_id, violation_type, severity, source_title, details, device_info, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        course_id ? Number(course_id) : null,
        lesson_id ? Number(lesson_id) : null,
        exam_id ? Number(exam_id) : null,
        cleanType,
        severity,
        String(source_title || '').slice(0, 160),
        String(details || label).slice(0, 400),
        ua,
        ip
      );

      db.prepare('UPDATE users SET security_strikes = COALESCE(security_strikes, 0) + 1 WHERE id = ?').run(req.user.id);

      const studentRow = db.prepare('SELECT id, name, phone, grade, security_strikes, is_blocked FROM users WHERE id = ?').get(req.user.id);
      const strikes = Number(studentRow?.security_strikes || 1);

      // Auto-block student if they reach 5 severe violations and notify teacher
      if (strikes >= 5 && !studentRow?.is_blocked) {
        db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(req.user.id);
        db.prepare('UPDATE enrollments SET is_suspended = 1 WHERE user_id = ?').run(req.user.id);
      }

      // Notify teachers
      const teachers = db.prepare("SELECT id FROM users WHERE role IN ('teacher', 'admin')").all();
      const notifTitle = strikes >= 5
        ? `🚨 حظر تلقائي لطالب بسبب تكرار محاولات التسريب (${strikes} مخالفات)`
        : `⚠️ تنبيه أمني: ${label}`;
      const notifMsg = `قام الطالب "${studentRow?.name || req.user.name}" (${studentRow?.phone || ''}) بـ ${label} داخل "${source_title || 'محتوى محمي'}" — إجمالي المخالفات: ${strikes}.`;
      for (const t of teachers) {
        db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
          t.id,
          notifTitle,
          notifMsg,
          'warning'
        );
      }
    }

    const updatedUser = db.prepare('SELECT COALESCE(security_strikes, 0) as strikes, COALESCE(is_blocked, 0) as is_blocked FROM users WHERE id = ?').get(req.user.id);
    res.json({
      logged: true,
      strikes: Number(updatedUser?.strikes || 1),
      is_blocked: Number(updatedUser?.is_blocked || 0),
      cooldown_seconds: Math.min(30, 8 + Number(updatedUser?.strikes || 1) * 4)
    });
  } catch (err) {
    console.error('Security report error:', err);
    res.status(500).json({ error: 'حدث خطأ في تسجيل المخالفة' });
  }
});

// Teacher: Get all security violations & offending students report
router.get('/violations', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const typeFilter = String(req.query.type || 'all').trim();
    const limitVal = Math.min(500, Math.max(10, parseInt(req.query.limit, 10) || 250));

    const allViolations = db.prepare(`
      SELECT sv.*,
             u.name as student_name, u.phone as student_phone, u.parent_phone, u.grade,
             COALESCE(u.study_track, 'عام') as study_track,
             COALESCE(u.security_strikes, 0) as security_strikes,
             COALESCE(u.is_blocked, 0) as is_blocked,
             c.title as course_title,
             l.title as lesson_title
      FROM security_violations sv
      JOIN users u ON sv.user_id = u.id
      LEFT JOIN courses c ON sv.course_id = c.id
      LEFT JOIN lessons l ON sv.lesson_id = l.id
      ORDER BY sv.created_at DESC
      LIMIT ?
    `).all(limitVal);

    const violations = typeFilter && typeFilter !== 'all'
      ? allViolations.filter(v => v.violation_type === typeFilter)
      : allViolations;

    const offenders = db.prepare(`
      SELECT u.id, u.name, u.phone, u.parent_phone, u.grade,
             COALESCE(u.study_track, 'عام') as study_track,
             COALESCE(u.security_strikes, 0) as security_strikes,
             COALESCE(u.is_blocked, 0) as is_blocked,
             COUNT(sv.id) as total_violations,
             COUNT(sv.id) as violations_count,
             SUM(CASE WHEN sv.violation_type = 'screenshot' THEN 1 ELSE 0 END) as screenshot_count,
             SUM(CASE WHEN sv.violation_type = 'screen_record' THEN 1 ELSE 0 END) as record_count,
             SUM(CASE WHEN sv.violation_type IN ('idm_download', 'devtools') THEN 1 ELSE 0 END) as download_count,
             SUM(CASE WHEN sv.violation_type IN ('idm_download', 'devtools') THEN 1 ELSE 0 END) as idm_count,
             SUM(CASE WHEN sv.violation_type IN ('pdf_leak', 'exam_leak') THEN 1 ELSE 0 END) as doc_leak_count,
             SUM(CASE WHEN sv.violation_type IN ('pdf_leak', 'exam_leak') THEN 1 ELSE 0 END) as leak_count,
             MAX(sv.created_at) as last_violation_at
      FROM users u
      JOIN security_violations sv ON sv.user_id = u.id
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY total_violations DESC, last_violation_at DESC
    `).all();

    const screenshots = allViolations.filter(v => v.violation_type === 'screenshot').length;
    const screen_records = allViolations.filter(v => v.violation_type === 'screen_record').length;
    const idm_downloads = allViolations.filter(v => v.violation_type === 'idm_download').length;
    const devtools_attempts = allViolations.filter(v => v.violation_type === 'devtools').length;
    const pdf_leaks = allViolations.filter(v => v.violation_type === 'pdf_leak').length;
    const exam_leaks = allViolations.filter(v => v.violation_type === 'exam_leak').length;
    const blocked_students = offenders.filter(o => o.is_blocked).length;

    const stats = {
      total_violations: allViolations.length,
      screenshots,
      screenshot_count: screenshots,
      screen_records,
      record_count: screen_records,
      idm_downloads,
      devtools_attempts,
      download_count: idm_downloads + devtools_attempts,
      pdf_leaks,
      exam_leaks,
      pdf_exam_count: pdf_leaks + exam_leaks,
      flagged_students_count: offenders.length,
      blocked_students,
      blocked_students_count: blocked_students
    };

    res.json({ stats, offenders, violations });
  } catch (err) {
    console.error('Get security violations error:', err);
    res.status(500).json({ error: 'حدث خطأ في جلب تقارير المخالفات الأمنية' });
  }
});

// Teacher: Take action on an offending student (block, unblock, clear violations)
router.post('/student/:userId/action', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const targetId = Number(req.params.userId);
    const { action } = req.body || {};
    const student = db.prepare('SELECT id, name, phone, parent_phone FROM users WHERE id = ?').get(targetId);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    if (action === 'block') {
      db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(targetId);
      db.prepare('UPDATE enrollments SET is_suspended = 1 WHERE user_id = ?').run(targetId);
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        targetId,
        'تم إيقاف حسابك لمخالفة سياسة حماية المحتوى',
        'تم رصد محاولات تصوير أو تسجيل أو تحميل غير مصرح بها للمحتوى التعليمي. يرجى التواصل مع إدارة المنصة.',
        'error'
      );
      return res.json({ is_blocked: 1, message: `تم حظر الطالب "${student.name}" وإيقاف اشتراكاته فوراً` });
    }

    if (action === 'unblock') {
      db.prepare('UPDATE users SET is_blocked = 0, security_strikes = 0 WHERE id = ?').run(targetId);
      db.prepare('UPDATE enrollments SET is_suspended = 0 WHERE user_id = ?').run(targetId);
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        targetId,
        'تم إعادة تفعيل حسابك من قِبل المعلم',
        'تم منحك فرصة جديدة وإعادة فتح الكورسات. يرجى الالتزام بعدم تصوير أو تسجيل المحتوى لتجنب الحظر النهائي.',
        'success'
      );
      return res.json({ is_blocked: 0, message: `تم فك الحظر عن الطالب "${student.name}" وتصفير عداد الإنذارات` });
    }

    if (action === 'clear') {
      db.prepare('DELETE FROM security_violations WHERE user_id = ?').run(targetId);
      db.prepare('UPDATE users SET security_strikes = 0, is_blocked = 0 WHERE id = ?').run(targetId);
      return res.json({ is_blocked: 0, message: `تم مسح سجل المخالفات للطالب "${student.name}"` });
    }

    res.status(400).json({ error: 'إجراء غير معروف' });
  } catch (err) {
    console.error('Security action error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تنفيذ الإجراء' });
  }
});

export default router;
