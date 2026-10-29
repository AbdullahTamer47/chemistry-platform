import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, teacherMiddleware } from '../middleware/auth.js';

const router = Router();

const METHODS = ['vodafone_cash', 'instapay', 'fawry'];
const PHONE_RE = /^01[0125][0-9]{8}$/;
const MAX_RECEIPT_BYTES = 3 * 1024 * 1024; // ~3MB base64 payload

// Public payment config (receiving accounts + Paymob status) — read from dynamic platform_settings
router.get('/config', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM platform_settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    const paymobConfigured = !!(settings.paymob_api_key || process.env.PAYMOB_API_KEY) && settings.paymob_enabled === '1';
    res.json({
      vodafone_cash: settings.vodafone_cash || process.env.PAY_VODAFONE_NUMBER || '',
      instapay: settings.instapay || process.env.PAY_INSTAPAY_HANDLE || '',
      fawry_merchant: settings.fawry_merchant || process.env.PAY_FAWRY_MERCHANT || '',
      whatsapp: settings.whatsapp || process.env.SUPPORT_WHATSAPP || '',
      paymob_enabled: settings.paymob_enabled === '1',
      paymob_configured: paymobConfigured,
      paymob_iframe_id: settings.paymob_iframe_id || process.env.PAYMOB_IFRAME_ID || '',
      paymob_integration_id_card: settings.paymob_integration_id_card || process.env.PAYMOB_INTEGRATION_ID_CARD || '',
      paymob_integration_id_wallet: settings.paymob_integration_id_wallet || process.env.PAYMOB_INTEGRATION_ID_WALLET || '',
    });
  } catch (err) {
    res.json({
      vodafone_cash: process.env.PAY_VODAFONE_NUMBER || '',
      instapay: process.env.PAY_INSTAPAY_HANDLE || '',
      fawry_merchant: process.env.PAY_FAWRY_MERCHANT || '',
      whatsapp: process.env.SUPPORT_WHATSAPP || '',
      paymob_enabled: false,
      paymob_configured: false,
    });
  }
});

