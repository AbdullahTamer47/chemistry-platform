import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { authMiddleware, teacherMiddleware, canAccessCourse, isTeacher } from '../middleware/auth.js';

const router = Router();

// Get exams for a course
router.get('/course/:courseId', authMiddleware, (req, res) => {
  try {
    if (!canAccessCourse(req.user, req.params.courseId) && !isTeacher(req.user)) {
      return res.status(403).json({ error: 'يجب الاشتراك في الكورس أولاً' });
    }
    const exams = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) as question_count,
      (SELECT COUNT(*) FROM exam_attempts WHERE exam_id = e.id AND user_id = ?) as my_attempts,
      (SELECT MAX(score) FROM exam_attempts WHERE exam_id = e.id AND user_id = ?) as my_best_score
      FROM exams e WHERE e.course_id = ? AND e.is_active = 1 ORDER BY e.created_at DESC`).all(req.user.id, req.user.id, req.params.courseId);
    res.json(exams);
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Get all exams (for dashboard)
router.get('/', authMiddleware, (req, res) => {
  try {
    let exams;
    if (req.user.role === 'teacher' || req.user.role === 'admin') {
      exams = db.prepare(`SELECT e.*, c.title as course_title, c.grade,
        (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) as question_count,
        (SELECT COUNT(DISTINCT user_id) FROM exam_attempts WHERE exam_id = e.id) as attempt_count
        FROM exams e LEFT JOIN courses c ON e.course_id = c.id ORDER BY e.created_at DESC`).all();
    } else {
      exams = db.prepare(`SELECT e.*, c.title as course_title, c.grade,
        (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) as question_count,
        (SELECT COUNT(*) FROM exam_attempts WHERE exam_id = e.id AND user_id = ?) as my_attempts,
        (SELECT MAX(score) FROM exam_attempts WHERE exam_id = e.id AND user_id = ?) as my_best_score
        FROM exams e LEFT JOIN courses c ON e.course_id = c.id
        INNER JOIN enrollments en ON en.course_id = e.course_id AND en.user_id = ?
        WHERE e.is_active = 1 ORDER BY e.created_at DESC`).all(req.user.id, req.user.id, req.user.id);
    }
    res.json(exams);
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Student: get all my exam attempts (history & results)
router.get(['/my-attempts', '/my-results'], authMiddleware, (req, res) => {
  try {
    const attempts = db.prepare(`
      SELECT ea.id, ea.exam_id, ea.score, ea.total_points, ea.time_spent, ea.is_graded, ea.teacher_feedback, ea.completed_at,
             e.title as exam_title, e.passing_score, e.course_id, c.title as course_title
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      LEFT JOIN courses c ON e.course_id = c.id
      WHERE ea.user_id = ? AND ea.completed_at IS NOT NULL
      ORDER BY ea.completed_at DESC
    `).all(req.user.id);
    res.json(attempts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في جلب سجل المحاولات' });
  }
});

// Student: get all my earned certificates
router.get('/certificates/my', authMiddleware, (req, res) => {
  try {
    const certs = db.prepare(`
      SELECT c.*, e.title as exam_title, u.name as student_name, cr.title as course_title
      FROM certificates c
      JOIN exams e ON c.exam_id = e.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN courses cr ON e.course_id = cr.id
      WHERE c.user_id = ?
      ORDER BY c.issued_at DESC
    `).all(req.user.id);
    res.json(certs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في جلب الشهادات' });
  }
});

// Public: verify certificate code
router.get('/certificates/verify/:certCode', (req, res) => {
  try {
    const cert = db.prepare(`
      SELECT c.*, e.title as exam_title, u.name as student_name, u.grade, cr.title as course_title
      FROM certificates c
      JOIN exams e ON c.exam_id = e.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN courses cr ON e.course_id = cr.id
      WHERE c.cert_code = ?
    `).get(req.params.certCode);
    if (!cert) return res.status(404).json({ error: 'رمز الشهادة غير صحيح أو غير مسجل' });
    res.json(cert);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في التحقق من الشهادة' });
  }
});

// Student: Generate Adaptive Mistakes Quiz ("امتحان خاص بيك")
router.post('/adaptive-mistakes-quiz', authMiddleware, (req, res) => {
  try {
    const isTeacherUser = isTeacher(req.user);
    const enrollments = isTeacherUser 
      ? db.prepare('SELECT id FROM courses').all()
      : db.prepare('SELECT course_id as id FROM enrollments WHERE user_id = ?').all(req.user.id);
    const enrolledCourseIds = enrollments.map(e => e.id);

    if (enrolledCourseIds.length === 0) {
      return res.status(400).json({ error: 'يجب الاشتراك في كورس واحد على الأقل لإنشاء الامتحان التكيفي' });
    }

    const coursePlaceholders = enrolledCourseIds.map(() => '?').join(',');

    const attempts = db.prepare(`
      SELECT answers FROM exam_attempts WHERE user_id = ? AND completed_at IS NOT NULL
    `).all(req.user.id);

    const wrongQuestionIds = new Set();
    attempts.forEach(a => {
      try {
        const ansMap = JSON.parse(a.answers || '{}');
        Object.keys(ansMap).forEach(qId => {
          const q = db.prepare('SELECT id, correct_answer, type FROM questions WHERE id = ?').get(qId);
          if (q) {
            const uAns = ansMap[qId];
            let correct = false;
            if (q.type === 'mcq' || q.type === 'true_false') {
              correct = String(uAns) === String(q.correct_answer);
            } else if (q.type === 'fill_blank') {
              correct = String(uAns || '').trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
            }
            if (!correct && uAns !== undefined && uAns !== null && uAns !== '') {
              wrongQuestionIds.add(Number(qId));
            }
          }
        });
      } catch (e) {}
    });

    if (wrongQuestionIds.size === 0) {
      // Pick 5 random challenging questions from enrolled courses only (without leaking explanation before taking quiz)
      const fallbackQuestions = db.prepare(`
        SELECT q.id, q.exam_id, q.type, q.text, q.image_url, q.options, q.points
        FROM questions q
        JOIN exams e ON q.exam_id = e.id
        WHERE e.course_id IN (${coursePlaceholders})
        ORDER BY RANDOM() LIMIT 5
      `).all(...enrolledCourseIds);

      fallbackQuestions.forEach(q => {
        if (q.options) {
          try { q.options = JSON.parse(q.options); } catch (e) {}
        }
      });

      return res.json({
        has_mistakes: false,
        count: fallbackQuestions.length,
        title: 'امتحان التميز والتدريب الإضافي في الكيمياء',
        description: 'ما شاء الله! لا توجد أخطاء سابقة مسجلة في حسابك، لذا قمنا باختيار مجموعة أسئلة متميزة لتعزيز مهارتك.',
        duration_minutes: 15,
        questions: fallbackQuestions
      });
    }

    const idArray = Array.from(wrongQuestionIds).slice(0, 15);
    const placeholders = idArray.map(() => '?').join(',');
    const questions = db.prepare(`
      SELECT q.id, q.exam_id, q.type, q.text, q.image_url, q.options, q.points
      FROM questions q
      JOIN exams e ON q.exam_id = e.id
      WHERE q.id IN (${placeholders}) AND e.course_id IN (${coursePlaceholders})
    `).all(...idArray, ...enrolledCourseIds);

    questions.forEach(q => {
      if (q.options) {
        try { q.options = JSON.parse(q.options); } catch (e) {}
      }
    });

    res.json({
      has_mistakes: true,
      count: questions.length,
      title: 'امتحانك الخاص: تدريب علاجي مكثف على أخطائك السابقة 🎯',
      description: 'تم جمع هذه الأسئلة خصيصاً لك من الاختبارات السابقة التي أخطأت فيها لتدريبك عليها حتى تتقنها 100%.',
      duration_minutes: 20,
      questions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في استخراج بنك الأخطاء' });
  }
});

// Get exam details with questions (for taking)
router.get('/:id/take', authMiddleware, (req, res) => {
  try {
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
    if (!exam) return res.status(404).json({ error: 'الامتحان غير موجود' });

    // Strict enrollment check
    if (exam.course_id && !canAccessCourse(req.user, exam.course_id)) {
      return res.status(403).json({ error: 'يجب الاشتراك في الكورس أولاً لخوض هذا الامتحان' });
    }

    // Exam Scheduling Check
    const now = new Date();
    if (exam.start_time && new Date(exam.start_time) > now) {
      return res.status(400).json({ error: `هذا الامتحان غير متاح بعد. موعد البدء: ${new Date(exam.start_time).toLocaleString('ar-EG')}` });
    }
    if (exam.end_time && new Date(exam.end_time) < now) {
      return res.status(400).json({ error: `انتهت الفترة الزمنية المخصصة لهذا الامتحان في ${new Date(exam.end_time).toLocaleString('ar-EG')}` });
    }

    const attemptCount = db.prepare('SELECT COUNT(*) as c FROM exam_attempts WHERE exam_id = ? AND user_id = ?').get(exam.id, req.user.id);
    if (!isTeacher(req.user) && exam.max_attempts > 0 && attemptCount.c >= exam.max_attempts) {
      return res.status(400).json({ error: 'لقد استنفذت عدد المحاولات المسموحة لهذا الامتحان' });
    }

    // Exam Session Management (Single active session & fixed random questions)
    let session = db.prepare('SELECT * FROM exam_sessions WHERE user_id = ? AND exam_id = ?').get(req.user.id, exam.id);
    let questions;

    if (session) {
      try {
        const qIds = JSON.parse(session.question_ids);
        const placeholders = qIds.map(() => '?').join(',');
        questions = db.prepare(`SELECT id, type, text, image_url, options, points, order_num FROM questions WHERE id IN (${placeholders}) ORDER BY order_num`).all(...qIds);
      } catch (e) {
        questions = db.prepare('SELECT id, type, text, image_url, options, points, order_num FROM questions WHERE exam_id = ? ORDER BY order_num').all(exam.id);
      }
    } else {
      let allQuestions = db.prepare('SELECT id, type, text, image_url, options, points, order_num FROM questions WHERE exam_id = ? ORDER BY order_num').all(exam.id);
      if (exam.random_questions_count > 0 && exam.random_questions_count < allQuestions.length) {
        questions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, exam.random_questions_count);
      } else {
        questions = allQuestions;
      }
      const qIds = questions.map(q => q.id);
      db.prepare('INSERT OR REPLACE INTO exam_sessions (user_id, exam_id, question_ids, started_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
        .run(req.user.id, exam.id, JSON.stringify(qIds));
      session = { started_at: new Date().toISOString() };
    }

    const startedAt = new Date(session.started_at || Date.now()).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const totalAllowedSeconds = (exam.duration_minutes || 30) * 60;
    exam.remaining_seconds = Math.max(0, totalAllowedSeconds - elapsedSeconds);

    questions.forEach(q => { if (q.options) q.options = JSON.parse(q.options); });
    exam.questions = questions;
    res.json(exam);
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ' }); }
});

// Submit exam
router.post('/:id/submit', authMiddleware, (req, res) => {
  try {
    const { answers, time_spent } = req.body;
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
    if (!exam) return res.status(404).json({ error: 'الامتحان غير موجود' });

    // Strict enrollment check
    if (exam.course_id && !canAccessCourse(req.user, exam.course_id)) {
      return res.status(403).json({ error: 'يجب الاشتراك في الكورس أولاً' });
    }

    // Strict attempt limit check on submit
    const attemptCount = db.prepare('SELECT COUNT(*) as c FROM exam_attempts WHERE exam_id = ? AND user_id = ?').get(exam.id, req.user.id);
    if (!isTeacher(req.user) && exam.max_attempts > 0 && attemptCount.c >= exam.max_attempts) {
      return res.status(400).json({ error: 'لقد استنفذت عدد المحاولات المسموحة لهذا الامتحان' });
    }

    // Verify against assigned session questions
    const session = db.prepare('SELECT * FROM exam_sessions WHERE user_id = ? AND exam_id = ?').get(req.user.id, exam.id);
    let questions;
    if (session) {
      try {
        const qIds = JSON.parse(session.question_ids);
        const placeholders = qIds.map(() => '?').join(',');
        questions = db.prepare(`SELECT * FROM questions WHERE id IN (${placeholders}) ORDER BY order_num`).all(...qIds);
      } catch (e) {
        questions = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num').all(exam.id);
      }
    } else {
      const answeredIds = Object.keys(answers || {}).map(id => parseInt(id)).filter(id => !isNaN(id));
      questions = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num').all(exam.id);
      if (exam.random_questions_count > 0) {
        questions = questions.filter(q => answeredIds.includes(q.id));
        if (questions.length > exam.random_questions_count) {
          questions = questions.slice(0, exam.random_questions_count);
        }
      }
    }

    let serverTimeSpent = time_spent || 0;
    if (session && session.started_at) {
      const serverElapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
      serverTimeSpent = Math.max(serverElapsed, time_spent || 0);

      // F-03: Reject submission if duration exceeded (with 60-second grace period)
      const allowedSeconds = (exam.duration_minutes || 30) * 60 + 60;
      if (!isTeacher(req.user) && serverElapsed > allowedSeconds) {
        return res.status(400).json({ error: 'انتهى وقت الامتحان. لا يمكن تسليم الإجابات بعد انتهاء المهلة المحددة.' });
      }
    }

    const feedbackByConcept = {
      iron_oxidation: {
        reinforcement: "تتبّع عدد أكسدة الحديد قبل موازنة التفاعل. ميّز بين FeO وFe₂O₃ وFe₃O₄؛ الأخير يحتوي على الحديد بحالتي الأكسدة +2 و+3.",
        learning_action: "راجع معادلات أكسدة الحديد واختزاله، واكتب أعداد الأكسدة ثم أعد موازنة المعادلة."
      },
      limiting_reagent: {
        reinforcement: "وازن المعادلة ثم حوّل كميات المتفاعلات إلى مولات. قارن عدد المولات مقسوماً على معامل كل متفاعل؛ القيمة الأصغر تحدّد المادة المحدِّدة للتفاعل.",
        learning_action: "أعد حساب عدد مولات المادة المحدِّدة للتفاعل، ثم احسب كمية الناتج باستخدام معاملات المعادلة."
      },
      stoichiometry: {
        reinforcement: "ابدأ بالعلاقة n = m / M، ثم استخدم النسب المولية من المعادلة الموزونة. لا تقارن الكتل مباشرةً دون تحويلها إلى مولات.",
        learning_action: "راجع حساب الكتلة المولية، وأعد الحل مع كتابة الوحدات في كل خطوة، ثم حل مسألتين على النسب المولية."
      },
      redox: {
        reinforcement: "الأكسدة فقد إلكترونات وزيادة عدد الأكسدة، والاختزال اكتساب إلكترونات وانخفاض عدد الأكسدة. العامل المؤكسِد يُختزل والعامل المختزِل يتأكسد.",
        learning_action: "حدّد أعداد الأكسدة والعاملين المؤكسِد والمختزِل، ثم اكتب نصفي التفاعل ووازن الإلكترونات."
      },
      chemical_equilibrium: {
        reinforcement: "ميّز بين تغيّر موضع الاتزان وتغيّر ثابت الاتزان؛ عند ثبات درجة الحرارة لا تتغيّر قيمة K. لا تدخل المواد الصلبة والسوائل النقية في تعبير ثابت الاتزان.",
        learning_action: "اكتب تعبير ثابت الاتزان من المعادلة الموزونة، ثم راجع أثر التغيّر المطلوب باستخدام مبدأ لوشاتلييه."
      },
      electrochemistry: {
        reinforcement: "الأكسدة تحدث عند الأنود والاختزال عند الكاثود. ميّز بين الخلية الجلفانية وخلية التحليل الكهربائي عند تحديد إشارات الأقطاب.",
        learning_action: "ارسم الخلية وحدّد الأنود والكاثود واتجاه انتقال الإلكترونات، ثم اكتب تفاعل كل قطب."
      },
      qualitative_analysis: {
        reinforcement: "اربط الأيون بالكاشف وشروط الاختبار والملاحظة الناتجة؛ لون الراسب وحده قد لا يكفي للتمييز بين الأيونات.",
        learning_action: "راجع جدول الكواشف النوعية وألوان الرواسب وظروف ذوبانها في الأحماض أو القواعد."
      },
      organic_reactions: {
        reinforcement: "حدّد نوع التفاعل (إضافة، استبدال، نزع، أكسدة) والمجموعة الوظيفية المؤثرة وقاعدة ماركوفنيكوف عند إضافة متفاعل غير متماثل.",
        learning_action: "اكتب الصيغة البنائية للمركب، ثم طبّق شروط التفاعل وقواعد التوجيه خطوة بخطوة."
      }
    };

    let totalPoints = 0, earnedPoints = 0;
    const results = questions.map(q => {
      totalPoints += q.points;
      const userAnswer = answers ? answers[q.id] : undefined;
      let isCorrect = false;
      const correct = q.correct_answer;
      if (q.type === 'mcq' || q.type === 'true_false') {
        isCorrect = String(userAnswer) === String(correct);
      } else if (q.type === 'fill_blank') {
        isCorrect = String(userAnswer || '').trim().toLowerCase() === String(correct).trim().toLowerCase();
      } else if (q.type === 'ordering') {
        isCorrect = JSON.stringify(userAnswer) === correct;
      } else if (q.type === 'multi_select') {
        try {
          const correctArr = JSON.parse(correct);
          isCorrect = Array.isArray(userAnswer) && JSON.stringify([...userAnswer].sort()) === JSON.stringify([...correctArr].sort());
        } catch (e) {}
      } else if (q.type === 'essay') {
        // Essay questions do NOT award automatic 90% unverified score.
        // Score remains 0 until the teacher reviews, scores, and approves it!
        return { 
          question_id: q.id, 
          user_answer: userAnswer, 
          correct_answer: q.correct_answer, 
          is_correct: false, 
          is_essay: true,
          ai_suggested_score: 0,
          ai_feedback: 'تم رصد خطوات الحل وحفظها بنجاح، وبانتظار اعتماد وتقدير الدرجة من المعلم.',
          explanation: q.explanation, 
          points: q.points, 
          options: null, 
          text: q.text, 
          type: q.type, 
          image_url: q.image_url 
        };
      }
      if (isCorrect) earnedPoints += q.points;

      let pedagogical_feedback = null;
      if (!isCorrect) {
        if (q.concept_key && feedbackByConcept[q.concept_key]) {
          pedagogical_feedback = feedbackByConcept[q.concept_key];
        } else if (q.explanation) {
          pedagogical_feedback = {
            reinforcement: q.explanation,
            learning_action: "راجع النقطة العلمية الموضحة في تفسير السؤال لإتقان الفكرة."
          };
        }
      }

      return { 
        question_id: q.id, 
        user_answer: userAnswer, 
        correct_answer: q.correct_answer, 
        is_correct: isCorrect, 
        explanation: q.explanation, 
        pedagogical_feedback,
        points: q.points, 
        options: q.options ? JSON.parse(q.options) : null, 
        text: q.text, 
        type: q.type, 
        image_url: q.image_url 
      };
    });

    // Penalty for unanswered questions in random bank
    if (exam.random_questions_count > 0 && questions.length < exam.random_questions_count) {
      const missing = exam.random_questions_count - questions.length;
      totalPoints += missing;
    }

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const hasEssay = questions.some(q => q.type === 'essay');
    const isGraded = hasEssay ? 0 : 1;

    // Snapshot assigned question IDs and pedagogical feedback summary
    const questionIdsJson = JSON.stringify(questions.map(q => q.id));
    const pedagogicalSummary = JSON.stringify(results.filter(r => r.pedagogical_feedback).map(r => ({ q_id: r.question_id, feedback: r.pedagogical_feedback })));

    const result = db.prepare(`
      INSERT INTO exam_attempts (exam_id, user_id, answers, score, total_points, time_spent, is_graded, question_ids, pedagogical_feedback, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(exam.id, req.user.id, JSON.stringify(answers || {}), score, totalPoints, serverTimeSpent, isGraded, questionIdsJson, pedagogicalSummary);

    // Clear exam session on successful submission
    db.prepare('DELETE FROM exam_sessions WHERE user_id = ? AND exam_id = ?').run(req.user.id, exam.id);
    const rank = db.prepare('SELECT COUNT(DISTINCT user_id) + 1 as rank FROM exam_attempts WHERE exam_id = ? AND score > ? AND user_id != ?').get(exam.id, score, req.user.id);

    // Auto-issue Certificate if passed and fully graded
    let certificate = null;
    if (isGraded === 1 && score >= (exam.passing_score || 60)) {
      const tier = score === 100 ? 'gold' : score >= 90 ? 'silver' : 'bronze';
      const certCode = `CERT-ZRA-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      try {
        db.prepare(`
          INSERT INTO certificates (cert_code, user_id, exam_id, attempt_id, score, total_points, percentage, tier)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, exam_id) DO UPDATE SET
            cert_code = excluded.cert_code,
            score = excluded.score,
            total_points = excluded.total_points,
            percentage = excluded.percentage,
            tier = excluded.tier,
            attempt_id = excluded.attempt_id
        `).run(certCode, req.user.id, exam.id, result.lastInsertRowid, earnedPoints, totalPoints, score, tier);
        certificate = { cert_code: certCode, tier, percentage: score };
      } catch (e) {
        console.error('Certificate issue error:', e.message);
      }
    }
    
    let next_item = null;
    if (exam.course_id) {
      try {
        const allLessons = db.prepare("SELECT id, title, order_num, 'lesson' as item_type FROM lessons WHERE course_id = ?").all(exam.course_id);
        const allExams = db.prepare("SELECT id, title, order_num, 'exam' as item_type FROM exams WHERE course_id = ? AND chapter_id IS NOT NULL").all(exam.course_id);
        const allItems = [...allLessons, ...allExams].sort((a, b) => a.order_num - b.order_num);
        const currentIndex = allItems.findIndex(item => item.item_type === 'exam' && item.id === exam.id);
        if (currentIndex >= 0 && currentIndex < allItems.length - 1) {
          next_item = allItems[currentIndex + 1];
        }
      } catch (e) {
        console.error('Error finding next item:', e.message);
      }
    }

    // Automated Dual Parent Loop (Father + Mother WhatsApp Reports)
    const student = db.prepare('SELECT name, parent_phone, parent_phone_secondary FROM users WHERE id = ?').get(req.user.id);
    let whatsapp_parent_url = null;
    let whatsapp_parent_secondary_url = null;

    if (student) {
      let baseMsg = '';
      if (hasEssay) {
        baseMsg = `نحيطكم علماً بأن الطالب قد أتم للتو تسليم اختبار: "${exam.title}" على منصة د. زياد رمزي عياد للكيمياء.\nتم رصد إجابات وخطوات الحل المقالية، وهي الآن قيد المراجعة والتصحيح من قبل المعلم لإصدار الدرجة المعتمدة.\nمع تحيات إدارة منصة كيمياوي.`;
      } else {
        const statusText = score >= exam.passing_score ? 'ناجح بتفوق 🌟' : 'يحتاج لمزيد من المذاكرة والمتابعة ⚠️';
        baseMsg = `نحيطكم علماً بأن الطالب قد أتم للتو اختبار: "${exam.title}" على منصة د. زياد رمزي عياد للكيمياء.\nالدرجة المحققة: ${score}% (${earnedPoints} من ${totalPoints})\nالحالة: ${statusText}\nمع تحيات إدارة منصة كيمياوي.`;
      }

      // 1. Father / Primary Parent
      if (student.parent_phone) {
        const fatherText = encodeURIComponent(`السلام عليكم ورحمة الله، والد الطالب/ة ${student.name}.\n${baseMsg}`);
        whatsapp_parent_url = `https://wa.me/20${student.parent_phone.replace(/^0+/, '')}?text=${fatherText}`;
      }

      // 2. Mother / Secondary Parent
      if (student.parent_phone_secondary) {
        const motherText = encodeURIComponent(`السلام عليكم ورحمة الله، والدة الطالب/ة ${student.name}.\n${baseMsg}`);
        whatsapp_parent_secondary_url = `https://wa.me/20${student.parent_phone_secondary.replace(/^0+/, '')}?text=${motherText}`;
      }

      // Notification
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        req.user.id,
        certificate ? 'تهانينا! حصلت على شهادة تفوق 🎉' : 'تقرير نتيجة الامتحان',
        hasEssay 
          ? `تم استلام إجابات امتحان "${exam.title}". خطوات الحل المقالية قيد مراجعة المعلم.`
          : (certificate 
              ? `تهانينا! حققت ${score}% في "${exam.title}" واستحققت شهادة تقدير (${certificate.tier === 'gold' ? 'الدرجة الكاملة 🥇' : certificate.tier === 'silver' ? 'المتفوقين 🥈' : 'الاجتياز 🥉'}). توجه لصفحة الشهادات لتحميلها!`
              : `تم تسجيل نتيجة امتحان "${exam.title}" بنسبة ${score}%.`),
        score >= exam.passing_score ? 'success' : 'warning'
      );
    }
    
    res.json({
      attempt_id: result.lastInsertRowid,
      score,
      earned_points: earnedPoints,
      total_points: totalPoints,
      results,
      rank: rank.rank,
      passed: score >= exam.passing_score,
      is_graded: isGraded,
      certificate,
      course_id: exam.course_id,
      next_item,
      whatsapp_parent_url,
      whatsapp_parent_secondary_url
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ في تسليم الامتحان' }); }
});

