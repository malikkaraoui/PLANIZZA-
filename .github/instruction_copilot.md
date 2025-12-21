# GitHub Copilot — Instructions du dépôt

**Emplacement recommandé :** `.github/copilot-instructions.md`  
**But :** guider Copilot pour développer le MVP **PLANIZZA** (Vite + React) : marketplace “type Planity” mais pour **camions pizza**, avec **compte pizzaiolo**, **commande client**, **paiement Stripe**, et **backend Firebase** (Hosting + Functions + DB).

---

## 1) Contexte du projet
- Nom : **PLANIZZA** — “Planity des camions pizza”.
- Objectif : permettre aux pizzaiolos (souvent en camion) d’être trouvés, de prendre des commandes sans téléphone, et d’encaisser sans interruption.
- Deux rôles :
  1) **Client** : trouve un camion (localisation), consulte le menu, compose son panier, paye (Stripe Checkout), reçoit confirmation.
  2) **Pizzaiolo** : crée un compte, configure profil camion (nom, logo, photos, horaires, localisation), gère menu, voit commandes.

---

## 2) Stack (choix MVP, rapide et propre)
Front :
- **Vite + React (JS/JSX)**
- **React Router**
- **TailwindCSS**
- `lucide-react` (icônes)
- (option) `sonner` ou `react-hot-toast` (toasts)

Backend :
- **Firebase**
  - Hosting (déploiement front)
  - Auth (email/password) + rôles “pizzaiolo/client”
  - Database : **Realtime Database** (MVP) ou Firestore (si demandé)
  - Functions : logique sensible + Stripe + webhooks
  - Emulators : dev local

Paiement :
- **Stripe Checkout** (rapide, Apple Pay côté Stripe selon device/config)
- **Stripe Connect (marketplace)** : le pizzaiolo a un compte Stripe connecté

---

## 3) Contraintes & règles à respecter (strict)
### 3.1 Sécurité clés / secrets
- **INTERDIT** : Stripe Secret Key (`sk_...`) dans le front, dans Git, ou dans `.env` commité.
- **Autorisé front** : Stripe publishable key (ex: `pk_...`) via `VITE_STRIPE_PUBLISHABLE_KEY`.
- **Firebase config** : doit passer par `.env.local` (pas en dur).
- Tout ce qui est “secret” (Stripe secret, webhook secret) doit vivre dans :
  - `functions/.env` en local (non commité), ET/OU
  - secrets/config Firebase/Cloud (selon config du projet).

**Règle d’or :** tout ce qui permet d’encaisser, modifier une commande “paid”, ou toucher à l’argent = **Cloud Functions uniquement**.

### 3.2 Git hygiene (obligatoire)
- `.env`, `.env.*`, `functions/.env`, `functions/.env.*` = jamais commit
- Vérifier `.gitignore` avant 1er push.
- Ajouter `.env.example` (vide) pour documenter les variables attendues.
- Si une clé sensible a été collée par erreur : **rotation** (regénération) + purge historique si nécessaire.

### 3.3 Architecture paiement (obligatoire)
- Le front ne fait JAMAIS `stripe.checkout.sessions.create` directement.
- Le front appelle une Function `createCheckoutSession` et redirige vers l’URL renvoyée.
- Les statuts de commande “paid” viennent uniquement du **webhook Stripe** (Function `stripeWebhook`).

### 3.4 Qualité code
- Hooks React uniquement (pas de classes).
- Code lisible, composants petits, props explicites.
- Gestion erreurs + états `loading` propres.
- Nettoyer abonnements (Firebase listeners, WebSockets si un jour) via `useEffect` cleanup.

---

## 4) MVP : ce qui doit exister en premier
### Parcours Client (V1)
1) Liste des camions actifs
2) Fiche camion + menu
3) Panier
4) Création commande (status `created`)
5) Checkout Stripe
6) Page “success” + commande `paid` après webhook

### Parcours Pizzaiolo (V1)
1) Register/Login
2) Dashboard protégé
3) CRUD Profil camion (nom, ville/localisation simple, horaires, photos/URL)
4) CRUD Menu (pizzas + boissons)
5) Liste commandes

---

## 5) Structure & fichiers attendus (ne pas casser)
Respecter cette organisation (évolutive sans être lourde) :

