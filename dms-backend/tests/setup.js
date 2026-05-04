// Globaler Setup-Hook: stellt sicher dass die Module beim Laden nicht
// auf fehlende Env-Vars meckern. Konkrete Werte ueberschreiben die Tests
// selbst (z.B. Integration-Tests setzen MONGO_URI auf den memory-server).
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-must-not-be-used-in-production';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://placeholder/test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://placeholder';

// OCR-Queue im Test-Modus stubben - sonst versucht IORedis live an
// "redis://placeholder" zu connecten und blockiert die Upload-Tests.
process.env.DMS_DISABLE_QUEUE = '1';

// Upload-Verzeichnis in einen tmp-Ordner umbiegen, damit Multer beim
// Multi-Upload-Test nicht in das Dev-uploads-Verzeichnis schreibt.
if (!process.env.UPLOAD_DIR) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-tests-uploads-'));
  process.env.UPLOAD_DIR = dir;
}
