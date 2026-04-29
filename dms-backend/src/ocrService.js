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

/**
 * Führt OCR auf einem PDF aus und gibt den erkannten Text zurück.
 * Erwartet, dass `ocrmypdf` im PATH liegt.
 */
async function ocrPdfToText(pdfPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocrmypdf-'));
  const outputPdf = path.join(tmpDir, 'output_ocr.pdf');
  const sidecarTxt = path.join(tmpDir, 'output.txt');

  const args = [
    '--force-ocr',          // zwingt OCR auch bei PDFs, die schon Textlagen melden
    '--sidecar',
    sidecarTxt,
    '-l',
    'deu',                  // OCR-Sprache
    pdfPath,
    outputPdf
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
  ocrPdfToText
};