// Teacher: get all student submissions for an exam
router.get('/:id/submissions', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
    if (!exam) return res.status(404).json({ error: 'الامتحان غير موجود' });

    const attempts = db.prepare(`
      SELECT ea.id, ea.exam_id, ea.user_id, ea.answers, ea.score, ea.total_points, ea.time_spent, ea.completed_at, ea.is_graded, ea.essay_grades, ea.teacher_feedback,
             u.name as student_name, u.phone as student_phone, u.avatar
      FROM exam_attempts ea
      JOIN users u ON u.id = ea.user_id
      WHERE ea.exam_id = ?
      ORDER BY ea.completed_at DESC
    `).all(exam.id);

    const questions = db.prepare('SELECT id, type, text, image_url, options, correct_answer, explanation, points, order_num FROM questions WHERE exam_id = ? ORDER BY order_num').all(exam.id);
    questions.forEach(q => { if (q.options) { try { q.options = JSON.parse(q.options); } catch (e) {} } });

    const parsedAttempts = attempts.map(a => {
      let parsedAnswers = {};
      let parsedGrades = {};
      try { parsedAnswers = a.answers ? JSON.parse(a.answers) : {}; } catch (e) {}
      try { parsedGrades = a.essay_grades ? JSON.parse(a.essay_grades) : {}; } catch (e) {}
      return {
        ...a,
        answers: parsedAnswers,
        essay_grades: parsedGrades
      };
    });

    res.json({ exam, questions, attempts: parsedAttempts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في جلب تسليمات الامتحان' });
  }
});

