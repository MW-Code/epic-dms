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

async function registerUser(email = 'label-test@example.com') {
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: 'pw1234',
    displayName: 'Label Tester',
  });
  return res.body.token;
}

async function seedDocument(overrides = {}, ownerToken = token) {
  const mongoose = (await import('mongoose')).default;
  const Document = mongoose.models.Document;
  const sub = JSON.parse(
    Buffer.from(ownerToken.split('.')[1], 'base64url').toString('utf8')
  ).sub;
  return Document.create({
    uploaderId: new mongoose.Types.ObjectId(sub),
    originalFileName: 'test.pdf',
    storagePath: 'fake-path',
    mimeType: 'application/pdf',
    sizeBytes: 1234,
    title: 'Doc',
    ocr: { status: 'done', text: '' },
    ...overrides,
  });
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
  token = await registerUser();
});

describe('GET /api/labels', () => {
  it('ohne Token -> 401', async () => {
    const res = await request(app).get('/api/labels');
    expect(res.status).toBe(401);
  });

  it('liefert leere Liste fuer User ohne Dokumente', async () => {
    const res = await request(app)
      .get('/api/labels')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toEqual([]);
  });

  it('aggregiert Labels aus aktiven Dokumenten alphabetisch', async () => {
    await seedDocument({ labels: ['Steuer', 'Wichtig'] });
    await seedDocument({ labels: ['Auto', 'Wichtig'] });

    const res = await request(app)
      .get('/api/labels')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toEqual(['Auto', 'Steuer', 'Wichtig']);
  });

  it('verwirft Labels aus soft-deleted Dokumenten', async () => {
    await seedDocument({ labels: ['Aktiv'] });
    await seedDocument({ labels: ['Verwaist'], deletedAt: new Date() });

    const res = await request(app)
      .get('/api/labels')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toEqual(['Aktiv']);
    expect(res.body.items).not.toContain('Verwaist');
  });

  it('Cleanup-Verhalten: Label verschwindet, wenn das letzte Doc geloescht wird', async () => {
    const onlyDoc = await seedDocument({ labels: ['Einmal'] });

    let res = await request(app)
      .get('/api/labels')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toEqual(['Einmal']);

    // Doc soft-deleten
    await request(app)
      .delete(`/api/documents/${onlyDoc._id}`)
      .set('Authorization', `Bearer ${token}`);

    res = await request(app)
      .get('/api/labels')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toEqual([]);
  });

  it('Cleanup-Verhalten: Label verschwindet nach PATCH ohne dieses Label', async () => {
    const doc = await seedDocument({ labels: ['Alpha', 'Beta'] });

    let res = await request(app)
      .get('/api/labels')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toEqual(['Alpha', 'Beta']);

    // PATCH entfernt 'Beta'
    await request(app)
      .patch(`/api/documents/${doc._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ labels: ['Alpha'] });

    res = await request(app)
      .get('/api/labels')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toEqual(['Alpha']);
  });

  it('zeigt fremde Labels nicht', async () => {
    await seedDocument({ labels: ['Privat'] });

    const otherToken = await registerUser('other@example.com');
    const res = await request(app)
      .get('/api/labels')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.body.items).toEqual([]);
  });
});
