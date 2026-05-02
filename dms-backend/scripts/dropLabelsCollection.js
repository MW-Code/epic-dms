// Einmalige Migration: alte labels-Collection wegwerfen.
// Ab jetzt wird die Vorschlagsliste aus Document.labels aggregiert -
// die Collection ist obsolet und ihre Eintraege koennen sogar irrefuehrend
// sein (z.B. Labels die nirgends mehr verwendet werden).
//
// Aufruf:  npm run drop-labels
require('dotenv').config();

const mongoose = require('mongoose');
const { connectToDatabase } = require('../src/db');

(async () => {
  await connectToDatabase();
  const db = mongoose.connection.db;

  const exists = await db.listCollections({ name: 'labels' }).toArray();
  if (exists.length === 0) {
    console.log('Keine labels-Collection vorhanden, nichts zu tun.');
  } else {
    const before = await db.collection('labels').countDocuments();
    await db.collection('labels').drop();
    console.log(`labels-Collection mit ${before} Eintraegen gedropt.`);
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error('Drop fehlgeschlagen:', err);
  await mongoose.disconnect();
  process.exit(1);
});
