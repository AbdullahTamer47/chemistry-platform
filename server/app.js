import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import lessonRoutes from './routes/lessons.js';
import examRoutes from './routes/exams.js';
import codeRoutes from './routes/codes.js';
import leaderboardRoutes from './routes/leaderboard.js';
import liveRoutes from './routes/live.js';
import studentRoutes from './routes/students.js';
import discussionRoutes from './routes/discussions.js';
import paymentRoutes from './routes/payments.js';
import uploadRoutes from './routes/upload.js';
import packageRoutes from './routes/packages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Behind Vercel / reverse proxies: use the real client IP for rate limiting.
app.set('trust proxy', 1);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// CORS: same-origin requests, local dev, and explicit origins from ALLOWED_ORIGINS (comma separated).
const extraOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors((req, cb) => {
  const origin = req.headers.origin;
  let allowed = !origin; // non-browser clients / same-origin GETs send no Origin
  if (origin) {
    try {
      const host = new URL(origin).host;
      allowed = host === req.headers.host
        || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
        || /\.vercel\.app$/.test(host)
        || extraOrigins.includes(origin);
    } catch { allowed = false; }
  }
  cb(null, { origin: allowed, credentials: true });
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Normalize URL prefix if rewritten by Vercel
app.use((req, res, next) => {
  if (req.url.startsWith('/api/api/')) {
    req.url = req.url.replace('/api/api/', '/api/');
  }
  next();
});

// PostgreSQL state synchronization middleware (ensures multi-instance consistency on Vercel)
app.use(async (req, res, next) => {
  try {
    if (typeof db.ensureSynced === 'function') {
      await db.ensureSynced(req.method);
    }
  } catch (e) {}

  const origJson = res.json.bind(res);
  res.json = async function(body) {
    try {
      if (typeof db.isDirty === 'function' && db.isDirty()) {
        await db.flushToPostgres();
      }
    } catch (e) {}
    return origJson(body);
  };

  next();
});

// Static uploads + DB-backed persistent uploads for serverless environments
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/uploads', express.static('/tmp/uploads'));
app.get(['/uploads/:filename', '/api/uploads/:filename'], (req, res) => {
  try {
    const safeName = path.basename(req.params.filename || '');
    if (!safeName) return res.status(404).end();
    const row = db.prepare('SELECT mimetype, data FROM uploaded_files WHERE filename = ?').get(safeName);
    if (!row || !row.data) return res.status(404).end();
    const buf = Buffer.from(row.data, 'base64');
    res.setHeader('Content-Type', row.mimetype || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buf);
  } catch (e) {
    res.status(404).end();
  }
});

// Mount helper: mounts route under both /api/... and /... for universal compatibility
const mount = (routePath, router) => {
  app.use(`/api${routePath}`, router);
  app.use(routePath, router);
};

// API Routes
mount('/auth', authRoutes);
mount('/courses', courseRoutes);
mount('/lessons', lessonRoutes);
mount('/exams', examRoutes);
mount('/codes', codeRoutes);
mount('/leaderboard', leaderboardRoutes);
mount('/live', liveRoutes);
mount('/students', studentRoutes);
mount('/discussions', discussionRoutes);
mount('/payments', paymentRoutes);
mount('/upload', uploadRoutes);
mount('/packages', packageRoutes);

// Health check
app.get(['/api/health', '/health'], (req, res) => res.json({
  status: 'ok',
  database: typeof db.isPostgresConnected === 'function' && db.isPostgresConnected() ? 'postgresql' : 'local',
  message: 'كيمياوي API يعمل بنجاح'
}));

// Global API Error Handler
app.use('/api', (err, req, res, next) => {
  console.error(`[API Error] ${req.method} ${req.url}:`, err.message || err);
  const status = err.status && err.status < 500 ? err.status : 500;
  res.status(status).json({ error: status < 500 && err.expose ? err.message : 'حدث خطأ غير متوقع في الخادم' });
});

export default app;