src/
app/
App.jsx
router.jsx
routes.jsx // constantes routes
providers/
AuthProvider.jsx
components/
layout/
Navbar.jsx
Footer.jsx
Container.jsx
ui/
Button.jsx
Input.jsx
Card.jsx
Badge.jsx
Modal.jsx
Spinner.jsx
features/
auth/
hooks/
useAuth.js
RequireAuth.jsx
RequireRole.jsx
trucks/
hooks/
useTrucks.js
useTruck.js
TruckCard.jsx
menu/
hooks/
useMenu.js
MenuItemCard.jsx
cart/
hooks/
useCart.js
CartPanel.jsx
orders/
hooks/
useCreateOrder.js
useMyOrders.js
useTruckOrders.js
lib/
firebase.js
db.js // helpers RTDB (paths, CRUD)
functionsClient.js // appel httpsCallable / fetch functions
format.js // prix, date, etc.
pages/
Home.jsx
Trucks.jsx
TruckDetails.jsx
CheckoutSuccess.jsx
Login.jsx
Register.jsx
pizzaiolo/
Dashboard.jsx
Profile.jsx
Menu.jsx
Orders.jsx
functions/
src/
index.ts|index.js // endpoints Stripe/Connect/webhook


---

## 6) Conventions `.env` (Vite)
### Front `.env.local` (NON commité)
- Toutes les variables front doivent être préfixées `VITE_` :


VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_FUNCTIONS_REGION=europe-west1


### Functions `functions/.env` (NON commité)

STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=http://localhost:5173
PLATFORM_FEE_PERCENT=5


---

## 7) Routage (React Router) : règles
### 7.1 Routes publiques
- `/` Home
- `/trucks` liste camions
- `/t/:truckId` fiche camion + menu + panier
- `/checkout/success` confirmation

### 7.2 Auth
- `/login` / `/register`

### 7.3 Routes protégées (pizzaiolo)
- `/pizzaiolo/dashboard`
- `/pizzaiolo/profile`
- `/pizzaiolo/menu`
- `/pizzaiolo/orders`

**Règle :**
- Utiliser `RequireAuth` + `RequireRole("pizzaiolo")` pour toutes les pages pizzaiolo.
- Les routes doivent être centralisées dans `src/app/routes.jsx` et réutilisées partout (pas de strings dispersées).

---

## 8) Politique composants : réutilisation maximale
- Tout ce qui ressemble à une brique UI doit être dans `components/ui/` :
  - `Button`, `Input`, `Card`, `Badge`, `Modal`, `Spinner`
- Les composants métier vont dans `features/*`.
- Les pages doivent rester “bêtes” : elles orchestrent les hooks + composants, pas de logique DB lourde dans les pages.

**Règle Copilot :**
- Avant de créer un nouveau composant : vérifier si un équivalent existe déjà.
- Préférer l’extension d’un composant générique (props) plutôt que la duplication.

---

## 9) Politique Hooks (qualité, perf, lisibilité)
### 9.1 Hooks standards attendus
- `useAuth()` : user, role, login/register/logout
- `useTrucks()` : liste camions actifs
- `useTruck(truckId)` : détails camion
- `useMenu(truckId)` : items menu
- `useCart()` : add/remove/update/total (Context)
- `useCreateOrder()` : crée l’ordre `created`
- `useMyOrders()` : commandes client
- `useTruckOrders(truckId)` : commandes côté pizzaiolo

### 9.2 Règles de perf
- Éviter les re-renders globaux :
  - `CartProvider` isolé
  - `AuthProvider` minimal
- Utiliser `useMemo` / `useCallback` quand nécessaire (handlers passés aux enfants).
- Ne pas faire de “subscribe DB” dans 10 composants : centraliser via hooks.

### 9.3 Nettoyage
- Tout listener Firebase doit être unsub dans le cleanup `useEffect`.
- Toute promesse doit gérer l’annulation logique (éviter state update après unmount).

---

## 10) Base de données (MVP) : principes
- Lecture publique : `trucks` + `menus`
- Écriture camion/menu : uniquement par propriétaire (ownerUid)
- Orders :
  - Client crée `created`
  - Paiement → webhook met `paid`
  - Pizzaiolo peut passer `accepted/ready/completed` via Function (V2) ou règles adaptées

