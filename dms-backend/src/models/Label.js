// Einfaches Label mit Besitzer und Namen
const mongoose = require('mongoose');

const LabelSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ein Label-Name pro User nur einmal
LabelSchema.index({ ownerId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Label', LabelSchema);
