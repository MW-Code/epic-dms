// OCR-Job-Producer fuer BullMQ.
// Wird vom Express-Server beim Upload/Checkin aufgerufen, damit der Request
// nicht auf den langsamen ocrmypdf-Aufruf wartet.
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// In Tests wollen wir keinerlei Netzwerk-Connection - Vitest's vi.mock greift
// bei CJS-require auf dieses Wrapper-Modul nicht zuverlaessig, daher der Stub.
// Aktiviert ueber DMS_DISABLE_QUEUE=1 (siehe tests/setup.js).
if (process.env.DMS_DISABLE_QUEUE === '1') {
  module.exports = {
    enqueueOcr: async () => ({ id: 'noop' }),
    ocrQueue: { close: async () => {} },
  };
} else {
  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    throw new Error('REDIS_URL fehlt in .env (siehe .env.example)');
  }

  // BullMQ verlangt maxRetriesPerRequest=null fuer langlaufende Verbindungen.
  const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const ocrQueue = new Queue('ocr', { connection });

  async function enqueueOcr(documentId) {
    return ocrQueue.add(
      'ocr',
      { documentId: String(documentId) },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,   // letzten 100 Erfolge fuer Telemetrie behalten
        removeOnFail: 500,       // letzten 500 Fehler zur Fehlersuche
      }
    );
  }

  module.exports = { enqueueOcr, ocrQueue };
}
