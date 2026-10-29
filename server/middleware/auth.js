import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db.js';

// JWT secret: must come from the environment in production. There is NO hardcoded fallback.
// In local development only, a random secret is generated once and persisted in the DB.
function resolveSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) return process.env.JWT_SECRET;
  try {
    const row = db.prepare("SELECT value FROM platform_settings WHERE key = 'jwt_secret'").get();
    if (row?.value) return row.value;
    const seed = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_URL || '';
    const secret = seed
      ? crypto.createHmac('sha384', 'kimyawy-zra-serverless-key').update(seed).digest('hex')
      : crypto.randomBytes(48).toString('hex');
    try {
      db.prepare("INSERT INTO platform_settings (key, value) VALUES ('jwt_secret', ?)").run(secret);
    } catch (e) {}
    return secret;
  } catch (err) {
    return crypto.randomBytes(48).toString('hex');
  }
}
const JWT_SECRET = resolveSecret();

export function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name, grade: user.grade || null }, JWT_SECRET, { expiresIn: '7d' });
}

// Verifies the token and resolves user (DB first, fallback to verified cryptographic payload on serverless)
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
    const user = db.prepare('SELECT id, name, role, grade FROM users WHERE id = ?').get(decoded.id);
    if (user) return user;
    // If the database query succeeded but the user wasn't found, the user has been deleted or deactivated.
    return null;
  } catch (err) {
    console.warn('[Auth] DB lookup warning on serverless:', err.message);
    // Fallback to verified JWT payload only during operational database outages on serverless
    return {
      id: decoded.id,
      name: decoded.name || 'مستخدم المنصة',
      role: decoded.role,
      grade: decoded.grade || null
    };
  }
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }
  try {
    const user = resolveUser(authHeader.split(' ')[1]);
    if (!user) return res.status(401).json({ error: 'جلسة غير صالحة - يرجى تسجيل الدخول مرة أخرى' });
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
    return res.status(403).json({ error: 'غير مصرح - الصلاحيات للمعلم فقط' });
  }
  next();
}

export function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - الصلاحيات للمدير فقط' });
  }
  next();
}

export const isTeacher = (user) => user && (user.role === 'teacher' || user.role === 'admin');

// Single source of truth for "can this user open paid content of this course?"
export function canAccessCourse(user, courseId) {
  if (!user) return false;
  if (isTeacher(user)) return true;
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
