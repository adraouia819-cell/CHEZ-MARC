# CASA STYLE — Plateforme E-Commerce Full-Stack

Plateforme e-commerce complète conçue pour **CASA STYLE** (Casablanca, Maroc — Devise : `MAD`).

## Architecture

- **Frontend** : React 19, TypeScript, Tailwind CSS v4
- **Backend** : Node.js, Express.js (`server.ts`)
- **Base de données** : SQLite relationnelle (`node:sqlite`) avec migrations SQL automatiques (`/src/db/migrations/001_init.sql`) et contraintes de clés étrangères (`PRAGMA foreign_keys = ON`)
- **Authentification & Sécurité** :
  - Hachage des mots de passe via `scrypt` avec sel aléatoire et comparaison à temps constant (`crypto.timingSafeEqual`)
  - Jetons d'accès JWT HMAC-SHA256 à courte durée de vie + jetons de rafraîchissement rotatifs persistés en base
  - Limitation des tentatives de connexion (`rate limiting`) sur l'authentification
  - Journalisation des opérations administratives (`audit_logs`)
  - Transactions SQL `BEGIN IMMEDIATE` pour la déduction atomique des stocks et la protection contre la survente

## Installation et lancement

1. Installer les dépendances :
   ```bash
   npm install
   ```
2. Copier `.env.example` vers `.env` et configurer vos secrets :
   ```bash
   cp .env.example .env
   ```
   Renseigner `JWT_SECRET`, `JWT_REFRESH_SECRET` et `ADMIN_INIT_PASSWORD` en production.
3. Lancer en mode développement :
   ```bash
   npm run dev
   ```
   Le serveur démarre sur `http://localhost:3000`.
4. Compiler et lancer en production :
   ```bash
   npm run build
   npm start
   ```

## Accès Administration

- Route : `/admin`
- Compte initial de développement : `admin` (mot de passe initial à remplacer impérativement depuis **Paramètres & Sécurité** avant toute mise en production).
