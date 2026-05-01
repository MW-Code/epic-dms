// src/ocrService.js
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function runCommand(file, args = []) {
  return new Promise((resolve, reject) => {
    execFile(file, args, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr.toString();
        return reject(error);
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

// Ab dieser Zeichenanzahl gilt das PDF als "hat eine echte Textebene".
// Darunter (z.B. nur ein Seitenkopf) lassen wir OCR ueber das ganze Doc laufen.
const TEXT_LAYER_MIN_CHARS = 30;

/**
 * Liefert den Volltext eines PDFs zurueck.
 *
 * Strategie:
 *   1) pdftotext direkt - wenn das PDF schon eine Textebene hat, sind wir
 *      sofort fertig (spart 5-30 Sekunden OCR pro Dokument).
 *   2) Sonst (reine Bild-PDFs / Scans): ocrmypdf mit --skip-text als
 *      Sicherheitsnetz fuer Mischformen, schreibt erkannten Text ins Sidecar.
 *
 * Erwartet `pdftotext` (poppler-utils) und `ocrmypdf` im PATH.
 */
async function ocrPdfToText(pdfPath) {
  const direct = await tryPdfToText(pdfPath);
  if (direct && direct.trim().length >= TEXT_LAYER_MIN_CHARS) {
    return direct;
  }
  return ocrWithOcrmypdf(pdfPath);
}

// pdftotext kommt aus poppler-utils, ist als Abhaengigkeit von ocrmypdf
// (sowohl im Container als auch nativ via dnf) bereits installiert.
async function tryPdfToText(pdfPath) {
  try {
    const { stdout } = await runCommand('pdftotext', ['-layout', pdfPath, '-']);
    return stdout;
  } catch {
    return '';
  }
}

async function ocrWithOcrmypdf(pdfPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocrmypdf-'));
  const outputPdf = path.join(tmpDir, 'output_ocr.pdf');
  const sidecarTxt = path.join(tmpDir, 'output.txt');

  // --skip-text umgeht den Ghostscript-10.x-Bug bei eingebetteten Schriften
  // ("rasterizing failed"). Bei reinen Bild-PDFs hat das keinen Effekt.
  const args = [
    '--skip-text',
    '--sidecar',
    sidecarTxt,
    '-l',
    'deu',
    pdfPath,
    outputPdf,
  ];

  try {
    await runCommand('ocrmypdf', args);
    return fs.readFileSync(sidecarTxt, 'utf8');
  } finally {
    // Tmp-Verzeichnis IMMER aufraeumen, auch im Fehlerfall
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn('OCR-Tmp-Cleanup fehlgeschlagen:', cleanupErr.message);
    }
  }
}

module.exports = {
  ocrPdfToText,
};
