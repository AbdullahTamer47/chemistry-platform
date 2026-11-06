import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';

const router = Router();

function getChemistryBadge(totalPoints) {
  if (totalPoints >= 500) {
    return { title: 'نابغة الكيمياء', badge: 'crown', color: '#f59e0b' };
  }
  if (totalPoints >= 250) {
    return { title: 'عالم كيمياء', badge: 'flask', color: '#10b981' };
  }
  if (totalPoints >= 120) {
    return { title: 'محترف الروابط', badge: 'atom', color: '#06b6d4' };
  }
  return { title: 'مستكشف الذرة', badge: 'compass', color: '#6366f1' };
}

// Get leaderboard (Strictly Top 10, deduplicated per student, fair mastery ranking, scoped to student's grade & track)
router.get('/', optionalAuth, (req, res) => {
  try {
    const { exam_id, course_id, grade, track, timeframe } = req.query;
    const timeFilter = timeframe === 'monthly'
      ? " AND ea.completed_at >= datetime('now', '-30 days')"
      : '';

    // If requester is a logged-in student, strictly filter to their grade and study track
    let effectiveGrade = grade || '';
    let effectiveTrack = track || '';
    if (req.user && req.user.role === 'student') {
      const me = db.prepare("SELECT grade, COALESCE(study_track, 'عام') as study_track FROM users WHERE id = ?").get(req.user.id);
      if (me) {
        effectiveGrade = me.grade || effectiveGrade;
        effectiveTrack = me.study_track || effectiveTrack;
      }
    }

    let students = [];

    if (exam_id) {
      // Deduplicate per student on single exam leaderboard (best score, fastest time)
      let q = `
        SELECT u.id, u.name, u.grade, COALESCE(u.study_track, 'عام') as study_track, u.avatar,
          MAX(ea.score) AS score,
          MAX(ea.score) AS avg_score,
          MAX(ea.score) AS total_score,
          MIN(ea.time_spent) AS time_spent,
          1 AS exams_taken,
          MAX(ea.completed_at) AS completed_at
        FROM exam_attempts ea
        JOIN users u ON ea.user_id = u.id
        WHERE u.role = 'student'
          AND ea.exam_id = ?
          AND ea.completed_at IS NOT NULL
          AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
          AND ea.score >= 50
          ${timeFilter}
      `;
      const params = [exam_id];
      if (effectiveGrade) {
        q += ' AND u.grade = ?';
        params.push(effectiveGrade);
      }
      if (effectiveTrack) {
        q += " AND COALESCE(u.study_track, 'عام') = ?";
        params.push(effectiveTrack);
      }
      q += `
        GROUP BY u.id
        ORDER BY score DESC, time_spent ASC
        LIMIT 10
      `;
      students = db.prepare(q).all(...params);
    } else if (course_id) {
      // Deduplicate by (user_id, exam_id) inside the course first
      let q = `
        SELECT u.id, u.name, u.grade, COALESCE(u.study_track, 'عام') as study_track, u.avatar,
          ROUND(AVG(best.best_score), 1) AS avg_score,
          ROUND(SUM(best.best_score), 0) AS total_score,
          COUNT(best.exam_id) AS exams_taken,
          ROUND(AVG(best.best_score) * 0.65 + MIN(COUNT(best.exam_id), 10) * 3.5 + SUM(best.best_score) * 0.05, 1) AS mastery_points
        FROM (
          SELECT ea.user_id, ea.exam_id, MAX(ea.score) AS best_score
          FROM exam_attempts ea
          JOIN exams e ON ea.exam_id = e.id
          WHERE e.course_id = ?
            AND ea.completed_at IS NOT NULL
            AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
            ${timeFilter}
          GROUP BY ea.user_id, ea.exam_id
        ) best
        JOIN users u ON best.user_id = u.id
        WHERE u.role = 'student'
      `;
      const params = [course_id];
      if (effectiveGrade) {
        q += ' AND u.grade = ?';
        params.push(effectiveGrade);
      }
      if (effectiveTrack) {
        q += " AND COALESCE(u.study_track, 'عام') = ?";
        params.push(effectiveTrack);
      }
      q += `
        GROUP BY u.id
        HAVING AVG(best.best_score) >= 50
        ORDER BY mastery_points DESC, total_score DESC, avg_score DESC
        LIMIT 10
      `;
      students = db.prepare(q).all(...params);
    } else {
      // General / Grade Leaderboard: Deduplicate by (user_id, exam_id) first, then rank by Mastery Points
      let q = `
        SELECT u.id, u.name, u.grade, COALESCE(u.study_track, 'عام') as study_track, u.avatar,
          ROUND(AVG(best.best_score), 1) AS avg_score,
          ROUND(SUM(best.best_score), 0) AS total_score,
          COUNT(best.exam_id) AS exams_taken,
          SUM(CASE WHEN best.best_score >= 60 THEN 1 ELSE 0 END) AS passed_exams,
          ROUND(AVG(best.best_score) * 0.65 + MIN(COUNT(best.exam_id), 10) * 3.5 + SUM(best.best_score) * 0.05, 1) AS mastery_points
        FROM (
          SELECT ea.user_id, ea.exam_id, MAX(ea.score) AS best_score
          FROM exam_attempts ea
          WHERE ea.completed_at IS NOT NULL
            AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
            ${timeFilter}
          GROUP BY ea.user_id, ea.exam_id
        ) best
        JOIN users u ON best.user_id = u.id
        WHERE u.role = 'student'
      `;
      const params = [];

      if (effectiveGrade) {
        q += ' AND u.grade = ?';
        params.push(effectiveGrade);
      }
      if (effectiveTrack) {
        q += " AND COALESCE(u.study_track, 'عام') = ?";
        params.push(effectiveTrack);
      }

      q += `
        GROUP BY u.id
        HAVING AVG(best.best_score) >= 50
        ORDER BY mastery_points DESC, total_score DESC, avg_score DESC
        LIMIT 10
      `;
      students = db.prepare(q).all(...params);
    }

    res.json(students.slice(0, 10).map((student, index) => ({
      ...student,
      rank: index + 1,
      badge: getChemistryBadge(
        student.total_score || (student.avg_score * student.exams_taken)
      )
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Get my rank (within student's own grade and study track)
router.get('/my-rank', authMiddleware, (req, res) => {
  try {
    const { timeframe } = req.query;
    const timeFilter = timeframe === 'monthly'
      ? " AND ea.completed_at >= datetime('now', '-30 days')"
      : '';

    const me = db.prepare("SELECT grade, COALESCE(study_track, 'عام') as study_track FROM users WHERE id = ?").get(req.user.id);
    const myGrade = me?.grade || req.user.grade || '';
    const myTrack = me?.study_track || 'عام';

    const stats = db.prepare(`
      SELECT ROUND(AVG(best_score), 1) AS avg_score,
        ROUND(SUM(best_score), 0) AS total_score,
        COUNT(exam_id) AS total_exams,
        SUM(CASE WHEN best_score >= 60 THEN 1 ELSE 0 END) AS passed,
        ROUND(AVG(best_score) * 0.65 + MIN(COUNT(exam_id), 10) * 3.5 + SUM(best_score) * 0.05, 1) AS mastery_points
      FROM (
        SELECT ea.exam_id, MAX(ea.score) AS best_score
        FROM exam_attempts ea
        WHERE ea.user_id = ?
          AND ea.completed_at IS NOT NULL
          AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
          ${timeFilter}
        GROUP BY ea.exam_id
      )
    `).get(req.user.id);

    const myMastery = stats?.mastery_points || 0;

    const rankRow = db.prepare(`
      SELECT COUNT(*) + 1 AS rank FROM (
        SELECT best.user_id,
          ROUND(AVG(best.best_score) * 0.65 + MIN(COUNT(best.exam_id), 10) * 3.5 + SUM(best.best_score) * 0.05, 1) AS mp
        FROM (
          SELECT ea.user_id, ea.exam_id, MAX(ea.score) AS best_score
          FROM exam_attempts ea
          WHERE ea.completed_at IS NOT NULL
            AND (ea.is_graded = 1 OR ea.is_graded IS NULL)
            ${timeFilter}
          GROUP BY ea.user_id, ea.exam_id
        ) best
        JOIN users u ON best.user_id = u.id
        WHERE u.role = 'student'
          AND u.grade = ?
          AND COALESCE(u.study_track, 'عام') = ?
        GROUP BY best.user_id
        HAVING mp > ?
      )
    `).get(myGrade, myTrack, myMastery);

    res.json({
      ...stats,
      grade: myGrade,
      study_track: myTrack,
      rank: (stats?.total_exams > 0) ? (rankRow?.rank || 1) : '-',
      badge: getChemistryBadge(
        stats?.total_score || (stats?.avg_score * stats?.total_exams) || 0
      )
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

export default router;