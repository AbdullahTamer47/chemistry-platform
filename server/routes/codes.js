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

// Generate activation codes (teacher): supports 2 distinct types:
// 1. Course Unlock Codes (code_purpose = 'course', course_id required) -> unlocks course directly
// 2. Wallet Balance Codes (code_purpose = 'wallet', wallet_amount required) -> adds balance to student wallet
router.post('/generate', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const {
      code_purpose = 'course',
      course_id,
      wallet_amount,
      type = 'individual',
      count,
      assigned_to,
      max_uses,
      expires_at
    } = req.body;

    const purpose = code_purpose === 'wallet' ? 'wallet' : 'course';

    if (purpose === 'course' && !course_id) {
      return res.status(400).json({ error: 'يجب تحديد الكورس المراد توليد أكواد لفتحه' });
    }
    const amountVal = purpose === 'wallet' ? Number(wallet_amount) : 0;
    if (purpose === 'wallet' && (!amountVal || amountVal <= 0 || amountVal > 20000)) {
      return res.status(400).json({ error: 'يرجى تحديد قيمة رصيد المحفظة بشكل صحيح (مثلاً 100 ج.م)' });
    }

    const codes = [];
    const requested = Number.parseInt(count, 10);
    const num = type === 'universal' ? 1 : Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), 100);
    let actualMaxUses = type === 'universal' ? (Number.parseInt(max_uses, 10) || 100) : (Number.parseInt(max_uses, 10) || 1);
    if (purpose === 'wallet') {
      // Wallet balance codes default to single-use per student unless specified
      actualMaxUses = Number.parseInt(max_uses, 10) || 1;
    }
    let expiry = expires_at || null;
    if (type === 'universal' && !expiry) expiry = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    if (actualMaxUses < -1 || actualMaxUses === 0) actualMaxUses = 1;
    if (actualMaxUses === -1 && !expires_at) {
      return res.status(400).json({ error: 'الكود غير المحدود يتطلب تاريخ انتهاء صلاحية' });
    }

    const tx = db.transaction(() => {
      for (let i = 0; i < num; i++) {
        const rawPart = uuidv4().split('-')[0].toUpperCase();
        const code = purpose === 'wallet' ? `WAL-${amountVal}-${rawPart.slice(0, 6)}` : `CRS-${course_id}-${rawPart.slice(0, 6)}`;
        db.prepare(
          'INSERT INTO activation_codes (code, course_id, type, assigned_to, max_uses, created_by, expires_at, code_purpose, wallet_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          code,
          purpose === 'course' ? Number(course_id) : null,
          type || 'individual',
          assigned_to || null,
          actualMaxUses,
          req.user.id,
          expiry,
          purpose,
          amountVal
        );
        if (purpose === 'wallet') {
          try {
            db.prepare('INSERT OR IGNORE INTO wallet_vouchers (code, amount) VALUES (?, ?)').run(code, amountVal);
          } catch (e) {}
        }
        codes.push(code);
      }
    });
    tx();

    res.json({
      codes,
      code_purpose: purpose,
      wallet_amount: amountVal,
      message: purpose === 'wallet'
        ? `تم إنشاء ${num} كود شحن محفظة بقيمة ${amountVal} ج.م للكود بنجاح`
        : `تم إنشاء ${num} كود فتح كورس مباشر بنجاح`
    });
  } catch (err) {
    console.error('Generate codes error:', err);
    res.status(500).json({ error: 'حدث خطأ في إنشاء الأكواد' });
  }
});

