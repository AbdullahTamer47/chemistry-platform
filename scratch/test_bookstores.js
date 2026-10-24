import app from '../server/app.js';
import db from '../server/db.js';
import { generateToken } from '../server/middleware/auth.js';

const server = app.listen(3333, async () => {
  try {
    console.log('Testing Bookstore Endpoints & Role Management on port 3333...');

    // 1. Get teacher and student tokens
    const teacher = db.prepare("SELECT id, role, phone, name, grade FROM users WHERE role = 'teacher'").get();
    const student = db.prepare("SELECT id, role, phone, name, grade FROM users WHERE role = 'student'").get();

    const teacherToken = generateToken(teacher);
    const studentToken = generateToken(student);

    // Test 1: Fetch all stores
    const storesRes = await fetch('http://localhost:3333/api/packages/stores/all');
    if (!storesRes.ok) throw new Error('Fetch stores failed');
    const storesData = await storesRes.json();
    console.log(`✅ PASS: Fetched ${storesData.stores.length} bookstores, ${storesData.governorates.length} governorates`);

    // Test 2: Teacher create store
    const createRes = await fetch('http://localhost:3333/api/packages/stores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        name: 'مكتبة الاختبار المعملية',
        governorate: 'القاهرة',
        address: 'شارع المعز، القاهرة',
        phone: '01099998888',
        whatsapp: '01099998888'
      })
    });
    if (!createRes.ok) throw new Error('Teacher create store failed: ' + (await createRes.text()));
    const createData = await createRes.json();
    const newStoreId = createData.store_id;
    console.log(`✅ PASS: Teacher created store ID ${newStoreId}`);

    // Test 3: Student rate store
    const rateRes = await fetch(`http://localhost:3333/api/packages/stores/${newStoreId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ rating: 5 })
    });
    if (!rateRes.ok) throw new Error('Student rate store failed: ' + (await rateRes.text()));
    console.log('✅ PASS: Student rated bookstore 5 stars');

    // Test 4: Teacher update store
    const updateRes = await fetch(`http://localhost:3333/api/packages/stores/${newStoreId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        address: 'شارع المعز المحدث، القاهرة'
      })
    });
    if (!updateRes.ok) throw new Error('Teacher update store failed');
    console.log('✅ PASS: Teacher updated bookstore address');

    // Test 5: Student cannot delete store (403 forbidden)
    const studentDeleteRes = await fetch(`http://localhost:3333/api/packages/stores/${newStoreId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${studentToken}`
      }
    });
    if (studentDeleteRes.status === 403) {
      console.log('✅ PASS: Student deletion blocked with HTTP 403 Forbidden');
    } else {
      throw new Error('Student was able to delete store! Expected 403, got ' + studentDeleteRes.status);
    }

    // Test 6: Teacher delete store
    const deleteRes = await fetch(`http://localhost:3333/api/packages/stores/${newStoreId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${teacherToken}`
      }
    });
    if (!deleteRes.ok) throw new Error('Teacher delete store failed');
    console.log('✅ PASS: Teacher successfully deleted bookstore');

    console.log('\n🎉 ALL 6 BOOKSTORE ENDPOINT & ROLE TESTS PASSED!\n');
    server.close();
  } catch (err) {
    console.error('Test failed:', err);
    server.close();
    process.exit(1);
  }
});
