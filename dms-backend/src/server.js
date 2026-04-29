require('dotenv').config();
const express = require('express');
const { connectToDatabase } = require('./db');
const authRoutes = require('./routes/auth');

const cors = require('cors');   

const userRoutes = require('./routes/users');
const documentRoutes = require('./routes/documents');
const labelsRouter = require('./routes/labels');

const app = express();
const PORT = process.env.PORT || 3000;



// REVIEW(claude): Body-Limit fehlt — default ist 100kb für JSON, aber kein helmet,
// kein rate-limit. Empfohlen für Production:
//   const helmet = require('helmet'); app.use(helmet());
//   const rateLimit = require('express-rate-limit');
//   app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 10 }));
app.use(express.json({ limit: '1mb' }));

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:9000'
}));

// Einfacher Healthcheck für Docker/Probes
app.get('/', (req, res) => {
  res.send('DMS Backend läuft');
});

// Auth
app.use('/api/auth', authRoutes);

// Labels
app.use('/api/labels', labelsRouter);

// User
app.use('/api/users', userRoutes);

// Documents
app.use('/api/documents', documentRoutes);

// Globaler Fehlerfänger, damit Fehler nicht im Promise verschwinden
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Serverfehler' });
});

(async () => {
  await connectToDatabase();
  app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
  });
})();