// Teacher: grade essay questions in an attempt
router.post(['/attempt/:id/grade-essay', '/attempt/:id/grade', '/attempts/:id/grade-essay', '/attempts/:id/grade'], authMiddleware, teacherMiddleware, (req, res) => {
  try {
    let { essay_grades, teacher_feedback, scores, feedback, overall_feedback } = req.body;
    teacher_feedback = teacher_feedback || overall_feedback;
    if (!essay_grades && scores) {
      essay_grades = {};
      Object.keys(scores).forEach(qId => {
        essay_grades[qId] = {
          points: scores[qId],
          notes: (feedback && feedback[qId]) || ''
        };
      });
    }
    const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(req.params.id);
    if (!attempt) return res.status(404).json({ error: 'المحاولة غير موجودة' });

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id);
    const questions = db.prepare('SELECT * FROM questions WHERE exam_id = ?').all(attempt.exam_id);
    let userAnswers = {};
    try { userAnswers = attempt.answers ? JSON.parse(attempt.answers) : {}; } catch (e) {}

    let totalPoints = 0;
    let earnedPoints = 0;

    questions.forEach(q => {
      totalPoints += q.points;
      if (q.type === 'essay') {
        const manualGrade = essay_grades && essay_grades[q.id] ? Number(essay_grades[q.id].points) : 0;
        earnedPoints += Math.min(Math.max(0, manualGrade), q.points);
      } else {
        const uAns = userAnswers[q.id];
        let isCorrect = false;
        if (q.type === 'mcq' || q.type === 'true_false') {
          isCorrect = String(uAns) === String(q.correct_answer);
        } else if (q.type === 'fill_blank') {
          isCorrect = String(uAns || '').trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
        } else if (q.type === 'ordering') {
          isCorrect = JSON.stringify(uAns) === q.correct_answer;
        } else if (q.type === 'multi_select') {
          try {
            const correctArr = JSON.parse(q.correct_answer);
            isCorrect = Array.isArray(uAns) && JSON.stringify([...uAns].sort()) === JSON.stringify([...correctArr].sort());
          } catch (e) {}
        }
        if (isCorrect) earnedPoints += q.points;
      }
    });

    const newScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    db.prepare(`
      UPDATE exam_attempts
      SET score = ?, essay_grades = ?, teacher_feedback = ?, is_graded = 1
      WHERE id = ?
    `).run(
      newScore,
      essay_grades ? JSON.stringify(essay_grades) : null,
      teacher_feedback || null,
      attempt.id
    );

    // Auto-issue Certificate if passed upon teacher grading
    if (newScore >= (exam?.passing_score || 60)) {
      const tier = newScore === 100 ? 'gold' : newScore >= 90 ? 'silver' : 'bronze';
      const certCode = `CERT-ZRA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      try {
        db.prepare(`
          INSERT INTO certificates (cert_code, user_id, exam_id, attempt_id, score, total_points, percentage, tier)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, exam_id) DO UPDATE SET
            cert_code = excluded.cert_code,
            score = excluded.score,
            total_points = excluded.total_points,
            percentage = excluded.percentage,
            tier = excluded.tier,
            attempt_id = excluded.attempt_id
        `).run(certCode, attempt.user_id, exam.id, attempt.id, earnedPoints, totalPoints, newScore, tier);
      } catch (e) {
        console.error('Certificate issue error on teacher grading:', e.message);
      }
    }

    // Notify student about the grading
    try {
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, ?)
      `).run(
        attempt.user_id,
        'تم تصحيح إجابتك واعتماد النتيجة',
        `قام أ/ زياد رمزي بمراجعة وتصحيح إجابتك في اختبار "${exam ? exam.title : 'امتحان كيمياء'}". نتيجتك النهائية المعتمدة: ${newScore}% (${earnedPoints} من ${totalPoints})`,
        newScore >= (exam?.passing_score || 60) ? 'success' : 'info'
      );
    } catch (e) {}

    res.json({
      message: 'تم حفظ التصحيح واعتماد الدرجة بنجاح',
      score: newScore,
      earned_points: earnedPoints,
      total_points: totalPoints,
      is_graded: 1
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ التصحيح' });
  }
});

