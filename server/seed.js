import bcrypt from 'bcryptjs';
import db from './db.js';
import crypto from 'crypto';

// ---- Safety guards (this script WIPES all data) ----
if ((process.env.NODE_ENV === 'production' || process.env.VERCEL) && process.env.FORCE_SEED !== '1') {
  console.error('Refusing to seed in production. Set FORCE_SEED=1 only if you really intend to wipe the database.');
  process.exit(1);
}
if (!process.argv.includes('--yes')) {
  console.error('This command DELETES existing data. Re-run with: npm run seed -- --yes');
  process.exit(1);
}
const rand = () => crypto.randomBytes(9).toString('base64url');
const TEACHER_PLAIN = process.env.SEED_TEACHER_PASSWORD || rand();
const STUDENT_PLAIN = process.env.SEED_STUDENT_PASSWORD || rand();
console.log(`\nGenerated demo passwords (shown once):\n  teacher 01000000000 -> ${TEACHER_PLAIN}\n  students            -> ${STUDENT_PLAIN}\n`);

console.log('Seeding database with full educational demo content...');

// Clear existing data — selectively preserve Admin
db.pragma('foreign_keys = OFF');
const tables = [
  'code_usage', 'activation_codes', 'discussion_replies', 'course_discussions',
  'lesson_progress', 'exam_attempts', 'exam_overrides', 'questions', 'exams',
  'lessons', 'chapters', 'enrollments', 'notifications', 'video_tokens',
  'live_sessions', 'courses', 'payment_requests', 'exam_sessions', 'fawry_orders', 'wallet_vouchers', 'saved_lessons', 'certificates', 'packages', 'package_enrollments', 'bookstores'
];

tables.forEach(t => {
  try { db.prepare(`DELETE FROM ${t}`).run(); } catch (e) { /* table might not exist yet */ }
});

// Delete all users except the teacher
db.prepare("DELETE FROM users WHERE phone != '01000000000'").run();

db.pragma('foreign_keys = ON');

// 1. Ensure teacher account exists
let teacher = db.prepare('SELECT id FROM users WHERE phone = ?').get('01000000000');
let teacherId;
if (teacher) {
  teacherId = teacher.id;
} else {
  const teacherPass = bcrypt.hashSync(TEACHER_PLAIN, 10);
  const teacherRes = db.prepare('INSERT INTO users (name, phone, password, role, grade) VALUES (?, ?, ?, ?, ?)')
    .run('د. زياد رمزي عياد', '01000000000', teacherPass, 'teacher', 'ثالثة ثانوي');
  teacherId = teacherRes.lastInsertRowid;
}

// 2. Create demo students
const studentPass = bcrypt.hashSync(STUDENT_PLAIN, 10);
const studentRes = db.prepare('INSERT INTO users (name, phone, password, role, grade, parent_phone) VALUES (?, ?, ?, ?, ?, ?)')
  .run('طالب تجريبي', '01111111111', studentPass, 'student', 'ثالثة ثانوي', '01222222222');
const studentId = studentRes.lastInsertRowid;

const student2Pass = bcrypt.hashSync(STUDENT_PLAIN, 10);
const student2Res = db.prepare('INSERT INTO users (name, phone, password, role, grade, parent_phone) VALUES (?, ?, ?, ?, ?, ?)')
  .run('مريم أحمد محمود', '01234567890', student2Pass, 'student', 'ثالثة ثانوي', '01099999999');
const student2Id = student2Res.lastInsertRowid;

// 3. Create courses
const course1Res = db.prepare(`
  INSERT INTO courses (title, description, grade, price, is_free, teacher_id, sequential_access, allow_student_replies)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'الباب الأول: كيمياء العناصر الانتقالية والحديد',
  'شرح تفصيلي متكامل للسلسلة الانتقالية الأولى، الخواص العامة والمغناطيسية، الألوان، خامات الحديد واستخلاصه، والأكاسيد والسبائك الكيميائية.',
  'ثالثة ثانوي',
  150,
  0,
  teacherId,
  0,
  1
);
const course1Id = course1Res.lastInsertRowid;

const course2Res = db.prepare(`
  INSERT INTO courses (title, description, grade, price, is_free, teacher_id, sequential_access, allow_student_replies)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'أساسيات الكيمياء والتأسيس المنهجي (مجاني)',
  'كورس تمهيدي شامل لجميع المفاهيم الأساسية: كتابة الصيغ الكيميائية، وزن المعادلات، وحساب أعداد التأكسد والمول.',
  'ثالثة ثانوي',
  0,
  1,
  teacherId,
  0,
  1
);
const course2Id = course2Res.lastInsertRowid;

