import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { generateToken, authMiddleware, rateLimit } from '../middleware/auth.js';

const router = Router();

const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, message: 'تم تجاوز عدد الحسابات المسموح بإنشائها من هذا الجهاز، حاول لاحقاً' });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, message: 'محاولات دخول كثيرة جداً، يرجى الانتظار قليلاً قبل المحاولة مرة أخرى' });

function normalizePhone(str) {
  if (!str) return '';
  return String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/\s|-/g, '');
}

// Practical password policy: >= 6 chars, not equal to phone number.
export function checkPasswordStrength(password, phone) {
  if (typeof password !== 'string' || password.length < 6) {
    return 'كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام';
  }
  if (password.length > 72) {
    return 'كلمة المرور طويلة جداً';
  }
  if (phone && password === phone) {
    return 'لا تستخدم رقم هاتفك ككلمة مرور';
  }
  return null;
}

// Strip HTML-significant characters from free-text names at the source.
function cleanName(name) {
  return String(name).replace(/[<>"'`&]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

// Register
router.post('/register', registerLimiter, (req, res) => {
  try {
    const { name, phone, password, grade, study_track, parent_phone, parent_phone_secondary, device_id, device_name } = req.body;

    if (!name || !phone || !password || !grade) {
      return res.status(400).json({ error: 'الاسم ورقم الهاتف وكلمة المرور والمرحلة الدراسية مطلوبون' });
    }

    const cleanTrack = study_track === 'لغات' ? 'لغات' : 'عام';
    const cleanPhone = normalizePhone(phone);
    const cleanParentPhone = normalizePhone(parent_phone);
    const cleanParentPhone2 = normalizePhone(parent_phone_secondary);

    if (!/^01[0125][0-9]{8}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'رقم الهاتف غير صحيح (يجب أن يكون 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015)' });
    }

    if (!cleanParentPhone || !/^01[0125][0-9]{8}$/.test(cleanParentPhone)) {
      return res.status(400).json({ error: 'رقم هاتف ولي الأمر إجباري ويجب أن يتكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015' });
    }

    if (cleanParentPhone === cleanPhone) {
      return res.status(400).json({ error: 'يرجى كتابة رقم هاتف ولي أمر مختلف عن رقم الطالب الشخصي' });
    }

    const pwError = checkPasswordStrength(password, cleanPhone);
    if (pwError) return res.status(400).json({ error: pwError });

    const safeName = cleanName(name);
    if (safeName.length < 2) return res.status(400).json({ error: 'الاسم غير صالح، يرجى كتابة اسمك الكامل' });

    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(cleanPhone);
    if (existing) {
      return res.status(400).json({ error: 'رقم الهاتف مسجل بالفعل في المنصة، يمكنك تسجيل الدخول مباشرة' });
    }

    const hashedPassword = bcrypt.hashSync(password, 8);
    const result = db.prepare(
      'INSERT INTO users (name, phone, password, role, grade, study_track, parent_phone, parent_phone_secondary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(safeName, cleanPhone, hashedPassword, 'student', grade, cleanTrack, cleanParentPhone, cleanParentPhone2 || null);

    let user = db.prepare('SELECT id, name, role, phone, grade, study_track, parent_phone FROM users WHERE id = ?').get(result.lastInsertRowid);
    if (!user) {
      user = db.prepare('SELECT id, name, role, phone, grade, study_track, parent_phone FROM users WHERE phone = ?').get(cleanPhone);
    }

    if (!user) {
      throw new Error('user lookup failed after insert');
    }

    // Bind initial device on registration
    try {
      const activeDeviceId = device_id || req.headers['x-device-id'] || ('dev_' + Buffer.from(req.ip + (req.headers['user-agent'] || '')).toString('base64').slice(0, 20));
      if (activeDeviceId) {
        db.prepare('INSERT INTO user_devices (user_id, device_id, device_name) VALUES (?, ?, ?)').run(
          user.id,
          activeDeviceId,
          device_name || 'جهاز طالب'
        );
      }
    } catch (_) {}

    const token = generateToken(user);

    // Send welcome notification
    try {
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        user.id,
        'أهلاً بك في منصة كيمياوي التعليمية',
        `مرحباً ${safeName}، نورتنا في منصة د. زياد رمزي عياد. ابدأ الآن رحلة التفوق في الكيمياء!`,
        'success'
      );
    } catch (notifErr) {
      console.warn('Welcome notification warning:', notifErr.message);
    }

    res.json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'حدث خطأ في التسجيل، حاول مرة أخرى' });
  }
});

