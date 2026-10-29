import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, teacherMiddleware, optionalAuth, isTeacher } from '../middleware/auth.js';

const router = Router();

// Get all courses (public)
router.get('/', (req, res) => {
  try {
    const { grade } = req.query;
    let query = `SELECT c.*, u.name as teacher_name,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as student_count,
      (SELECT COUNT(*) FROM exams WHERE course_id = c.id) as exam_count
      FROM courses c LEFT JOIN users u ON c.teacher_id = u.id`;

    const params = [];
    if (grade) {
      query += ' WHERE c.grade = ?';
      params.push(grade);
    }
    query += ' ORDER BY c.created_at DESC';

    const courses = db.prepare(query).all(...params);
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في جلب الكورسات' });
  }
});

// Get single course with chapters and lessons (public, but uses optional auth for progress)
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const userId = req.user?.id;
    
    const course = db.prepare(`
      SELECT c.*, u.name as teacher_name,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as student_count,
      (SELECT COUNT(*) FROM exams WHERE course_id = c.id) as exam_count
      FROM courses c LEFT JOIN users u ON c.teacher_id = u.id WHERE c.id = ?
    `).get(req.params.id);

    if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });

    const chapters = db.prepare('SELECT * FROM chapters WHERE course_id = ? ORDER BY order_num').all(course.id);
    // video_url is only ever handed out via the signed video-token endpoint (teachers see it for editing)
    const lessons = db.prepare('SELECT * FROM lessons WHERE course_id = ?').all(course.id)
      .map(l => (isTeacher(req.user) ? l : { ...l, video_url: undefined }));
    const exams = db.prepare('SELECT * FROM exams WHERE course_id = ?').all(course.id);
    
    // Fetch progress if user is logged in
    let completedItemIds = new Set();
    if (userId) {
      const lessonProgress = db.prepare('SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND completed = 1').all(userId);
      lessonProgress.forEach(lp => completedItemIds.add(`lesson_${lp.lesson_id}`));
      
      const examProgress = db.prepare('SELECT exam_id FROM exam_attempts WHERE user_id = ?').all(userId);
      examProgress.forEach(ep => completedItemIds.add(`exam_${ep.exam_id}`));
    }

    // Combine and sort
    let allItems = [
      ...lessons.map(l => ({ ...l, item_type: 'lesson' })),
      ...exams.map(e => ({ ...e, item_type: 'exam' }))
    ].sort((a, b) => a.order_num - b.order_num);

    let isPreviousCompleted = true; // First item is always unlocked
    const chapterIdSet = new Set(chapters.map(ch => ch.id));

    // Group items by chapter and apply sequential access
    chapters.forEach(ch => {
      ch.items = allItems.filter(item => item.chapter_id === ch.id).map(item => {
        let isLocked = false;
        
        if (course.sequential_access && !isPreviousCompleted && !course.is_free) {
          isLocked = true;
        }

        const itemKey = `${item.item_type}_${item.id}`;
        const isCompleted = completedItemIds.has(itemKey);
        isPreviousCompleted = isCompleted;

        return { ...item, is_locked: isLocked, is_completed: isCompleted };
      });
    });

    // Ensure items with chapter_id == null or orphaned chapter_id are still displayed
    const unchapteredItems = allItems.filter(item => !item.chapter_id || !chapterIdSet.has(item.chapter_id)).map(item => {
      let isLocked = false;
      if (course.sequential_access && !isPreviousCompleted && !course.is_free) {
        isLocked = true;
      }
      const itemKey = `${item.item_type}_${item.id}`;
      const isCompleted = completedItemIds.has(itemKey);
      isPreviousCompleted = isCompleted;
      return { ...item, is_locked: isLocked, is_completed: isCompleted };
    });

    if (unchapteredItems.length > 0) {
      chapters.push({
        id: 0,
        course_id: course.id,
        title: 'محاضرات واختبارات عامة',
        order_num: 999,
        items: unchapteredItems
      });
    }

    let totalItems = 0;
    let completedItems = 0;
    chapters.forEach(ch => {
      (ch.items || []).forEach(it => {
        totalItems++;
        if (it.is_completed) completedItems++;
      });
    });
    course.total_items = totalItems;
    course.completed_items = completedItems;

    course.chapters = chapters;
    course.total_lessons = lessons.length;

    res.json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Check enrollment status
