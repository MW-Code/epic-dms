require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { connectToDatabase } = require('./db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const documentRoutes = require('./routes/documents');
const labelsRouter = require('./routes/labels');

const app = express();
const PORT = process.env.PORT || 3000;

// Standard-HTTP-Security-Header (X-Frame-Options, CSP-Basics, etc.)
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:9000'
}));

app.use(express.json({ limit: '1mb' }));

// Brute-Force-Schutz fuer Login + Register: max 10 Versuche / 15 Minuten / IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anmeldeversuche, bitte spaeter erneut probieren' },
});

// Einfacher Healthcheck für Docker/Probes
app.get('/', (req, res) => {
  res.send('DMS Backend läuft');
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/labels', labelsRouter);
app.use('/api/users', userRoutes);
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
