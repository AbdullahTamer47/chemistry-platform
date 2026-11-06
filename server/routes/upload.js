import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { authMiddleware, rateLimit } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {}
}

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf'
};

function verifyFileMagicBytes(filePath, mimetype) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    if (bytesRead < 4) return false;
    if (mimetype === 'image/jpeg') return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    if (mimetype === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    if (mimetype === 'image/gif') return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
    if (mimetype === 'image/webp') {
      return bytesRead >= 12 &&
        buf.toString('ascii', 0, 4) === 'RIFF' &&
        buf.toString('ascii', 8, 12) === 'WEBP';
    }
    if (mimetype === 'application/pdf') return buf.toString('ascii', 0, 4) === '%PDF';
    return false;
  } catch (e) {
    return false;
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || '.png';
    const rand = crypto.randomBytes(8).toString('hex');
    cb(null, `file_${Date.now()}_${rand}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (MIME_TO_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم. الصيغ المدعومة: صور (JPG, PNG, WEBP, GIF) وملفات PDF'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

router.post('/', authMiddleware, rateLimit(20, 60_000), (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'حجم الملف يتجاوز الحد المسموح به (10 ميجابايت)' });
      }
      return res.status(400).json({ error: `خطأ في رفع الملف: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم إرسال أي ملف' });
    }

    if (!verifyFileMagicBytes(req.file.path, req.file.mimetype)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({ error: 'محتوى الملف غير صالح أو لا يطابق الصيغة المعلنة' });
    }

    let dataUrl = null;
    try {
      const rawBuf = fs.readFileSync(req.file.path);
      const b64 = rawBuf.toString('base64');
      db.prepare('INSERT OR REPLACE INTO uploaded_files (filename, mimetype, data, size) VALUES (?, ?, ?, ?)')
        .run(req.file.filename, req.file.mimetype, b64, req.file.size);
      if (req.file.mimetype.startsWith('image/') && req.file.size <= 2 * 1024 * 1024) {
        dataUrl = `data:${req.file.mimetype};base64,${b64}`;
      }
    } catch (e) {
      console.warn('Upload DB persist warning:', e.message);
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      url: fileUrl,
      data_url: dataUrl,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  });
});

export function extractGoogleDriveId(url) {
  const s = String(url ?? '').trim();
  if (!s) return null;
  if (!/drive\.google\.com|docs\.google\.com|googleusercontent\.com/i.test(s)) return null;
  const fileMatch = s.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch) return fileMatch[1];
  const dMatch = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (dMatch) return dMatch[1];
  const idMatch = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch) return idMatch[1];
  return null;
}

export function normalizeImageUrl(url) {
  const s = String(url ?? '').trim();
  if (!s) return null;
  if (s.startsWith('data:image/')) return s;
  if (s.startsWith('/api/upload/gdrive/')) return s;
  const driveId = extractGoogleDriveId(s);
  if (driveId) {
    return `/api/upload/gdrive/${driveId}`;
  }
  return s;
}

// Server-side Google Drive Image Proxy + Persistent DB Cache (bypasses ORB/CORP and HTML viewer wrappers)
router.get('/gdrive/:fileId', async (req, res) => {
  try {
    const fileId = String(req.params.fileId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!fileId || fileId.length < 10) return res.status(400).end();

    const cacheKey = `gdrive_${fileId}`;
    const cached = db.prepare('SELECT mimetype, data FROM uploaded_files WHERE filename = ?').get(cacheKey);
    if (cached && cached.data) {
      const buf = Buffer.from(cached.data, 'base64');
      res.setHeader('Content-Type', cached.mimetype || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.send(buf);
    }

    const candidateUrls = [
      `https://lh3.googleusercontent.com/d/${fileId}=w1200`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
      `https://drive.google.com/uc?export=download&id=${fileId}`
    ];

    for (const targetUrl of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const upstream = await fetch(targetUrl, {
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
          }
        });
        clearTimeout(timeout);

        if (!upstream.ok) continue;
        const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('image/')) continue;

        const arrayBuf = await upstream.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (buf.length < 64) continue;

        // Cache in DB if <= 3MB so subsequent loads are instant and persisted in PostgreSQL
        if (buf.length <= 3 * 1024 * 1024) {
          try {
            db.prepare('INSERT OR REPLACE INTO uploaded_files (filename, mimetype, data, size) VALUES (?, ?, ?, ?)')
              .run(cacheKey, contentType.split(';')[0], buf.toString('base64'), buf.length);
            if (typeof db.flushToPostgres === 'function') {
              db.flushToPostgres().catch(() => {});
            }
          } catch (e) {}
        }

        res.setHeader('Content-Type', contentType.split(';')[0] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        return res.send(buf);
      } catch (e) {
        // try next candidate
      }
    }

    res.status(404).json({ error: 'تعذر جلب الصورة من Google Drive. تأكد من أن صلاحية الملف "أي شخص لديه الرابط" (Anyone with the link).' });
  } catch (err) {
    res.status(500).end();
  }
});

export default router;
