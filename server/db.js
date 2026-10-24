import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data.db');

let db;
const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

if (!isVercel) {
  try {
    const { default: Database } = await import('better-sqlite3');
    db = new Database(dbPath);
    try {
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
    } catch (e) {}
  } catch (err) {
    console.warn('[DB] better-sqlite3 unavailable, using WebAssembly engine:', err.message);
  }
}

if (!db) {
  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs();
  let buffer = null;
  const candidatePaths = [
    '/tmp/data.db',
    path.join(process.cwd(), 'data.db'),
    dbPath,
    path.join(__dirname, 'data.db'),
    path.join(__dirname, '..', 'data.db')
  ];
  for (const cp of candidatePaths) {
    if (fs.existsSync(cp)) {
      try {
        const candidateBuf = fs.readFileSync(cp);
        if (candidateBuf && candidateBuf.length > 0) {
          buffer = candidateBuf;
          break;
        }
      } catch (e) {}
    }
  }
  const rawDb = buffer ? new SQL.Database(buffer) : new SQL.Database();

  db = {
    prepare(sql) {
      return {
        all(...params) {
          const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
          const stmt = rawDb.prepare(sql);
          try {
            if (args.length > 0) stmt.bind(args);
            const list = [];
            while (stmt.step()) {
              list.push(stmt.getAsObject());
            }
            return list;
          } finally {
            stmt.free();
          }
        },
        get(...params) {
          const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
          const stmt = rawDb.prepare(sql);
          try {
            if (args.length > 0) stmt.bind(args);
            if (stmt.step()) {
              return stmt.getAsObject();
            }
            return undefined;
          } finally {
            stmt.free();
          }
        },
        run(...params) {
          const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
          if (args.length > 0) {
            rawDb.run(sql, args);
          } else {
            rawDb.run(sql);
          }
          const lastRowIdRes = rawDb.exec("SELECT last_insert_rowid() as id");
          const lastInsertRowid = lastRowIdRes[0]?.values[0][0] ?? 0;
          const changesRes = rawDb.exec("SELECT changes() as c");
          const changes = changesRes[0]?.values[0][0] ?? 0;
          if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
            try {
              fs.writeFileSync('/tmp/data.db', Buffer.from(rawDb.export()));
            } catch (e) {}
          }
          return { changes, lastInsertRowid };
        }
      };
    },
    exec(sql) {
      return rawDb.exec(sql);
    },
    pragma(sql) {
      try { return rawDb.exec(`PRAGMA ${sql}`); } catch (e) {}
    },
    transaction(fn) {
      return function(...args) {
        rawDb.exec('BEGIN TRANSACTION');
        try {
          const res = fn(...args);
          rawDb.exec('COMMIT');
          return res;
        } catch (err) {
          try { rawDb.exec('ROLLBACK'); } catch (e) {}
          throw err;
        }
      };
    }
  };
}

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'student' CHECK(role IN ('student', 'teacher', 'admin')),
    grade TEXT NOT NULL,
    parent_phone TEXT DEFAULT '',
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    grade TEXT NOT NULL,
    price REAL DEFAULT 0,
    thumbnail TEXT,
    is_free INTEGER DEFAULT 0,
    teacher_id INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_num INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    duration INTEGER DEFAULT 0,
    order_num INTEGER DEFAULT 0,
    is_free INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 30,
    max_attempts INTEGER DEFAULT 1,
    passing_score INTEGER DEFAULT 60,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('mcq', 'true_false', 'fill_blank', 'ordering', 'multi_select')),
    text TEXT NOT NULL,
    image_url TEXT,
    options TEXT,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    points INTEGER DEFAULT 1,
    order_num INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS exam_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    answers TEXT,
    score REAL DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    time_spent INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS activation_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'universal' CHECK(type IN ('universal', 'individual')),
    assigned_to INTEGER REFERENCES users(id),
    max_uses INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS code_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_id INTEGER REFERENCES activation_codes(id),
    user_id INTEGER REFERENCES users(id),
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS live_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    course_id INTEGER REFERENCES courses(id),
    description TEXT,
    scheduled_at DATETIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    meeting_link TEXT,
    status TEXT DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'live', 'completed', 'cancelled')),
    replay_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lesson_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    completed INTEGER DEFAULT 0,
    watch_time INTEGER DEFAULT 0,
    completed_at DATETIME,
    UNIQUE(user_id, lesson_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS video_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    lesson_id INTEGER REFERENCES lessons(id),
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Alter existing tables safely — add missing columns
const migrations = [
  "ALTER TABLE courses ADD COLUMN allow_student_replies INTEGER DEFAULT 0;",
  "ALTER TABLE courses ADD COLUMN sequential_access INTEGER DEFAULT 0;",
  "ALTER TABLE enrollments ADD COLUMN is_suspended INTEGER DEFAULT 0;",
  "ALTER TABLE enrollments ADD COLUMN code_id INTEGER;",
  "ALTER TABLE lessons ADD COLUMN max_views INTEGER DEFAULT 8;",
  "ALTER TABLE lesson_progress ADD COLUMN views_count INTEGER DEFAULT 0;",
  "ALTER TABLE lesson_progress ADD COLUMN extra_views INTEGER DEFAULT 0;",
  "ALTER TABLE exams ADD COLUMN chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE;",
  "ALTER TABLE exams ADD COLUMN order_num INTEGER DEFAULT 0;",
  "ALTER TABLE exams ADD COLUMN random_questions_count INTEGER DEFAULT 0;",
  "ALTER TABLE activation_codes ADD COLUMN expires_at DATETIME;",
];

for (const query of migrations) {
  try { db.exec(query); } catch (e) { /* ignore if column already exists */ }
}

// Create new tables for phase 2
db.exec(`
  CREATE TABLE IF NOT EXISTS course_discussions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS discussion_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discussion_id INTEGER REFERENCES course_discussions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exam_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    extra_attempts INTEGER DEFAULT 0,
    UNIQUE(exam_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id)
  );

  CREATE TABLE IF NOT EXISTS student_wallets (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    reference_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Upgrade questions table schema to support 'essay' type if needed
try {
  const qTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='questions'").get();
  if (qTable && !qTable.sql.includes("'essay'")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS questions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('mcq', 'true_false', 'fill_blank', 'ordering', 'multi_select', 'essay')),
        text TEXT NOT NULL,
        image_url TEXT,
        options TEXT,
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        points INTEGER DEFAULT 1,
        order_num INTEGER DEFAULT 0
      );
      INSERT INTO questions_new SELECT * FROM questions;
      DROP TABLE questions;
      ALTER TABLE questions_new RENAME TO questions;
    `);
  }
} catch (e) {
  console.log('Questions table already up to date or migrated');
}

