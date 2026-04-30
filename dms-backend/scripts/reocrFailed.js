// CLI-Helper: setzt alle Dokumente mit ocr.status in (error|pending|processing)
// auf "pending" zurueck und enqueued sie erneut. Nuetzlich nach OCR-Pipeline-
// Fixes oder Worker-Crashs.
//
// Aufruf:  npm run reocr-failed
require('dotenv').config();

const mongoose = require('mongoose');
const { connectToDatabase } = require('../src/db');
const Document = require('../src/models/Document');
const { enqueueOcr, ocrQueue } = require('../src/queues/ocrQueue');

const TARGET_STATUSES = ['error', 'pending', 'processing'];

(async () => {
  await connectToDatabase();

  const docs = await Document.find({
    'ocr.status': { $in: TARGET_STATUSES },
    deletedAt: null,
  })
    .select('_id title ocr.status')
    .lean();

  if (!docs.length) {
    console.log('Keine Dokumente mit problematischem OCR-Status gefunden.');
    await shutdown();
    return;
  }

  console.log(`${docs.length} Dokumente werden erneut in die Queue gegeben:`);

  for (const doc of docs) {
    await Document.updateOne(
      { _id: doc._id },
      {
        $set: {
          'ocr.status': 'pending',
          'ocr.errorMessage': null,
          'ocr.text': '',
        },
      }
    );
    await enqueueOcr(doc._id);
    console.log(`  - ${doc._id}  "${doc.title || '(ohne Titel)'}"  war: ${doc.ocr?.status}`);
  }

  console.log('Fertig. Stelle sicher, dass der Worker laeuft (npm run worker).');
  await shutdown();
})().catch(async (err) => {
  console.error('Re-OCR fehlgeschlagen:', err);
  await shutdown(1);
});

async function shutdown(code = 0) {
  try {
    await ocrQueue.close();
    await mongoose.disconnect();
  } finally {
    process.exit(code);
  }
}
