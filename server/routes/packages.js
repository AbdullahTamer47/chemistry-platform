import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, optionalAuth, teacherMiddleware } from '../middleware/auth.js';

const router = Router();

// ==========================================
// PACKAGES (باقات الـ 3 شهور والترم الأول)
// ==========================================

// Get all packages
router.get('/', optionalAuth, (req, res) => {
  try {
    const packages = db.prepare(`SELECT * FROM packages WHERE is_active = 1 ORDER BY created_at DESC`).all();

    const result = packages.map(pkg => {
      let courseIds = [];
      try { courseIds = JSON.parse(pkg.course_ids); } catch (e) {}

      let courses = [];
      if (courseIds.length > 0) {
        const placeholders = courseIds.map(() => '?').join(',');
        courses = db.prepare(`
          SELECT id, title, price, thumbnail,
                 (SELECT COUNT(*) FROM lessons WHERE course_id = courses.id) as lessons_count,
                 (SELECT COUNT(*) FROM exams WHERE course_id = courses.id) as exams_count
          FROM courses WHERE id IN (${placeholders})
        `).all(...courseIds);
      }

      let isEnrolled = false;
      let expiresAt = null;
      if (req.user) {
        const enrollment = db.prepare(`
          SELECT * FROM package_enrollments WHERE user_id = ? AND package_id = ?
        `).get(req.user.id, pkg.id);
        if (enrollment) {
          isEnrolled = true;
          expiresAt = enrollment.expires_at;
        }
      }

      const totalRegularPrice = courses.reduce((sum, c) => sum + (c.price || 0), 0);
      const discountPercent = pkg.original_price > pkg.price
        ? Math.round(((pkg.original_price - pkg.price) / pkg.original_price) * 100)
        : 0;

      return {
        ...pkg,
        course_ids: courseIds,
        courses,
        total_regular_price: totalRegularPrice,
        discount_percent: discountPercent,
        is_enrolled: isEnrolled,
        expires_at: expiresAt
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في جلب الباقات' });
  }
});

// Get package by ID
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!pkg) return res.status(404).json({ error: 'الباقة غير موجودة' });

    let courseIds = [];
    try { courseIds = JSON.parse(pkg.course_ids); } catch (e) {}

    let courses = [];
    if (courseIds.length > 0) {
      const placeholders = courseIds.map(() => '?').join(',');
      courses = db.prepare(`
        SELECT id, title, price, thumbnail, description,
               (SELECT COUNT(*) FROM lessons WHERE course_id = courses.id) as lessons_count,
               (SELECT COUNT(*) FROM exams WHERE course_id = courses.id) as exams_count
        FROM courses WHERE id IN (${placeholders})
      `).all(...courseIds);
    }

    let isEnrolled = false;
    let expiresAt = null;
    if (req.user) {
      const enrollment = db.prepare('SELECT * FROM package_enrollments WHERE user_id = ? AND package_id = ?').get(req.user.id, pkg.id);
      if (enrollment) {
        isEnrolled = true;
        expiresAt = enrollment.expires_at;
      }
    }

    res.json({
      ...pkg,
      course_ids: courseIds,
      courses,
      is_enrolled: isEnrolled,
      expires_at: expiresAt
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Student: Subscribe to package from wallet balance or voucher
router.post('/:id/subscribe', authMiddleware, (req, res) => {
  try {
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND is_active = 1').get(req.params.id);
    if (!pkg) return res.status(404).json({ error: 'الباقة غير متاحة حالياً' });

    // Check existing package enrollment
    const existing = db.prepare('SELECT * FROM package_enrollments WHERE user_id = ? AND package_id = ?').get(req.user.id, pkg.id);
    if (existing) {
      return res.status(400).json({ error: 'أنت مشترك بالفعل في هذه الباقة ومفعلة بحسابك' });
    }

    let courseIds = [];
    try { courseIds = JSON.parse(pkg.course_ids); } catch (e) {}

    const { payment_method, voucher_code } = req.body; // 'wallet' or 'voucher'

    const tx = db.transaction(() => {
      if (payment_method === 'voucher') {
        const code = String(voucher_code || '').trim().toUpperCase();
        if (!code) throw new Error('يرجى إدخال كود الكارت');

        const voucher = db.prepare('SELECT * FROM wallet_vouchers WHERE code = ?').get(code);
        if (!voucher) throw new Error('كود الكارت غير صحيح');
        if (voucher.is_used) throw new Error('تم استخدام هذا الكود مسبقاً');
        if (voucher.amount < pkg.price) throw new Error(`قيمة الكارت (${voucher.amount} ج) أقل من سعر الباقة (${pkg.price} ج)`);

        db.prepare('UPDATE wallet_vouchers SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.user.id, voucher.id);
      } else {
        // Direct deduction from student wallet
        let wallet = db.prepare('SELECT balance FROM student_wallets WHERE user_id = ?').get(req.user.id);
        const currentBalance = wallet ? wallet.balance : 0;
        if (currentBalance < pkg.price) {
          throw new Error(`رصيدك الحالي (${currentBalance} ج) غير كافٍ. سعر الباقة هو ${pkg.price} ج. يرجى شحن محفظتك أولاً.`);
        }

        db.prepare('UPDATE student_wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(pkg.price, req.user.id);
        db.prepare(`
          INSERT INTO wallet_transactions (user_id, amount, type, description)
          VALUES (?, ?, 'debit', ?)
        `).run(req.user.id, -pkg.price, `اشتراك في ${pkg.title}`);
      }

      // Packages and courses have no expiration date (open throughout academic year)
      const expStr = null;

      // Enroll in package
      db.prepare(`
        INSERT INTO package_enrollments (user_id, package_id, expires_at)
        VALUES (?, ?, ?)
      `).run(req.user.id, pkg.id, expStr);

      // Automatically enroll student into ALL courses inside the package (no expiration)
      const enrollCourse = db.prepare(`
        INSERT INTO enrollments (user_id, course_id, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, course_id) DO UPDATE SET expires_at = excluded.expires_at, is_suspended = 0
      `);

      courseIds.forEach(cId => {
        enrollCourse.run(req.user.id, cId, expStr);
      });

      // Notification
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, 'success')
      `).run(
        req.user.id,
        'تم تفعيل باقة الكيمياء الشاملة! 🎉',
        `مبروك! تم تفعيل اشتراكك في "${pkg.title}". محتوى الـ 3 شهور من المنهج متاح لك الآن بالكامل طوال العام الدراسي حتى امتحانات الثانوية العامة دون أي انتهاء صلاحية!`
      );
    });

    tx();

    res.json({
      message: 'تم تفعيل الباقة بنجاح، وجميع محاضراتها متاحة لك طوال العام الدراسي!',
      package_title: pkg.title
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'حدث خطأ أثناء الاشتراك بالباقة' });
  }
});

// ==========================================
// BOOKSTORES & STORE LOCATOR (دليل المنافذ)
// ==========================================

// Get bookstores with governorate filtering and search
router.get('/stores/all', optionalAuth, (req, res) => {
  try {
    const { governorate, q } = req.query;
    let query = 'SELECT * FROM bookstores WHERE is_active = 1';
    const params = [];

    if (governorate && governorate !== 'الكل') {
      query += ' AND governorate = ?';
      params.push(governorate);
    }

    if (q && q.trim()) {
      query += ' AND (name LIKE ? OR address LIKE ? OR governorate LIKE ?)';
      const term = `%${q.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY rating DESC, reviews_count DESC';

    const stores = db.prepare(query).all(...params);
    const governorates = db.prepare('SELECT DISTINCT governorate FROM bookstores WHERE is_active = 1').all().map(g => g.governorate);

    // If user is logged in, attach their existing rating if any
    if (req.user) {
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS bookstore_ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER REFERENCES bookstores(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            rating INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(store_id, user_id)
          );
        `);
        const userRatings = db.prepare('SELECT store_id, rating FROM bookstore_ratings WHERE user_id = ?').all(req.user.id);
        const userRatingMap = new Map(userRatings.map(r => [r.store_id, r.rating]));
        stores.forEach(s => {
          s.my_rating = userRatingMap.get(s.id) || null;
        });
      } catch (e) {}
    }

    res.json({
      stores,
      governorates: ['الكل', ...governorates]
    });
  } catch (err) {
    console.error('Stores fetch error:', err);
    res.status(500).json({ error: 'حدث خطأ في جلب دليل المكتبات' });
  }
});

// Student rate bookstore (with user tracking & exact mathematical average)
router.post('/stores/:id/rate', authMiddleware, (req, res) => {
  try {
    const rating = Math.min(Math.max(Number(req.body.rating) || 5, 1), 5);
    const store = db.prepare('SELECT * FROM bookstores WHERE id = ? AND is_active = 1').get(req.params.id);
    if (!store) return res.status(404).json({ error: 'المكتبة غير مسجلة أو غير مفعلة' });

    db.exec(`
      CREATE TABLE IF NOT EXISTS bookstore_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER REFERENCES bookstores(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(store_id, user_id)
      );
    `);

    // Insert or update this student's rating
    db.prepare(`
      INSERT INTO bookstore_ratings (store_id, user_id, rating)
      VALUES (?, ?, ?)
      ON CONFLICT(store_id, user_id) DO UPDATE SET rating = excluded.rating
    `).run(store.id, req.user.id, rating);

    // Calculate exact mathematical average and count
    const stats = db.prepare(`
      SELECT COUNT(*) as count, AVG(rating) as avg_rating
      FROM bookstore_ratings
      WHERE store_id = ?
    `).get(store.id);

    const baseCount = (store.reviews_count && store.reviews_count > 10) ? store.reviews_count : 0;
    const totalCount = Math.max(stats.count, baseCount);
    const exactRating = Number((stats.avg_rating || rating).toFixed(1));

    db.prepare('UPDATE bookstores SET rating = ?, reviews_count = ? WHERE id = ?').run(exactRating, totalCount, store.id);

    res.json({
      message: 'شكراً لك! تم تسجيل تقييمك بنجاح لمساعدة زملائك الطلاب ⭐',
      new_rating: exactRating,
      reviews_count: totalCount,
      user_rating: rating
    });
  } catch (err) {
    console.error('Rate store error:', err);
    res.status(500).json({ error: 'حدث خطأ في تسجيل التقييم' });
  }
});

export default router;