// Teacher: update payment config / numbers & Paymob keys
router.put('/config', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const {
      vodafone_cash, instapay, fawry_merchant, whatsapp,
      paymob_enabled, paymob_api_key, paymob_iframe_id,
      paymob_integration_id_card, paymob_integration_id_wallet
    } = req.body;
    const upsert = db.prepare(`
      INSERT INTO platform_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    const tx = db.transaction(() => {
      if (vodafone_cash !== undefined) upsert.run('vodafone_cash', String(vodafone_cash).trim());
      if (instapay !== undefined) upsert.run('instapay', String(instapay).trim());
      if (fawry_merchant !== undefined) upsert.run('fawry_merchant', String(fawry_merchant).trim());
      if (whatsapp !== undefined) upsert.run('whatsapp', String(whatsapp).trim());
      if (paymob_enabled !== undefined) upsert.run('paymob_enabled', paymob_enabled ? '1' : '0');
      if (paymob_api_key !== undefined && String(paymob_api_key).trim() !== '') {
        upsert.run('paymob_api_key', String(paymob_api_key).trim());
      }
      if (paymob_iframe_id !== undefined) upsert.run('paymob_iframe_id', String(paymob_iframe_id).trim());
      if (paymob_integration_id_card !== undefined) upsert.run('paymob_integration_id_card', String(paymob_integration_id_card).trim());
      if (paymob_integration_id_wallet !== undefined) upsert.run('paymob_integration_id_wallet', String(paymob_integration_id_wallet).trim());
    });
    tx();
    res.json({ message: 'تم حفظ وتحديث بيانات وبوابات الدفع بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث بيانات الدفع' });
  }
});

// Student: submit a payment request (Receipt is MANDATORY, transaction_ref is OPTIONAL)
router.post('/', authMiddleware, (req, res) => {
  try {
    const { course_id, method, sender_phone, transaction_ref, receipt_image } = req.body;
    if (!course_id) return res.status(400).json({ error: 'يرجى اختيار الكورس' });
    if (!METHODS.includes(method)) return res.status(400).json({ error: 'طريقة الدفع غير صحيحة' });

    // Receipt image is mandatory for teacher verification!
    if (!receipt_image) {
      return res.status(400).json({ error: 'يجب إرفاق صورة إيصال أو لقطة شاشة التحويل لإتمام الطلب' });
    }
    if (typeof receipt_image !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/.test(receipt_image)) {
      return res.status(400).json({ error: 'صيغة صورة الإيصال غير مدعومة (PNG / JPEG / WebP)' });
    }
    if (receipt_image.length > MAX_RECEIPT_BYTES) {
      return res.status(400).json({ error: 'حجم صورة الإيصال كبير جداً (الحد الأقصى 3 ميجا)' });
    }

    const course = db.prepare('SELECT id, title, price, is_free FROM courses WHERE id = ?').get(course_id);
    if (!course) return res.status(404).json({ error: 'الكورس غير موجود' });
    if (course.is_free || !(Number(course.price) > 0)) {
      return res.status(400).json({ error: 'هذا الكورس مجاني ولا يحتاج إلى دفع' });
    }

    const phone = String(sender_phone || '').replace(/\s|-/g, '');
    if (method !== 'fawry' && !PHONE_RE.test(phone)) {
      return res.status(400).json({ error: 'رقم الهاتف المحوَّل منه غير صحيح (11 رقم يبدأ بـ 01)' });
    }
    const ref = String(transaction_ref || '').trim();
    if (ref.length > 40) {
      return res.status(400).json({ error: 'رقم العملية طويل جداً' });
    }

    const enrolled = db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, course_id);
    if (enrolled) return res.status(400).json({ error: 'أنت مشترك بالفعل في هذا الكورس' });

    const pending = db.prepare("SELECT id FROM payment_requests WHERE user_id = ? AND course_id = ? AND status = 'pending'").get(req.user.id, course_id);
    if (pending) return res.status(400).json({ error: 'لديك طلب دفع قيد المراجعة لهذا الكورس بالفعل' });

    if (ref) {
      const dupRef = db.prepare("SELECT id FROM payment_requests WHERE transaction_ref = ? AND method = ? AND status != 'rejected'").get(ref, method);
      if (dupRef) return res.status(400).json({ error: 'رقم العملية هذا مستخدم من قبل' });
    }

    const result = db.prepare(`
      INSERT INTO payment_requests (user_id, course_id, method, amount, sender_phone, transaction_ref, receipt_image)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, course_id, method, course.price, phone || null, ref || null, receipt_image);

    res.status(201).json({ id: result.lastInsertRowid, message: 'تم إرسال طلب الدفع مع صورة الإيصال بنجاح، سيتم تفعيل الكورس فور مراجعة التحويل' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء إرسال طلب الدفع' });
  }
});