router.get('/:id/enrollment', authMiddleware, (req, res) => {
  try {
    const enrollment = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
      .get(req.user.id, req.params.id);
    res.json({ enrolled: !!enrollment, enrollment });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Self-enrollment — ONLY allowed for free courses. Paid courses go through codes or payment requests.
router.post('/:id/enroll', authMiddleware, (req, res) => {
  try {
    const courseId = req.params.id;
    const course = db.prepare('SELECT id, title, is_free, price FROM courses WHERE id = ?').get(courseId);
    if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });

    const existing = db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, courseId);
    if (existing) return res.status(400).json({ error: 'أنت مشترك بالفعل في هذا الكورس' });

    // Free course enrollment
    if (course.is_free || Number(course.price) === 0) {
      db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)').run(req.user.id, courseId);
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        req.user.id,
        'اشتراك جديد في الكورس',
        `تم تفعيل اشتراكك في الكورس المجاني "${course.title}" بنجاح!`,
        'success'
      );
      return res.json({ message: 'تم الاشتراك في الكورس المجاني بنجاح', course_title: course.title });
    }

    // Paid course via wallet balance
    const coursePrice = Number(course.price);
    
    // Ensure student wallet exists
    db.prepare('INSERT INTO student_wallets (user_id, balance) VALUES (?, 0) ON CONFLICT(user_id) DO NOTHING').run(req.user.id);
    const wallet = db.prepare('SELECT balance FROM student_wallets WHERE user_id = ?').get(req.user.id);
    const currentBalance = Number(wallet?.balance || 0);

    if (currentBalance < coursePrice) {
      return res.status(400).json({
        error: `رصيد محفظتك الحالي (${currentBalance} ج) غير كافٍ. سعر الكورس هو ${coursePrice} ج. يرجى شحن المحفظة أولاً أو استخدام كود التفعيل.`
      });
    }

    const tx = db.transaction(() => {
      // Deduct balance atomically
      const deductResult = db.prepare('UPDATE student_wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND balance >= ?').run(coursePrice, req.user.id, coursePrice);
      if (deductResult.changes === 0) {
        throw new Error('رصيد غير كافٍ أو تم خصمه بالفعل');
      }
      
      // Record transaction
      db.prepare("INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES (?, ?, 'debit', ?)").run(
        req.user.id,
        -coursePrice,
        `شراء كورس "${course.title}" من رصيد المحفظة`
      );

      // Enroll student
      db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)').run(req.user.id, courseId);

      // Send notification
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        req.user.id,
        'تم شراء الكورس بنجاح 🎉',
        `تم خصم ${coursePrice} ج من محفظتك وتفعيل كورس "${course.title}". نتمنى لك دراسة ممتعة!`,
        'success'
      );
    });

    tx();

    const updatedWallet = db.prepare('SELECT balance FROM student_wallets WHERE user_id = ?').get(req.user.id);

    res.json({
      message: 'تم الاشتراك في الكورس بنجاح وخصم المبلغ من محفظتك 🎉',
      course_title: course.title,
      new_balance: updatedWallet.balance,
      remaining_balance: updatedWallet.balance
    });
  } catch (err) {
    console.error('Course enroll error:', err);
    res.status(500).json({ error: err.message || 'حدث خطأ في تفعيل الاشتراك' });
  }
});

