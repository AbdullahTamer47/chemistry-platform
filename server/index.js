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
const PORT = process.env.PORT || 3000;

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : null;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !allowedOrigins || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('غير مصرح بهذا النطاق للاتصال بالخادم'));
  },
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/codes', codeRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/packages', packageRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'كيمياوي API يعمل بنجاح' }));

// Global API Error Handler
app.use('/api', (err, req, res, next) => {
  console.error(`[API Error] ${req.method} ${req.url}:`, err.message || err);
  res.status(err.status || 500).json({ error: err.message || 'حدث خطأ غير متوقع في الخادم' });
});

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'نقطة الاتصال غير موجودة (404 Not Found)' });
});

// Serve built frontend if dist exists
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`كيمياوي Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
