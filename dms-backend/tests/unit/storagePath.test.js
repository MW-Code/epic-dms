import { describe, it, expect } from 'vitest';
import { resolveStoragePath } from '../../src/utils/storagePath.js';

describe('resolveStoragePath', () => {
  const uploadDir = '/app/uploads';

  it('liefert null fuer null/undefined/empty', () => {
    expect(resolveStoragePath(null, uploadDir)).toBe(null);
    expect(resolveStoragePath(undefined, uploadDir)).toBe(null);
    expect(resolveStoragePath('', uploadDir)).toBe(null);
  });

  it('joined Basename mit UPLOAD_DIR', () => {
    expect(resolveStoragePath('abc123', uploadDir)).toBe('/app/uploads/abc123');
    expect(resolveStoragePath('1afaaac2c574', uploadDir)).toBe('/app/uploads/1afaaac2c574');
  });

  it('laesst absoluten Pfad unveraendert (Legacy-Bestand)', () => {
    const oldAbsPath = '/home/Maikel/Projekte/Projekte/DMS/dms-backend/uploads/abc123';
    expect(resolveStoragePath(oldAbsPath, uploadDir)).toBe(oldAbsPath);
  });

  it('arbeitet mit beliebigem UPLOAD_DIR', () => {
    expect(resolveStoragePath('foo.pdf', '/var/data')).toBe('/var/data/foo.pdf');
    expect(resolveStoragePath('foo.pdf', '/tmp')).toBe('/tmp/foo.pdf');
  });
});