function formatAttemptReview(attempt, exam, user) {
  let userAnswers = {};
  let essayGrades = {};
  try { userAnswers = attempt.answers ? JSON.parse(attempt.answers) : {}; } catch (e) {}
  try { essayGrades = attempt.essay_grades ? JSON.parse(attempt.essay_grades) : {}; } catch (e) {}

  let questions;
  if (attempt.question_ids) {
    try {
      const qIds = JSON.parse(attempt.question_ids);
      if (Array.isArray(qIds) && qIds.length > 0) {
        const placeholders = qIds.map(() => '?').join(',');
        questions = db.prepare(`SELECT * FROM questions WHERE id IN (${placeholders}) ORDER BY order_num`).all(...qIds);
      } else {
        questions = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num').all(exam.id);
      }
    } catch (e) {
      questions = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num').all(exam.id);
    }
  } else {
    questions = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num').all(exam.id);
  }

  const feedbackByConcept = {
    iron_oxidation: {
      reinforcement: "تتبّع عدد أكسدة الحديد قبل موازنة التفاعل. ميّز بين FeO وFe₂O₃ وFe₃O₄؛ الأخير يحتوي على الحديد بحالتي الأكسدة +2 و+3.",
      learning_action: "راجع معادلات أكسدة الحديد واختزاله، واكتب أعداد الأكسدة ثم أعد موازنة المعادلة."
    },
    limiting_reagent: {
      reinforcement: "وازن المعادلة ثم حوّل كميات المتفاعلات إلى مولات. قارن عدد المولات مقسوماً على معامل كل متفاعل؛ القيمة الأصغر تحدّد المادة المحدِّدة للتفاعل.",
      learning_action: "أعد حساب عدد مولات المادة المحدِّدة للتفاعل، ثم احسب كمية الناتج باستخدام معاملات المعادلة."
    },
    stoichiometry: {
      reinforcement: "ابدأ بالعلاقة n = m / M، ثم استخدم النسب المولية من المعادلة الموزونة. لا تقارن الكتل مباشرةً دون تحويلها إلى مولات.",
      learning_action: "راجع حساب الكتلة المولية، وأعد الحل مع كتابة الوحدات في كل خطوة، ثم حل مسألتين على النسب المولية."
    },
    redox: {
      reinforcement: "الأكسدة فقد إلكترونات وزيادة عدد الأكسدة، والاختزال اكتساب إلكترونات وانخفاض عدد الأكسدة. العامل المؤكسِد يُختزل والعامل المختزِل يتأكسد.",
      learning_action: "حدّد أعداد الأكسدة والعاملين المؤكسِد والمختزِل، ثم اكتب نصفي التفاعل ووازن الإلكترونات."
    },
    chemical_equilibrium: {
      reinforcement: "ميّز بين تغيّر موضع الاتزان وتغيّر ثابت الاتزان؛ عند ثبات درجة الحرارة لا تتغيّر قيمة K. لا تدخل المواد الصلبة والسوائل النقية في تعبير ثابت الاتزان.",
      learning_action: "اكتب تعبير ثابت الاتزان من المعادلة الموزونة، ثم راجع أثر التغيّر المطلوب باستخدام مبدأ لوشاتلييه."
    },
    electrochemistry: {
      reinforcement: "الأكسدة تحدث عند الأنود والاختزال عند الكاثود. ميّز بين الخلية الجلفانية وخلية التحليل الكهربائي عند تحديد إشارات الأقطاب.",
      learning_action: "ارسم الخلية وحدّد الأنود والكاثود واتجاه انتقال الإلكترونات، ثم اكتب تفاعل كل قطب."
    },
    qualitative_analysis: {
      reinforcement: "اربط الأيون بالكاشف وشروط الاختبار والملاحظة الناتجة؛ لون الراسب وحده قد لا يكفي للتمييز بين الأيونات.",
      learning_action: "راجع جدول الكواشف النوعية وألوان الرواسب وظروف ذوبانها في الأحماض أو القواعد."
    },
    organic_reactions: {
      reinforcement: "حدّد نوع التفاعل (إضافة، استبدال، نزع، أكسدة) والمجموعة الوظيفية المؤثرة وقاعدة ماركوفنيكوف عند إضافة متفاعل غير متماثل.",
      learning_action: "اكتب الصيغة البنائية للمركب، ثم طبّق شروط التفاعل وقواعد التوجيه خطوة بخطوة."
    }
  };

  let totalPoints = 0;
  let earnedPoints = 0;

  const results = questions.map(q => {
    let options = null;
    if (q.options) {
      try { options = JSON.parse(q.options); } catch (e) {}
    }
    const uAns = userAnswers[q.id];
    let isCorrect = false;
    let questionEarned = 0;
    let teacherComment = null;

    totalPoints += q.points;

    if (q.type === 'essay') {
      const manualGrade = essayGrades && essayGrades[q.id] ? Number(essayGrades[q.id].points) : 0;
      questionEarned = Math.min(Math.max(0, manualGrade), q.points);
      teacherComment = essayGrades && essayGrades[q.id] ? essayGrades[q.id].notes : null;
      isCorrect = questionEarned > 0;
    } else if (q.type === 'mcq' || q.type === 'true_false') {
      isCorrect = String(uAns) === String(q.correct_answer);
      if (isCorrect) questionEarned = q.points;
    } else if (q.type === 'fill_blank') {
      isCorrect = String(uAns || '').trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
      if (isCorrect) questionEarned = q.points;
    } else if (q.type === 'ordering') {
      isCorrect = JSON.stringify(uAns) === q.correct_answer;
      if (isCorrect) questionEarned = q.points;
    } else if (q.type === 'multi_select') {
      try {
        const correctArr = JSON.parse(q.correct_answer);
        isCorrect = Array.isArray(uAns) && JSON.stringify([...uAns].sort()) === JSON.stringify([...correctArr].sort());
      } catch (e) {}
      if (isCorrect) questionEarned = q.points;
    }

    earnedPoints += questionEarned;

    let pedagogical_feedback = null;
    if (!isCorrect) {
      if (q.concept_key && feedbackByConcept[q.concept_key]) {
        pedagogical_feedback = feedbackByConcept[q.concept_key];
      } else if (q.explanation) {
        pedagogical_feedback = {
          reinforcement: q.explanation,
          learning_action: "راجع النقطة العلمية الموضحة في تفسير السؤال لإتقان الفكرة."
        };
      }
    }

    return {
      id: q.id,
      text: q.text,
      type: q.type,
      options,
      image_url: q.image_url,
      user_answer: uAns,
      correct_answer: (q.type !== 'essay' && attempt.completed_at) ? q.correct_answer : null,
      is_correct: isCorrect,
      points: q.points,
      earned_points: questionEarned,
      explanation: q.explanation,
      pedagogical_feedback,
      teacher_comment: teacherComment,
      is_essay: q.type === 'essay'
    };
  });

  const rank = db.prepare('SELECT COUNT(*) + 1 as rank FROM exam_attempts WHERE exam_id = ? AND score > ? AND user_id != ?').get(exam.id, attempt.score, user.id);

  return {
    attempt_id: attempt.id,
    score: attempt.score,
    earned_points: earnedPoints,
    total_points: totalPoints || attempt.total_points,
    time_spent: attempt.time_spent,
    is_graded: attempt.is_graded,
    teacher_feedback: attempt.teacher_feedback,
    completed_at: attempt.completed_at,
    results,
    questions: results,
    rank: rank?.rank || 1,
    passed: attempt.score >= exam.passing_score,
    course_id: exam.course_id,
    exam_title: exam.title
  };
}

