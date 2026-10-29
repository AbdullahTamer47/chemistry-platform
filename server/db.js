import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');

const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const pgConnectionString = !process.env.DB_PATH
  ? (process.env.DATABASE_URL || process.env.POSTGRES_URL || '')
  : '';

let pgSql = null;
let loadedFromPg = false;
let localVersion = 0;
let lastPgCheckAt = 0;
let isDirty = false;
let isBootstrapping = true;

let initialPgBuffer = null;

if (pgConnectionString) {
  try {
    const { neon } = await import('@neondatabase/serverless');
    pgSql = neon(pgConnectionString);
    try {
      const rows = await pgSql.query('SELECT version, snapshot FROM kimyawy_pg_state WHERE id = 1');
      if (rows && rows.length > 0 && rows[0].snapshot) {
        initialPgBuffer = Buffer.from(rows[0].snapshot, 'base64');
        localVersion = Number(rows[0].version) || 1;
        loadedFromPg = true;
        lastPgCheckAt = Date.now();
      }
    } catch {
      // First-time setup: create tables if kimyawy_pg_state does not exist yet
      await Promise.all([
        pgSql.query(`
          CREATE TABLE IF NOT EXISTS kimyawy_pg_state (
            id INT PRIMARY KEY,
            version BIGINT NOT NULL DEFAULT 1,
            snapshot TEXT NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )
        `),
        pgSql.query(`
          CREATE TABLE IF NOT EXISTS pg_users (
            id INT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            grade TEXT,
            parent_phone TEXT,
            created_at TEXT
          )
        `),
        pgSql.query(`
          CREATE TABLE IF NOT EXISTS pg_courses (
            id INT PRIMARY KEY,
            title TEXT NOT NULL,
            grade TEXT NOT NULL,
            price REAL DEFAULT 0,
            is_free INT DEFAULT 0
          )
        `),
        pgSql.query(`
          CREATE TABLE IF NOT EXISTS pg_enrollments (
            id INT PRIMARY KEY,
            user_id INT NOT NULL,
            course_id INT NOT NULL,
            activated_at TEXT
          )
        `)
      ]);
    }
  } catch (err) {
    console.warn('[DB] PostgreSQL initialization warning, falling back to local engine:', err.message);
    pgSql = null;
  }
}

let db;

if (!isVercel && !pgSql) {
  try {
    const mod = 'better' + '-sqlite3';
    const { default: Database } = await import(/* @vite-ignore */ mod);
    db = new Database(dbPath);
    try {
      if (dbPath !== ':memory:') db.pragma('journal_mode = WAL');
      db.pragma('temp_store = MEMORY');
      db.pragma('foreign_keys = ON');
    } catch (e) {}
    db.ensureSynced = async () => {};
    db.flushToPostgres = async () => {};
    db.isDirty = () => false;
    db.isPostgresConnected = () => false;
  } catch (err) {
    console.warn('[DB] better-sqlite3 unavailable, using WebAssembly + PostgreSQL engine:', err.message);
  }
}

let rawDbRef = null;
let SQLRef = null;

