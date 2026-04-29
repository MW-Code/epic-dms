// Stellt die MongoDB-Verbindung her
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error('MONGO_URI fehlt — bitte in .env setzen (siehe .env.example)');
}

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB verbunden');
  } catch (err) {
    console.error('Mongo-Fehler:', err);
    process.exit(1);
  }
}

module.exports = { connectToDatabase };