// Get student's latest attempt review for an exam
router.get('/:id/my-attempt', authMiddleware, (req, res) => {
  try {
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
    if (!exam) return res.status(404).json({ error: 'الامتحان غير موجود' });
    const attempt = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ? ORDER BY completed_at DESC LIMIT 1').get(exam.id, req.user.id);
    if (!attempt) return res.status(404).json({ error: 'لم تقم بتسليم هذا الامتحان بعد' });
    const review = formatAttemptReview(attempt, exam, req.user);
    res.json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في تحميل نتيجة الامتحان' });
  }
});

// Get attempt results by ID
router.get(['/attempt/:id', '/attempts/:id'], authMiddleware, (req, res) => {
  try {
    const isTeacherUser = isTeacher(req.user);
    const attempt = isTeacherUser
      ? db.prepare('SELECT ea.*, e.title as exam_title, e.passing_score, e.course_id FROM exam_attempts ea JOIN exams e ON ea.exam_id = e.id WHERE ea.id = ?').get(req.params.id)
      : db.prepare('SELECT ea.*, e.title as exam_title, e.passing_score, e.course_id FROM exam_attempts ea JOIN exams e ON ea.exam_id = e.id WHERE ea.id = ? AND ea.user_id = ?').get(req.params.id, req.user.id);

    if (!attempt) return res.status(404).json({ error: 'المحاولة غير موجودة' });
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id);
    const review = formatAttemptReview(attempt, exam, req.user);
    res.json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات المحاولة' });
  }
});

