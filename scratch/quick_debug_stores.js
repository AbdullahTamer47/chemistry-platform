import db from '../server/db.js';
import { generateToken } from '../server/middleware/auth.js';

async function testStores() {
  const teacher = db.prepare("SELECT * FROM users WHERE role = 'teacher' LIMIT 1").get();
  const student = db.prepare("SELECT * FROM users WHERE role = 'student' LIMIT 1").get();
  const teacherToken = generateToken(teacher);
  const studentToken = generateToken(student);

  const res1 = await fetch('http://localhost:3000/api/packages/stores');
  const d1 = await res1.json();
  console.log('GET STORES:', res1.status, 'COUNT:', d1.stores?.length);

  const res2 = await fetch('http://localhost:3000/api/packages/stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({
      name: 'مكتبة تجريبية',
      address: 'شارع التجربة',
      governorate: 'الجيزة',
      phone: '01012345678',
      whatsapp: '01012345678'
    })
  });
  console.log('CREATE STORE:', res2.status, await res2.text());

  const store = d1.stores?.[0];
  if (store) {
    const resRate = await fetch(`http://localhost:3000/api/packages/stores/${store.id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ rating: 5 })
    });
    console.log('RATE STORE:', resRate.status, await resRate.text());
  }
}
testStores().catch(console.error);
