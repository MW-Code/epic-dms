// src/utils/encoding.js

function looksLikeAscii(str) {
  return /^[\x00-\x7F]*$/.test(str);
}

function containsRealUmlauts(str) {
  return /[äöüÄÖÜß]/.test(str);
}

function containsTypicalMojibake(str) {
  // Klassische UTF-8/Latin1-Verdreher für deutsche Umlaute
  return /Ã[¤¶¼¼Ÿ]|Â./.test(str);
}

/**
 * Versucht Strings zu reparieren, die als Latin-1 statt UTF-8 gelesen wurden.
 * Beispiele:
 *   "KindergeldbestÃ¤tigung" -> "Kindergeldbestätigung"
 */
function fixLatin1ToUtf8(str) {
  if (!str) return str;

  // Nur ASCII: nichts machen
  if (looksLikeAscii(str)) {
    return str;
  }

  // String enthält bereits echte Umlaute -> mit hoher Wahrscheinlichkeit korrekt
  if (containsRealUmlauts(str) && !containsTypicalMojibake(str)) {
    return str;
  }

  // Wenn typische Mojibake-Muster drin sind -> Konvertierung versuchen
  if (containsTypicalMojibake(str)) {
    const converted = Buffer.from(str, 'latin1').toString('utf8');

    // Wenn nach der Konvertierung korrekte Umlaute drin sind, nehmen wir das
    if (containsRealUmlauts(converted)) {
      return converted;
    }

    // Wenn das Ergebnis nur ASCII + Umlaute ist, passt meist auch
    if (/^[\x20-\x7EäöüÄÖÜß€]*$/.test(converted)) {
      return converted;
    }

    // Sonst lieber Original behalten
    return str;
  }

  // Kein typisches Mojibake erkannt -> Original zurückgeben
  return str;
}

module.exports = { fixLatin1ToUtf8 };
