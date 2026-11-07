import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, optionalAuth, teacherMiddleware, isTeacher, logSecurityIntrusion } from '../middleware/auth.js';

const router = Router();

const VIOLATION_LABELS = {
  screenshot: 'محاولة أخذ لقطة شاشة (Screenshot)',
  screen_record: 'محاولة تسجيل الشاشة فيديو (Screen Record)',
  idm_download: 'محاولة تحميل المحتوى ببرامج التحميل (IDM / Sniffer)',
  devtools: 'فتح أدوات المطورين أو فحص الكود (DevTools)',
  pdf_leak: 'محاولة طباعة أو تسريب ملف PDF محمي',
  exam_leak: 'محاولة نسخ أو تصوير أسئلة امتحان / واجب',
  admin_intrusion: 'محاولة دخول غير مصرح به للوحة وصلاحيات الأدمن',
  auth_bruteforce: 'محاولة دخول فاشلة أو تخمين بيانات تسجيل الدخول',
  hack_attempt: 'محاولة اختراق أو تلاعب بالنظام (Hack / Injection)'
};

// Public / Optional-Auth endpoint to log unauthorized /admin navigation or intrusion attempts with any data
router.post('/intrusion', optionalAuth, (req, res) => {
  try {
    if (req.user && isTeacher(req.user)) {
      return res.json({ logged: false });
    }
    const {
      violation_type = 'admin_intrusion',
      source_title = 'محاولة دخول غير مصرح به للوحة الإدارة',
      details = '',
      suspect_name = '',
      suspect_phone = '',
      request_payload = ''
    } = req.body || {};

    logSecurityIntrusion(req, {
      user_id: req.user?.id || null,
      suspect_name: suspect_name || req.user?.name || 'زائر / متصفح خارجي',
      suspect_phone: suspect_phone || req.user?.phone || '',
      violation_type: String(violation_type).slice(0, 50),
      source_title: String(source_title).slice(0, 160),
      details: String(details || source_title).slice(0, 400),
      request_payload: String(request_payload || '').slice(0, 400)
    });

    res.json({ logged: true });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

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
    const did = String(req.headers['x-device-id'] || req.body?.device_id || '').slice(0, 120);

    // Throttle duplicate reports within 3 seconds from the same user & type
    const recent = db.prepare(`
      SELECT id FROM security_violations
      WHERE user_id = ? AND violation_type = ?
        AND datetime(created_at) > datetime('now', '-3 seconds')
      LIMIT 1
    `).get(req.user.id, cleanType);

    if (!recent) {
      db.prepare(`
        INSERT INTO security_violations
          (user_id, course_id, lesson_id, exam_id, violation_type, severity, source_title, details, device_info, ip_address, suspect_name, suspect_phone, device_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        ip,
        req.user.name || '',
        req.user.phone || '',
        did
      );

      db.prepare('UPDATE users SET security_strikes = COALESCE(security_strikes, 0) + 1 WHERE id = ?').run(req.user.id);

      const studentRow = db.prepare('SELECT id, name, phone, grade, security_strikes, is_blocked FROM users WHERE id = ?').get(req.user.id);
      const strikes = Number(studentRow?.security_strikes || 1);

      // Silent notification to teachers only (never shown to student)
      const teachers = db.prepare("SELECT id FROM users WHERE role IN ('teacher', 'admin')").all();
      const notifTitle = `⚠️ تنبيه حماية المحتوى: ${label}`;
      const notifMsg = `قام الطالب "${studentRow?.name || req.user.name}" (${studentRow?.phone || ''}) بـ ${label} داخل "${source_title || 'محتوى محمي'}" — إجمالي المرات المرصودة: ${strikes}.`;
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
      is_blocked: Number(updatedUser?.is_blocked || 0)
    });
  } catch (err) {
    console.error('Security report error:', err);
    res.status(500).json({ error: 'حدث خطأ في تسجيل المخالفة' });
  }
});

// Helper: Match a violation_type against a selected category filter tab
function matchesSecurityFilter(vType, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'idm_download') return vType === 'idm_download' || vType === 'devtools';
  if (filter === 'intrusion') return ['admin_intrusion', 'auth_bruteforce', 'hack_attempt', 'devtools'].includes(vType);
  return vType === filter;
}

// Teacher: Get all security violations & offending students report
router.get('/violations', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const typeFilter = String(req.query.type || 'all').trim();
    const limitVal = Math.min(500, Math.max(10, parseInt(req.query.limit, 10) || 250));

    const rawViolations = db.prepare(`
      SELECT sv.*,
             COALESCE(u.name, sv.suspect_name, 'زائر / محاولة خارجية') as student_name,
             COALESCE(u.phone, sv.suspect_phone, sv.ip_address, '-') as student_phone,
             u.parent_phone,
             COALESCE(u.grade, 'خارجي / غير مسجل') as grade,
             COALESCE(u.study_track, 'عام') as study_track,
             COALESCE(u.security_strikes, 0) as security_strikes,
             COALESCE(u.is_blocked, 0) as is_blocked,
             c.title as course_title,
             l.title as lesson_title
      FROM security_violations sv
      LEFT JOIN users u ON sv.user_id = u.id
      LEFT JOIN courses c ON sv.course_id = c.id
      LEFT JOIN lessons l ON sv.lesson_id = l.id
      ORDER BY sv.created_at DESC, sv.id DESC
      LIMIT ?
    `).all(limitVal);

    const bannedDevicesRows = db.prepare('SELECT device_id FROM banned_devices').all();
    const bannedDeviceSet = new Set(bannedDevicesRows.map(r => r.device_id));

    const allViolations = rawViolations.map(v => ({
      ...v,
      is_device_banned: v.device_id && bannedDeviceSet.has(v.device_id) ? 1 : 0
    }));

    const violations = typeFilter && typeFilter !== 'all'
      ? allViolations.filter(v => matchesSecurityFilter(v.violation_type, typeFilter))
      : allViolations;

    const studentOffenders = db.prepare(`
      SELECT u.id, u.name, u.phone, u.parent_phone, u.grade,
             0 as is_external,
             MAX(sv.device_id) as device_id,
             MAX(sv.ip_address) as ip_address,
             COALESCE(u.study_track, 'عام') as study_track,
             COALESCE(u.security_strikes, 0) as security_strikes,
             COALESCE(u.is_blocked, 0) as is_blocked,
             COUNT(sv.id) as total_violations,
             COUNT(sv.id) as violations_count,
             SUM(CASE WHEN sv.violation_type = 'screenshot' THEN 1 ELSE 0 END) as screenshot_count,
             SUM(CASE WHEN sv.violation_type = 'screen_record' THEN 1 ELSE 0 END) as record_count,
             SUM(CASE WHEN sv.violation_type IN ('idm_download', 'devtools') THEN 1 ELSE 0 END) as download_count,
             SUM(CASE WHEN sv.violation_type IN ('idm_download', 'devtools') THEN 1 ELSE 0 END) as idm_count,
             SUM(CASE WHEN sv.violation_type = 'pdf_leak' THEN 1 ELSE 0 END) as pdf_leak_count,
             SUM(CASE WHEN sv.violation_type = 'exam_leak' THEN 1 ELSE 0 END) as exam_leak_count,
             SUM(CASE WHEN sv.violation_type IN ('pdf_leak', 'exam_leak') THEN 1 ELSE 0 END) as doc_leak_count,
             SUM(CASE WHEN sv.violation_type IN ('pdf_leak', 'exam_leak') THEN 1 ELSE 0 END) as leak_count,
             SUM(CASE WHEN sv.violation_type IN ('admin_intrusion', 'auth_bruteforce', 'hack_attempt', 'devtools') THEN 1 ELSE 0 END) as intrusion_count,
             MAX(sv.created_at) as last_violation_at
      FROM users u
      JOIN security_violations sv ON sv.user_id = u.id
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY total_violations DESC, last_violation_at DESC
    `).all();

    const externalOffendersRaw = db.prepare(`
      SELECT NULL as id,
             1 as is_external,
             COALESCE(NULLIF(sv.suspect_name, ''), 'زائر / محاولة خارجية') as name,
             COALESCE(NULLIF(sv.suspect_phone, ''), NULLIF(sv.ip_address, ''), '-') as phone,
             '' as parent_phone,
             'خارجي / غير مسجل' as grade,
             'خارجي' as study_track,
             MAX(sv.device_id) as device_id,
             MAX(sv.ip_address) as ip_address,
             COUNT(sv.id) as security_strikes,
             COUNT(sv.id) as total_violations,
             COUNT(sv.id) as violations_count,
             SUM(CASE WHEN sv.violation_type = 'screenshot' THEN 1 ELSE 0 END) as screenshot_count,
             SUM(CASE WHEN sv.violation_type = 'screen_record' THEN 1 ELSE 0 END) as record_count,
             SUM(CASE WHEN sv.violation_type IN ('idm_download', 'devtools') THEN 1 ELSE 0 END) as download_count,
             SUM(CASE WHEN sv.violation_type IN ('idm_download', 'devtools') THEN 1 ELSE 0 END) as idm_count,
             SUM(CASE WHEN sv.violation_type = 'pdf_leak' THEN 1 ELSE 0 END) as pdf_leak_count,
             SUM(CASE WHEN sv.violation_type = 'exam_leak' THEN 1 ELSE 0 END) as exam_leak_count,
             SUM(CASE WHEN sv.violation_type IN ('pdf_leak', 'exam_leak') THEN 1 ELSE 0 END) as doc_leak_count,
             SUM(CASE WHEN sv.violation_type IN ('pdf_leak', 'exam_leak') THEN 1 ELSE 0 END) as leak_count,
             SUM(CASE WHEN sv.violation_type IN ('admin_intrusion', 'auth_bruteforce', 'hack_attempt', 'devtools') THEN 1 ELSE 0 END) as intrusion_count,
             MAX(sv.created_at) as last_violation_at
      FROM security_violations sv
      WHERE sv.user_id IS NULL
      GROUP BY COALESCE(NULLIF(sv.device_id, ''), NULLIF(sv.ip_address, ''), NULLIF(sv.suspect_phone, ''), CAST(sv.id AS TEXT))
      ORDER BY total_violations DESC, last_violation_at DESC
    `).all();

    const externalOffenders = externalOffendersRaw.map(ext => {
      const targetKey = ext.device_id || (ext.ip_address ? `ip_ban_${ext.ip_address}` : '');
      return {
        ...ext,
        is_blocked: targetKey && bannedDeviceSet.has(targetKey) ? 1 : 0
      };
    });

    const allOffenders = [...studentOffenders, ...externalOffenders];

    const offenders = typeFilter && typeFilter !== 'all'
      ? allOffenders.filter(o => {
          if (typeFilter === 'screenshot') return Number(o.screenshot_count) > 0;
          if (typeFilter === 'screen_record') return Number(o.record_count) > 0;
          if (typeFilter === 'idm_download') return Number(o.idm_count) > 0;
          if (typeFilter === 'pdf_leak') return Number(o.pdf_leak_count) > 0;
          if (typeFilter === 'exam_leak') return Number(o.exam_leak_count) > 0;
          if (typeFilter === 'intrusion') return Number(o.intrusion_count) > 0;
          return true;
        })
      : allOffenders;

    const screenshots = allViolations.filter(v => v.violation_type === 'screenshot').length;
    const screen_records = allViolations.filter(v => v.violation_type === 'screen_record').length;
    const idm_downloads = allViolations.filter(v => v.violation_type === 'idm_download').length;
    const devtools_attempts = allViolations.filter(v => v.violation_type === 'devtools').length;
    const pdf_leaks = allViolations.filter(v => v.violation_type === 'pdf_leak').length;
    const exam_leaks = allViolations.filter(v => v.violation_type === 'exam_leak').length;
    const intrusions = allViolations.filter(v => ['admin_intrusion', 'auth_bruteforce', 'hack_attempt'].includes(v.violation_type)).length;
    const blocked_students = allOffenders.filter(o => o.is_blocked).length;

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
      intrusions,
      flagged_students_count: allOffenders.length,
      blocked_students,
      blocked_students_count: blocked_students,
      banned_devices_count: bannedDevicesRows.length
    };

    res.json({ stats, offenders, violations });
  } catch (err) {
    console.error('Get security violations error:', err);
    res.status(500).json({ error: 'حدث خطأ في جلب تقارير المخالفات الأمنية' });
  }
});

// Teacher: Take action on an offending student (block student + all their devices forever until unblocked, unblock, or clear violations)
router.post('/student/:userId/action', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const targetId = Number(req.params.userId);
    const { action } = req.body || {};
    const student = db.prepare('SELECT id, name, phone, parent_phone FROM users WHERE id = ?').get(targetId);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    if (action === 'block') {
      db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(targetId);
      db.prepare('UPDATE enrollments SET is_suspended = 1 WHERE user_id = ?').run(targetId);

      // Permanently ban all devices associated with this student until teacher unblocks
      const knownDevices = new Set();
      db.prepare('SELECT device_id FROM user_devices WHERE user_id = ?').all(targetId).forEach(r => {
        if (r.device_id) knownDevices.add(r.device_id);
      });
      db.prepare('SELECT DISTINCT device_id, ip_address FROM security_violations WHERE user_id = ?').all(targetId).forEach(r => {
        if (r.device_id) knownDevices.add(r.device_id);
      });

      const lastIpRow = db.prepare('SELECT ip_address FROM security_violations WHERE user_id = ? AND ip_address IS NOT NULL ORDER BY id DESC LIMIT 1').get(targetId);
      const lastIp = lastIpRow?.ip_address || null;

      db.prepare('DELETE FROM banned_devices WHERE user_id = ?').run(targetId);
      if (knownDevices.size > 0) {
        const insBan = db.prepare('INSERT INTO banned_devices (device_id, ip_address, user_id, reason) VALUES (?, ?, ?, ?)');
        for (const did of knownDevices) {
          insBan.run(did, lastIp, targetId, `حظر دائم للطالب (${student.name}) وجهازه بقرار المعلم`);
        }
      } else {
        db.prepare('INSERT INTO banned_devices (device_id, ip_address, user_id, reason) VALUES (?, ?, ?, ?)').run(
          `user_ban_${targetId}`, lastIp, targetId, `حظر دائم للطالب (${student.name}) بقرار المعلم`
        );
      }

      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        targetId,
        'تم حظر حسابك وجهازك نهائياً بقرار من إدارة المنصة',
        'تم إيقاف حسابك وحظر جهازك من الدخول للمنصة. لا يمكن فك الحظر إلا بقرار مباشر من المعلم.',
        'error'
      );
      return res.json({ is_blocked: 1, message: `تم حظر الطالب "${student.name}" وحظر جهازه نهائياً حتى تقوم بإلغاء الحظر` });
    }

    if (action === 'unblock') {
      db.prepare('UPDATE users SET is_blocked = 0, security_strikes = 0 WHERE id = ?').run(targetId);
      db.prepare('UPDATE enrollments SET is_suspended = 0 WHERE user_id = ?').run(targetId);
      // Remove device bans for this student
      const studentDevices = db.prepare('SELECT device_id FROM user_devices WHERE user_id = ?').all(targetId).map(r => r.device_id);
      db.prepare('DELETE FROM banned_devices WHERE user_id = ?').run(targetId);
      for (const did of studentDevices) {
        if (did) db.prepare('DELETE FROM banned_devices WHERE device_id = ?').run(did);
      }

      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        targetId,
        'تم إعادة تفعيل حسابك وفك حظر جهازك من قِبل المعلم',
        'تم منحك فرصة جديدة وإعادة فتح حسابك وجهازك.',
        'success'
      );
      return res.json({ is_blocked: 0, message: `تم فك الحظر عن الطالب "${student.name}" وعن جهازه بنجاح` });
    }

    if (action === 'clear') {
      db.prepare('DELETE FROM security_violations WHERE user_id = ?').run(targetId);
      db.prepare('UPDATE users SET security_strikes = 0, is_blocked = 0 WHERE id = ?').run(targetId);
      db.prepare('DELETE FROM banned_devices WHERE user_id = ?').run(targetId);
      return res.json({ is_blocked: 0, message: `تم مسح سجل المخالفات للطالب "${student.name}"` });
    }

    res.status(400).json({ error: 'إجراء غير معروف' });
  } catch (err) {
    console.error('Security action error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تنفيذ الإجراء' });
  }
});

// Teacher: Ban or unban a specific device_id directly from an intrusion event
router.post('/device/action', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { device_id, ip_address, action = 'block', reason = 'حظر جهاز بسبب محاولة اختراق' } = req.body || {};
    const cleanDid = String(device_id || '').trim();
    if (!cleanDid) return res.status(400).json({ error: 'معرّف الجهاز غير متوفر' });

    if (action === 'unblock') {
      db.prepare('DELETE FROM banned_devices WHERE device_id = ?').run(cleanDid);
      return res.json({ is_device_banned: 0, message: 'تم فك الحظر عن هذا الجهاز بنجاح' });
    }

    db.prepare('DELETE FROM banned_devices WHERE device_id = ?').run(cleanDid);
    db.prepare('INSERT INTO banned_devices (device_id, ip_address, reason) VALUES (?, ?, ?)').run(cleanDid, ip_address || null, reason);
    res.json({ is_device_banned: 1, message: 'تم حظر هذا الجهاز نهائياً من استخدام المنصة' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء تنفيذ الإجراء على الجهاز' });
  }
});

export default router;