if (!db) {
  try {
    const inlineModule = await import('sql.js/dist/sql-wasm-inline.js');
    const initSqlJs = inlineModule.default || inlineModule;
    SQLRef = await initSqlJs();
  } catch (e) {
    const { default: initSqlJs } = await import('sql.js');
    SQLRef = await initSqlJs();
  }

  let buffer = initialPgBuffer;

  // 2. Fallback to local file if PostgreSQL had no snapshot yet
  if (!buffer && dbPath !== ':memory:' && !pgSql) {
    const candidatePaths = [
      '/tmp/data.db',
      dbPath,
      path.join(process.cwd(), 'data.db'),
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
  }

  rawDbRef = buffer ? new SQLRef.Database(buffer) : new SQLRef.Database();
  try { rawDbRef.exec('PRAGMA foreign_keys = ON'); } catch (e) {}
  let txDepth = 0;

  const persistLocalIfNeeded = () => {
    if (isBootstrapping || txDepth > 0) return;
    isDirty = true;
    if (isVercel) {
      try {
        fs.writeFileSync('/tmp/data.db', Buffer.from(rawDbRef.export()));
      } catch (e) {}
    } else if (dbPath && dbPath !== ':memory:' && !pgSql) {
      try {
        fs.writeFileSync(dbPath, Buffer.from(rawDbRef.export()));
      } catch (e) {}
    }
  };

  const syncRelationalTablesToPg = async () => {
    if (!pgSql || !rawDbRef) return;
    try {
      const usersStmt = rawDbRef.prepare('SELECT id, name, phone, role, grade, parent_phone, created_at FROM users');
      const users = [];
      while (usersStmt.step()) users.push(usersStmt.getAsObject());
      usersStmt.free();

      for (const u of users) {
        await pgSql.query(
          `INSERT INTO pg_users (id, name, phone, role, grade, parent_phone, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             phone = EXCLUDED.phone,
             role = EXCLUDED.role,
             grade = EXCLUDED.grade,
             parent_phone = EXCLUDED.parent_phone`,
          [u.id, u.name, u.phone, u.role, u.grade || '', u.parent_phone || '', u.created_at || '']
        );
      }

      const coursesStmt = rawDbRef.prepare('SELECT id, title, grade, price, is_free FROM courses');
      const courses = [];
      while (coursesStmt.step()) courses.push(coursesStmt.getAsObject());
      coursesStmt.free();

      for (const c of courses) {
        await pgSql.query(
          `INSERT INTO pg_courses (id, title, grade, price, is_free)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             grade = EXCLUDED.grade,
             price = EXCLUDED.price,
             is_free = EXCLUDED.is_free`,
          [c.id, c.title, c.grade, c.price || 0, c.is_free || 0]
        );
      }
    } catch (err) {
      console.warn('[DB] Relational mirror sync warning:', err.message);
    }
  };

  db = {
    prepare(sql) {
      return {
        all(...params) {
          const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
          const stmt = rawDbRef.prepare(sql);
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
          const stmt = rawDbRef.prepare(sql);
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
            rawDbRef.run(sql, args);
          } else {
            rawDbRef.run(sql);
          }
          const lastRowIdRes = rawDbRef.exec("SELECT last_insert_rowid() as id");
          const lastInsertRowid = lastRowIdRes[0]?.values[0][0] ?? 0;
          const changesRes = rawDbRef.exec("SELECT changes() as c");
          const changes = changesRes[0]?.values[0][0] ?? 0;
          persistLocalIfNeeded();
          return { changes, lastInsertRowid };
        }
      };
    },
    exec(sql) {
      const res = rawDbRef.exec(sql);
      if (!isBootstrapping) persistLocalIfNeeded();
      return res;
    },
    pragma(sql) {
      try { return rawDbRef.exec(`PRAGMA ${sql}`); } catch (e) {}
    },
    transaction(fn) {
      return function(...args) {
        const isOuter = txDepth === 0;
        const spName = `sp_${txDepth}`;
        txDepth++;
        rawDbRef.exec(isOuter ? 'BEGIN TRANSACTION' : `SAVEPOINT ${spName}`);
        try {
          const res = fn(...args);
          rawDbRef.exec(isOuter ? 'COMMIT' : `RELEASE SAVEPOINT ${spName}`);
          txDepth--;
          persistLocalIfNeeded();
          return res;
        } catch (err) {
          try {
            rawDbRef.exec(isOuter ? 'ROLLBACK' : `ROLLBACK TO SAVEPOINT ${spName}`);
          } catch (e) {}
          txDepth = Math.max(0, txDepth - 1);
          throw err;
        }
      };
    },
    isDirty() {
      return isDirty;
    },
    isPostgresConnected() {
      return !!pgSql;
    },
    async ensureSynced(method = 'GET') {
      if (!pgSql || !SQLRef) return;
      const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
      const now = Date.now();
      if (!isWrite && now - lastPgCheckAt < 1200) return;
      lastPgCheckAt = now;
      try {
        const rows = await pgSql.query('SELECT version FROM kimyawy_pg_state WHERE id = 1');
        const remoteVersion = Number(rows?.[0]?.version || 0);
        if (remoteVersion > localVersion) {
          const fullRows = await pgSql.query('SELECT version, snapshot FROM kimyawy_pg_state WHERE id = 1');
          if (fullRows?.[0]?.snapshot) {
            const nextBuf = Buffer.from(fullRows[0].snapshot, 'base64');
            const nextDb = new SQLRef.Database(nextBuf);
            try { nextDb.exec('PRAGMA foreign_keys = ON'); } catch (e) {}
            const oldDb = rawDbRef;
            rawDbRef = nextDb;
            localVersion = Number(fullRows[0].version) || remoteVersion;
            isDirty = false;
            try { oldDb.close(); } catch (e) {}
          }
        }
      } catch (err) {
        console.warn('[DB] ensureSynced check warning:', err.message);
      }
    },
    async flushToPostgres(force = false) {
      if (!pgSql || !rawDbRef) return;
      if (!isDirty && !force) return;
      isDirty = false;
      try {
        const exported = Buffer.from(rawDbRef.export());
        if (isVercel) {
          try { fs.writeFileSync('/tmp/data.db', exported); } catch (e) {}
        }
        const base64Snap = exported.toString('base64');
        const res = await pgSql.query(
          `INSERT INTO kimyawy_pg_state (id, version, snapshot, updated_at)
           VALUES (1, 1, $1, NOW())
           ON CONFLICT (id) DO UPDATE
           SET version = kimyawy_pg_state.version + 1,
               snapshot = EXCLUDED.snapshot,
               updated_at = NOW()
           RETURNING version`,
          [base64Snap]
        );
        if (res?.[0]?.version) {
          localVersion = Number(res[0].version);
        }
        lastPgCheckAt = Date.now();
        // Non-blocking relational table mirror sync
        syncRelationalTablesToPg().catch(() => {});
      } catch (err) {
        console.error('[DB] flushToPostgres error:', err.message);
      }
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
    type TEXT NOT NULL CHECK(type IN ('mcq', 'true_false', 'fill_blank', 'ordering', 'multi_select', 'essay')),
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
    time_spent INTEGER DEFAULT 0,
    late INTEGER DEFAULT 0
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

if (!loadedFromPg) {
  for (const query of migrations) {
    try { db.exec(query); } catch (e) { /* ignore if column already exists */ }
  }
}

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
    reviews_count INTEGER DEFAULT 0,
    whatsapp TEXT,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS lesson_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    timestamp_sec INTEGER DEFAULT 0,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function addColumnIfMissing(table, column, def) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  } catch (e) {}
}

if (!loadedFromPg) {
  addColumnIfMissing('enrollments', 'code_id', 'INTEGER');
  addColumnIfMissing('enrollments', 'payment_id', 'INTEGER');
  addColumnIfMissing('exam_attempts', 'question_ids', 'TEXT');
  addColumnIfMissing('exam_attempts', 'pedagogical_feedback', 'TEXT');
  addColumnIfMissing('questions', 'concept_key', 'TEXT');
  addColumnIfMissing('exam_attempts', 'essay_grades', 'TEXT');
  addColumnIfMissing('exam_attempts', 'teacher_feedback', 'TEXT');
  addColumnIfMissing('exam_attempts', 'is_graded', 'INTEGER DEFAULT 1');
  addColumnIfMissing('exam_attempts', 'late', 'INTEGER DEFAULT 0');
  addColumnIfMissing('lessons', 'pdf_url', 'TEXT');
  addColumnIfMissing('exams', 'start_time', 'DATETIME');
  addColumnIfMissing('exams', 'end_time', 'DATETIME');
  addColumnIfMissing('enrollments', 'expires_at', 'DATETIME');
  addColumnIfMissing('users', 'parent_phone_secondary', 'TEXT');
  addColumnIfMissing('courses', 'course_type', "TEXT DEFAULT 'monthly'");
  addColumnIfMissing('courses', 'duration_days', 'INTEGER DEFAULT 30');
  addColumnIfMissing('courses', 'original_price', 'REAL DEFAULT 0');
  addColumnIfMissing('courses', 'badge_text', 'TEXT');
}

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
      ['مكتبة الأوائل الفجالة', 'القاهرة', 'شارع كامل صدقي، الفجالة، الأزبكية', '01019882233', 5.0, 0, '201019882233'],
      ['سنتر ومكتبة الأهرام التعليمية', 'الجيزة', 'شارع مراد، ميدان الجيزة بجوار محطة المترو', '01123445566', 5.0, 0, '201123445566'],
      ['مكتبة الإسكندر الأكبر', 'الإسكندرية', 'شارع سوتر، أمام المجمع النظري، الشاطبي', '01234556677', 5.0, 0, '201234556677'],
      ['مكتبة النور للطباعة والنشر', 'الدقهلية', 'شارع جيهان، أمام بوابة جامعة المنصورة', '01098877665', 5.0, 0, '201098877665'],
      ['مكتبة الجمهورية والسنتر الحديث', 'الشرقية', 'ميدان القومية، الزقازيق', '01155667788', 5.0, 0, '201155667788'],
      ['مكتبة ابن سينا والمطبوعات', 'الغربية', 'شارع البحر، أمام محطة قطار طنطا', '01022334455', 5.0, 0, '201022334455'],
      ['مكتبة المستقبل والجامعة', 'أسيوط', 'شارع الجمهورية، أمام جامعة أسيوط القديمة', '01299887711', 5.0, 0, '201299887711']
    ];
    initialStores.forEach(s => insertStore.run(...s));
  }
} catch (e) { console.error('Seed stores error', e); }

