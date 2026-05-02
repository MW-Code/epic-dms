// Globaler Setup-Hook: stellt sicher dass die Module beim Laden nicht
// auf fehlende Env-Vars meckern. Konkrete Werte ueberschreiben die Tests
// selbst (z.B. Integration-Tests setzen MONGO_URI auf den memory-server).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-must-not-be-used-in-production';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://placeholder/test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://placeholder';
