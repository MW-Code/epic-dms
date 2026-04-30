// Migration: storagePath von absoluten Host-Pfaden auf Basename umstellen.
// Hintergrund: vor Phase 2.3 wurde der gesamte Pfad gespeichert
// (z.B. /home/Maikel/.../uploads/abc123). Ab Container-Setup ist das nicht
// mehr resolvable - wir speichern jetzt nur noch den Basename und resolven
// zur Laufzeit ueber UPLOAD_DIR.
//
// Aufruf:  npm run migrate-paths
require('dotenv').config();

const path = require('node:path');
const mongoose = require('mongoose');
const { connectToDatabase } = require('../src/db');
const Document = require('../src/models/Document');

(async () => {
  await connectToDatabase();

  const docs = await Document.find({ storagePath: { $exists: true, $ne: null } })
    .select('_id storagePath history')
    .lean();

  let touched = 0;

  for (const doc of docs) {
    const update = {};

    if (path.isAbsolute(doc.storagePath)) {
      update.storagePath = path.basename(doc.storagePath);
    }

    // Auch History-Eintraege haben storagePath
    if (Array.isArray(doc.history) && doc.history.length) {
      const newHistory = doc.history.map((h) => ({
        ...h,
        storagePath: h.storagePath && path.isAbsolute(h.storagePath)
          ? path.basename(h.storagePath)
          : h.storagePath,
      }));
      const changed = newHistory.some((h, i) => h.storagePath !== doc.history[i].storagePath);
      if (changed) update.history = newHistory;
    }

    if (Object.keys(update).length === 0) continue;

    await Document.updateOne({ _id: doc._id }, { $set: update });
    touched++;
    console.log(`  - ${doc._id}  ${doc.storagePath} -> ${update.storagePath || '(unchanged)'}`);
  }

  console.log(`\nFertig. ${touched} Dokumente angepasst.`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error('Migration fehlgeschlagen:', err);
  await mongoose.disconnect();
  process.exit(1);
});
