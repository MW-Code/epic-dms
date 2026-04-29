// Dokument-Routen: Upload, Versionierung, OCR-Status und Listing
const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');

const { fixLatin1ToUtf8 } = require('../utils/encoding');
const { authMiddleware } = require('../middleware/auth');
const { ocrPdfToText } = require('../ocrService');

const Label = require('../models/Label');
const Document = require('../models/Document');

const router = express.Router();

// REVIEW(claude): Mehrere Punkte:
//   1) `dest` als String -> Multer verwirft den Originalnamen, deshalb der Encoding-Hack
//      in utils/encoding.js. Mit `defParamCharset: 'utf8'` wäre das nicht nötig.
//   2) Alle Files landen flach in einem Verzeichnis. Bei 100k+ Dateien wird ext4 langsam.
//      Sharding (uploads/ab/cd/<hash>) oder Object Storage (S3/MinIO) verwenden.
//   3) Pfad ist nicht aus process.env.UPLOAD_DIR konfigurierbar -> Container-Volume hart.
const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads'),
  defParamCharset: 'utf8',
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Nur PDF-Dateien erlaubt'));
    }
    cb(null, true);
  }
});

function sanitizeTitleFromFileName(fileName) {
  if (!fileName) return '';
  // Encoding reparieren (Ã¤ -> ä usw.)
  const fixed = fixLatin1ToUtf8(fileName);
  return fixed.replace(/\.pdf$/i, '').trim();
}



function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parsed die Such-Query in:
 *  - include: Begriffe, die enthalten sein müssen
 *  - exclude: Begriffe, die NICHT vorkommen dürfen
 *
 * Syntax:
 *   "Rechnung + Steam -Amazon"
 *   -> include: ["Rechnung", "Steam"]
 *   -> exclude: ["Amazon"]
 */
function parseSearchQuery(raw) {
  if (!raw || typeof raw !== 'string') {
    return { include: [], exclude: [] };
  }

  // "+" wie ein Leerzeichen behandeln und Mehrfachspaces entfernen
  const normalized = raw.replace(/\+/g, ' ');
  const parts = normalized
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const include = [];
  const exclude = [];

  for (const part of parts) {
    if (part.startsWith('-') && part.length > 1) {
      exclude.push(part.slice(1));
    } else if (part === '-') {
      // nacktes "-" ignorieren
      continue;
    } else {
      include.push(part);
    }
  }

  return { include, exclude };
}


router.post('/:id/checkout', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const doc = await Document.findOne({
      _id: id,
      uploaderId: user.id,
      deletedAt: null,
    });

    if (!doc) {
      return res.status(404).json({ error: 'Dokument nicht gefunden' });
    }

    // Schon ausgecheckt von anderem User?
    if (doc.checkout?.isCheckedOut && String(doc.checkout.byUserId) !== String(user.id)) {
      return res.status(409).json({
        error: 'Dokument ist bereits von einem anderen Benutzer ausgecheckt',
      });
    }

    doc.checkout = {
      isCheckedOut: true,
      byUserId: user.id,
      at: new Date(),
    };

    await doc.save();

    return res.json({
      success: true,
      checkout: doc.checkout,
    });
  } catch (err) {
    console.error('Fehler beim Checkout:', err);
    return res.status(500).json({ error: 'Serverfehler bei Checkout' });
  }
});





