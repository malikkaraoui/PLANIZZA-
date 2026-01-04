# PLANIZZA — Filet de sécurité (Smoke tests)

Ce document sert de **filet anti-régression** après refactors (hooks, Firebase RTDB, pages pizzaiolo, checkout).

> Objectif : en 10–15 minutes, valider que l’app est « utilisable » sur les parcours critiques.

## Pré-requis

- Avoir une base RTDB avec au moins 1 truck public + menu.
- Avoir un compte Google Firebase Auth (client) et un compte « pro » (pizzaiolo) relié à un `truckId`.
- En local, vous pouvez aussi utiliser les émulateurs (`npm run firebase:emulators`).

## Parcours Client (sans compte)

### 1) Explore

- Aller sur `/explore`
- Attendu : liste des camions visible, filtres utilisables, pas d’erreur console bloquante.

### 2) Détail camion

- Ouvrir un camion via la route canon `/:truckId`
  - `truckId` peut être une **clé RTDB** (ex: `-Oi...`) ou un **slug** (ex: `TEST_04_01`).
- Attendu : menu affiché, prix cohérents (cents → euros), ajout au panier possible.

### 3) Panier

- Aller sur `/panier`
- Attendu : items présents, quantités modifiables, total recalculé.

## Checkout & paiement (MVP)

> Rappel sécurité : **pas de secret Stripe côté front**, et `paid` est écrit uniquement par webhook côté Functions.

### 4) AuthGate

- Depuis `/panier` → bouton « payer » / « valider »
- Attendu : si non connecté → redirection login.

### 5) Checkout session

- Une fois connecté → lancer le checkout
- Attendu : appel Functions OK, redirection Stripe Checkout (ou retour sessionId/URL).

### 6) Retour paiement

- Après paiement test → retour page success
- Attendu : création/affichage de commande, `orders/{orderId}.payment.paymentStatus` évolue à `paid` via webhook.

## Suivi commande

### 7) Tracking temps réel

- Aller sur `/order/:orderId`
- Attendu : la page écoute RTDB, affichage cohérent du statut, pas de fuite d’abonnement (pas de multiples callbacks).

> Note : l’avancement automatique des statuts est désactivé (workflow manuel côté pizzaiolo). Le tracking doit rester stable et réactif aux changements RTDB.

## Parcours Pizzaiolo

### 8) Accès Pro

- Se connecter avec un compte pro
- Attendu : Navbar affiche l’accès pro (Live / menu / commandes) sans clignotement étrange.

### 9) Menu

- Aller sur `/pro/menu`
- Attendu :
  - menu existant listé
  - ajout d’un item : validation (prix/tailles) + écriture RTDB
  - suppression d’un item : confirmation + suppression RTDB

### 10) Commandes

- Aller sur `/pro/commandes`
- Attendu : liste des commandes payées, stats visibles, changement d’onglets sans crash.

## Vérifs rapides “qualité”

- `npm run lint` → OK
- `npm run build` → OK

## En cas de bug

1) Noter : route, user UID, truckId, orderId, timestamp.
2) Copier la trace console (si présente).
3) Vérifier les données RTDB sur les paths :
   - `public/trucks/{truckId}`
   - `public/trucks/{truckId}/menu/items`
   - `orders/{orderId}`
   - `pizzaiolos/{uid}`