// Student: my payment requests
router.get('/my', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.id, p.course_id, p.method, p.amount, p.transaction_ref, p.status, p.admin_note, p.created_at, p.reviewed_at, c.title as course_title
      FROM payment_requests p LEFT JOIN courses c ON c.id = p.course_id
      WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 50
    `).all(req.user.id);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Teacher: list requests
router.get('/', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
    const rows = db.prepare(`
      SELECT p.*, u.name as student_name, u.phone as student_phone, c.title as course_title
      FROM payment_requests p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN courses c ON c.id = p.course_id
      ${status ? 'WHERE p.status = ?' : ''}
      ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END, p.created_at DESC
      LIMIT 200
    `).all(...(status ? [status] : []));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Teacher: approve / reject
router.put('/:id', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const { status, admin_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'حالة غير صحيحة' });
    const p = db.prepare('SELECT * FROM payment_requests WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (p.status !== 'pending') return res.status(400).json({ error: 'تمت مراجعة هذا الطلب مسبقاً' });

    const tx = db.transaction(() => {
      db.prepare('UPDATE payment_requests SET status = ?, admin_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, admin_note || null, p.id);
      
      const course = db.prepare('SELECT title FROM courses WHERE id = ?').get(p.course_id);
      const courseTitle = course ? course.title : 'الكورس';

      if (status === 'approved') {
        let expiresAt = null;
        if (req.body.duration_days && Number(req.body.duration_days) > 0) {
          const d = new Date();
          d.setDate(d.getDate() + Number(req.body.duration_days));
          expiresAt = d.toISOString();
        }
        const exists = db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(p.user_id, p.course_id);
        if (!exists) {
          db.prepare('INSERT INTO enrollments (user_id, course_id, payment_id, expires_at) VALUES (?, ?, ?, ?)').run(p.user_id, p.course_id, p.id, expiresAt);
        } else if (expiresAt) {
          db.prepare('UPDATE enrollments SET expires_at = ? WHERE id = ?').run(expiresAt, exists.id);
        }

        db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
          p.user_id,
          'تم تأكيد الدفع وتفعيل الكورس',
          `تم قبول طلب الدفع بنجاح وتفعيل اشتراكك في "${courseTitle}". يمكنك الآن مشاهدة جميع الدروس وحل الامتحانات!`,
          'success'
        );
      } else {
        db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
          p.user_id,
          'تحديث بخصوص طلب الدفع',
          `تم رفض طلب الدفع لكورس "${courseTitle}". ${admin_note ? `السبب: ${admin_note}` : 'يرجى مراجعة رقم العملية وصورة الإيصال والتواصل مع إدارة المنصة.'}`,
          'warning'
        );
      }
    });
    tx();
    res.json({ message: status === 'approved' ? 'تم قبول الدفع وتفعيل الكورس للطالب وإرسال الإشعار' : 'تم رفض الطلب وإشعار الطالب' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// ==========================================
// PILLAR 1: AUTOMATED WALLET & INSTANT FAWRY
// ==========================================

// Student: get wallet balance and recent transactions
router.get('/wallet/balance', authMiddleware, (req, res) => {
  try {
    let wallet = db.prepare('SELECT balance FROM student_wallets WHERE user_id = ?').get(req.user.id);
    if (!wallet) {
      db.prepare('INSERT INTO student_wallets (user_id, balance) VALUES (?, 0)').run(req.user.id);
      wallet = { balance: 0 };
    }
    const transactions = db.prepare(`
      SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
    `).all(req.user.id);

    const activeFawryOrder = db.prepare(`
      SELECT * FROM fawry_orders
      WHERE user_id = ? AND status = 'pending' AND datetime(expires_at) > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(req.user.id);

    res.json({
      balance: wallet.balance,
      transactions,
      active_fawry_order: activeFawryOrder || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات المحفظة' });
  }
});

