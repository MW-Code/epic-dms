// src/models/Document.js - Sammelt alle Upload-Informationen inkl. OCR, Historie und Checkout
const { Schema, model } = require('mongoose');

const noteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    _id: true,
  }
);

const documentSchema = new Schema(
  {
    uploaderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Upload-Metadaten des aktuellen Stands
    originalFileName: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },

    // Vom Nutzer gepflegte Metadaten
    title: { type: String, required: true },
    documentDate: { type: Date },
    fromParty: { type: String },
    toParty: { type: String },
    category: { type: String },
    folder: { type: String, default: null },

    labels: {
      type: [String],
      default: [],
    },

    // Ergebnis der OCR-Pipeline für Volltextsuche
    ocr: {
      status: {
        type: String,
        enum: ['pending', 'processing', 'done', 'error'],
        default: 'pending',
      },
      language: { type: String, default: 'deu' },
      text: { type: String, default: '' },
      engine: { type: String, default: 'ocrmypdf' },
      lastTriedAt: { type: Date },
      errorMessage: { type: String },
    },


    // Freitext-Notizen (ein Feld)
    notesText: {
      type: String,
      default: '',
    },

    // REVIEW(claude): `notes` ist laut deinem eigenen Kommentar "altes System".
    // Wird nirgendwo mehr beschrieben (nur notesText). Migration und Feld entfernen,
    // sonst trägt jedes Doc das Array für immer mit (auch leer = +bytes).
    notes: {
      type: [noteSchema],
      default: [],
    },

    // Checkout-Status verhindert gleichzeitige Änderungen
    checkout: {
      isCheckedOut: { type: Boolean, default: false },
      byUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      at: { type: Date, default: null },
    },

    // Versionierung zählt Uploads hoch und hält Vorgängerversionen
    version: { type: Number, default: 1 },

    history: [
      {
        version: { type: Number, required: true },
        storagePath: { type: String, required: true },
        originalFileName: { type: String, required: true },
        sizeBytes: { type: Number, required: true },
        mimeType: { type: String, required: true },
        uploadedAt: { type: Date, required: true },
      },
    ],

    archived: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Listing-Default-Query: nicht-geloescht + chronologisch
documentSchema.index({ uploaderId: 1, deletedAt: 1, uploadedAt: -1 });
// Filter nach Labels innerhalb eines Users
documentSchema.index({ uploaderId: 1, labels: 1 });
// Filter nach Ordner innerhalb eines Users
documentSchema.index({ uploaderId: 1, folder: 1 });
// Volltextsuche ueber Titel, OCR-Text und Labels
// (Mongo erlaubt nur EINEN Text-Index pro Collection — daher kombiniert)
documentSchema.index(
  { title: 'text', 'ocr.text': 'text', labels: 'text' },
  {
    weights: { title: 10, labels: 5, 'ocr.text': 1 },
    default_language: 'german',
    name: 'document_text_idx',
  }
);

module.exports = model('Document', documentSchema);
