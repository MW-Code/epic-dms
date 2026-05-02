import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearAllCollections,
  buildApp,
} from './_helpers.js';

let app;

beforeAll(async () => {
  await startInMemoryMongo();
  app = await buildApp();
}, 60_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearAllCollections();
});

describe('POST /api/auth/register', () => {
  it('legt einen User an und gibt ein JWT zurueck', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'maikel@example.com',
      password: 'super-secret-pw',
      displayName: 'Maikel',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^eyJ/); // JWT-Header beginnt mit eyJ
    expect(res.body.user.email).toBe('maikel@example.com');
    expect(res.body.user.displayName).toBe('Maikel');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('macht den ersten Registrant zum admin', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'first@example.com',
      password: 'pw1234',
      displayName: 'Erster',
    });
    expect(res.body.user.role).toBe('admin');
  });

  it('macht den zweiten Registrant zum member', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'first@example.com',
      password: 'pw1234',
      displayName: 'Erster',
    });
    const res = await request(app).post('/api/auth/register').send({
      email: 'second@example.com',
      password: 'pw1234',
      displayName: 'Zweiter',
    });
    expect(res.body.user.role).toBe('member');
  });

  it('lehnt fehlende Felder mit 400 ab', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'incomplete@example.com',
    });
    expect(res.status).toBe(400);
  });

  it('lehnt doppelte E-Mail mit 409 ab', async () => {
    const payload = {
      email: 'dup@example.com',
      password: 'pw1234',
      displayName: 'Dup',
    };
    await request(app).post('/api/auth/register').send(payload);
    const res = await request(app).post('/api/auth/register').send(payload);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      email: 'maikel@example.com',
      password: 'correct-horse',
      displayName: 'Maikel',
    });
  });

  it('liefert ein JWT bei korrekten Credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'maikel@example.com',
      password: 'correct-horse',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^eyJ/);
  });

  it('lehnt falsches Passwort mit 401 ab', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'maikel@example.com',
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);
  });

  it('lehnt unbekannte E-Mail mit 401 ab (kein Leak ueber Existenz)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'unknown@example.com',
      password: 'whatever',
    });
    expect(res.status).toBe(401);
  });

  it('lehnt fehlende Credentials mit 400 ab', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});