router.post(
  '/:id/checkin',
  authMiddleware,
  upload.single('file'),
  async (req, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Keine Datei hochgeladen' });
      }

      let doc = await Document.findOne({
        _id: id,
        uploaderId: user.id,
        deletedAt: null,
      });

      if (!doc) {
        return res.status(404).json({ error: 'Dokument nicht gefunden' });
      }

      // Blockiere nur, wenn ein anderer User den Checkout hält
      if (doc.checkout?.isCheckedOut && String(doc.checkout.byUserId) !== String(user.id)) {
        return res
          .status(409)
          .json({ error: 'Dokument ist von einem anderen Benutzer ausgecheckt' });
      }

      const currentVersion = doc.version || 1;

      doc.history = doc.history || [];
      // Vor dem Überschreiben den bisherigen Stand archivieren
      doc.history.push({
        version: currentVersion,
        storagePath: doc.storagePath,
        originalFileName: doc.originalFileName,
        sizeBytes: doc.sizeBytes,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt,
      });

      const originalFileName = fixLatin1ToUtf8(file.originalname || '');
      doc.storagePath = file.path;
      doc.originalFileName = originalFileName;
      doc.mimeType = file.mimetype;
      doc.sizeBytes = file.size;
      doc.uploadedAt = new Date();
      doc.version = currentVersion + 1;

      // Checkout zurücksetzen, da neue Version hochgeladen wurde
      doc.checkout = {
        isCheckedOut: false,
        byUserId: null,
        at: null,
      };

      // OCR zurücksetzen, damit die neue Version erneut verarbeitet wird
      doc.ocr.status = 'pending';
      doc.ocr.text = '';
      doc.ocr.lastTriedAt = null;
      doc.ocr.errorMessage = null;

      await doc.save();

      try {
        // Neue Version direkt verarbeiten, damit Treffer im Frontend sofort passen
        const text = await ocrPdfToText(file.path);
        doc.ocr.text = text;
        doc.ocr.status = 'done';
        doc.ocr.lastTriedAt = new Date();
        await doc.save();
      } catch (err) {
        console.error('OCR-Fehler (Checkin):', err);
        doc.ocr.status = 'error';
        doc.ocr.lastTriedAt = new Date();
        doc.ocr.errorMessage = (err.stderr || err.message || '').slice(0, 500);
        await doc.save();
      }

      return res.json({
        id: doc._id,
        version: doc.version,
        checkout: doc.checkout,
      });
    } catch (err) {
      console.error('Fehler beim Checkin:', err);
      return res.status(500).json({ error: 'Serverfehler bei Checkin' });
    }
  },
);



router.post('/:id/notes', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { text } = req.body || {};

    const doc = await Document.findOne({
      _id: id,
      uploaderId: user.id,
      deletedAt: null,
    });

    if (!doc) {
      return res.status(404).json({ error: 'Dokument nicht gefunden' });
    }

    doc.notesText = typeof text === 'string' ? text : '';
    await doc.save();

    return res.json({
      success: true,
      notesText: doc.notesText,
    });
  } catch (err) {
    console.error('Fehler beim Notiz-Speichern:', err);
    return res.status(500).json({ error: 'Serverfehler beim Notiz-Speichern' });
  }
});



/**
 * POST /api/documents
 * - nimmt eine PDF
 * - führt OCR durch
 * - legt ein Document in Mongo an
 */
router.post(
  '/',
  authMiddleware,
  upload.single('file'),
  async (req, res) => {
    try {
const file = req.file;
const user = req.user;
const rawFolder = req.body.folder || '';
const folder = rawFolder ? fixLatin1ToUtf8(rawFolder).trim() : null;

if (!file) {
  return res.status(400).json({ error: 'Keine Datei hochgeladen' });
}

// Dateiname sauber dekodieren
const originalFileName = fixLatin1ToUtf8(file.originalname || '');

// Override aus dem Formular (kommt aus UploadDialog.vue)
const rawTitleOverride = req.body.titleOverride || '';
const titleOverride = rawTitleOverride
  ? fixLatin1ToUtf8(rawTitleOverride).trim()
  : '';

// Fallback: Titel aus Dateiname
const fallbackTitle = sanitizeTitleFromFileName(originalFileName);

// Finaler Titel: Override > Fallback > „Unbenanntes Dokument“
const title = titleOverride || fallbackTitle || 'Unbenanntes Dokument';



// Labels aus dem Formular (kommt als JSON-String)
let labels = [];
if (req.body.labels) {
  try {
    const raw = JSON.parse(req.body.labels);

    if (Array.isArray(raw)) {
      labels = raw
        .map((x) => {
          // Fall 1: reiner String
          if (typeof x === 'string') return x;

          // Fall 2: QSelect-Objekt { label, value, ... }
          if (x && typeof x === 'object') {
            if (typeof x.label === 'string') return x.label;
            if (typeof x.value === 'string') return x.value;
          }

          // alles andere ignorieren
          return '';
        })
        .map((s) => fixLatin1ToUtf8(s).trim())
        .filter((s) => s.length > 0)
        // Duplikate raus
        .filter((val, idx, arr) => arr.indexOf(val) === idx);
    }
  } catch (e) {
    console.warn('Konnte labels nicht parsen:', e.message, 'payload:', req.body.labels);
  }
}



// 1) Erstmal Document mit status "pending" anlegen
let doc = await Document.create({
  uploaderId: user.id,
  originalFileName,
  storagePath: file.path,
  mimeType: file.mimetype,
  sizeBytes: file.size,
  uploadedAt: new Date(),
  title,
  folder,
  labels,
  ocr: {
    status: 'pending',
    language: 'deu',
    text: '',
    engine: 'ocrmypdf',
    lastTriedAt: null,
    errorMessage: null,
  },
});

if (labels.length) {
  const ops = labels.map(name => ({
    updateOne: {
      filter: { ownerId: user.id, name },
      update: { $setOnInsert: { createdAt: new Date() } },
      upsert: true,
    },
  }));

  try {
    await Label.bulkWrite(ops, { ordered: false });
  } catch (e) {
    // Duplikate etc. ignorieren, nur loggen
    console.warn('Label bulkWrite Warnung:', e.message);
  }
}
      // REVIEW(claude): SKALIERUNGS-BOTTLENECK #1
      // OCR läuft synchron im Request -> 5-30s pro Upload, parallele Uploads blockieren.
      // Empfohlen: BullMQ-Queue + Redis. Pseudocode:
      //   await ocrQueue.add('ocr', { documentId: doc._id });
      //   return res.status(202).json({ id: doc._id, ocrStatus: 'pending' });
      // Worker (separater Prozess) zieht Jobs, ruft ocrPdfToText, schreibt zurück.
      // Frontend pollt /api/documents/:id oder bekommt Push via SSE.
      try {
        const text = await ocrPdfToText(file.path);

        doc.ocr.text = text;
        doc.ocr.status = 'done';
        doc.ocr.lastTriedAt = new Date();
        await doc.save();
      } catch (err) {
        console.error('OCR-Fehler:', err);
        doc.ocr.status = 'error';
        doc.ocr.lastTriedAt = new Date();
        doc.ocr.errorMessage = (err.stderr || err.message || '').slice(0, 500);
        await doc.save();
      }

      return res.status(201).json({
        id: doc._id,
        title: doc.title,
        uploadedAt: doc.uploadedAt,
        ocrStatus: doc.ocr.status
      });
    } catch (err) {
      console.error('Fehler beim Dokument-Upload:', err);
      return res.status(500).json({ error: 'Serverfehler bei Upload' });
    }
  }
);



