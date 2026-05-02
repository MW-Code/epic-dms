import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelative, formatDateTime, formatDate } from 'src/utils/date.js';

// Tests pinnen die "now" auf einen festen Zeitpunkt, sonst werden Tests
// flaky am Tageswechsel.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-01T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatRelative', () => {
  it('liefert leeren String fuer null/undefined', () => {
    expect(formatRelative(null)).toBe('');
    expect(formatRelative(undefined)).toBe('');
    expect(formatRelative('')).toBe('');
  });

  it('"gerade eben" fuer Daten unter 1 Minute', () => {
    expect(formatRelative(new Date('2026-05-01T11:59:30'))).toBe('gerade eben');
  });

  it('"vor X Min." zwischen 1 und 60 Minuten', () => {
    expect(formatRelative(new Date('2026-05-01T11:55:00'))).toBe('vor 5 Min.');
    expect(formatRelative(new Date('2026-05-01T11:01:00'))).toBe('vor 59 Min.');
  });

  it('"Heute, HH:MM" fuer den gleichen Tag', () => {
    expect(formatRelative(new Date('2026-05-01T08:30:00'))).toBe('Heute, 08:30');
  });

  it('"Gestern, HH:MM" fuer den Vortag', () => {
    expect(formatRelative(new Date('2026-04-30T14:15:00'))).toBe('Gestern, 14:15');
  });

  it('"vor X Tagen" innerhalb der letzten Woche', () => {
    expect(formatRelative(new Date('2026-04-28T10:00:00'))).toBe('vor 3 Tagen');
  });

  it('Datum DD.MM.YYYY fuer aelteres', () => {
    expect(formatRelative(new Date('2026-01-15T08:00:00'))).toBe('15.01.2026');
  });
});

describe('formatDateTime', () => {
  it('formatiert mit Datum + Uhrzeit', () => {
    expect(formatDateTime(new Date('2026-04-30T11:17:43'))).toBe('30.04.2026, 11:17');
  });
  it('liefert leeren String fuer ungueltige Daten', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime('not a date')).toBe('');
  });
});

describe('formatDate', () => {
  it('formatiert nur das Datum', () => {
    expect(formatDate(new Date('2026-04-30T11:17:43'))).toBe('30.04.2026');
  });
});
