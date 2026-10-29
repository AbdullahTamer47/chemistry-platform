import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, teacherMiddleware, canAccessCourse, isTeacher } from '../middleware/auth.js';

const router = Router();

// Get discussions for a course or specific lesson
router.get('/:courseId', authMiddleware, (req, res) => {
  try {
    if (!isTeacher(req.user) && !canAccessCourse(req.user, req.params.courseId)) {
      return res.status(403).json({ error: 'يجب الاشتراك في الكورس أولاً للاطلاع على النقاشات' });
    }
    const { lesson_id } = req.query;
    let query = `
      SELECT d.*, u.name as user_name, u.role as user_role, u.avatar 
      FROM course_discussions d 
      JOIN users u ON d.user_id = u.id 
      WHERE d.course_id = ?
    `;
    const params = [req.params.courseId];

    if (lesson_id) {
      query += ' AND d.lesson_id = ?';
      params.push(lesson_id);
    }
    
    query += ' ORDER BY d.created_at DESC';

    const discussions = db.prepare(query).all(...params);

    // Get replies for these discussions
    if (discussions.length > 0) {
      const discussionIds = discussions.map(d => d.id).join(',');
      const replies = db.prepare(`
        SELECT r.*, u.name as user_name, u.role as user_role, u.avatar 
        FROM discussion_replies r 
        JOIN users u ON r.user_id = u.id 
        WHERE r.discussion_id IN (${discussionIds})
        ORDER BY r.created_at ASC
      `).all();

      discussions.forEach(d => {
        d.replies = replies.filter(r => r.discussion_id === d.id);
      });
    }

    res.json(discussions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في جلب المناقشات' });
  }
});

// Post a new discussion
router.post('/', authMiddleware, (req, res) => {
  try {
    const { course_id, lesson_id, content } = req.body;
    
    const cleanContent = String(content || '').trim();
    if (!course_id || !cleanContent) {
      return res.status(400).json({ error: 'بيانات غير مكتملة' });
    }
    if (cleanContent.length > 2000) {
      return res.status(400).json({ error: 'نص السؤال طويل جداً (الحد الأقصى 2000 حرف)' });
    }

    // Check enrollment or free course access or teacher
    if (!isTeacher(req.user)) {
      if (!canAccessCourse(req.user, course_id)) {
        return res.status(403).json({ error: 'غير مسموح. يجب الاشتراك في الكورس أولاً' });
      }
    }

    const result = db.prepare(
      'INSERT INTO course_discussions (course_id, lesson_id, user_id, content) VALUES (?, ?, ?, ?)'
    ).run(course_id, lesson_id || null, req.user.id, cleanContent);

    const newDisc = db.prepare(`
      SELECT d.*, u.name as user_name, u.role as user_role, u.avatar 
      FROM course_discussions d 
      JOIN users u ON d.user_id = u.id 
      WHERE d.id = ?
    `).get(result.lastInsertRowid);
    
    newDisc.replies = [];
    res.status(201).json(newDisc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في إضافة السؤال' });
  }
});

// Reply to a discussion
router.post('/:id/replies', authMiddleware, (req, res) => {
  try {
    const { content } = req.body;
    const discussionId = req.params.id;

    const cleanReply = String(content || '').trim();
    if (!cleanReply) return res.status(400).json({ error: 'الرد فارغ' });
    if (cleanReply.length > 2000) return res.status(400).json({ error: 'الرد طويل جداً (الحد الأقصى 2000 حرف)' });

    const discussion = db.prepare('SELECT course_id FROM course_discussions WHERE id = ?').get(discussionId);
    if (!discussion) return res.status(404).json({ error: 'السؤال غير موجود' });

    const course = db.prepare('SELECT allow_student_replies FROM courses WHERE id = ?').get(discussion.course_id);

    // Permission checks
    if (!isTeacher(req.user)) {
      if (!canAccessCourse(req.user, discussion.course_id)) {
        return res.status(403).json({ error: 'يجب الاشتراك في الكورس' });
      }
      if (!course || !course.allow_student_replies) {
        return res.status(403).json({ error: 'المدرس لم يسمح بردود الطلاب في هذا الكورس' });
      }
    }

    const result = db.prepare(
      'INSERT INTO discussion_replies (discussion_id, user_id, content) VALUES (?, ?, ?)'
    ).run(discussionId, req.user.id, cleanReply);

    const newReply = db.prepare(`
      SELECT r.*, u.name as user_name, u.role as user_role, u.avatar 
      FROM discussion_replies r 
      JOIN users u ON r.user_id = u.id 
      WHERE r.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newReply);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في إضافة الرد' });
  }
});

// Delete a discussion
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const discussion = db.prepare('SELECT user_id FROM course_discussions WHERE id = ?').get(req.params.id);
    if (!discussion) return res.status(404).json({ error: 'غير موجود' });

    if (req.user.role === 'student' && discussion.user_id !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح لك بحذف هذا السؤال' });
    }

    db.prepare('DELETE FROM course_discussions WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف السؤال' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Delete a reply
router.delete('/replies/:id', authMiddleware, (req, res) => {
  try {
    const reply = db.prepare('SELECT user_id FROM discussion_replies WHERE id = ?').get(req.params.id);
    if (!reply) return res.status(404).json({ error: 'غير موجود' });

    if (req.user.role === 'student' && reply.user_id !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح لك بحذف هذا الرد' });
    }

    db.prepare('DELETE FROM discussion_replies WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف الرد' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

export default router;
