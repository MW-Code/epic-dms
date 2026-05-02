import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearAllCollections,
  buildApp,
} from './_helpers.js';

let app;
let token;

async function registerAndLogin() {
  const res = await request(app).post('/api/auth/register').send({
    email: 'doc-test@example.com',
    password: 'test-password',
    displayName: 'Doc Tester',
  });
  return res.body.token;
}

// Hilfs-Funktion: Document direkt ins DB schreiben (umgeht Multer/Upload).
async function seedDocument(overrides = {}) {
  const mongoose = (await import('mongoose')).default;
  // Model wurde durch buildApp() bereits beim ersten Run registriert
  const Document = mongoose.models.Document;
  const userId = new mongoose.Types.ObjectId(decodeJwtSub(token));
  return Document.create({
    uploaderId: userId,
    originalFileName: 'test.pdf',
    storagePath: 'fake-storage-path',
    mimeType: 'application/pdf',
    sizeBytes: 1234,
    title: 'Test Doc',
    ocr: { status: 'done', text: 'Standard-OCR-Text' },
    ...overrides,
  });
}

function decodeJwtSub(jwt) {
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  return payload.sub;
}

beforeAll(async () => {
  await startInMemoryMongo();
  app = await buildApp();
}, 60_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearAllCollections();
  token = await registerAndLogin();
});

describe('GET /api/documents', () => {
  it('ohne Token -> 401', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });

  it('liefert leere Liste fuer neuen User', async () => {
    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('liefert eigene Dokumente sortiert nach uploadedAt desc', async () => {
    await seedDocument({ title: 'Alt', uploadedAt: new Date('2026-01-01') });
    await seedDocument({ title: 'Neu', uploadedAt: new Date('2026-04-01') });

    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items.map((d) => d.title)).toEqual(['Neu', 'Alt']);
  });

  it('filtert per q nach Titel (case-insensitive Substring)', async () => {
    await seedDocument({ title: 'Rechnung Steam', ocr: { status: 'done', text: 'foo' } });
    await seedDocument({ title: 'Vertrag Spotify', ocr: { status: 'done', text: 'foo' } });

    const res = await request(app)
      .get('/api/documents?q=steam')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Rechnung Steam');
  });

  it('filtert per q nach OCR-Volltext', async () => {
    await seedDocument({
      title: 'Anschreiben',
      ocr: { status: 'done', text: 'Bewerbung als Social Media Manager' },
    });
    await seedDocument({
      title: 'Other',
      ocr: { status: 'done', text: 'Lieferschein' },
    });

    const res = await request(app)
      .get('/api/documents?q=social')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Anschreiben');
  });

  it('filtert per q mit exclude-Operator (-Begriff)', async () => {
    await seedDocument({
      title: 'Rechnung Amazon',
      ocr: { status: 'done', text: 'Amazon Marketplace' },
    });
    await seedDocument({
      title: 'Rechnung Steam',
      ocr: { status: 'done', text: 'Steam Powered' },
    });

    const res = await request(app)
      .get('/api/documents?q=Rechnung -Amazon')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Rechnung Steam');
  });

  it('zeigt fremde Dokumente nicht', async () => {
    // Doc als anderer User
    const otherToken = (
      await request(app).post('/api/auth/register').send({
        email: 'other@example.com',
        password: 'pw1234',
        displayName: 'Other',
      })
    ).body.token;

    // Eigenes Doc fuer User 1 (token gehoert User 1)
    await seedDocument({ title: 'Mein Dok' });

    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.body.items).toEqual([]);
  });
});

describe('PATCH /api/documents/:id', () => {
  it('aktualisiert Titel und Labels', async () => {
    const doc = await seedDocument({ title: 'Alt' });
    const res = await request(app)
      .patch(`/api/documents/${doc._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Neu', labels: ['Wichtig', 'Steuer'] });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Neu');
    expect(res.body.labels).toEqual(['Wichtig', 'Steuer']);
  });

  it('lehnt Update auf fremdes Doc mit 404 ab', async () => {
    const doc = await seedDocument();
    const otherToken = (
      await request(app).post('/api/auth/register').send({
        email: 'other2@example.com',
        password: 'pw1234',
        displayName: 'Other',
      })
    ).body.token;

    const res = await request(app)
      .patch(`/api/documents/${doc._id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Hijack' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/documents/:id', () => {
  it('soft-deleted ein Dokument', async () => {
    const doc = await seedDocument();

    const del = await request(app)
      .delete(`/api/documents/${doc._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    // Listing zeigt es nicht mehr
    const list = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.items).toEqual([]);
  });
});
