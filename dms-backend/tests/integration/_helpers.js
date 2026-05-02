// Gemeinsame Helfer fuer Integration-Tests.
// Startet eine In-Memory-Mongo, baut eine express-App ohne BullMQ-Connection
// und gibt einen supertest-Agent zurueck.
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { vi } from 'vitest';

// BullMQ-Queue komplett mocken - kein Redis im Test.
vi.mock('../../src/queues/ocrQueue.js', () => ({
  enqueueOcr: vi.fn(async () => ({ id: 'mock-job' })),
  ocrQueue: { close: vi.fn() },
}));

let mongoServer;

export async function startInMemoryMongo() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
  return uri;
}

export async function stopInMemoryMongo() {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

export async function clearAllCollections() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

// Baut eine fresh-konfigurierte App fuer einen einzelnen Test.
// Wir importieren die Routen erst hier, damit die Mocks vorher greifen.
export async function buildApp() {
  const express = (await import('express')).default;
  const cors = (await import('cors')).default;

  const authRoutes = (await import('../../src/routes/auth.js')).default;
  const documentRoutes = (await import('../../src/routes/documents.js')).default;
  const userRoutes = (await import('../../src/routes/users.js')).default;
  const labelRoutes = (await import('../../src/routes/labels.js')).default;

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(cors());
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/labels', labelRoutes);
  app.use('/api/documents', documentRoutes);
  return app;
}
