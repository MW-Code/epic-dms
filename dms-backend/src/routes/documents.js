// Dokument-Routen: Upload, Versionierung, OCR-Status und Listing
const express = require('express');
const multer = require('multer');
const fs = require('node:fs');

const { fixLatin1ToUtf8 } = require('../utils/encoding');
const { parseSearchQuery, escapeRegex } = require('../utils/searchQuery');
const { resolveStoragePath, getUploadDir } = require('../utils/storagePath');
const { hasPdfMagicBytes, safeUnlink } = require('../utils/pdfValidation');
const { authMiddleware } = require('../middleware/auth');
const { enqueueOcr } = require('../queues/ocrQueue');

const Document = require('../models/Document');

const router = express.Router();

// REVIEW(claude): offene Punkte:
//   1) Alle Files landen flach in einem Verzeichnis. Bei 100k+ Dateien wird ext4 langsam.
//      Sharding (uploads/ab/cd/<hash>) oder Object Storage (S3/MinIO) verwenden.
const upload = multer({
  // Lazy via Function, damit Tests UPLOAD_DIR nach Module-Import setzen koennen.
  dest: getUploadDir(),
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
    const file = req.file;
    try {
      const user = req.user;
      const { id } = req.params;

      if (!file) {
        return res.status(400).json({ error: 'Keine Datei hochgeladen' });
      }

      // mimetype ist Client-gesteuert, daher zusaetzlich Magic Bytes pruefen.
      const isPdf = await hasPdfMagicBytes(file.path);
      if (!isPdf) {
        await safeUnlink(file.path);
        return res.status(400).json({ error: 'Datei ist keine gueltige PDF' });
      }

      let doc = await Document.findOne({
        _id: id,
        uploaderId: user.id,
        deletedAt: null,
      });

      if (!doc) {
        await safeUnlink(file.path);
        return res.status(404).json({ error: 'Dokument nicht gefunden' });
      }

      // Blockiere nur, wenn ein anderer User den Checkout hält
      if (doc.checkout?.isCheckedOut && String(doc.checkout.byUserId) !== String(user.id)) {
        await safeUnlink(file.path);
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
      // Nur Basename speichern, Lookup ueber UPLOAD_DIR
      doc.storagePath = file.filename;
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

      // OCR an Worker delegieren, Request kommt sofort zurueck
      await enqueueOcr(doc._id);

      return res.json({
        id: doc._id,
        version: doc.version,
        checkout: doc.checkout,
        ocrStatus: doc.ocr.status,
      });
    } catch (err) {
      console.error('Fehler beim Checkin:', err);
      // Multer-Datei haengt bei Fehlern nach diesem Punkt noch im Dateisystem.
      await safeUnlink(file?.path);
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
 * - nimmt 1 bis 20 PDFs entgegen (Feldname: "file")
 * - legt pro Datei ein Document in Mongo an
 * - dispatcht OCR an den Worker
 *
 * Geteilte Felder (gelten fuer alle Dateien): folder, labels.
 * titleOverride wird NUR genutzt, wenn genau eine Datei hochgeladen wird;
 * bei Multi-Upload waeren sonst alle Dokumente gleich benannt.
 */
router.post(
  '/',
  authMiddleware,
  upload.array('file', 20),
  async (req, res) => {
    try {
      const files = req.files || [];
      const user = req.user;
      const rawFolder = req.body.folder || '';
      const folder = rawFolder ? fixLatin1ToUtf8(rawFolder).trim() : null;

      if (files.length === 0) {
        return res.status(400).json({ error: 'Keine Datei hochgeladen' });
      }

      // Override nur bei Single-Upload sinnvoll - sonst alle Dokumente identisch benannt.
      const rawTitleOverride = req.body.titleOverride || '';
      const titleOverride =
        files.length === 1 && rawTitleOverride
          ? fixLatin1ToUtf8(rawTitleOverride).trim()
          : '';

      // Labels einmal parsen, dann fuer alle Dateien wiederverwenden.
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

      const created = [];
      const failed = [];

      // Sequentiell: Mongo-Inserts sind billig, dafuer behalten wir den
      // Encode/Decode-Kontext sauber pro Datei und koennen Fehler einzeln melden.
      for (const file of files) {
        const originalFileName = fixLatin1ToUtf8(file.originalname || '');
        const fallbackTitle = sanitizeTitleFromFileName(originalFileName);
        const title = titleOverride || fallbackTitle || 'Unbenanntes Dokument';

        try {
          // mimetype kommt vom Client, daher zusaetzlich Magic Bytes pruefen.
          const isPdf = await hasPdfMagicBytes(file.path);
          if (!isPdf) {
            throw new Error('Datei ist keine gueltige PDF (Magic Bytes fehlen)');
          }

          const doc = await Document.create({
            uploaderId: user.id,
            originalFileName,
            storagePath: file.filename,
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

          // OCR an Worker delegieren, Request kommt sofort zurueck.
          // Frontend pollt den OCR-Status (siehe stores/documents.js).
          try {
            await enqueueOcr(doc._id);
          } catch (enqueueErr) {
            // Queue down -> Doc + Datei wieder entfernen, damit nichts Halbgares zurueckbleibt.
            await Document.deleteOne({ _id: doc._id }).catch(() => {});
            throw enqueueErr;
          }

          created.push({
            id: doc._id,
            title: doc.title,
            uploadedAt: doc.uploadedAt,
            ocrStatus: doc.ocr.status,
          });
        } catch (err) {
          console.error('Fehler beim Dokument-Upload (', originalFileName, '):', err);
          // Verwaiste Multer-Datei aufraeumen, sonst muellt sich uploads/ zu.
          await safeUnlink(file.path);
          failed.push({
            originalFileName,
            error: err?.message || 'Unbekannter Fehler',
          });
        }
      }

      // Nichts angekommen -> hartes 500. Sonst 202 mit Mischreport.
      if (created.length === 0) {
        return res.status(500).json({ error: 'Serverfehler bei Upload', failed });
      }

      return res.status(202).json({
        items: created,
        failed,
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

    // Titel aktualisieren
    if (typeof req.body.title === 'string') {
      doc.title = fixLatin1ToUtf8(req.body.title).trim();
    }

    // Labels aktualisieren - werden direkt am Document gespeichert,
    // der /api/labels-Endpoint aggregiert daraus die Vorschlagsliste.
    if (Array.isArray(req.body.labels)) {
      let labels = req.body.labels
        .map((x) => (typeof x === 'string' ? x : ''))
        .map((s) => fixLatin1ToUtf8(s).trim())
        .filter((s) => s.length > 0);

      // doppelte raus
      labels = labels.filter((val, idx, arr) => arr.indexOf(val) === idx);

      doc.labels = labels;
    }

    doc.folder = folder || null;

    await doc.save();

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

    // Nur das grosse ocr.text-Feld weglassen, Status/Engine etc. brauchen wir
    // fuer den Sidebar-Badge und das OCR-Polling im Frontend.
    const projection = {
      'ocr.text': 0,
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

    const absPath = resolveStoragePath(doc.storagePath);
    if (!absPath || !fs.existsSync(absPath)) {
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

    const stream = fs.createReadStream(absPath);
    stream.pipe(res);
  } catch (err) {
    console.error('Fehler beim Document-File:', err);
    return res.status(500).json({ error: 'Serverfehler bei File' });
  }
});

module.exports = router;