router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const doc = await Document.findOne({
      _id: id,
      uploaderId: user.id,
      deletedAt: null,
    });

    if (!doc) {
      return res.status(404).json({ error: 'Dokument nicht gefunden' });
    }

    // Optional: Deletion blocken, wenn von anderem User ausgecheckt
    if (doc.checkout?.isCheckedOut && String(doc.checkout.byUserId) !== String(user.id)) {
      return res.status(409).json({ error: 'Dokument ist von einem anderen Benutzer ausgecheckt' });
    }

    doc.deletedAt = new Date();
    await doc.save();

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Fehler beim Document-Delete:', err);
    return res.status(500).json({ error: 'Serverfehler bei Delete' });
  }
});


// Liste aller Ordner-Namen des Users (für Selects)
router.get('/folders', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const items = await Document.distinct('folder', {
      uploaderId: user.id,
      deletedAt: null,
      folder: { $ne: null },
    });

    return res.json({ items });
  } catch (err) {
    console.error('Fehler beim Folder-Listing:', err);
    return res.status(500).json({ error: 'Serverfehler bei Folder-Listing' });
  }
});


router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const rawFolder = req.body.folder || '';
    const folder = rawFolder ? fixLatin1ToUtf8(rawFolder).trim() : null;

    const doc = await Document.findOne({
      _id: id,
      uploaderId: user.id,
      deletedAt: null,
    });

    if (!doc) {
      return res.status(404).json({ error: 'Dokument nicht gefunden' });
    }

    let labelsForUpsert = null;

    // Titel aktualisieren
    if (typeof req.body.title === 'string') {
      doc.title = fixLatin1ToUtf8(req.body.title).trim();
    }

    // Labels aktualisieren
    if (Array.isArray(req.body.labels)) {
      let labels = req.body.labels
        .map((x) => (typeof x === 'string' ? x : ''))
        .map((s) => fixLatin1ToUtf8(s).trim())
        .filter((s) => s.length > 0);

      // doppelte raus
      labels = labels.filter((val, idx, arr) => arr.indexOf(val) === idx);

      doc.labels = labels;
      labelsForUpsert = labels;
    }

    // Optional: für später - muss auch im frontend eingebaut werden!!
    // if (req.body.documentDate) { update.documentDate = new Date(req.body.documentDate); }
    // if (typeof req.body.fromParty === 'string') { update.fromParty = fixLatin1ToUtf8(req.body.fromParty).trim(); }
    // if (typeof req.body.toParty === 'string') { update.toParty = fixLatin1ToUtf8(req.body.toParty).trim(); }
    // if (typeof req.body.category === 'string') { update.category = fixLatin1ToUtf8(req.body.category).trim(); }

    doc.folder = folder || null;

    await doc.save();

    // Neue Labels in Label-Collection upserten
    if (labelsForUpsert && labelsForUpsert.length) {
      const ops = labelsForUpsert.map((name) => ({
        updateOne: {
          filter: { ownerId: user.id, name },
          update: { $setOnInsert: { createdAt: new Date() } },
          upsert: true,
        },
      }));

      try {
        await Label.bulkWrite(ops, { ordered: false });
      } catch (e) {
        console.warn('Label bulkWrite Warnung (PATCH):', e.message);
      }
    }

    return res.json(doc.toObject ? doc.toObject() : doc);
  } catch (err) {
    console.error('Fehler beim Document-Update:', err);
    return res.status(500).json({ error: 'Serverfehler bei Update' });
  }
});