// show exam details for teacher
router.get('/:id/details', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
    if (!exam) return res.status(404).json({ error: 'الامتحان غير موجود' });

    let questions = db.prepare('SELECT id, type, text, image_url, options, points, order_num, correct_answer FROM questions WHERE exam_id = ? ORDER BY order_num').all(exam.id);

    questions.forEach(q => { if (q.options) q.options = JSON.parse(q.options); });
    exam.questions = questions;
    res.json(exam);
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Create exam (teacher) — FIXED: now saves chapter_id, order_num, start_time, end_time
router.post('/', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { course_id, chapter_id, title, description, duration_minutes, max_attempts, passing_score, random_questions_count, order_num, start_time, end_time } = req.body;
    const result = db.prepare('INSERT INTO exams (course_id, chapter_id, title, description, duration_minutes, max_attempts, passing_score, random_questions_count, order_num, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(course_id, chapter_id || null, title, description, duration_minutes || 30, max_attempts || 1, passing_score || 60, random_questions_count || 0, order_num || 0, start_time || null, end_time || null);
    res.status(201).json(db.prepare('SELECT * FROM exams WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ' }); }
});

// Update exam
router.put('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const fields = ['title', 'description', 'duration_minutes', 'max_attempts', 'passing_score', 'random_questions_count', 'order_num', 'chapter_id'];
    const updates = [];
    const values = [];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }

    if (req.body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(req.body.is_active ? 1 : 0);
    }
    if (req.body.start_time !== undefined) {
      updates.push('start_time = ?');
      values.push(req.body.start_time || null);
    }
    if (req.body.end_time !== undefined) {
      updates.push('end_time = ?');
      values.push(req.body.end_time || null);
    }

    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE exams SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    res.json(db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id));
  } catch (err) { res.status(500).json({ error: 'حدث خطأ في تحديث الامتحان' }); }
});