// Student: Generate instant Fawry reference code (16 characters, valid 24 hours)
router.post('/fawry/generate', authMiddleware, (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 10 || amount > 5000) {
      return res.status(400).json({ error: 'يرجى إدخال مبلغ شحن صحيح بين 10 و 5000 جنيه' });
    }

    // Check if there is already an active pending order
    const existing = db.prepare(`
      SELECT * FROM fawry_orders
      WHERE user_id = ? AND status = 'pending' AND datetime(expires_at) > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(req.user.id);

    if (existing && existing.amount === amount) {
      return res.json({
        message: 'لديك كود دفع فوري نشط بالفعل لهذا المبلغ',
        order: existing
      });
    }

    // Generate unique 16-character alphanumeric reference code (matching Shake-Out / Bassthalk format e.g. 9824 + 12 chars)
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let randomPart = '';
    for (let i = 0; i < 12; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const reference_code = `9824${randomPart}`;

    // Expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const insert = db.prepare(`
      INSERT INTO fawry_orders (user_id, amount, reference_code, status, expires_at)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(req.user.id, amount, reference_code, expiresAt);

    const fawryMerchant = db.prepare("SELECT value FROM platform_settings WHERE key = 'fawry_merchant'").get()?.value || '788';

    const order = {
      id: insert.lastInsertRowid,
      amount,
      service_fee: 5.0,
      total_amount: amount + 5.0,
      reference_code,
      status: 'pending',
      expires_at: expiresAt,
      service_code: fawryMerchant
    };

    res.status(201).json({
      message: 'تم توليد رقم فوري المرجعي بنجاح! توجه لأي ماكينة فوري وسدد قبل انتهاء الوقت.',
      order
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في توليد كود فوري' });
  }
});


// Student: Recharge wallet using 14-digit prepaid scratch card / voucher
router.post('/wallet/charge-voucher', authMiddleware, (req, res) => {
  try {
    const code = String(req.body.voucher_code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'يرجى إدخال كود كارت الشحن' });

    const voucher = db.prepare('SELECT * FROM wallet_vouchers WHERE code = ?').get(code);
    if (!voucher) return res.status(404).json({ error: 'كود كارت الشحن غير صحيح أو غير مسجل' });
    if (voucher.is_used) {
      return res.status(400).json({ error: 'هذا الكارت تم استخدامه وشحنه مسبقاً' });
    }

    const tx = db.transaction(() => {
      // 1. Mark voucher as used atomically
      const upd = db.prepare(`
        UPDATE wallet_vouchers SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ? AND is_used = 0
      `).run(req.user.id, voucher.id);
      if (upd.changes === 0) {
        throw new Error('هذا الكارت تم استخدامه وشحنه مسبقاً');
      }

      // 2. Add to wallet
      db.prepare(`
        INSERT INTO student_wallets (user_id, balance) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = CURRENT_TIMESTAMP
      `).run(req.user.id, voucher.amount);

      // 3. Log transaction
      db.prepare(`
        INSERT INTO wallet_transactions (user_id, amount, type, description, reference_code)
        VALUES (?, ?, 'credit', ?, ?)
      `).run(req.user.id, voucher.amount, `شحن كارت سنتر / مذكرات (كود: ${voucher.code})`, voucher.code);

      // 4. Send notification
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, 'success')
      `).run(
        req.user.id,
        'تم شحن كارت السنتر بنجاح',
        `تم شحن رصيد قدره ${voucher.amount} ج.م في محفظتك باستخدام كارت السنتر المعتمد.`
      );
    });

    tx();

    const newBalance = db.prepare('SELECT balance FROM student_wallets WHERE user_id = ?').get(req.user.id).balance;

    res.json({
      message: `تم شحن الكارت بنجاح وإضافة ${voucher.amount} ج.م إلى رصيدك!`,
      amount_added: voucher.amount,
      new_balance: newBalance
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في شحن الكارت' });
  }
});

// Teacher: List and generate wallet vouchers
router.get('/vouchers', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT v.*, u.name as used_by_name, u.phone as used_by_phone
      FROM wallet_vouchers v
      LEFT JOIN users u ON u.id = v.used_by
      ORDER BY v.created_at DESC LIMIT 100
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

router.post('/vouchers/generate', authMiddleware, teacherMiddleware, (req, res) => {
  try {
    const count = Math.min(Math.max(Number(req.body.count) || 1, 1), 50);
    const amount = Number(req.body.amount) || 50;
    const prefix = String(req.body.prefix || 'KEM').toUpperCase().trim();

    const generated = [];
    const insert = db.prepare('INSERT INTO wallet_vouchers (code, amount) VALUES (?, ?)');

    const tx = db.transaction(() => {
      for (let i = 0; i < count; i++) {
        const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
        const code = `${prefix}-${amount}-${rand}`;
        insert.run(code, amount);
        generated.push({ code, amount });
      }
    });

    tx();
    res.status(201).json({ message: `تم توليد ${count} كارت شحن برصيد ${amount} ج.م بنجاح`, vouchers: generated });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في توليد الكروت' });
  }
});

// ==========================================
// PAYMOB ELECTRONIC PAYMENT GATEWAY ARCHITECTURE
// ==========================================
router.post('/paymob/checkout', authMiddleware, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const paymentType = req.body.payment_type || 'card'; // 'card' | 'wallet'
    const walletPhone = String(req.body.wallet_phone || req.user.phone || '').replace(/\D/g, '');

    if (!amount || amount < 10 || amount > 10000) {
      return res.status(400).json({ error: 'يرجى تحديد مبلغ شحن صحيح بين 10 و 10000 جنيه' });
    }

    const rows = db.prepare('SELECT key, value FROM platform_settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    const apiKey = settings.paymob_api_key || process.env.PAYMOB_API_KEY || '';
    const isEnabled = settings.paymob_enabled === '1' && !!apiKey;

    if (!isEnabled) {
      return res.status(400).json({
        configured: false,
        error: 'بوابة الدفع الإلكتروني الآلي (Paymob) غير مفعلة حالياً من قِبل الإدارة. يمكنك الدفع الآن عبر فودافون كاش / إنستاباي أو شحن كارت السنتر.'
      });
    }

    const integrationId = paymentType === 'wallet'
      ? (settings.paymob_integration_id_wallet || process.env.PAYMOB_INTEGRATION_ID_WALLET)
      : (settings.paymob_integration_id_card || process.env.PAYMOB_INTEGRATION_ID_CARD);

    if (!integrationId) {
      return res.status(400).json({ error: 'معرف التكامل (Integration ID) الخاص ببوابة Paymob غير مضبوط في إعدادات المعلم.' });
    }

    // 1. Authenticate with Paymob API
    const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey })
    });
    const authData = await authRes.json();
    if (!authData.token) {
      return res.status(502).json({ error: 'تعذر الاتصال ببوابة Paymob — تحقق من صحة مفتاح API Key' });
    }

    // 2. Register Order on Paymob
    const merchantOrderId = `KIM-${req.user.id}-${Date.now()}`;
    const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authData.token,
        delivery_needed: 'false',
        amount_cents: Math.round(amount * 100),
        currency: 'EGP',
        merchant_order_id: merchantOrderId,
        items: [{
          name: `شحن محفظة منصة كيمياوي - ${req.user.name}`,
          amount_cents: Math.round(amount * 100),
          description: `شحن رصيد لطالب ${req.user.phone}`,
          quantity: 1
        }]
      })
    });
    const orderData = await orderRes.json();
    if (!orderData.id) {
      return res.status(502).json({ error: 'تعذر تسجيل الطلب في بوابة Paymob' });
    }

    // 3. Request Payment Key
    const nameParts = String(req.user.name || 'Student Kimyawy').trim().split(/\s+/);
    const pKeyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authData.token,
        amount_cents: Math.round(amount * 100),
        expiration: 3600,
        order_id: orderData.id,
        billing_data: {
          apartment: 'NA',
          email: `${req.user.phone}@kimyawy.edu.eg`,
          floor: 'NA',
          first_name: nameParts[0] || 'Student',
          street: 'NA',
          building: 'NA',
          phone_number: walletPhone || req.user.phone || '01000000000',
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'Cairo',
          country: 'EG',
          last_name: nameParts.slice(1).join(' ') || 'Kimyawy',
          state: 'Cairo'
        },
        currency: 'EGP',
        integration_id: Number(integrationId)
      })
    });
    const pKeyData = await pKeyRes.json();
    if (!pKeyData.token) {
      return res.status(502).json({ error: 'تعذر استخراج مفتاح الدفع من Paymob' });
    }

    const iframeId = settings.paymob_iframe_id || process.env.PAYMOB_IFRAME_ID || '';
    res.json({
      configured: true,
      order_id: orderData.id,
      merchant_order_id: merchantOrderId,
      payment_key: pKeyData.token,
      iframe_url: iframeId ? `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${pKeyData.token}` : null
    });
  } catch (err) {
    console.error('Paymob checkout error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء الاتصال ببوابة الدفع الإلكتروني Paymob' });
  }
});

export default router;
