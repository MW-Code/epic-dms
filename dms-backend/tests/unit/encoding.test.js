import { describe, it, expect } from 'vitest';
import { fixLatin1ToUtf8 } from '../../src/utils/encoding.js';

describe('fixLatin1ToUtf8', () => {
  it('laesst null/undefined/empty unveraendert', () => {
    expect(fixLatin1ToUtf8(null)).toBe(null);
    expect(fixLatin1ToUtf8(undefined)).toBe(undefined);
    expect(fixLatin1ToUtf8('')).toBe('');
  });

  it('laesst reines ASCII unveraendert', () => {
    expect(fixLatin1ToUtf8('Hello World')).toBe('Hello World');
    expect(fixLatin1ToUtf8('Rechnung_2026.pdf')).toBe('Rechnung_2026.pdf');
  });

  it('laesst korrekt kodierte Umlaute unveraendert', () => {
    expect(fixLatin1ToUtf8('Kündigung')).toBe('Kündigung');
    expect(fixLatin1ToUtf8('Müllerstraße')).toBe('Müllerstraße');
  });

  it('repariert klassische Latin1->UTF-8-Mojibake', () => {
    // "Kindergeldbestätigung" als Latin-1 gelesen sieht so aus:
    const broken = Buffer.from('Kindergeldbestätigung', 'utf8').toString('latin1');
    expect(fixLatin1ToUtf8(broken)).toBe('Kindergeldbestätigung');
  });

  it('repariert zusammengesetzte Mojibake-Strings', () => {
    const broken = Buffer.from('Müller & Söhne GmbH', 'utf8').toString('latin1');
    expect(fixLatin1ToUtf8(broken)).toBe('Müller & Söhne GmbH');
  });
});