// Add question to exam
router.post('/:id/questions', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { type, text, image_url, options, correct_answer, explanation, points } = req.body;
    const maxOrder = db.prepare('SELECT MAX(order_num) as m FROM questions WHERE exam_id = ?').get(req.params.id);
    const result = db.prepare('INSERT INTO questions (exam_id, type, text, image_url, options, correct_answer, explanation, points, order_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(req.params.id, type, text, image_url, options ? JSON.stringify(options) : null, typeof correct_answer === 'string' ? correct_answer : JSON.stringify(correct_answer), explanation, points || 1, (maxOrder?.m || 0) + 1);
    res.status(201).json(db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { console.error(err); res.status(500).json({ error: 'حدث خطأ' }); }
});

// Update question — FIXED: use /questions/:questionId pattern
router.put('/questions/:questionId', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { type, text, image_url, options, correct_answer, explanation, points, order_num } = req.body;
    db.prepare('UPDATE questions SET type=COALESCE(?,type), text=COALESCE(?,text), image_url=COALESCE(?,image_url), options=COALESCE(?,options), correct_answer=COALESCE(?,correct_answer), explanation=COALESCE(?,explanation), points=COALESCE(?,points), order_num=COALESCE(?,order_num) WHERE id=?').run(type, text, image_url, options ? JSON.stringify(options) : null, correct_answer ? (typeof correct_answer === 'string' ? correct_answer : JSON.stringify(correct_answer)) : null, explanation, points, order_num, req.params.questionId);
    res.json(db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.questionId));
  } catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Delete question — FIXED: use /questions/:questionId pattern
router.delete('/questions/:questionId', authMiddleware, teacherMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.questionId); res.json({ message: 'تم حذف السؤال' }); }
  catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

// Delete exam
router.delete('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM exams WHERE id = ?').run(req.params.id); res.json({ message: 'تم حذف الامتحان' }); }
  catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

export default router;
