// Aufloeser fuer Document-Storage-Pfade.
// In der DB wird nur der Basename gespeichert; zur Laufzeit kombinieren
// wir mit UPLOAD_DIR (env oder Backend-relatives Default-Verzeichnis).
// Aelterer Bestand mit absoluten Pfaden wird unveraendert durchgereicht.
const path = require('node:path');

const DEFAULT_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

function getUploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR);
}

function resolveStoragePath(storagePath, uploadDir = getUploadDir()) {
  if (!storagePath) return null;
  if (path.isAbsolute(storagePath)) return storagePath;
  return path.join(uploadDir, storagePath);
}

module.exports = { resolveStoragePath, getUploadDir };
