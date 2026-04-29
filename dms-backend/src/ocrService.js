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
// REVIEW(claude): tmpDir wird nie aufgeräumt -> Tmp-Leak (jeder Upload hinterlässt
// einen output_ocr.pdf in /tmp). Empfohlen: try/finally mit fs.rmSync(tmpDir, { recursive: true }).
// Außerdem: '--force-ocr' ist teuer, wenn PDF bereits Textlage hat. Mit '--skip-text'
// könnten viele Docs schneller durchlaufen.
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

  await runCommand('ocrmypdf', args);

  const text = fs.readFileSync(sidecarTxt, 'utf8');
  return text;
}

module.exports = {
  ocrPdfToText
};
