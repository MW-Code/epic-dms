// Labels werden NICHT in einer eigenen Collection gehalten, sondern aus
// den aktiven Dokumenten aggregiert. Damit verschwindet ein Label automatisch,
// sobald das letzte Doc, das es nutzte, geloescht oder umgelabelt wird.
// (Selbe Strategie wie /api/documents/folders.)
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const Document = require('../models/Document');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const items = await Document.distinct('labels', {
      uploaderId: req.user.id,
      deletedAt: null,
    });

    // distinct liefert die Werte in Insertion-Order zurueck - alphabetisch
    // sortieren ist fuer die Vorschlagsliste angenehmer.
    items.sort((a, b) => a.localeCompare(b, 'de'));

    return res.json({ items });
  } catch (err) {
    console.error('Fehler beim Label-Listing:', err);
    return res.status(500).json({ error: 'Serverfehler bei Labels' });
  }
});

module.exports = router;