// Login
router.post('/login', loginLimiter, (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'رقم الهاتف وكلمة المرور مطلوبان' });
    }

    const cleanPhone = normalizePhone(phone);
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);
    if (!user) {
      return res.status(401).json({ error: 'رقم الهاتف غير مسجل أو كلمة المرور غير صحيحة' });
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
    }

    const { password: _, ...safeUser } = user;

    // Strict Device Fingerprinting (Maximum 2 Devices per Student — blocks 3rd device until teacher resets)
    const { device_id, device_name } = req.body;
    if (user.role === 'student') {
      const activeDeviceId = device_id || req.headers['x-device-id'] || ('dev_' + Buffer.from(req.ip + (req.headers['user-agent'] || '')).toString('base64').slice(0, 20));
      const devices = db.prepare('SELECT * FROM user_devices WHERE user_id = ?').all(user.id);
      const isRegistered = devices.some(d => d.device_id === activeDeviceId);

      if (!isRegistered) {
        if (devices.length >= 2) {
          return res.status(403).json({
            error: 'عفواً، لقد وصلت للحد الأقصى المسموح به لتسجيل الدخول (جهازان فقط لكل طالب). لتسجيل الدخول من جهاز جديد يرجى التواصل مع المعلم لإعادة ضبط أجهزتك.'
          });
        }
        db.prepare('INSERT INTO user_devices (user_id, device_id, device_name) VALUES (?, ?, ?)').run(
          user.id,
          activeDeviceId,
          device_name || 'جهاز طالب'
        );
      } else {
        db.prepare('UPDATE user_devices SET last_login = CURRENT_TIMESTAMP WHERE user_id = ? AND device_id = ?').run(
          user.id,
          activeDeviceId
        );
      }
    }

    const token = generateToken(safeUser);

    res.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'حدث خطأ في تسجيل الدخول' });
  }
});

