import { describe, it, expect } from 'vitest';
import { parseSearchQuery, escapeRegex } from '../../src/utils/searchQuery.js';

describe('parseSearchQuery', () => {
  it('liefert leere Listen bei null/undefined/empty', () => {
    expect(parseSearchQuery(null)).toEqual({ include: [], exclude: [] });
    expect(parseSearchQuery(undefined)).toEqual({ include: [], exclude: [] });
    expect(parseSearchQuery('')).toEqual({ include: [], exclude: [] });
    expect(parseSearchQuery('   ')).toEqual({ include: [], exclude: [] });
  });

  it('liefert leere Listen bei Nicht-String-Input', () => {
    expect(parseSearchQuery(42)).toEqual({ include: [], exclude: [] });
    expect(parseSearchQuery({})).toEqual({ include: [], exclude: [] });
  });

  it('split einfache Begriffe als include', () => {
    expect(parseSearchQuery('Rechnung Steam')).toEqual({
      include: ['Rechnung', 'Steam'],
      exclude: [],
    });
  });

  it('behandelt + als Trenner wie Leerzeichen', () => {
    expect(parseSearchQuery('Rechnung+Steam+Adobe')).toEqual({
      include: ['Rechnung', 'Steam', 'Adobe'],
      exclude: [],
    });
  });

  it('extrahiert exclude-Begriffe mit fuehrendem -', () => {
    expect(parseSearchQuery('Rechnung -Amazon')).toEqual({
      include: ['Rechnung'],
      exclude: ['Amazon'],
    });
  });

  it('mischt include und exclude', () => {
    expect(parseSearchQuery('Steam + Spotify -Amazon -Netflix')).toEqual({
      include: ['Steam', 'Spotify'],
      exclude: ['Amazon', 'Netflix'],
    });
  });

  it('ignoriert ein nacktes Minus ohne Begriff', () => {
    expect(parseSearchQuery('Foo - Bar')).toEqual({
      include: ['Foo', 'Bar'],
      exclude: [],
    });
  });

  it('macht Mehrfach-Spaces nicht zu leeren Tokens', () => {
    expect(parseSearchQuery('  Foo     Bar  ')).toEqual({
      include: ['Foo', 'Bar'],
      exclude: [],
    });
  });
});

describe('escapeRegex', () => {
  it('escapt RegEx-Sonderzeichen', () => {
    expect(escapeRegex('a.b*c+d')).toBe('a\\.b\\*c\\+d');
    expect(escapeRegex('(test)')).toBe('\\(test\\)');
    expect(escapeRegex('foo$bar^')).toBe('foo\\$bar\\^');
  });

  it('laesst harmlose Zeichen unveraendert', () => {
    expect(escapeRegex('AbC 123')).toBe('AbC 123');
  });
});
