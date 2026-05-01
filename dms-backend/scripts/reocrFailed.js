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

  // Targets:
  //  - error / pending / processing -> Worker abgebrochen oder nie durchgelaufen
  //  - done, aber ocr.text leer -> z.B. PDFs mit existierender Textebene, die
  //    ein altes ocrService mit --skip-text uebersprungen hat, ohne Text zu
  //    extrahieren. Mit dem neuen pdftotext-Fast-Path werden die jetzt erfasst.
  const docs = await Document.find({
    deletedAt: null,
    $or: [
      { 'ocr.status': { $in: TARGET_STATUSES } },
      { 'ocr.status': 'done', $expr: { $lt: [{ $strLenCP: { $ifNull: ['$ocr.text', ''] } }, 30] } },
    ],
  })
    .select('_id title ocr.status ocr.text')
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