// Safe column migrations
function addColumnIfMissing(table, column, def) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  } catch (e) { console.error(`Migration failed for ${table}.${column}`, e.message); }
}
addColumnIfMissing('enrollments', 'code_id', 'INTEGER');
addColumnIfMissing('enrollments', 'payment_id', 'INTEGER');

// Manual payment requests (Vodafone Cash / InstaPay / Fawry) reviewed by teacher
db.exec(`
  CREATE TABLE IF NOT EXISTS payment_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK(method IN ('vodafone_cash', 'instapay', 'fawry')),
    amount REAL NOT NULL,
    sender_phone TEXT,
    transaction_ref TEXT,
    receipt_image TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS exam_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_ids TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, exam_id)
  );
`);

// Add essay grading columns to exam_attempts
addColumnIfMissing('exam_attempts', 'essay_grades', 'TEXT');
addColumnIfMissing('exam_attempts', 'teacher_feedback', 'TEXT');
addColumnIfMissing('exam_attempts', 'is_graded', 'INTEGER DEFAULT 1');

// Wave A & Phase 1 migrations
addColumnIfMissing('lessons', 'pdf_url', 'TEXT');
addColumnIfMissing('exams', 'start_time', 'DATETIME');
addColumnIfMissing('exams', 'end_time', 'DATETIME');
addColumnIfMissing('enrollments', 'expires_at', 'DATETIME');
addColumnIfMissing('users', 'parent_phone_secondary', 'TEXT');
addColumnIfMissing('courses', 'course_type', "TEXT DEFAULT 'monthly'");
addColumnIfMissing('courses', 'duration_days', 'INTEGER DEFAULT 30');
addColumnIfMissing('courses', 'original_price', 'REAL DEFAULT 0');
addColumnIfMissing('courses', 'badge_text', 'TEXT');

// New tables for 5 pillars
db.exec(`
  CREATE TABLE IF NOT EXISTS fawry_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    reference_code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'expired', 'cancelled')),
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS wallet_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    amount REAL NOT NULL,
    is_used INTEGER DEFAULT 0,
    used_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS saved_lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, lesson_id)
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cert_code TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
    attempt_id INTEGER REFERENCES exam_attempts(id) ON DELETE CASCADE,
    score REAL NOT NULL,
    total_points REAL NOT NULL,
    percentage REAL NOT NULL,
    tier TEXT NOT NULL CHECK(tier IN ('gold', 'silver', 'bronze')),
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, exam_id)
  );

  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    grade TEXT NOT NULL,
    price REAL DEFAULT 0,
    original_price REAL DEFAULT 0,
    duration_days INTEGER DEFAULT 90,
    course_ids TEXT NOT NULL,
    thumbnail TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS package_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    package_id INTEGER REFERENCES packages(id) ON DELETE CASCADE,
    activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    UNIQUE(user_id, package_id)
  );

  CREATE TABLE IF NOT EXISTS bookstores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    governorate TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    rating REAL DEFAULT 4.9,
    reviews_count INTEGER DEFAULT 120,
    whatsapp TEXT,
    is_active INTEGER DEFAULT 1
  );
`);

