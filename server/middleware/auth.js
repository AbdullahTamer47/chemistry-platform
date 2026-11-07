import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db.js';

function resolveSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) return process.env.JWT_SECRET;
  const seed = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.VERCEL_PROJECT_ID || 'kimyawy-zra-platform-secret-2026';
  const deterministicSecret = crypto.createHmac('sha384', 'kimyawy-zra-serverless-key').update(seed).digest('hex');
  try {
    const row = db.prepare("SELECT value FROM platform_settings WHERE key = 'jwt_secret'").get();
    if (row?.value && row.value.length >= 32) return row.value;
    try {
      db.prepare("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('jwt_secret', ?)").run(deterministicSecret);
    } catch (e) {}
    return deterministicSecret;
  } catch (err) {
    return deterministicSecret;
  }
}
const JWT_SECRET = resolveSecret();
export const SECRET_KEY = JWT_SECRET;

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role || 'student',
      name: user.name || 'طالب كيمياوي',
      grade: user.grade || 'ثالثة ثانوي',
      phone: user.phone || ''
    },
    JWT_SECRET,
    { expiresIn: '14d' }
  );
}

// Verifies the token and resolves user (DB first, fallback to verified cryptographic payload)
function resolveUser(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }

  if (!decoded || typeof decoded !== 'object' || decoded.id == null || typeof decoded.role !== 'string') {
    return null;
  }

  try {
    const user = db.prepare('SELECT id, name, role, grade, phone, COALESCE(is_blocked, 0) as is_blocked FROM users WHERE id = ?').get(decoded.id);
    if (user) return user;
  } catch (err) {
    console.warn('[Auth] DB lookup warning on serverless:', err.message);
  }

  return {
    id: decoded.id,
    name: decoded.name || 'مستخدم المنصة',
    role: decoded.role,
    grade: decoded.grade || 'ثالثة ثانوي',
    phone: decoded.phone || '',
    is_blocked: 0
  };
}

export function isDeviceOrUserBanned({ deviceId = '', userId = null } = {}) {
  try {
    if (userId) {
      const u = db.prepare('SELECT role, COALESCE(is_blocked, 0) as is_blocked FROM users WHERE id = ?').get(userId);
      if (u && (u.role === 'teacher' || u.role === 'admin')) return false;
      if (u && Number(u.is_blocked) === 1) return true;
      const bannedByUser = db.prepare('SELECT id FROM banned_devices WHERE user_id = ? LIMIT 1').get(userId);
      if (bannedByUser) return true;
    }
    const cleanDid = String(deviceId || '').trim();
    if (cleanDid && cleanDid.length >= 4) {
      const bannedByDid = db.prepare('SELECT id FROM banned_devices WHERE device_id = ? LIMIT 1').get(cleanDid);
      if (bannedByDid) return true;
    }
  } catch (_) {}
  return false;
}

