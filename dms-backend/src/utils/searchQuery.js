// Such-Helfer: parsed eine Such-Query und liefert include/exclude-Listen.

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parsed die Such-Query in:
 *  - include: Begriffe, die enthalten sein muessen
 *  - exclude: Begriffe, die NICHT vorkommen duerfen
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

  // "+" wie ein Leerzeichen behandeln
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

module.exports = { parseSearchQuery, escapeRegex };
