import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

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

app.use(cors({
  origin: true,
  credentials: true
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

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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
app.get(['/api/health', '/health'], (req, res) => res.json({ status: 'ok', message: 'كيمياوي API يعمل بنجاح' }));

// Global API Error Handler
app.use('/api', (err, req, res, next) => {
  console.error(`[API Error] ${req.method} ${req.url}:`, err.message || err);
  res.status(err.status || 500).json({ error: err.message || 'حدث خطأ غير متوقع في الخادم' });
});

export default app;
