# Audit & Prévention — pizzaioloTransitionOrderV2 (Action‑Only)

Ce document sert de mémoire technique pour éviter toute régression sur la transition des commandes v2 (pizzaiolo). Il doit rester concis, actionnable, et aligné avec la réalité du code.

## Résumé exécutif
Le bug provenait d’un **mismatch de contrat** (action vs status) et d’un **mismatch de transport** (HTTP `onRequest` vs Callable `onCall`) combinés à un **edge case RTDB** (`current = null` en transaction). La correction durable impose un **contrat unique action‑only**, un **transport unique Callable**, et une **validation stricte** côté client + serveur. Un test E2E minimal assure la non‑régression.

## Symptômes observés
- `HTTP 400: action requis` malgré un log front affichant `action: "ACCEPT"`.
- `HTTP 409: transition_refused` avec `debugAbortReason: order_not_found` alors que l’ordre existait.
- Incohérences entre payload affiché et payload réellement envoyé.

## Causes racines
### 1) Contrat cassé côté front
Le front loguait `action`, mais **envoyait encore** `nextKitchenStatus` via `ordersApi.js` et `OrdersV2.jsx`. Résultat : le backend ne voyait pas `action`.

### 2) Transport incohérent
Le backend était `onRequest` (HTTP), alors que le flux devait être **Callable**. Le body `data` attendu par Callable n’était pas lu en HTTP. Mismatch → `action` perdue → 400.

### 3) Transaction RTDB avec `current = null`
Une transaction peut recevoir `current = null` même si un pre‑snapshot existe (concurrence / cache / retry). La transaction abortait avec `order_not_found`.

> Règle critique : **si tu fallbackes sur `pre`, alors `pre` doit être un snapshot fiable et récent de la même source de vérité**. Sinon tu risques de “réanimer” un ordre supprimé.

## Correctifs appliqués (durables)
### Backend
- `pizzaioloTransitionOrderV2` convertie en **Callable (`onCall`)**.
- Validation stricte des champs (`orderId`, `action`).
- Matrice serveur `ACTION_TO_STATUS` (client n’envoie jamais de statut cible).
- Transaction robuste : si `current` est `null`, utiliser `pre` comme base.
- Logs verbeux **gated** par `DEBUG_V2_TRANSITIONS=true`.

### Front
- `ordersApi.js` utilise **httpsCallable** uniquement.
- **Validation stricte** avant envoi (rejette `nextKitchenStatus`).
- `OrdersTimeDriven.jsx` et `OrdersV2.jsx` envoient **action** (ACCEPT/START/READY/HANDOFF/DONE/CANCEL).

### E2E minimal
- Test Playwright qui intercepte l’appel et vérifie que `data.action` est bien envoyé.
- Route test **activée uniquement** si `VITE_E2E=true`.

## Règles à graver dans le repo
1) **Transport unique** : `pizzaioloTransitionOrderV2` est **Callable only**.
2) **Contrat unique** : **action‑only**. Le client ne peut jamais envoyer un statut.
3) **Versionning immuable** : `...V2` reste figée. Toute évolution → `...V3`.
4) **Validation stricte** côté client ET serveur (refuser les champs interdits).
5) **Logs corrélés** : ajouter un `correlationId` côté front, renvoyé par le backend.

## Améliorations recommandées (prévention renforcée)
### 1) Schema contractuel partagé
- Ajouter un schéma commun (ex. `contracts/transitionOrderV2.schema.ts`).
- Utilisé côté front + backend.
- Rejeter explicitement `nextKitchenStatus` (erreur `deprecated_field`).

### 2) Tests anti‑régression
- Test CI qui **grep** `nextKitchenStatus` dans le front (interdit).
- Test CI qui vérifie l’usage de `httpsCallable("pizzaioloTransitionOrderV2")`.

### 3) CorrelationId systématique
- Front : `cid = crypto.randomUUID()`.
- Payload : `{ ..., cid }`.
- Backend : log `[cid]` + réponse renvoie `cid`.

### 4) Source de vérité claire
Éviter un modèle hybride où l’ordre vit à la fois en RTDB et ailleurs sans règles strictes.
Décider :
- **Soit** RTDB comme source de vérité,
- **Soit** Firestore comme source de vérité (RTDB = vue temps réel).

## Fichiers clés
- `functions/index.js` — callable + transaction robuste + logs gated.
- `src/lib/ordersApi.js` — httpsCallable + validation stricte.
- `src/lib/transitionValidation.js` — validator action‑only.
- `src/pages/pizzaiolo/OrdersTimeDriven.jsx` — envoi `action`.
- `src/pages/pizzaiolo/OrdersV2.jsx` — envoi `action`.
- `e2e/transition.spec.js` — test contractuel minimal.
- `playwright.config.js` — config e2e.

## Commandes utiles
- Lancer E2E : `npm run test:e2e`
- Activer logs v2 : `DEBUG_V2_TRANSITIONS=true` (Functions)

---

### TL;DR
**Un bug de contrat + transport + transaction**. La solution : **Callable only + action only + validation stricte + test E2E**. Toute dérive doit être bloquée par les tests et les validations.