// Activate code (student) — handles both Course Unlock Codes & Wallet Balance Codes
router.post('/activate', authMiddleware, activateLimiter, (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'يرجى إدخال الكود' });
    const cleanCode = String(code).trim().toUpperCase();

    const ac = db.prepare('SELECT * FROM activation_codes WHERE code = ? AND is_active = 1').get(cleanCode);

    // Wallet balance codes must NEVER unlock a course: they can only be redeemed from the wallet page.
    const isWalletCode = (ac && (ac.code_purpose === 'wallet' || Number(ac.wallet_amount) > 0))
      || (!ac && db.prepare('SELECT id FROM wallet_vouchers WHERE code = ?').get(cleanCode));
    if (isWalletCode) {
      return res.status(400).json({ error: 'هذا كود شحن رصيد، يتم تفعيله من صفحة المحفظة فقط وليس لفتح الكورسات' });
    }
    if (!ac) {
      return res.status(404).json({ error: 'الكود غير صالح أو تم استخدامه بالكامل' });
    }
    // Fallback check in wallet_vouchers if generated via legacy voucher endpoint
    if (!ac) {
      const voucher = db.prepare('SELECT * FROM wallet_vouchers WHERE code = ? AND is_used = 0').get(cleanCode);
      if (voucher) {
        const tx = db.transaction(() => {
          const upd = db.prepare('UPDATE wallet_vouchers SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ? AND is_used = 0').run(req.user.id, voucher.id);
          if (upd.changes === 0) throw new Error('تم استخدام هذا الكود مسبقاً');
          db.prepare(`
            INSERT INTO student_wallets (user_id, balance) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = CURRENT_TIMESTAMP
          `).run(req.user.id, voucher.amount);
          db.prepare("INSERT INTO wallet_transactions (user_id, amount, type, description, reference_code) VALUES (?, ?, 'credit', ?, ?)")
            .run(req.user.id, voucher.amount, `شحن رصيد المحفظة بالكود (${voucher.code})`, voucher.code);
          db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'success')")
            .run(req.user.id, 'تم شحن المحفظة بنجاح', `تم إضافة ${voucher.amount} ج.م إلى رصيد محفظتك بنجاح.`);
        });
        tx();
        const newBal = db.prepare('SELECT balance FROM student_wallets WHERE user_id = ?').get(req.user.id)?.balance || voucher.amount;
        return res.json({
          message: `تم شحن المحفظة بنجاح وإضافة ${voucher.amount} ج.م إلى رصيدك!`,
          code_purpose: 'wallet',
          amount_added: voucher.amount,
          new_balance: newBal
        });
      }
      return res.status(404).json({ error: 'الكود غير صالح أو تم استخدامه بالكامل' });
    }

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

    // Prevent same user from using the exact same code twice
    const alreadyUsedByStudent = db.prepare('SELECT id FROM code_usage WHERE code_id = ? AND user_id = ?').get(ac.id, req.user.id);
    if (alreadyUsedByStudent) {
      return res.status(400).json({ error: 'لقد قمت باستخدام هذا الكود من قبل' });
    }

    // CASE 1: WALLET BALANCE CODE (كود شحن رصيد المحفظة)
    if (ac.code_purpose === 'wallet' || Number(ac.wallet_amount) > 0) {
      const amount = Number(ac.wallet_amount) || 0;
      const claimWallet = db.transaction(() => {
        const upd = db.prepare('UPDATE activation_codes SET used_count = used_count + 1 WHERE id = ? AND is_active = 1 AND (max_uses = -1 OR used_count < max_uses)').run(ac.id);
        if (!upd || upd.changes === 0) return false;
        db.prepare('UPDATE activation_codes SET is_active = 0 WHERE id = ? AND max_uses != -1 AND used_count >= max_uses').run(ac.id);
        db.prepare('INSERT INTO code_usage (code_id, user_id) VALUES (?, ?)').run(ac.id, req.user.id);
        db.prepare('UPDATE wallet_vouchers SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?').run(req.user.id, ac.code);

        db.prepare(`
          INSERT INTO student_wallets (user_id, balance) VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = CURRENT_TIMESTAMP
        `).run(req.user.id, amount);

        db.prepare("INSERT INTO wallet_transactions (user_id, amount, type, description, reference_code) VALUES (?, ?, 'credit', ?, ?)")
          .run(req.user.id, amount, `شحن رصيد المحفظة بكود تفعيل (${ac.code})`, ac.code);

        db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'success')")
          .run(req.user.id, 'تم شحن المحفظة بنجاح', `تم إضافة ${amount} ج.م إلى محفظتك باستخدام الكود (${ac.code}).`);
        return true;
      });

      if (!claimWallet()) return res.status(400).json({ error: 'تم استخدام هذا الكود بالكامل' });
      const newBalance = db.prepare('SELECT balance FROM student_wallets WHERE user_id = ?').get(req.user.id)?.balance || amount;
      return res.json({
        message: `تم شحن المحفظة بنجاح وإضافة ${amount} ج.م إلى رصيدك!`,
        code_purpose: 'wallet',
        amount_added: amount,
        new_balance: newBalance
      });
    }

    // CASE 2: COURSE UNLOCK CODE (كود فتح كورس محدد مباشرة)
    const existing = db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, ac.course_id);
    if (existing) return res.status(400).json({ error: 'أنت مشترك بالفعل في هذا الكورس' });

    const claimCourse = db.transaction(() => {
      const upd = db.prepare('UPDATE activation_codes SET used_count = used_count + 1 WHERE id = ? AND is_active = 1 AND (max_uses = -1 OR used_count < max_uses)').run(ac.id);
      if (!upd || upd.changes === 0) return false;
      db.prepare('INSERT INTO enrollments (user_id, course_id, code_id) VALUES (?, ?, ?)').run(req.user.id, ac.course_id, ac.id);
      db.prepare('UPDATE activation_codes SET is_active = 0 WHERE id = ? AND max_uses != -1 AND used_count >= max_uses').run(ac.id);
      db.prepare('INSERT INTO code_usage (code_id, user_id) VALUES (?, ?)').run(ac.id, req.user.id);
      return true;
    });
    if (!claimCourse()) return res.status(400).json({ error: 'تم استخدام هذا الكود بالكامل' });

    const course = db.prepare('SELECT title FROM courses WHERE id = ?').get(ac.course_id);
    db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
      req.user.id,
      'تم تفعيل الكورس بالكود',
      `تم فتح وتفعيل كورس "${course?.title || ''}" بنجاح!`,
      'success'
    );
    res.json({
      message: `تم فتح وتفعيل كورس "${course?.title || ''}" بنجاح!`,
      code_purpose: 'course',
      course_id: ac.course_id,
      course_title: course?.title || ''
    });
  } catch (err) {
    console.error('Activate code error:', err);
    res.status(500).json({ error: 'حدث خطأ في تفعيل الكود' });
  }
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