// 4. Create chapters for Course 1
const ch1Res = db.prepare('INSERT INTO chapters (course_id, title, order_num) VALUES (?, ?, ?)').run(
  course1Id,
  'الفصل الأول: الخواص العامة للسلسلة الانتقالية الأولى',
  1
);
const ch1Id = ch1Res.lastInsertRowid;

const ch2Res = db.prepare('INSERT INTO chapters (course_id, title, order_num) VALUES (?, ?, ?)').run(
  course1Id,
  'الفصل الثاني: كيمياء الحديد وتفاعلات الأكاسيد',
  2
);
const ch2Id = ch2Res.lastInsertRowid;

// 5. Create lessons
const lesson1Res = db.prepare(`
  INSERT INTO lessons (chapter_id, course_id, title, description, video_url, duration, order_num, is_free, max_views)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  ch1Id,
  course1Id,
  'المحاضرة 1: التوزيع الإلكتروني وحالات التأكسد الشائعة',
  'نتناول في هذه المحاضرة قاعدة هوند ومبدأ البناء التصاعدي، وحالات استقرار عناصر الكروم والنحاس والشذوذ في التوزيع الإلكتروني.',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  42,
  1,
  1, // Free preview lesson
  8
);
const lesson1Id = lesson1Res.lastInsertRowid;

const lesson2Res = db.prepare(`
  INSERT INTO lessons (chapter_id, course_id, title, description, video_url, duration, order_num, is_free, max_views)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  ch1Id,
  course1Id,
  'المحاضرة 2: الخواص البارامغناطيسية والدايامغناطيسية والأيونات الملونة',
  'شرح العلاقة بين عدد الإلكترونات المفردة في الأوربيتالات وعزم الدوران المغناطيسي وتفسير ظاهرة امتصاص الضوء المرئي.',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  50,
  2,
  0,
  8
);

// 6. Create Exams
const exam1Res = db.prepare(`
  INSERT INTO exams (course_id, chapter_id, title, description, duration_minutes, max_attempts, passing_score, is_active, order_num)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  course1Id,
  ch1Id,
  'اختبار إلكتروني شامل على الخواص العامة والتوزيع الإلكتروني',
  'اختبار تقييمي لقياس فهم التوزيع الإلكتروني وأعداد التأكسد والخواص المغناطيسية والألوان.',
  20,
  3,
  60,
  1,
  3
);
const exam1Id = exam1Res.lastInsertRowid;

// 7. Create Questions
db.prepare(`
  INSERT INTO questions (exam_id, type, text, options, correct_answer, explanation, points, order_num)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  exam1Id,
  'mcq',
  'عنصر انتقالي رئيسي من السلسلة الأولى يحتوي مركبه على أيون X³⁺ بتوزيع إلكتروني [Ar] 3d⁵، فما هو العدد الذري لهذا العنصر؟',
  JSON.stringify([
    { id: 'opt1', text: '26 (الحديد Fe)' },
    { id: 'opt2', text: '25 (المنجنيز Mn)' },
    { id: 'opt3', text: '27 (الكوبالت Co)' },
    { id: 'opt4', text: '24 (الكروم Cr)' }
  ]),
  'opt1',
  'الحديد Fe عدده الذري 26 وتوزيعه الذري [Ar] 4s² 3d⁶. عند فقد 3 إلكترونات (إلكترونين من 4s وواحد من 3d) يصبح توزيعه [Ar] 3d⁵ وهو نصف ممتلئ شديد الاستقرار.',
  2,
  1
);

db.prepare(`
  INSERT INTO questions (exam_id, type, text, options, correct_answer, explanation, points, order_num)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  exam1Id,
  'true_false',
  'تتميز جميع عناصر السلسلة الانتقالية الأولى بامتلاكها حالة التأكسد (+2) ما عدا عنصر السكانديوم Sc الذي يمتلك حالة وحيدة هي (+3).',
  null,
  'true',
  'صحيح، لأن السكانديوم يفقد إلكتروني 4s وإلكترون 3d معاً ليعطي حالة تأكسد +3 للوصول إلى التركيب الثابت للغاز الخامل [Ar].',
  1,
  2
);

db.prepare(`
  INSERT INTO questions (exam_id, type, text, options, correct_answer, explanation, points, order_num)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  exam1Id,
  'fill_blank',
  'العنصر الانتقالي الوحيد في السلسلة الأولى الذي جميع مركباته ومحاليله غير ملونة ودايامغناطيسية هو عنصر الـ...',
  null,
  'سكانديوم',
  'عنصر السكانديوم Sc في حالة التأكسد +3 يخلو مداره 3d تماماً من الإلكترونات (3d⁰)، وبالتالي مركباته عديمة اللون ودايامغناطيسية.',
  2,
  3
);