/**
 * GET /api/documents
 * einfache Liste für den aktuellen User
 * Query-Parameter:
 *   q       = Textsuche (Titel + ocr.text) (MVP: Regex)
 *   page    = Seite (1-basiert)
 *   pageSize= Anzahl pro Seite
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { q, page = 1, pageSize = 20, folder: rawFolder } = req.query;

    // Basisfilter: nur eigene, nicht gelöschte Dokumente
    const filter = {
      uploaderId: user.id,
      deletedAt: null,
    };

    if (rawFolder) {
      filter.folder = fixLatin1ToUtf8(String(rawFolder)).trim();
    }

    const andClauses = [];

    // Volltextsuche per case-insensitive Substring-Regex auf title, ocr.text, labels.
    // Syntax aus parseSearchQuery():
    //   "Rechnung Steam"   -> beide Begriffe muessen vorkommen (AND)
    //   "Rechnung -Amazon" -> Amazon darf nirgends vorkommen
    if (q && q.trim()) {
      const { include, exclude } = parseSearchQuery(q);

      for (const term of include) {
        const rx = new RegExp(escapeRegex(term), 'i');
        andClauses.push({
          $or: [{ title: rx }, { 'ocr.text': rx }, { labels: rx }],
        });
      }

      for (const term of exclude) {
        const rx = new RegExp(escapeRegex(term), 'i');
        andClauses.push({
          $nor: [{ title: rx }, { 'ocr.text': rx }, { labels: rx }],
        });
      }
    }

    if (andClauses.length > 0) {
      filter.$and = andClauses;
    }

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const ps = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);

    const projection = {
      ocr: 0,
      notes: 0,
      notesText: 0,
      history: 0,
    };

    const [items, total] = await Promise.all([
      Document.find(filter, projection)
        .sort({ uploadedAt: -1 })
        .skip((p - 1) * ps)
        .limit(ps)
        .lean(),
      Document.countDocuments(filter),
    ]);

    return res.json({
      items,
      total,
      page: p,
      pageSize: ps,
    });
  } catch (err) {
    console.error('Fehler beim Document-Listing:', err);
    return res.status(500).json({ error: 'Serverfehler bei Listing' });
  }
});


/**
 * GET /api/documents/:id
 * Detailansicht (inkl. Notizen, aber ohne kompletten OCR-Text kannst du später limitieren)
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const doc = await Document.findOne({
      _id: id,
      uploaderId: user.id,
      deletedAt: null
    }).lean();

    if (!doc) {
      return res.status(404).json({ error: 'Dokument nicht gefunden' });
    }

    return res.json(doc);
  } catch (err) {
    console.error('Fehler beim Document-Detail:', err);
    return res.status(500).json({ error: 'Serverfehler bei Detail' });
  }
});

/**
 * GET /api/documents/:id/file
 * PDF-Download/-Stream
 */
router.get('/:id/file', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const doc = await Document.findOne({
      _id: id,
      uploaderId: user.id,
      deletedAt: null
    }).lean();

    if (!doc) {
      return res.status(404).json({ error: 'Dokument nicht gefunden' });
    }

    if (!fs.existsSync(doc.storagePath)) {
      return res.status(410).json({ error: 'Datei nicht mehr vorhanden' });
    }

    const safeName = encodeURIComponent(
      fixLatin1ToUtf8(doc.originalFileName || 'document.pdf')
    );

    res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${safeName}"`
    );

    const stream = fs.createReadStream(doc.storagePath);
    stream.pipe(res);
  } catch (err) {
    console.error('Fehler beim Document-File:', err);
    return res.status(500).json({ error: 'Serverfehler bei File' });
  }
});

module.exports = router;
