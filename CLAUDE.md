# CLAUDE.md – Epic DMS

Dokumenten-Management-System mit OCR-Volltextsuche, Versionierung und Multi-User-Auth. Monorepo: `dms-backend/` (Node/Express/Mongo) + `dms-frontend/` (Quasar/Vue 3).

## Arbeitsweise & Kommunikation
- Antworten auf Deutsch
- Sei ehrlich — auch wenn meine Idee suboptimal ist, sag's direkt
- Wenn du dir unsicher bist, sag das lieber als zu raten
- Erkläre Entscheidungen verständlich
- Schlage gerne bessere Patterns oder Optimierungen vor

## Projekt-Konventionen
- Code-Kommentare auf Deutsch
- Review-Anmerkungen mit `// REVIEW(claude):` markieren, damit ich sie später leicht finde
- Secrets gehören in `.env`, niemals in den Code

## Stack-Notizen
- Backend: Express 5, Mongoose 8, Multer, JWT, bcrypt, OCR via `ocrmypdf` (CLI-Aufruf)
- Frontend: Quasar 2 / Vue 3 / Pinia / axios, Dev-Port 9000
- Mongo läuft via Docker-Compose im Backend-Verzeichnis