db.prepare(`
  INSERT INTO questions (exam_id, type, text, options, correct_answer, explanation, points, order_num)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  exam1Id,
  'multi_select',
  'اختر من بين الآتي العناصر التي تشذ في توزيعها الإلكتروني عن التوزيع المتوقع:',
  JSON.stringify([
    { id: 'opt1', text: 'الكروم Cr (العدد الذري 24)' },
    { id: 'opt2', text: 'النحاس Cu (العدد الذري 29)' },
    { id: 'opt3', text: 'الحديد Fe (العدد الذري 26)' },
    { id: 'opt4', text: 'التيتانيوم Ti (العدد الذري 22)' }
  ]),
  JSON.stringify(['opt1', 'opt2']),
  'يشذ الكروم (4s¹ 3d⁵) لتكون أوربيتالات d نصف ممتلئة، والنحاس (4s¹ 3d¹⁰) لتكون أوربيتالات d تامة الامتلاء.',
  2,
  4
);

// 8. Create Activation Code
db.prepare(`
  INSERT INTO activation_codes (code, course_id, type, max_uses, used_count, is_active, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run('CHEM2025', course1Id, 'universal', 500, 0, 1, teacherId);

db.prepare(`
  INSERT INTO activation_codes (code, course_id, type, max_uses, used_count, is_active, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run('ZRA-VIP1', course1Id, 'individual', 1, 0, 1, teacherId);

// 9. Enroll Student 2 and give exam attempt for Leaderboard
db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)').run(student2Id, course1Id);
db.prepare(`
  INSERT INTO exam_attempts (exam_id, user_id, answers, score, total_points, time_spent, completed_at)
  VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`).run(exam1Id, student2Id, JSON.stringify({ 1: 'opt1', 2: 'true', 3: 'سكانديوم', 4: ['opt1', 'opt2'] }), 100, 7, 340);

// 10. Live session
db.prepare(`
  INSERT INTO live_sessions (title, course_id, description, scheduled_at, duration_minutes, meeting_link, status)
  VALUES (?, ?, ?, datetime('now', '+1 day'), ?, ?, ?)
`).run(
  'بث مباشر: مراجعة ليلة الامتحان وحل مسائل الكيمياء الصعبة',
  course1Id,
  'حصة تفاعلية مباشرة مع د. زياد رمزي عياد لمراجعة تكات الباب الأول والإجابة على استفسارات الطلاب.',
  75,
  'https://meet.google.com/demo-chem-zra',
  'upcoming'
);

// 11. Forum discussion
const discRes = db.prepare(`
  INSERT INTO course_discussions (course_id, lesson_id, user_id, content)
  VALUES (?, ?, ?, ?)
`).run(
  course1Id,
  lesson1Id,
  student2Id,
  'يا دكتور هو ليه أقصى حالة تأكسد لأي عنصر انتقالي في السلسلة الأولى لا تتعدى رقم مجموعته، ما عدا عناصر المجموعة 1B؟'
);
const discId = discRes.lastInsertRowid;

db.prepare(`
  INSERT INTO discussion_replies (discussion_id, user_id, content)
  VALUES (?, ?, ?)
`).run(
  discId,
  teacherId,
  'سؤال ممتاز يا مريم! لأن عناصر العملة (1B) مثل النحاس والذهب يمكن أن تفقد إلكترونات من المستوى d الداخلي وتعطي حالات تأكسد +2 و +3 فتتعدى رقم مجموعتها.'
);

// 12. Notifications
db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (NULL, 'مرحباً بالعام الدراسي الجديد!', 'كل سنة وأنتم طيبين - منصة كيمياوي مع د. زياد رمزي عياد جاهزة ليكم!', 'success')").run();
db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'كود اشتراك تجريبي جاهز', 'استخدم كود CHEM2025 لتفعيل كورس الباب الأول مجاناً للتجربة!', 'info')").run(studentId);

console.log('Database successfully seeded with realistic Chemistry course and exam data!');
console.log(`Teacher: 01000000000 / ${TEACHER_PLAIN}`);
console.log(`Student: 01111111111 / ${STUDENT_PLAIN} (Try code CHEM2025 in #/wallet)`);
