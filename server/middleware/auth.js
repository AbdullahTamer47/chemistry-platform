import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db.js';

// JWT secret: must come from env in production. In development a random secret
// is generated once and persisted, so it is never hard-coded in the source.
function resolveSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  const row = db.prepare("SELECT value FROM platform_settings WHERE key = 'jwt_secret'").get();
  if (row?.value) return row.value;
  const secret = crypto.randomBytes(48).toString('hex');
  db.prepare("INSERT INTO platform_settings (key, value) VALUES ('jwt_secret', ?)").run(secret);
  return secret;
}
const JWT_SECRET = resolveSecret();

export function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

// Verifies the token AND that the user still exists (deleted users are logged out immediately).
// Role is always read from the database so a changed role takes effect at once.
function resolveUser(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  const user = db.prepare('SELECT id, name, role, grade FROM users WHERE id = ?').get(decoded.id);
  return user || null;
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }
  try {
    const user = resolveUser(authHeader.split(' ')[1]);
    if (!user) return res.status(401).json({ error: 'الحساب غير موجود - يرجى تسجيل الدخول مرة أخرى' });
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

// Minimal in-memory rate limiter (no extra dependency).
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
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
