// Einfaches Admin-Listing der Nutzer
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    // Nur Admins dürfen Nutzerlisten sehen
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Nur für Admins' });
    }

    const users = await User.find({}, { passwordHash: 0 }).lean();
    res.json(users);
  } catch (err) {
    console.error('User-List-Fehler:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
