# 📋 Setup PLANIZZA (à jour)

Ce guide configure PLANIZZA **tel qu’implémenté aujourd’hui** : Firebase **Auth + RTDB + Functions + Storage** et Stripe Checkout.

## ✅ Prérequis

- Node.js LTS
- Firebase CLI (`npm i -g firebase-tools`)
- Un projet Firebase
- Un compte Stripe (mode test pour commencer)

## 1) Installation

- Installer les dépendances front
- Installer les dépendances Functions (`functions/`)

## 2) Firebase Console — activer les services

### Auth

Activer au moins : Google (recommandé) et/ou Email/Password.

### Realtime Database (RTDB)

Créer une RTDB (mode test pour démarrer, puis règles durcies). Choisir une région proche.

> Important : PLANIZZA utilise **RTDB** (pas Firestore) pour le runtime.

### Storage (images)

Activer Storage (pour logos/photos camions). Déployer ensuite `storage.rules`.

### Functions

Les Functions gèrent notamment : `createCheckoutSession` et `stripeWebhook`.

## 3) Variables d’environnement (front)

Créer `.env.local` depuis `.env.example`.

Variables importantes :

- `VITE_FIREBASE_DATABASE_URL` (**obligatoire**) : URL RTDB
- `VITE_FUNCTIONS_REGION` : région Firebase Functions utilisée par le SDK (par défaut `us-central1`)
- `VITE_FUNCTIONS_ORIGIN` (optionnel) : base URL HTTP pour les endpoints (ex: `https://us-central1-<PROJECT_ID>.cloudfunctions.net`).
	- À définir si vos Functions ne sont pas en `us-central1` ou si vous utilisez un domaine custom.
- `VITE_STRIPE_PUBLISHABLE_KEY` : clé publique Stripe (ok côté client)

## 4) Lier le projet local à Firebase

```bash
firebase login
firebase use --add
```

## 5) Déployer les rules RTDB/Storage

```bash
firebase deploy --only database
firebase deploy --only storage
```

### RTDB : index nécessaire pour les slugs

Pour que `/:truckId` fonctionne aussi avec un **slug** (ex: `/TEST_04_01`), RTDB doit indexer `slug` sous `public/trucks`.

Voir `database.rules.json` (recherche : `.indexOn: ["slug"]`).

## 6) Stripe — secrets & webhook (backend)

Le projet utilise `defineSecret()` (Firebase Functions v2). Les secrets se stockent via **Secrets Manager**.

### A) Définir les secrets

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

### B) Déployer les functions

```bash
firebase deploy --only functions
```

### C) Configurer le webhook Stripe

Dans Stripe Dashboard → Webhooks → ajouter un endpoint :

- URL : `https://us-central1-<PROJECT_ID>.cloudfunctions.net/stripeWebhook`
- Event : `checkout.session.completed`

Copier le **Signing secret** Stripe et le mettre dans `STRIPE_WEBHOOK_SECRET`.

## 7) Dev local

- Front : `npm run dev` (http://localhost:5173)
- Émulateurs : `npm run firebase:emulators`

## 🆘 Dépannage rapide

### “Firebase non configuré”

➡️ Vérifier que `.env.local` contient bien `VITE_FIREBASE_DATABASE_URL`.

### Checkout ne redirige pas

➡️ Vérifier :
- l’utilisateur est connecté (token ID en Authorization)
- les secrets Functions sont bien définis
- les logs Functions (`firebase functions:log`)

### Webhook ne passe pas en paid

➡️ Vérifier :
- URL webhook (région + project)
- `STRIPE_WEBHOOK_SECRET`
- l’événement `checkout.session.completed`
