// Eigenstaendiger Worker-Prozess. Zieht OCR-Jobs aus BullMQ, ruft ocrmypdf,
// schreibt Ergebnis ins Document-Dokument zurueck.
//
// Start: `npm run worker` in einem separaten Terminal.
require('dotenv').config();

const path = require('node:path');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');

const { connectToDatabase } = require('../db');
const Document = require('../models/Document');
const { ocrPdfToText } = require('../ocrService');

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')
);

function resolveStoragePath(storagePath) {
  if (!storagePath) return null;
  if (path.isAbsolute(storagePath)) return storagePath;
  return path.join(UPLOAD_DIR, storagePath);
}

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error('REDIS_URL fehlt in .env (siehe .env.example)');
}

const concurrency = Math.max(parseInt(process.env.OCR_CONCURRENCY, 10) || 2, 1);

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

(async () => {
  await connectToDatabase();
  console.log(`OCR-Worker bereit (concurrency=${concurrency})`);

  const worker = new Worker(
    'ocr',
    async (job) => {
      const { documentId } = job.data;
      const doc = await Document.findById(documentId);
      if (!doc) {
        throw new Error(`Document ${documentId} nicht gefunden`);
      }

      doc.ocr.status = 'processing';
      await doc.save();

      const absPath = resolveStoragePath(doc.storagePath);
      if (!absPath) {
        throw new Error(`storagePath fehlt fuer Document ${documentId}`);
      }

      const text = await ocrPdfToText(absPath);

      doc.ocr.text = text;
      doc.ocr.status = 'done';
      doc.ocr.lastTriedAt = new Date();
      doc.ocr.errorMessage = null;
      await doc.save();

      return { documentId: String(doc._id), chars: text.length };
    },
    { connection, concurrency }
  );

  worker.on('completed', (job, result) => {
    console.log(`OCR fertig: doc=${result.documentId} chars=${result.chars}`);
  });

  // Bei Fehlversuchen Status nur nach finalem Aufgeben hart auf "error" ziehen.
  worker.on('failed', async (job, err) => {
    console.error(`OCR-Job ${job?.id} fehlgeschlagen (Versuch ${job?.attemptsMade}/${job?.opts?.attempts}):`, err.message);

    const isFinalAttempt = job && job.attemptsMade >= (job.opts?.attempts || 1);
    if (!isFinalAttempt) return;

    try {
      const doc = await Document.findById(job.data.documentId);
      if (!doc) return;
      doc.ocr.status = 'error';
      doc.ocr.errorMessage = (err.stderr || err.message || '').slice(0, 500);
      doc.ocr.lastTriedAt = new Date();
      await doc.save();
    } catch (e) {
      console.error('Konnte Status nicht auf error setzen:', e.message);
    }
  });

  // Sauberer Shutdown bei SIGTERM/SIGINT
  const shutdown = async () => {
    console.log('Worker shutdown...');
    try {
      await worker.close();
      await connection.quit();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})().catch((err) => {
  console.error('Worker konnte nicht starten:', err);
  process.exit(1);
});
