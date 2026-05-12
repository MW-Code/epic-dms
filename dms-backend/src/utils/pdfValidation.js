// PDF-Validierung und Cleanup verwaister Multer-Uploads.
const fs = require('node:fs/promises');

// PDF-Signatur laut ISO 32000: Datei muss mit "%PDF-" beginnen.
const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

/**
 * Prueft die ersten Bytes der Datei gegen die PDF-Signatur.
 * mimetype kommt vom Client und ist manipulierbar - die Magic Bytes nicht.
 */
async function hasPdfMagicBytes(filePath) {
  let handle;
  try {
    handle = await fs.open(filePath, 'r');
    const buf = Buffer.alloc(PDF_MAGIC.length);
    const { bytesRead } = await handle.read(buf, 0, PDF_MAGIC.length, 0);
    return bytesRead === PDF_MAGIC.length && buf.equals(PDF_MAGIC);
  } catch {
    return false;
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
  }
}

/**
 * Loescht eine (moeglicherweise verwaiste) Upload-Datei und schluckt ENOENT,
 * damit Cleanup im Fehlerpfad nie zu einem zweiten Fehler eskaliert.
 */
async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn('Konnte verwaiste Upload-Datei nicht loeschen:', filePath, err.message);
    }
  }
}

module.exports = { hasPdfMagicBytes, safeUnlink };