// Seed default settings if empty
const seedSetting = (key, defaultVal) => {
  try {
    const exists = db.prepare('SELECT key FROM platform_settings WHERE key = ?').get(key);
    if (!exists) {
      db.prepare('INSERT INTO platform_settings (key, value) VALUES (?, ?)').run(key, defaultVal);
    }
  } catch (e) {}
};
seedSetting('vodafone_cash', process.env.PAY_VODAFONE_NUMBER || '01012345678');
seedSetting('instapay', process.env.PAY_INSTAPAY_HANDLE || 'ziad.ramzy@instapay');
seedSetting('fawry_merchant', process.env.PAY_FAWRY_MERCHANT || '788');
seedSetting('whatsapp', process.env.SUPPORT_WHATSAPP || '201012345678');

// Seed sample bookstores if empty
try {
  const storeCount = db.prepare('SELECT COUNT(*) as c FROM bookstores').get().c;
  if (storeCount === 0) {
    const insertStore = db.prepare(`INSERT INTO bookstores (name, governorate, address, phone, rating, reviews_count, whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const initialStores = [
      ['مكتبة الأوائل الفجالة', 'القاهرة', 'شارع كامل صدقي، الفجالة، الأزبكية', '01019882233', 4.9, 142, '201019882233'],
      ['سنتر ومكتبة الأهرام التعليمية', 'الجيزة', 'شارع مراد، ميدان الجيزة بجوار محطة المترو', '01123445566', 4.8, 98, '201123445566'],
      ['مكتبة الإسكندر الأكبر', 'الإسكندرية', 'شارع سوتر، أمام المجمع النظري، الشاطبي', '01234556677', 5.0, 210, '201234556677'],
      ['مكتبة النور للطباعة والنشر', 'الدقهلية', 'شارع جيهان، أمام بوابة جامعة المنصورة', '01098877665', 4.9, 115, '201098877665'],
      ['مكتبة الجمهورية والسنتر الحديث', 'الشرقية', 'ميدان القومية، الزقازيق', '01155667788', 4.7, 84, '201155667788'],
      ['مكتبة ابن سينا والمطبوعات', 'الغربية', 'شارع البحر، أمام محطة قطار طنطا', '01022334455', 4.8, 76, '201022334455'],
      ['مكتبة المستقبل والجامعة', 'أسيوط', 'شارع الجمهورية، أمام جامعة أسيوط القديمة', '01299887711', 4.9, 93, '201299887711']
    ];
    initialStores.forEach(s => insertStore.run(...s));
  }
} catch (e) { console.error('Seed stores error', e); }

// Seed default 3-month package if empty
try {
  const pkgCount = db.prepare('SELECT COUNT(*) as c FROM packages').get().c;
  if (pkgCount === 0) {
    const courses = db.prepare('SELECT id FROM courses ORDER BY id ASC LIMIT 3').all();
    const courseIds = courses.map(c => c.id);
    db.prepare(`
      INSERT INTO packages (title, description, grade, price, original_price, duration_days, course_ids, thumbnail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'باقة الـ 3 شهور الشاملة في الكيمياء (الفصل الأول والثاني والعضوية)',
      'الباقة الذهبية المخفضة للدكتور زياد رمزي عياد: تشمل محتوى 3 شهور كاملة من منهج الكيمياء (جميع محاضرات الشرح، التدريبات التفاعلية، حلول امتحانات الثانوية العامة السابقة، والواجبات والمذكرات PDF) ومتاحة طوال العام الدراسي حتى الامتحانات.',
      'ثالثة ثانوي',
      350,
      500,
      90,
      JSON.stringify(courseIds.length ? courseIds : [1, 2]),
      '/assets/dr-ziad-success.jpg'
    );
  }
} catch (e) { console.error('Seed package error', e); }

// Seed sample wallet vouchers if empty
try {
  const vCount = db.prepare('SELECT COUNT(*) as c FROM wallet_vouchers').get().c;
  if (vCount === 0) {
    const insertV = db.prepare('INSERT INTO wallet_vouchers (code, amount) VALUES (?, ?)');
    insertV.run('KEM-50-DEMO1', 50);
    insertV.run('KEM-100-DEMO2', 100);
    insertV.run('KEM-200-DEMO3', 200);
    insertV.run('KEM-350-PKG90', 350);
  }
} catch (e) { console.error('Seed vouchers error', e); }

export default db;
