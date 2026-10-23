import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, teacherMiddleware } from '../middleware/auth.js';

const router = Router();

// Get live sessions
router.get('/', (req, res) => {
  try {
    const sessions = db.prepare(`SELECT ls.*, c.title as course_title, c.grade FROM live_sessions ls LEFT JOIN courses c ON ls.course_id = c.id ORDER BY ls.scheduled_at DESC`).all();
    res.json(sessions);
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Get upcoming sessions
router.get('/upcoming', (req, res) => {
  try {
    const sessions = db.prepare(`SELECT ls.*, c.title as course_title, c.grade FROM live_sessions ls LEFT JOIN courses c ON ls.course_id = c.id WHERE ls.status IN ('upcoming', 'live') AND ls.scheduled_at >= datetime('now', '-2 hours') ORDER BY ls.scheduled_at ASC`).all();
    res.json(sessions);
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Create session (teacher)
router.post('/', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { title, course_id, description, scheduled_at, duration_minutes, meeting_link } = req.body;
    const result = db.prepare('INSERT INTO live_sessions (title, course_id, description, scheduled_at, duration_minutes, meeting_link) VALUES (?, ?, ?, ?, ?, ?)').run(title, course_id, description, scheduled_at, duration_minutes || 60, meeting_link);
    // Notify enrolled students
    if (course_id) {
      const enrolled = db.prepare('SELECT user_id FROM enrollments WHERE course_id = ?').all(course_id);
      enrolled.forEach(e => {
        db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(e.user_id, 'حصة لايف جديدة', `تم إضافة حصة "${title}" - ${scheduled_at}`, 'info');
      });
    }
    res.status(201).json(db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Update session
router.put('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { title, description, scheduled_at, duration_minutes, meeting_link, status, replay_url } = req.body;
    db.prepare('UPDATE live_sessions SET title=COALESCE(?,title), description=COALESCE(?,description), scheduled_at=COALESCE(?,scheduled_at), duration_minutes=COALESCE(?,duration_minutes), meeting_link=COALESCE(?,meeting_link), status=COALESCE(?,status), replay_url=COALESCE(?,replay_url) WHERE id=?').run(title, description, scheduled_at, duration_minutes, meeting_link, status, replay_url, req.params.id);
    res.json(db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Delete session
router.delete('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM live_sessions WHERE id = ?').run(req.params.id); res.json({ message: 'تم الحذف' }); }
  catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

export default router;