export function logSecurityIntrusion(req, {
  user_id = null,
  suspect_name = '',
  suspect_phone = '',
  violation_type = 'admin_intrusion',
  severity = 'critical',
  source_title = 'محاولة اختراق أو دخول غير مصرح',
  details = '',
  request_payload = ''
} = {}) {
  try {
    const uid = user_id || req?.user?.id || null;
    const sName = String(suspect_name || req?.user?.name || 'زائر / محاولة خارجية').slice(0, 120);
    const sPhone = String(suspect_phone || req?.user?.phone || '').slice(0, 60);
    const ua = String(req?.headers?.['user-agent'] || '').slice(0, 220);
    const ip = String(req?.headers?.['x-forwarded-for'] || req?.ip || '').split(',')[0].trim();
    const did = String(req?.headers?.['x-device-id'] || req?.body?.device_id || '').slice(0, 120);
    const reqPath = String(req?.originalUrl || req?.url || '').slice(0, 200);
    const payloadStr = String(request_payload || (req?.body ? JSON.stringify(req.body) : '')).slice(0, 500);

    db.prepare(`
      INSERT INTO security_violations
        (user_id, violation_type, severity, source_title, details, device_info, ip_address, suspect_name, suspect_phone, device_id, request_path, request_payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uid, violation_type, severity, source_title, details, ua, ip, sName, sPhone, did, reqPath, payloadStr);

    if (uid) {
      db.prepare('UPDATE users SET security_strikes = COALESCE(security_strikes, 0) + 1 WHERE id = ?').run(uid);
    }

    const teachers = db.prepare("SELECT id FROM users WHERE role IN ('teacher', 'admin')").all();
    const msg = `رصد النظام ${source_title} — الاسم/البيانات: "${sName}" ${sPhone ? `(${sPhone})` : ''} | المسار: ${reqPath} | IP: ${ip || 'غير معروف'}.`;
    for (const t of teachers) {
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        t.id,
        '🚨 إنذار أمني: محاولة اختراق / دخول غير مصرح',
        msg,
        'error'
      );
    }
  } catch (e) {}
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }
  try {
    const user = resolveUser(authHeader.split(' ')[1]);
    if (!user) return res.status(401).json({ error: 'جلسة غير صالحة - يرجى تسجيل الدخول مرة أخرى' });

    const deviceId = String(req.headers['x-device-id'] || '').trim();
    if (user.role !== 'teacher' && user.role !== 'admin') {
      if (Number(user.is_blocked) === 1 || isDeviceOrUserBanned({ deviceId, userId: user.id })) {
        return res.status(403).json({
          error: 'تم حظر هذا الحساب وهذا الجهاز نهائياً بقرار من إدارة المنصة. لا يمكنك الدخول إلا بعد رفع الحظر من المعلم.',
          is_blocked: true
        });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'جلسة غير صالحة - يرجى تسجيل الدخول مرة أخرى' });
  }
}

// Extracts the user if a valid token exists, never blocks.
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try { req.user = resolveUser(authHeader.split(' ')[1]) || undefined; } catch (e) { /* ignore */ }
  }
  next();
}

export function teacherMiddleware(req, res, next) {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    logSecurityIntrusion(req, {
      violation_type: 'admin_intrusion',
      source_title: 'محاولة دخول غير مصرح به للوحة وصلاحيات الأدمن',
      details: `حاول المستخدم (${req.user.name} - ${req.user.phone}) الوصول إلى مسار الإدارة المحمي: ${req.method} ${req.originalUrl}`
    });
    return res.status(403).json({ error: 'غير مصرح - الصلاحيات للمعلم فقط' });
  }
  next();
}

export function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    logSecurityIntrusion(req, {
      violation_type: 'admin_intrusion',
      source_title: 'محاولة دخول غير مصرح به لصلاحيات المدير',
      details: `حاول المستخدم (${req.user?.name || ''} - ${req.user?.phone || ''}) الوصول إلى: ${req.method} ${req.originalUrl}`
    });
    return res.status(403).json({ error: 'غير مصرح - الصلاحيات للمدير فقط' });
  }
  next();
}

export const isTeacher = (user) => user && (user.role === 'teacher' || user.role === 'admin');

// Single source of truth for "can this user open paid content of this course?"
export function canAccessCourse(user, courseId) {
  if (!user) return false;
  if (isTeacher(user)) return true;
  const userRow = db.prepare('SELECT COALESCE(is_blocked, 0) as is_blocked FROM users WHERE id = ?').get(user.id);
  if (userRow?.is_blocked) return false;
  const course = db.prepare('SELECT is_free FROM courses WHERE id = ?').get(courseId);
  if (!course) return false;
  if (course.is_free) return true;
  const en = db.prepare('SELECT is_suspended, expires_at FROM enrollments WHERE user_id = ? AND course_id = ?').get(user.id, courseId);
  if (!en || en.is_suspended) return false;
  if (en.expires_at && new Date(en.expires_at) < new Date()) return false;
  return true;
}

// Minimal in-memory rate limiter (no extra dependency). Supports both ({ windowMs, max, message }) and (max, windowMs, message).
export function rateLimit(arg1, arg2, arg3) {
  const opts = typeof arg1 === 'object' && arg1 !== null
    ? arg1
    : { max: Number(arg1) || 30, windowMs: Number(arg2) || 60_000, message: arg3 };
  const windowMs = opts.windowMs || 60_000;
  const max = opts.max || 30;
  const message = opts.message;
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset < now) { entry = { count: 0, reset: now + windowMs }; hits.set(key, entry); }
    entry.count++;
    if (entry.count > max) {
      res.set('Retry-After', Math.ceil((entry.reset - now) / 1000));
      return res.status(429).json({ error: message || 'محاولات كثيرة جداً، حاول مرة أخرى بعد قليل' });
    }
    next();
  };
}
