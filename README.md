## 🍕 PLANIZZA

Plateforme web de commande et gestion de pizzas itinérantes.

- Front : **Vite + React + Tailwind**
- Back : **Firebase Auth + Realtime Database (RTDB) + Cloud Functions**
- Paiement : **Stripe Checkout** (validation réelle via **webhook**)

## 🎯 Principes non négociables (sécurité & cohérence)

- **Aucun secret Stripe côté front** (jamais de `sk_...` ni `whsec_...`).
- Le front **n’écrit jamais** un statut `paid` : seul `stripeWebhook` (Functions) le fait après vérif de signature.
- Les prix sont **toujours en cents** (int) dans la data.
- Le détail camion doit marcher par **clé RTDB** *ou* par **slug** (ex : `/TEST_04_01`).

## 📚 Documentation (minimal & à jour)

- Setup / env / Firebase / Stripe : `SETUP.md`
- Filet anti-régression : `CHECKLIST_SMOKE_TEST.md`

## 🚀 Démarrage rapide (dev)

1) Installer les dépendances (front + functions)

- `npm install`
- `npm --prefix functions install`

2) Créer `.env.local` depuis `.env.example` puis renseigner :

- `VITE_FIREBASE_*`
- **RTDB** : `VITE_FIREBASE_DATABASE_URL` (obligatoire)
- `VITE_STRIPE_PUBLISHABLE_KEY`
- (Optionnel) `VITE_FUNCTIONS_ORIGIN` si vos Functions ne sont pas en `us-central1`

3) Lancer le front

- `npm run dev`

4) (Optionnel) Lancer les émulateurs Firebase

- `npm run firebase:emulators`

Tout le détail (Firebase Console + CLI + secrets Stripe) est dans `SETUP.md`.

## 🧭 Routes (canon) — à connaître

Les routes sont centralisées dans `src/app/routes.jsx`.

| Fonction | Route |
|---|---|
| Explore (public) | `/explore` |
| Panier (public) | `/panier` |
| Checkout (public UI, auth requise au paiement) | `/checkout` |
| Success checkout | `/checkout/success` |
| Tracking commande | `/order/:orderId` |
| Détail camion (slug **ou** id RTDB) | `/:truckId` |
| Pro (pizzaiolo) | `/pro/*` (ex: `/pro/menu`, `/pro/live`) |

Routes legacy compatibles : `/truck/:truckId`, `/t/:truckId`, `/trucks/:truckId`.

## 🗄️ RTDB — modèle (MVP)

Paths principaux :

```txt
public/trucks/{truckId}
public/trucks/{truckId}/menu/items

orders/{orderId}
truckOrders/{truckId}/{orderId} = true

pizzaiolos/{uid}/truckId

```

Notes importantes :

- Les camions sont stockés sous une **clé RTDB** (ex : `-Oi6p2NbOfSJ2gI3atRg`).
- Le champ `slug` (ex : `TEST_04_01`) est utilisé pour la route `/:truckId`.
- Dans certains jeux de données, `id` peut être `null` en base : côté front, l’ID canonique est **la clé RTDB**.

## 💳 Paiement Stripe — flow réel

### 1) Créer la session Checkout

Le front appelle une Function HTTP `createCheckoutSession` en envoyant :

- `Authorization: Bearer <Firebase ID token>`
- `orderId` en body

La Function :

- reconstruit les line items côté serveur
- crée la session Stripe Checkout
- écrit `paymentStatus = "pending"` + `sessionId` sur la commande

### 2) Confirmer le paiement

Le webhook `stripeWebhook` :

- vérifie la signature Stripe
- sur `checkout.session.completed` : écrit `paymentStatus = "paid"` et `status = "received"`

> Important : le workflow d’avancement des statuts est **manuel** côté pizzaiolo (les anciennes transitions automatiques sont désactivées).

## 🧱 Architecture (où vit quoi)

- `src/app/` : router, guards, providers
- `src/pages/` : pages (orchestrateurs)
- `src/features/` : logique métier (hooks/utils/components) réutilisable

### Menu pizzaiolo (refactor)

Le gros de la logique d’édition menu a été sorti de la page :

- Hook d’édition : `src/features/menu/hooks/usePizzaioloMenuEditor.js`
- Draft UI/state : `src/features/menu/hooks/pizzaiolo/usePizzaioloMenuDraft.js`
- Builder payload RTDB : `src/features/menu/utils/buildMenuItemData.js`
- UI découpée : `src/features/menu/components/pizzaiolo/*` (barrel export)

## 🛟 Troubleshooting (les classiques)

- **Loader infini sur une page camion** :
  - Vérifier que RTDB a un index sur `slug` (voir `database.rules.json`).
  - Vérifier `VITE_FIREBASE_DATABASE_URL`.
  - La route canon est `/:truckId` (slug ou clé).

- **Checkout appelle la mauvaise région** :
  - Par défaut, le front cible `https://us-central1-<PROJECT_ID>.cloudfunctions.net`.
  - Si vous déployez vos Functions ailleurs, définir `VITE_FUNCTIONS_ORIGIN` dans `.env.local`.

## 🧪 Filet anti-régression

Après un refactor, exécuter :

- `CHECKLIST_SMOKE_TEST.md`

## 📦 Scripts utiles

- `npm run dev` : dev server
- `npm run build` : build prod
- `npm run lint` : eslint
- `npm run firebase:emulators` : émulateurs
- `npm run firebase:deploy` : build + deploy

## 🔐 Sécurité (rappel)

- Ne jamais commiter `.env*` (sauf `.env.example`).
- Front : uniquement `VITE_STRIPE_PUBLISHABLE_KEY`.
- Back (Functions) : secrets Stripe via Secrets Manager.

## 🔗 Références

- Vite : https://vite.dev/
- Firebase (Auth, RTDB, Functions) : https://firebase.google.com/docs
- Stripe Checkout + webhooks : https://stripe.com/docs