**Important :**
- Le front ne doit pas pouvoir écrire `paid`.

---

## 11) Stripe / Connect : endpoints Functions attendus
### 11.1 Endpoints (MVP)
1) `createConnectAccount(truckId)`
2) `createAccountLink(truckId)` → onboarding
3) `createCheckoutSession(orderId)` → retourne `{ url }`
4) `stripeWebhook` → valide signature, met commande `paid`

### 11.2 Produit/Prices Stripe (MVP)
- V1 : ne pas créer des products Stripe.
- Utiliser `line_items` dynamiques dans Checkout Session (depuis menu Firebase).
- V2 : créer products/prices si nécessaire (automation via Stripe API/CLI/MCP).

---

## 12) Design (simple, inspiré Planity, mais MVP)
- UI claire : fond clair, cartes, sections, CTA.
- Accent couleur : **#10B981** (vert émeraude).
- Layout :
  - Navbar sticky
  - Cards camion
  - Fiche camion avec menu en sections
  - Panier visible (side panel ou page)

Accessibilité :
- Focus visible
- Boutons avec `aria-label` si icône seule
- Form inputs avec labels

---

## 13) Optimisation “MVP mais sérieux”
- Lazy load des pages (React lazy) si simple à mettre.
- Skeleton/spinner minimal sur chargements.
- Utiliser `priceCents` et formatter côté UI (éviter flottants).
- Gérer les erreurs utilisateur : “Paiement annulé”, “Connexion requise”, etc.

---

## 14) Ce que Copilot doit faire par défaut
- Respecter la structure dossiers ci-dessus.
- Construire d’abord un parcours client fonctionnel (liste → fiche → panier → checkout).
- Ajouter ensuite l’espace pizzaiolo.
- Mettre les secrets dans `.env` / functions env.
- Centraliser les chemins de routes + les paths DB.
- Produire du code exécutable directement, avec messages d’erreur utiles.
- Garder l’UI simple (pas de librairies lourdes non demandées).

---

## 15) À éviter
- Mettre Stripe secret ou webhook secret côté front
- Écrire la logique paiement dans React
- Dupliquer les composants UI
- Mettre la logique DB directement dans les pages
- Ajouter trop de libs “magiques” (state managers lourds) sans besoin

---

## 16) Convention commits (simple)
- `feat(client): ...`
- `feat(pizzaiolo): ...`
- `feat(stripe): ...`
- `chore: ...`
- `fix: ...`

---

## 17) Prompts de tâches (exemples Copilot)
- “Implémente `useTrucks()` avec écoute RTDB et tri par ville, + loading/error.”
- “Crée `TruckDetails.jsx` + `MenuItemCard` + `useCart` (Context) + total.”
- “Ajoute Function `createCheckoutSession(orderId)` + appel front via `functionsClient.js`.”
- “Ajoute `RequireRole` pour protéger `/pizzaiolo/*` et un layout dashboard.”

---

> Rappel : MVP = vitesse + sécurité. Tout ce qui touche l’argent et le statut `paid` doit être piloté par Cloud Functions + webhooks.


# =========================
# OS / Editor
# =========================
.DS_Store
Thumbs.db
.idea/
.vscode/
*.swp
*.swo

# =========================
# Node / Vite / React
# =========================
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
*.log

dist/
dist-ssr/
.vite/
.cache/

# =========================
# Env / Secrets (NEVER COMMIT)
# =========================
.env
.env.*
!.env.example

# If you keep env files inside functions too
functions/.env
functions/.env.*
functions/.env.example.local

# Common secret/key files
**/serviceAccountKey.json
**/service-account*.json
**/*-service-account*.json
**/google-credentials*.json
**/*.pem
**/*.key
**/*.p12

# =========================
# Firebase
# =========================
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log

# Firebase local files / runtime config dumps
.functions/
functions/.runtimeconfig.json

# =========================
# Firebase Functions (Node)
# =========================
functions/node_modules/
functions/lib/
functions/dist/
functions/.eslintcache
functions/.cache/

# =========================
# Testing / Coverage
# =========================
coverage/
.nyc_output/

# =========================
# Build tools / misc
# =========================
*.tsbuildinfo