// Get current user profile
router.get('/me', authMiddleware, (req, res) => {
  try {
    let user = db.prepare(`
      SELECT u.id, u.name, u.phone, u.role, u.grade, COALESCE(u.study_track, 'عام') as study_track, u.parent_phone, u.parent_phone_secondary, u.avatar, u.created_at,
             COALESCE(sw.balance, 0) as balance
      FROM users u
      LEFT JOIN student_wallets sw ON sw.user_id = u.id
      WHERE u.id = ?
    `).get(req.user.id);
    if (!user) {
      user = {
        id: req.user.id,
        name: req.user.name || 'طالب كيمياوي',
        phone: req.user.phone || '',
        role: req.user.role || 'student',
        grade: req.user.grade || 'ثالثة ثانوي',
        study_track: req.user.study_track || 'عام',
        parent_phone: '',
        balance: 0
      };
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Update profile (Teacher only; student profile data is locked after registration)
router.put(['/me', '/profile'], authMiddleware, (req, res) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({ error: 'لا يمكن للطالب تعديل بيانات الحساب بعد التسجيل إلا من خلال المعلم' });
    }
    const { name, grade, parent_phone, parent_phone_secondary } = req.body;
    const cleanedName = name !== undefined ? cleanName(name) : null;
    if (name !== undefined && (!cleanedName || cleanedName.length < 3)) {
      return res.status(400).json({ error: 'يرجى إدخال اسم ثلاثي صحيح' });
    }
    const normParent1 = parent_phone !== undefined ? (parent_phone ? normalizePhone(parent_phone) : '') : null;
    const normParent2 = parent_phone_secondary !== undefined ? (parent_phone_secondary ? normalizePhone(parent_phone_secondary) : '') : null;

    db.prepare('UPDATE users SET name = COALESCE(?, name), grade = COALESCE(?, grade), parent_phone = COALESCE(?, parent_phone), parent_phone_secondary = COALESCE(?, parent_phone_secondary) WHERE id = ?')
      .run(cleanedName, grade ?? null, normParent1, normParent2, req.user.id);
    const user = db.prepare(`
      SELECT u.id, u.name, u.phone, u.role, u.grade, COALESCE(u.study_track, 'عام') as study_track, u.parent_phone, u.parent_phone_secondary, u.avatar, u.created_at,
             COALESCE(sw.balance, 0) as balance
      FROM users u
      LEFT JOIN student_wallets sw ON sw.user_id = u.id
      WHERE u.id = ?
    `).get(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في تحديث الملف الشخصي' });
  }
});

// Change password (Teacher only; students contact teacher to change password)
router.put('/change-password', authMiddleware, (req, res) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({ error: 'لا يمكن للطالب تغيير كلمة المرور إلا من خلال المعلم' });
    }
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT password, phone FROM users WHERE id = ?').get(req.user.id);
    const pwError = checkPasswordStrength(newPassword, user?.phone);
    if (pwError) return res.status(400).json({ error: pwError });

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }

    const hashed = bcrypt.hashSync(newPassword, 8);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Dashboard data for student
router.get('/dashboard', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user with balance
    let user = db.prepare(`
      SELECT u.id, u.name, u.role, u.phone, u.grade, COALESCE(u.study_track, 'عام') as study_track, u.parent_phone, u.parent_phone_secondary, u.avatar, u.created_at,
             COALESCE(sw.balance, 0) as balance
      FROM users u
      LEFT JOIN student_wallets sw ON sw.user_id = u.id
      WHERE u.id = ?
    `).get(userId);

    if (!user) {
      user = {
        id: req.user.id,
        name: req.user.name || 'طالب كيمياوي',
        role: req.user.role || 'student',
        phone: req.user.phone || '',
        grade: req.user.grade || 'ثالثة ثانوي',
        parent_phone: '',
        balance: 0
      };
    }

    // Stats
    const examsStats = db.prepare(
      'SELECT COUNT(*) as exams_taken, ROUND(AVG(score), 1) as avg_score FROM exam_attempts WHERE user_id = ? AND completed_at IS NOT NULL'
    ).get(userId) || { exams_taken: 0, avg_score: 0 };

    // Rank in leaderboard (efficient SQL rank query)
    const userAvg = examsStats.avg_score || 0;
    const higherCount = db.prepare(`
      SELECT COUNT(*) as c FROM (
        SELECT user_id, ROUND(AVG(score), 1) as avg
        FROM exam_attempts
        WHERE completed_at IS NOT NULL
        GROUP BY user_id
        HAVING avg > ?
      )
    `).get(userAvg)?.c || 0;
    const rank = higherCount + 1;

    // Active courses with progress
    const activeCourses = db.prepare(`
      SELECT c.id, c.title, c.grade, c.thumbnail, e.activated_at,
        (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as total_lessons,
        (SELECT COUNT(*) FROM lesson_progress WHERE user_id = ? AND lesson_id IN (SELECT id FROM lessons WHERE course_id = c.id) AND completed = 1) as completed_lessons
      FROM courses c
      INNER JOIN enrollments e ON c.id = e.course_id
      WHERE e.user_id = ? AND e.is_suspended = 0
      ORDER BY e.activated_at DESC
      LIMIT 6
    `).all(userId, userId).map(c => ({
      ...c,
      progress: c.total_lessons > 0 ? Math.round((c.completed_lessons / c.total_lessons) * 100) : 0
    }));

    // Recent activity from exam attempts
    const recentExams = db.prepare(
      'SELECT ea.completed_at as date, ex.title, ea.score FROM exam_attempts ea JOIN exams ex ON ea.exam_id = ex.id WHERE ea.user_id = ? AND ea.completed_at IS NOT NULL ORDER BY ea.completed_at DESC LIMIT 5'
    ).all(userId).map(a => ({ action: `حللت امتحان "${a.title}" بدرجة ${Math.round(a.score)}%`, date: a.date }));

    // Recent activations
    const recentActivations = db.prepare(
      'SELECT e.activated_at as date, c.title FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.user_id = ? ORDER BY e.activated_at DESC LIMIT 3'
    ).all(userId).map(a => ({ action: `فعّلت كورس "${a.title}"`, date: a.date }));

    const recentActivity = [...recentExams, ...recentActivations]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 7);

    // Find "أنت هنا" (Current / Next Lesson to resume across enrolled courses)
    let resumeLesson = db.prepare(`
      SELECT l.id as lesson_id, l.title as lesson_title, l.order_num, l.chapter_id, l.course_id,
             ch.title as chapter_title, c.title as course_title,
             COALESCE(lp.watch_time, 0) as watch_time
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      JOIN lessons l ON l.course_id = c.id
      LEFT JOIN chapters ch ON ch.id = l.chapter_id
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = e.user_id
      WHERE e.user_id = ? AND e.is_suspended = 0 AND COALESCE(lp.completed, 0) = 0
      ORDER BY CASE WHEN lp.views_count > 0 THEN 0 ELSE 1 END ASC, e.activated_at DESC, COALESCE(ch.order_num, 0) ASC, l.order_num ASC
      LIMIT 1
    `).get(userId) || null;

    if (resumeLesson && resumeLesson.chapter_id) {
      const chCounts = db.prepare(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN lp.completed = 1 THEN 1 ELSE 0 END) as completed
        FROM lessons l
        LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
        WHERE l.chapter_id = ?
      `).get(userId, resumeLesson.chapter_id);
      resumeLesson.chapter_total = chCounts?.total || 1;
      resumeLesson.chapter_completed = chCounts?.completed || 0;
    }

    res.json({
      user,
      stats: {
        exams_taken: examsStats.exams_taken || 0,
        avg_score: examsStats.avg_score || 0,
        rank,
        enrolled_count: activeCourses.length
      },
      resumeLesson,
      activeCourses,
      recentActivity
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الداشبورد' });
  }
});

export default router;
