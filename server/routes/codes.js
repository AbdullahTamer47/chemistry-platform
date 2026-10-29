import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware, teacherMiddleware, rateLimit } from '../middleware/auth.js';

const router = Router();

const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'محاولات تفعيل كثيرة جداً، يرجى الانتظار 15 دقيقة قبل المحاولة مجدداً'
});

// Generate activation codes (teacher)
router.post('/generate', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { course_id, type, count, assigned_to, max_uses, expires_at } = req.body;
    if (!course_id) return res.status(400).json({ error: 'يجب تحديد الكورس' });
    const codes = [];
    const requested = Number.parseInt(count, 10);
    const num = type === 'universal' ? 1 : Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), 100);
    // Universal codes must never be unlimited AND immortal: default to 100 uses / 30 days.
    let actualMaxUses = type === 'universal' ? (Number.parseInt(max_uses, 10) || 100) : (Number.parseInt(max_uses, 10) || 1);
    let expiry = expires_at || null;
    if (type === 'universal' && !expiry) expiry = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    if (actualMaxUses < -1 || actualMaxUses === 0) actualMaxUses = 1;
    if (actualMaxUses === -1 && !expires_at) {
      return res.status(400).json({ error: 'الكود غير المحدود يتطلب تاريخ انتهاء صلاحية' });
    }

    for (let i = 0; i < num; i++) {
      const code = uuidv4().split('-')[0].toUpperCase();
      db.prepare('INSERT INTO activation_codes (code, course_id, type, assigned_to, max_uses, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(code, course_id, type || 'universal', assigned_to || null, actualMaxUses, req.user.id, expiry);
      codes.push(code);
    }
    res.json({ codes, message: `تم إنشاء ${num} كود بنجاح` });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ' }); }
});

// Activate code (student)
router.post('/activate', authMiddleware, activateLimiter, (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'يرجى إدخال الكود' });
    const ac = db.prepare('SELECT * FROM activation_codes WHERE code = ? AND is_active = 1').get(code.trim().toUpperCase());
    if (!ac) return res.status(404).json({ error: 'الكود غير صالح أو تم استخدامه' });

    // Check Expiration
    if (ac.expires_at && new Date(ac.expires_at) < new Date()) {
      return res.status(400).json({ error: 'عذراً، هذا الكود منتهي الصلاحية' });
    }

    if (ac.type === 'individual' && ac.assigned_to && ac.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'هذا الكود مخصص لطالب آخر' });
    }

    // Check max uses (-1 means unlimited)
    if (ac.max_uses !== -1 && ac.used_count >= ac.max_uses) {
      return res.status(400).json({ error: 'تم استخدام هذا الكود بالكامل' });
    }

    const existing = db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, ac.course_id);
    if (existing) return res.status(400).json({ error: 'أنت مشترك بالفعل في هذا الكورس' });

    // Atomic claim: the conditional UPDATE guarantees the last use can't be consumed twice.
    const claim = db.transaction(() => {
      const upd = db.prepare('UPDATE activation_codes SET used_count = used_count + 1 WHERE id = ? AND is_active = 1 AND (max_uses = -1 OR used_count < max_uses)').run(ac.id);
      if (!upd || upd.changes === 0) return false;
      db.prepare('INSERT INTO enrollments (user_id, course_id, code_id) VALUES (?, ?, ?)').run(req.user.id, ac.course_id, ac.id);
      db.prepare('UPDATE activation_codes SET is_active = 0 WHERE id = ? AND max_uses != -1 AND used_count >= max_uses').run(ac.id);
      db.prepare('INSERT INTO code_usage (code_id, user_id) VALUES (?, ?)').run(ac.id, req.user.id);
      return true;
    });
    if (!claim()) return res.status(400).json({ error: 'تم استخدام هذا الكود بالكامل' });
    const course = db.prepare('SELECT title FROM courses WHERE id = ?').get(ac.course_id);
    db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(req.user.id, 'تم تفعيل الاشتراك', `تم تفعيل اشتراكك في كورس "${course.title}" بنجاح!`, 'success');
    res.json({ message: 'تم تفعيل الكود بنجاح', course_id: ac.course_id, course_title: course.title });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ في تفعيل الكود' }); }
});

// Get all codes (teacher)
router.get('/', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { course_id } = req.query;
    let query = `SELECT ac.*, c.title as course_title, u.name as assigned_to_name FROM activation_codes ac LEFT JOIN courses c ON ac.course_id = c.id LEFT JOIN users u ON ac.assigned_to = u.id`;
    const params = [];
    if (course_id) { query += ' WHERE ac.course_id = ?'; params.push(course_id); }
    query += ' ORDER BY ac.created_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Get code usage history
router.get('/:id/usage', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const usage = db.prepare('SELECT cu.*, u.name, u.phone FROM code_usage cu JOIN users u ON cu.user_id = u.id WHERE cu.code_id = ? ORDER BY cu.used_at DESC').all(req.params.id);
    res.json(usage);
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Update code
router.put('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { max_uses, expires_at, is_active } = req.body;
    let query = 'UPDATE activation_codes SET ';
    const params = [];

    if (max_uses !== undefined) { query += 'max_uses = ?, '; params.push(max_uses); }
    if (expires_at !== undefined) { query += 'expires_at = ?, '; params.push(expires_at ? new Date(expires_at).toISOString() : null); }
    if (is_active !== undefined) { query += 'is_active = ?, '; params.push(is_active); }

    if (params.length === 0) {
      return res.status(400).json({ error: 'لا توجد حقول للتحديث' });
    }

    // remove trailing comma and space
    query = query.slice(0, -2) + ' WHERE id = ?';
    params.push(req.params.id);

    db.prepare(query).run(...params);
    res.json({ message: 'تم تحديث الكود' });
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Delete code
router.delete('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    // Remove students who enrolled using this code
    db.prepare('DELETE FROM enrollments WHERE code_id = ?').run(req.params.id);
    db.prepare('DELETE FROM code_usage WHERE code_id = ?').run(req.params.id);
    db.prepare('DELETE FROM activation_codes WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف الكود وإلغاء اشتراك الطلاب الذين استخدموه' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ في عملية الحذف' }); }
});

export default router;
