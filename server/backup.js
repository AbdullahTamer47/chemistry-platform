import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

export function createDatabaseBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.warn('⚠️ data.db does not exist yet. Skipping backup.');
      return null;
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {}

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `chemistry_backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`✅ Database backup created successfully: ${backupName}`);

    // Prune old backups keeping only latest 10
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('chemistry_backup_') && f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 10) {
      files.slice(10).forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f.name));
        console.log(`🧹 Pruned old backup: ${f.name}`);
      });
    }

    return { success: true, backupName, backupPath };
  } catch (err) {
    console.error('❌ Database backup failed:', err.message);
    return { success: false, error: err.message };
  }
}

// If run directly from CLI: node server/backup.js
if (process.argv[1] && process.argv[1].endsWith('backup.js')) {
  createDatabaseBackup();
}
