// Auth-Routen: Registrierung und Login mit JWT-Issuance
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Registrierung: legt einen neuen Benutzer an und gibt direkt ein Token zurück
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'email, password, displayName nötig' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'E-Mail bereits registriert' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // REVIEW(claude): JEDER Registrant wird Admin — auch der zweite, dritte, n-te.
    // Empfohlen: Erst-User-Detection: const isFirstUser = (await User.countDocuments()) === 0;
    // role: isFirstUser ? 'admin' : 'member'
    const user = await User.create({
      email,
      displayName,
      passwordHash,
      role: 'admin' // erster User ist Admin; Rollenmodell später erweiterbar
    });

    const token = jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error('Register-Fehler:', err);
    return res.status(500).json({ error: 'Serverfehler bei Registrierung' });
  }
});

// Login: prüft Credentials und liefert JWT + Userinfo
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email und password nötig' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Login fehlgeschlagen' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Login fehlgeschlagen' });
    }

    const token = jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error('Login-Fehler:', err);
    return res.status(500).json({ error: 'Serverfehler bei Login' });
  }
});

module.exports = router;
