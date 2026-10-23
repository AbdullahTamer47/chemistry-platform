import db from '../server/db.js';

const teacher = db.prepare("SELECT id FROM users WHERE role IN ('teacher', 'admin') LIMIT 1").get();
const teacherId = teacher ? teacher.id : 1;

// Update Course 8
db.prepare("UPDATE courses SET course_type = 'monthly', duration_days = 30, original_price = 200, badge_text = 'الأكثر طلباً 🔥' WHERE id = 8").run();

// Check if 3-month package course exists
let p3 = db.prepare("SELECT id FROM courses WHERE course_type = 'quarterly'").get();
if (!p3) {
  const res = db.prepare("INSERT INTO courses (title, description, grade, price, original_price, duration_days, course_type, badge_text, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run('باقة الـ 3 شهور الشاملة: الباب الأول والثاني والكيمياء العضوية', 'تشمل جميع محاضرات الباب الأول والباب الثاني والتأسيس الشامل للكيمياء العضوية مع حل امتحانات الثانوية العامة السابقة وتطبيقات المذكرات PDF.', 'ثالثة ثانوي', 350, 500, 90, 'quarterly', 'وفر 150 ج (30%) 🌟', teacherId);
  const ch = db.prepare("INSERT INTO chapters (course_id, title, order_num) VALUES (?, ?, ?)").run(res.lastInsertRowid, 'المحاضرات التأسيسية للباقة', 1);
  db.prepare("INSERT INTO lessons (chapter_id, course_id, title, video_url, duration, is_free) VALUES (?, ?, ?, ?, ?, ?)").run(ch.lastInsertRowid, res.lastInsertRowid, 'المحاضرة الشاملة: أسرار التوزيع الإلكتروني والخواص المغناطيسية', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 45, 1);
}

// Check if term package course exists
let pTerm = db.prepare("SELECT id FROM courses WHERE course_type = 'term'").get();
if (!pTerm) {
  const res = db.prepare("INSERT INTO courses (title, description, grade, price, original_price, duration_days, course_type, badge_text, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run('باقة الفصل الدراسي الأول المكثفة (شاملة المراجعات والامتحانات الوزارية)', 'تغطية شاملة لكل دروس الترم الأول، حل تدريبات كتاب الواجب، وورش عمل حل أسئلة الربط والمستويات العليا.', 'ثالثة ثانوي', 450, 650, 120, 'term', 'باقة الترم الكامل 📚', teacherId);
  const ch = db.prepare("INSERT INTO chapters (course_id, title, order_num) VALUES (?, ?, ?)").run(res.lastInsertRowid, 'مراجعات الفصل الأول', 1);
  db.prepare("INSERT INTO lessons (chapter_id, course_id, title, video_url, duration, is_free) VALUES (?, ?, ?, ?, ?, ?)").run(ch.lastInsertRowid, res.lastInsertRowid, 'محاضرة مراجعة ليلة الامتحان على الاتزان الكيميائي', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 60, 1);
}

console.log('Courses in DB:', db.prepare("SELECT id, title, course_type, duration_days, price, original_price, badge_text FROM courses").all());
