import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Get leaderboard
router.get('/', (req, res) => {
  try {
    const { exam_id, course_id, grade } = req.query;
    let students;
    if (exam_id) {
      students = db.prepare(`SELECT u.id, u.name, u.grade, u.avatar, ea.score, ea.time_spent, ea.completed_at,
        ROW_NUMBER() OVER (ORDER BY ea.score DESC, ea.time_spent ASC) as rank
        FROM exam_attempts ea JOIN users u ON ea.user_id = u.id
        WHERE ea.exam_id = ? AND ea.completed_at IS NOT NULL AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
        ORDER BY ea.score DESC, ea.time_spent ASC LIMIT 100`).all(exam_id);
    } else if (course_id) {
      students = db.prepare(`SELECT u.id, u.name, u.grade, u.avatar,
        ROUND(AVG(ea.score), 1) as avg_score,
        COUNT(DISTINCT ea.exam_id) as exams_taken,
        ROW_NUMBER() OVER (ORDER BY AVG(ea.score) DESC) as rank
        FROM exam_attempts ea JOIN users u ON ea.user_id = u.id
        JOIN exams e ON ea.exam_id = e.id
        WHERE e.course_id = ? AND ea.completed_at IS NOT NULL AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
        GROUP BY u.id ORDER BY avg_score DESC LIMIT 100`).all(course_id);
    } else {
      let q = `SELECT u.id, u.name, u.grade, u.avatar,
        ROUND(AVG(ea.score), 1) as avg_score,
        COUNT(DISTINCT ea.exam_id) as exams_taken,
        SUM(CASE WHEN ea.score >= 60 THEN 1 ELSE 0 END) as passed_exams,
        ROW_NUMBER() OVER (ORDER BY AVG(ea.score) DESC) as rank
        FROM exam_attempts ea JOIN users u ON ea.user_id = u.id
        WHERE ea.completed_at IS NOT NULL AND (ea.is_graded = 1 OR ea.is_graded IS NULL)`;
      const params = [];
      if (grade) { q += ' AND u.grade = ?'; params.push(grade); }
      q += ' GROUP BY u.id ORDER BY avg_score DESC LIMIT 100';
      students = db.prepare(q).all(...params);
    }
    res.json(students);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ' }); }
});

// Get my rank
router.get('/my-rank', authMiddleware, (req, res) => {
  try {
    const stats = db.prepare(`SELECT ROUND(AVG(score), 1) as avg_score, COUNT(*) as total_exams,
      SUM(CASE WHEN score >= 60 THEN 1 ELSE 0 END) as passed FROM exam_attempts WHERE user_id = ? AND completed_at IS NOT NULL AND (is_graded = 1 OR is_graded IS NULL)`).get(req.user.id);
    const rank = db.prepare(`SELECT COUNT(DISTINCT user_id) + 1 as rank FROM exam_attempts WHERE completed_at IS NOT NULL AND (is_graded = 1 OR is_graded IS NULL)
      GROUP BY user_id HAVING AVG(score) > ?`).get(stats?.avg_score || 0);
    res.json({ ...stats, rank: rank?.rank || 1 });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

export default router;
