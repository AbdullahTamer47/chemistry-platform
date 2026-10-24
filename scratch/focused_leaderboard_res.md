```javascript
import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function getChemistryBadge(totalPoints) {
  if (totalPoints >= 1000) {
    return { title: 'نابغة الكيمياء', badge: 'crown', color: '#f59e0b' };
  }
  if (totalPoints >= 600) {
    return { title: 'عالم كيمياء', badge: 'flask', color: '#10b981' };
  }
  if (totalPoints >= 300) {
    return { title: 'محترف الروابط', badge: 'atom', color: '#06b6d4' };
  }
  return { title: 'مستكشف الذرة', badge: 'compass', color: '#6366f1' };
}

// Get leaderboard
router.get('/', (req, res) => {
  try {
    const { exam_id, course_id, grade, timeframe } = req.query;
    const timeFilter = timeframe === 'monthly'
      ? " AND ea.completed_at >= datetime('now', '-30 days')"
      : '';

    let students;

    if (exam_id) {
      students = db.prepare(`
        SELECT u.id, u.name, u.grade, u.avatar,
          ea.score, ea.score AS total_score, ea.time_spent, ea.completed_at,
          ROW_NUMBER() OVER (ORDER BY ea.score DESC, ea.time_spent ASC) AS rank
        FROM exam_attempts ea
        JOIN users u ON ea.user_id = u.id
        WHERE ea.exam_id = ?
          AND ea.completed_at IS NOT NULL
          AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
          ${timeFilter}
        ORDER BY ea.score DESC, ea.time_spent ASC
        LIMIT 100
      `).all(exam_id);
    } else if (course_id) {
      students = db.prepare(`
        SELECT u.id, u.name, u.grade, u.avatar,
          ROUND(AVG(ea.score), 1) AS avg_score,
          SUM(ea.score) AS total_score,
          COUNT(DISTINCT ea.exam_id) AS exams_taken,
          ROW_NUMBER() OVER (ORDER BY AVG(ea.score) DESC) AS rank
        FROM exam_attempts ea
        JOIN users u ON ea.user_id = u.id
        JOIN exams e ON ea.exam_id = e.id
        WHERE e.course_id = ?
          AND ea.completed_at IS NOT NULL
          AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
          ${timeFilter}
        GROUP BY u.id
        ORDER BY avg_score DESC
        LIMIT 100
      `).all(course_id);
    } else {
      let q = `
        SELECT u.id, u.name, u.grade, u.avatar,
          ROUND(AVG(ea.score), 1) AS avg_score,
          SUM(ea.score) AS total_score,
          COUNT(DISTINCT ea.exam_id) AS exams_taken,
          SUM(CASE WHEN ea.score >= 60 THEN 1 ELSE 0 END) AS passed_exams,
          ROW_NUMBER() OVER (ORDER BY AVG(ea.score) DESC) AS rank
        FROM exam_attempts ea
        JOIN users u ON ea.user_id = u.id
        WHERE ea.completed_at IS NOT NULL
          AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
          ${timeFilter}
      `;
      const params = [];

      if (grade) {
        q += ' AND u.grade = ?';
        params.push(grade);
      }

      q += ' GROUP BY u.id ORDER BY avg_score DESC LIMIT 100';
      students = db.prepare(q).all(...params);
    }

    res.json(students.map(student => ({
      ...student,
      badge: getChemistryBadge(
        student.total_score || (student.avg_score * student.exams_taken)
      )
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Get my rank
router.get('/my-rank', authMiddleware, (req, res) => {
  try {
    const { timeframe } = req.query;
    const timeFilter = timeframe === 'monthly'
      ? " AND ea.completed_at >= datetime('now', '-30 days')"
      : '';

    const stats = db.prepare(`
      SELECT ROUND(AVG(ea.score), 1) AS avg_score,
        SUM(ea.score) AS total_score,
        COUNT(*) AS total_exams,
        SUM(CASE WHEN ea.score >= 60 THEN 1 ELSE 0 END) AS passed
      FROM exam_attempts ea
      WHERE ea.user_id = ?
        AND ea.completed_at IS NOT NULL
        AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
        ${timeFilter}
    `).get(req.user.id);

    const rank = db.prepare(`
      SELECT COUNT(DISTINCT ea.user_id) + 1 AS rank
      FROM exam_attempts ea
      WHERE ea.completed_at IS NOT NULL
        AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
        ${timeFilter}
      GROUP BY ea.user_id
      HAVING AVG(ea.score) > ?
    `).get(stats?.avg_score || 0);

    res.json({
      ...stats,
      rank: rank?.rank || 1,
      badge: getChemistryBadge(
        stats?.total_score || (stats?.avg_score * stats?.total_exams) || 0
      )
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

export default router;
```