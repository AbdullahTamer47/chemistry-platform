import http from 'http';
import db from '../server/db.js';
import { generateToken } from '../server/middleware/auth.js';

async function testWalletEnroll() {
  console.log('Testing Wallet Direct Course Purchase...');

  const student = db.prepare("SELECT * FROM users WHERE role = 'student' LIMIT 1").get();
  if (!student) throw new Error('No student found in DB');

  const token = generateToken(student);

  // Set student wallet balance to 500 for testing
  db.prepare(`
    INSERT INTO student_wallets (user_id, balance) VALUES (?, 500)
    ON CONFLICT(user_id) DO UPDATE SET balance = 500
  `).run(student.id);

  // Find a paid course
  const course = db.prepare('SELECT * FROM courses WHERE is_free = 0 AND price > 0 LIMIT 1').get();
  if (!course) throw new Error('No paid course found');

  // Make sure not enrolled initially
  db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?').run(student.id, course.id);

  // Start temporary test server
  const { default: app } = await import('../server/app.js');
  const server = app.listen(3334);

  try {
    // 1. Enroll with sufficient balance
    const res1 = await fetch(`http://127.0.0.1:3334/api/courses/${course.id}/enroll`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data1 = await res1.json();
    if (res1.status !== 200 || !data1.message.includes('بنجاح')) {
      throw new Error(`Enroll failed: ${JSON.stringify(data1)}`);
    }
    console.log('✅ PASS: Enrolled using wallet balance:', data1.message, `New Balance: ${data1.new_balance}`);

    // Verify enrollment in DB
    const enrolled = db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(student.id, course.id);
    if (!enrolled) throw new Error('Enrollment row not found in DB');
    console.log('✅ PASS: Enrollment confirmed in database.');

    // 2. Try enrolling again -> should fail with already enrolled
    const res2 = await fetch(`http://127.0.0.1:3334/api/courses/${course.id}/enroll`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data2 = await res2.json();
    if (res2.status !== 400 || !data2.error.includes('مشترك بالفعل')) {
      throw new Error(`Duplicate check failed: ${JSON.stringify(data2)}`);
    }
    console.log('✅ PASS: Blocked duplicate enrollment:', data2.error);

    // 3. Test insufficient balance on a second course
    db.prepare('UPDATE student_wallets SET balance = 5 WHERE user_id = ?').run(student.id);
    const course2 = db.prepare('SELECT * FROM courses WHERE is_free = 0 AND price > 10 AND id != ? LIMIT 1').get(course.id);
    if (course2) {
      db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?').run(student.id, course2.id);
      const res3 = await fetch(`http://127.0.0.1:3334/api/courses/${course2.id}/enroll`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data3 = await res3.json();
      if (res3.status !== 400 || !data3.error.includes('غير كافٍ')) {
        throw new Error(`Insufficient balance check failed: ${JSON.stringify(data3)}`);
      }
      console.log('✅ PASS: Blocked when balance insufficient:', data3.error);
    }

    console.log('🎉 ALL WALLET ENROLLMENT TESTS PASSED!');
  } finally {
    server.close();
  }
}

testWalletEnroll().catch(err => {
  console.error('❌ Test Error:', err);
  process.exit(1);
});