// Auto-seed initial curriculum if courses table is empty
try {
  const courseCount = db.prepare('SELECT COUNT(*) as c FROM courses').get().c;
  if (courseCount === 0 && process.env.SKIP_AUTO_SEED !== '1') {
    let teacher = db.prepare("SELECT id FROM users WHERE phone = '01000000000'").get();
    let teacherId;
    if (teacher) {
      teacherId = teacher.id;
    } else {
      const initialTeacherPass = process.env.TEACHER_INITIAL_PASSWORD || crypto.randomBytes(12).toString('base64url');
      const hashed = bcrypt.hashSync(initialTeacherPass, 8);
      const tRes = db.prepare('INSERT INTO users (name, phone, password, role, grade) VALUES (?, ?, ?, ?, ?)')
        .run('د. زياد رمزي عياد', '01000000000', hashed, 'teacher', 'ثالثة ثانوي');
      teacherId = tRes.lastInsertRowid;
    }

    const insertCourse = db.prepare(`
      INSERT INTO courses (title, description, grade, price, original_price, duration_days, course_type, badge_text, is_free, teacher_id, sequential_access, allow_student_replies)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const c1Id = insertCourse.run(
      'الباب الأول: كيمياء العناصر الانتقالية واستخلاص الحديد',
      'شرح تفصيلي متكامل للسلسلة الانتقالية الأولى، التوزيع الإلكتروني، الخواص المغناطيسية والألوان، خامات الحديد واستخلاصه وتفاعلات أكاسيده.',
      'ثالثة ثانوي', 150, 220, 365, 'monthly', 'الأكثر طلباً 🔥', 0, teacherId, 0, 1
    ).lastInsertRowid;

    const c2Id = insertCourse.run(
      'أساسيات الكيمياء والتأسيس المنهجي الشامل (مجاني)',
      'كورس تمهيدي شامل لجميع المفاهيم الأساسية: كتابة الصيغ الكيميائية، وزن المعادلات، وحساب أعداد التأكسد والمول.',
      'ثالثة ثانوي', 0, 0, 365, 'monthly', 'مجاني للجميع 🎁', 1, teacherId, 0, 1
    ).lastInsertRowid;

    const c3Id = insertCourse.run(
      'الباب الخامس: الكيمياء العضوية من الصفر للاحتراف',
      'تغطية شاملة للهيدروكربونات الأليفاتية والأروماتية ومشتقات الهيدروكربونات مع مخططات التفاعلات الذهبية.',
      'ثالثة ثانوي', 250, 350, 365, 'quarterly', 'شامل المخططات 🧪', 0, teacherId, 0, 1
    ).lastInsertRowid;

    const c4Id = insertCourse.run(
      'بنية الذرة والجدول الدوري الحديث والروابط الكيميائية',
      'شرح وافٍ لنظريات بنية الذرة وأعداد الكم الأربعة وتدرج الخواص في الجدول الدوري لطلاب الصف الثاني الثانوي.',
      'ثانية ثانوي', 120, 160, 365, 'term', 'منهج الترم الأول', 0, teacherId, 0, 1
    ).lastInsertRowid;

    const ch1Id = db.prepare('INSERT INTO chapters (course_id, title, order_num) VALUES (?, ?, ?)').run(c1Id, 'الفصل الأول: الخواص العامة للسلسلة الانتقالية الأولى', 1).lastInsertRowid;
    const ch2Id = db.prepare('INSERT INTO chapters (course_id, title, order_num) VALUES (?, ?, ?)').run(c1Id, 'الفصل الثاني: كيمياء الحديد وتفاعلات الأكاسيد', 2).lastInsertRowid;
    const chFreeId = db.prepare('INSERT INTO chapters (course_id, title, order_num) VALUES (?, ?, ?)').run(c2Id, 'الوحدة التأسيسية: الصيغ الكيميائية والمعادلات', 1).lastInsertRowid;
    const chOrgId = db.prepare('INSERT INTO chapters (course_id, title, order_num) VALUES (?, ?, ?)').run(c3Id, 'الجزء الأول: الهيدروكربونات (الألكانات والألكينات والألكاينات)', 1).lastInsertRowid;
    const chSec2Id = db.prepare('INSERT INTO chapters (course_id, title, order_num) VALUES (?, ?, ?)').run(c4Id, 'الفصل الأول: بنية الذرة وأعداد الكم', 1).lastInsertRowid;

    const insLesson = db.prepare(`
      INSERT INTO lessons (chapter_id, course_id, title, description, video_url, duration, order_num, is_free, max_views)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insLesson.run(ch1Id, c1Id, 'المحاضرة 1: التوزيع الإلكتروني وحالات التأكسد الشائعة', 'نتناول في هذه المحاضرة قاعدة هوند ومبدأ البناء التصاعدي، وحالات استقرار عناصر الكروم والنحاس.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 45, 1, 1, 8);
    insLesson.run(ch1Id, c1Id, 'المحاضرة 2: الخواص البارامغناطيسية والدايامغناطيسية والأيونات الملونة', 'شرح العلاقة بين عدد الإلكترونات المفردة في الأوربيتالات وعزم الدوران المغناطيسي.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 50, 2, 0, 8);
    insLesson.run(ch2Id, c1Id, 'المحاضرة 3: خامات الحديد وأفران الاختزال (الفرن العالي ومدركس)', 'مقارنة شاملة بين الفرن العالي وفرن مدركس وإنتاج الصلب.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 55, 1, 0, 8);
    insLesson.run(chFreeId, c2Id, 'تأسيس 1: التكافؤات وكتابة الصيغ الكيميائية للمركبات', 'أساسيات لا غنى عنها لكل طالب ثانوية عامة في كتابة الصيغ الكيميائية بدقة.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 35, 1, 1, 15);
    insLesson.run(chFreeId, c2Id, 'تأسيس 2: وزن المعادلات الكيميائية وحساب المول والكتلة المولية', 'تدريبات عملية على وزن أصعب المعادلات وحسابات المول.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 40, 2, 1, 15);
    insLesson.run(chOrgId, c3Id, 'عضوية 1: مقدمة الكيمياء العضوية وتسمية الألكانات بنظام الأيوباك', 'بداية قوية للكيمياء العضوية وقواعد تسمية المركبات العضوية خطوة بخطوة.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 60, 1, 1, 8);
    insLesson.run(chSec2Id, c4Id, 'المحاضرة 1: تطور مفهوم بنية الذرة ونموذج بور الذري', 'شرح تجارب رذرفورد وطومسون ونموذج بور الذري.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 42, 1, 1, 8);

    const exam1Id = db.prepare(`
      INSERT INTO exams (course_id, chapter_id, title, description, duration_minutes, max_attempts, passing_score, is_active, order_num)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(c1Id, ch1Id, 'اختبار إلكتروني شامل على الخواص العامة والتوزيع الإلكتروني', 'اختبار تقييمي لقياس فهم التوزيع الإلكتروني وأعداد التأكسد والخواص المغناطيسية والألوان.', 20, 3, 60, 1, 3).lastInsertRowid;

    const insQ = db.prepare(`
      INSERT INTO questions (exam_id, type, text, options, correct_answer, explanation, points, order_num)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insQ.run(
      exam1Id, 'mcq',
      'عنصر انتقالي رئيسي من السلسلة الأولى يحتوي مركبه على أيون X³⁺ بتوزيع إلكتروني [Ar] 3d⁵، فما هو العدد الذري لهذا العنصر؟',
      JSON.stringify([
        { id: 'opt1', text: '26 (الحديد Fe)' },
        { id: 'opt2', text: '25 (المنجنيز Mn)' },
        { id: 'opt3', text: '27 (الكوبالت Co)' },
        { id: 'opt4', text: '24 (الكروم Cr)' }
      ]),
      'opt1',
      'الحديد Fe عدده الذري 26 وتوزيعه الذري [Ar] 4s² 3d⁶. عند فقد 3 إلكترونات يصبح توزيعه [Ar] 3d⁵.',
      2, 1
    );
    insQ.run(
      exam1Id, 'true_false',
      'تتميز جميع عناصر السلسلة الانتقالية الأولى بامتلاكها حالة التأكسد (+2) ما عدا عنصر السكانديوم Sc الذي يمتلك حالة وحيدة هي (+3).',
      null, 'true',
      'صحيح، لأن السكانديوم يفقد إلكتروني 4s وإلكترون 3d دفعة واحدة للوصول إلى التركيب الثابت للغاز الخامل [Ar].',
      1, 2
    );
    insQ.run(
      exam1Id, 'fill_blank',
      'العنصر الانتقالي الوحيد في السلسلة الأولى الذي جميع مركباته ومحاليله غير ملونة ودايامغناطيسية هو عنصر الـ...',
      null, 'سكانديوم',
      'عنصر السكانديوم Sc في حالة التأكسد +3 يخلو مداره 3d تماماً من الإلكترونات (3d⁰).',
      2, 3
    );

    const examFreeId = db.prepare(`
      INSERT INTO exams (course_id, chapter_id, title, description, duration_minutes, max_attempts, passing_score, is_active, order_num)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(c2Id, chFreeId, 'اختبار تحديد المستوى في أساسيات الكيمياء (مجاني)', 'اختبر مستواك في الصيغ الكيميائية وأعداد التأكسد وحسابات المول.', 15, 5, 60, 1, 3).lastInsertRowid;

    insQ.run(
      examFreeId, 'mcq',
      'ما هي الكتلة المولية لمركب هيدروكسيد الكالسيوم Ca(OH)₂ علماً بأن (Ca=40, O=16, H=1)؟',
      JSON.stringify([
        { id: 'opt1', text: '74 جم/مول' },
        { id: 'opt2', text: '57 جم/مول' },
        { id: 'opt3', text: '58 جم/مول' },
        { id: 'opt4', text: '90 جم/مول' }
      ]),
      'opt1',
      'الكتلة المولية = 40 + 2 × (16 + 1) = 40 + 34 = 74 جم/مول.',
      2, 1
    );

    db.prepare(`
      INSERT INTO live_sessions (title, course_id, description, scheduled_at, duration_minutes, meeting_link, status)
      VALUES (?, ?, ?, datetime('now', '+2 days'), ?, ?, ?)
    `).run(
      'بث مباشر: مراجعة شاملة وحل مسائل الباب الأول العليا',
      c1Id,
      'حصة تفاعلية مباشرة مع د. زياد رمزي عياد لمراجعة تكات الباب الأول والإجابة على استفسارات الطلاب.',
      75,
      'https://meet.google.com/demo-chem-zra',
      'upcoming'
    );
  }
} catch (e) { console.error('Auto-seed curriculum error', e); }

// Create indexes for better query performance
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_exam ON exam_attempts(user_id, exam_id)',
  'CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_code_usage_code ON code_usage(code_id)',
  'CREATE INDEX IF NOT EXISTS idx_payment_requests_user_status ON payment_requests(user_id, status)',
  'CREATE INDEX IF NOT EXISTS idx_fawry_orders_user_status ON fawry_orders(user_id, status)',
  'CREATE INDEX IF NOT EXISTS idx_live_sessions_scheduled ON live_sessions(scheduled_at)',
  'CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id)',
  'CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_lesson ON lesson_notes(user_id, lesson_id)',
];
for (const idx of indexes) {
  try { db.exec(idx); } catch (e) {}
}

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

isBootstrapping = false;

// If connected to PostgreSQL and this was the initial bootstrap, persist snapshot immediately
if (pgSql && !loadedFromPg) {
  await db.flushToPostgres(true);
}

export default db;
