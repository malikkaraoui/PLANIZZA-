# PLANIZZA — instruction_base_website.md

Bootstrapping d’un site **MVP** inspiré de Planity, dédié aux **pizzaiolos indépendants (camions)** + aux **clients**.

Objectif : tester le concept rapidement avec un vrai parcours : **je trouve → je commande → je paye**.

> Contrainte sécurité : aucune clé sensible dans Git. La clé Stripe **secrète** ne doit vivre **que** côté Firebase Functions.

---

## 0) MVP — ce qu’on construit (simple et testable)

### Côté client
- Page d’accueil type marketplace (style Planity) : recherche / proximité / liste des camions.
- Fiche camion : infos, menu, panier.
- Paiement simple via **Stripe Checkout** (Apple Pay géré par Stripe si dispo).
- Confirmation de commande + statut basique.

### Côté pizzaiolo
- Création de compte (email + mdp). Vérif téléphone : **plus tard**.
- Dashboard minimal :
  - Profil camion : nom, logo, photos, description, localisation, horaires, jours d’ouverture.
  - Menu : pizzas + boissons (nom, prix, photo, dispo).
  - Commandes : liste des commandes payées (statut).

### Important (MVP)
- Pas de créneaux capacité/heure en V1 (option V2).
- Pas de RIB stocké dans Firebase : **toutes les infos bancaires restent chez Stripe** via onboarding Connect.
- Pas de livraison V1 : **retrait au camion** uniquement.

---

## 1) Stack recommandée (rapide + propre)

### Front
- Vite + React
- React Router
- TailwindCSS
- lucide-react (icônes)
- (option) sonner ou react-hot-toast (toasts)

### Backend
Firebase :
- Hosting (front)
- Auth (email/password)
- **Firestore (recommandé)** ou Realtime Database (RTDB)
- Cloud Functions (API backend + webhooks Stripe)
- Emulators (dev local)

### Paiement
- Stripe Checkout (simple)
- Stripe Connect (mode marketplace) : chaque pizzaiolo a son compte Stripe connecté
- Webhook Stripe → met à jour la commande côté Firebase

---

## 2) Démarrage projet (commandes)

### 2.1 Création Vite + dépendances

```bash
npm create vite@latest planizza -- --template react
cd planizza
git init
npm install

# routing + icons + firebase
npm i react-router-dom lucide-react firebase @stripe/stripe-js

# tailwind
npm i -D tailwindcss postcss autoprefixer @tailwindcss/postcss
```

> Note Tailwind v4 : le plugin PostCSS est `@tailwindcss/postcss` (et non `tailwindcss` directement).

---

## 3) Structure de dossiers (simple, orientée features)

```text
src/
  app/
    App.jsx
    router.jsx
    providers/
      AuthProvider.jsx
  components/
    layout/
      Navbar.jsx
      Footer.jsx
    ui/
      Button.jsx
      Input.jsx
      Card.jsx
      Badge.jsx
  features/
    trucks/
      hooks/
        useTrucks.js
        useTruck.js
      TruckCard.jsx
      TruckHeader.jsx
    menu/
      hooks/
        useMenu.js
      MenuItemCard.jsx
    cart/
      hooks/
        useCart.js
      CartDrawer.jsx
    orders/
      hooks/
        useCreateOrder.js
        useMyOrders.js
  lib/
    firebase.js
    stripeClient.js
    geo.js
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
  styles/
    globals.css (option)
```

---

## 4) Hygiene obligatoire (.gitignore)

À ignorer au minimum :

```text
node_modules/
dist/
.vite/
.firebase/
firebase-debug.log
*.log

.env
.env.*
functions/.env
functions/.env.*
```

---

## 5) Variables d’environnement

### 5.1 .env.example (commité) + .env.local (jamais commité)

Créer/maintenir `.env.example` :

```dotenv
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
```

Créer `.env.local` (non commit) avec les vraies valeurs.

---

## 6) Firebase setup (CLI + Emulators)

### 6.1 Installer Firebase Tools

```bash
npm i -g firebase-tools
firebase login
```

### 6.2 Initialiser Firebase dans le projet

```bash
firebase init
```

Sélections recommandées :
- Hosting: YES (dist = `dist`, SPA = YES)
- Functions: YES (Node 18/20)
- Firestore: YES (si tu choisis Firestore) / Realtime Database: YES (si RTDB)
- Emulators: Auth + Functions + Database + Hosting

---

## 7) Stripe — flux MVP

### 7.1 Checkout
1. Le client crée un panier.
2. Le front appelle une Function `createCheckoutSession`.
3. Stripe Checkout gère paiement (et Apple Pay si dispo).
4. Stripe envoie un webhook à une Function `stripeWebhook`.
5. La Function met à jour la commande dans Firebase (payée / annulée).

### 7.2 Connect (V2 proche)
- Créer un compte Stripe connecté pour chaque pizzaiolo.
- Conserver uniquement l’identifiant Stripe Connect côté Firebase.
- Aucun IBAN/RIB n’est stocké chez nous.

---

## 8) Données minimales (suggestion)

### Collections/Noeuds
- `trucks` (camions)
- `menus/{truckId}/items` (items)
- `orders` (commandes)
- `users` (pizzaiolos)

### Statuts de commande (MVP)
- `created` → `paid` → `ready` → `picked_up`
- `canceled`

---

## 9) Checklist “ça marche” (MVP)

- [ ] Je vois une liste de camions.
- [ ] J’ouvre une fiche camion et je remplis un panier.
- [ ] Je paye via Stripe Checkout.
- [ ] Je reviens sur une page de succès.
- [ ] La commande apparaît côté pizzaiolo (dashboard) en statut “paid”.
