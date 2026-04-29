// src/routes/labels.js
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const Label = require('../models/Label');

const router = express.Router();

/**
 * GET /api/labels
 * -> liefert alle Labels des aktuellen Users als String-Liste
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = req.user;

    const labels = await Label.find({ ownerId: user.id })
      .sort({ name: 1 })
      .lean();

    return res.json({
      items: labels.map(l => l.name),
    });
  } catch (err) {
    console.error('Fehler beim Label-Listing:', err);
    return res.status(500).json({ error: 'Serverfehler bei Labels' });
  }
});

module.exports = router;