// Get enrolled courses for current user
router.get('/my/enrolled', authMiddleware, (req, res) => {
  try {
    const courses = db.prepare(`
      SELECT c.*, e.activated_at,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as total_lessons,
      (SELECT COUNT(*) FROM lesson_progress WHERE user_id = ? AND lesson_id IN (SELECT id FROM lessons WHERE course_id = c.id) AND completed = 1) as completed_lessons
      FROM courses c
      INNER JOIN enrollments e ON c.id = e.course_id
      WHERE e.user_id = ? AND e.is_suspended = 0
      ORDER BY e.activated_at DESC
    `).all(req.user.id, req.user.id);
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Create course (teacher only)
router.post('/', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { title, description, grade, price, is_free, thumbnail, allow_student_replies, sequential_access, course_type, duration_days, original_price, badge_text } = req.body;
    const result = db.prepare(
      'INSERT INTO courses (title, description, grade, price, is_free, thumbnail, teacher_id, allow_student_replies, sequential_access, course_type, duration_days, original_price, badge_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      title,
      description,
      grade,
      price || 0,
      is_free ? 1 : 0,
      thumbnail,
      req.user.id,
      allow_student_replies ? 1 : 0,
      sequential_access ? 1 : 0,
      course_type || 'monthly',
      duration_days || (course_type === 'quarterly' ? 90 : course_type === 'term' ? 120 : course_type === 'annual' ? 365 : 30),
      original_price || 0,
      badge_text || null
    );

    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في إنشاء الكورس' });
  }
});

// Update course
router.put('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { title, description, grade, price, is_free, thumbnail, allow_student_replies, sequential_access, course_type, duration_days, original_price, badge_text } = req.body;
    db.prepare(
      'UPDATE courses SET title=COALESCE(?,title), description=COALESCE(?,description), grade=COALESCE(?,grade), price=COALESCE(?,price), is_free=COALESCE(?,is_free), thumbnail=COALESCE(?,thumbnail), allow_student_replies=COALESCE(?,allow_student_replies), sequential_access=COALESCE(?,sequential_access), course_type=COALESCE(?,course_type), duration_days=COALESCE(?,duration_days), original_price=COALESCE(?,original_price), badge_text=COALESCE(?,badge_text) WHERE id=?'
    ).run(
      title,
      description,
      grade,
      price,
      is_free !== undefined ? (is_free ? 1 : 0) : null,
      thumbnail,
      allow_student_replies !== undefined ? (allow_student_replies ? 1 : 0) : null,
      sequential_access !== undefined ? (sequential_access ? 1 : 0) : null,
      course_type || null,
      duration_days || null,
      original_price || null,
      badge_text || null,
      req.params.id
    );

    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    res.json(course);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في تحديث الكورس' });
  }
});

// Delete course
router.delete('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
    res.json({ message: 'تم حذف الكورس بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Add chapter to course
router.post('/:id/chapters', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { title, order_num } = req.body;
    const maxOrder = db.prepare('SELECT MAX(order_num) as max FROM chapters WHERE course_id = ?').get(req.params.id);
    const result = db.prepare('INSERT INTO chapters (course_id, title, order_num) VALUES (?, ?, ?)')
      .run(req.params.id, title, order_num || (maxOrder?.max || 0) + 1);
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(chapter);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في إضافة الفصل' });
  }
});

// Update chapter — fixed: use /chapters/:chapterId pattern
router.put('/chapters/:chapterId', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { title, order_num } = req.body;
    db.prepare('UPDATE chapters SET title = COALESCE(?, title), order_num = COALESCE(?, order_num) WHERE id = ?').run(title, order_num, req.params.chapterId);
    res.json(db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.chapterId));
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في تحديث الفصل' });
  }
});

// Delete chapter — fixed: use /chapters/:chapterId pattern
router.delete('/chapters/:chapterId', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM chapters WHERE id = ?').run(req.params.chapterId);
    res.json({ message: 'تم حذف الفصل بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في الحذف' });
  }
});

export default router;
