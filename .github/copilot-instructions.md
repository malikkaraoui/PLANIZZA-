# Instructions GitHub Copilot — PLANIZZA

Ce fichier existe pour que Copilot capte immédiatement les règles du dépôt.

## Référence
- Les instructions détaillées et canoniques sont dans `instruction_copilot.md` (racine).

## Règles strictes (rappel)
- **Jamais** de clé Stripe secrète (`sk_...`) ou webhook secret (`whsec_...`) dans le front, ni commité.
- Côté front: uniquement `VITE_STRIPE_PUBLISHABLE_KEY`.
- Tout ce qui touche l’argent/statut `paid` = **Firebase Cloud Functions + Webhook Stripe**.
- Le front ne crée **jamais** une session Checkout directement via Stripe secret API.

## Paiement (MVP)
- Le front appelle une Function `createCheckoutSession` et redirige l’utilisateur via l’URL ou `sessionId`.
- Le statut `paid` doit être écrit **uniquement** depuis `stripeWebhook` après vérification de signature.

## Hygiène Git
- Ne jamais commiter: `.env*`, `functions/.env*` (sauf `.env.example`).

## Structure
- Conserver l’organisation `src/app`, `src/features`, `src/components`, `src/lib`.
- Préférer hooks + petits composants.

# GitHub Copilot — Instructions du dépôt
# Projet : PIZZA — COMMANDE — STRIPE
# Stack : Vite + React (JS/JSX) + Tailwind + Firebase (Auth, Realtime Database, Functions) + Stripe Checkout

## 0) Objectif MVP (résumé)
Construire une application web avec 3 profils :
1) USER Explorateur : explore sans compte (camions, menus, panier). Compte obligatoire uniquement au paiement.
2) USER Connecté : retrouve ses derniers camions et peut recommander en 1 clic.
3) PIZZAIOLO : crée et administre son camion (profil, menu, horaires, capacité, commandes).

Paiement : Stripe Checkout (one-shot) + validation réelle via webhook (Cloud Functions) + suivi commande en temps réel.

## 1) Règles non négociables (sécurité + architecture)
- Aucun secret Stripe côté front. Les secrets Stripe sont uniquement dans Cloud Functions (env/secret manager).
- Le front ne “valide” jamais un paiement : seule la confirmation webhook met `paymentStatus = "paid"`.
- Explore/Menu/Panier doivent fonctionner sans authentification.
- Auth requise au moment de valider la commande (checkout).
- Données privées (users, orders) protégées via RTDB Security Rules (scopées par auth.uid).
- Réutiliser un maximum de composants (cards, badges, glass panels, boutons, inputs, modals).
- Pas de logique business sensible uniquement côté front (prix total, paiement, statut final) : le front affiche, le back confirme.

## 2) Parcours utilisateurs (flows)

### 2.1 USER Explorateur (sans compte au départ)
- /explore : liste camions + filtres (distance, badges, note, ouvert)
- /truck/:truckId : détail camion + menu + add to cart
- /cart : panier local (localStorage) + total + CTA “Valider ma commande”
- /checkout : AuthGate
  - Google Sign-in Firebase
  - Étape “Compléter le profil” : téléphone obligatoire
    - MVP : demander téléphone + flag phoneVerified=false
    - Reco : prévoir plus tard vérification SMS + linking (Google + Phone)
- Appel callable function `createCheckoutSession(orderDraft)`
- Redirection vers Stripe Checkout
- Retour /order/:orderId : suivi temps réel (reçue → préparation → cuisson → prête)
  - MVP : timeline totale 4 minutes

### 2.2 USER déjà client
- Connexion Google
- /home (ou /explore enrichi) affiche :
  - derniers camions fréquentés
  - dernière commande + bouton “Recommander”
- Possibilité changer localisation et commander ailleurs

### 2.3 PIZZAIOLO
- Bouton visible “Je suis un Pizzaiolo”
- /pizzaiolo/start : explication + CTA onboarding
- Auth Google obligatoire
- Formulaire création camion :
  - Identité : nom, prénom, téléphone, email
  - Légal : siret, société
  - Emplacement : adresse + coords
  - Médias : photo camion, logo
  - Menu items : (nom, description, type pizza/calzone/sucré, prix)
  - Badges : bio, terroir, sans gluten, halal, kasher, sucré
  - Opérations : minPerPizza, pizzaPerHour
  - Horaires : jours + heures (structure claire)
- Dashboard pizzaiolo :
  - édition camion/menu
  - gestion commandes (affichage + changement statut manuel plus tard)

## 3) Pages & Routing (React Router)
Routes publiques :
- / -> redirect /explore
- /explore
- /truck/:truckId
- /cart
- /checkout
- /order/:orderId  (lecture autorisée si owner)

Routes privées USER :
- /account
- /orders

Routes privées PIZZAIOLO :
- /pizzaiolo/start
- /pizzaiolo/dashboard
- /pizzaiolo/orders

Garde d’accès :
- <RequireAuth> : bloque si pas connecté
- <RequirePizzaiolo> : bloque si role != pizzaiolo

## 4) Design system : “Liquid Glass” (thème sombre + accent émeraude)
But : une UI moderne glass mais lisible, performante et accessible.
- Fond sombre (gradient subtle)
- Composants glass uniquement pour le chrome (cards, topbar, drawers)
- Verre : blur modéré, border fin, highlight, shadow douce
- Accent principal : #10B981 (émeraude)

Créer des composants UI réutilisables :
- GlassPanel, GlassButton, GlassInput, GlassModal/Drawer
- BadgePill (badges de camion)
- Stars (rating + count)
- DistancePill
- TruckCard (visuel + badges + étoiles + ouvert + CTA)
- FilterDrawer (distance, badges, note min, ouvert maintenant, tri)
- OrderStepper (étapes commande)
- Toast/notifications (ex : succès paiement, commande créée)

Accessibilité :
- gérer prefers-reduced-motion (désactiver anims)
- prévoir une option “réduire transparence” (classe CSS globale)

## 5) Données (Realtime Database) — modèle MVP
### 5.1 Public (lecture ouverte)
public/
  trucks/
    {truckId}/
      name
      logoUrl
      photoUrl
      location: { lat, lng, address }
      badges: { bio, terroir, sansGluten, halal, kasher, sucre }
      ratingAvg
      ratingCount
      openingHours: { mon:{open,close,enabled}, ... }
      capacity: { minPerPizza, pizzaPerHour }
      menu:
        items: [ { id, name, desc, type, priceCents } ]

### 5.2 Privé
users/
  {uid}/
    displayName
    photoURL
    phoneNumber
    phoneVerified
    role: "user" | "pizzaiolo"
    lastLocation: { lat, lng, ts }
    lastTruckIds: { truckId:true, ... } (ou array)

orders/
  {orderId}/
    uid
    truckId
    items: [ { id, name, qty, priceCents } ]
    totalCents
    status: "received"|"prep"|"cook"|"ready"|"cancelled"
    createdAt
    updatedAt
    payment:
      provider: "stripe"
      sessionId
      paymentStatus: "pending"|"paid"|"failed"
    timeline:
      receivedAt
      prepAt
      cookAt
      readyAt

pizzaiolos/
  {uid}/
    truckId
    createdAt

## 6) Stripe — architecture correcte (MVP)
Front :
- Sur “Payer” :
  - appelle callable function `createCheckoutSession({ truckId, items, phoneNumber? })`
  - reçoit { orderId, checkoutUrl }
  - redirige vers checkoutUrl

Functions :
- createCheckoutSession (callable)
  - vérifie auth
  - calcule total côté serveur (ne jamais faire confiance au total front)
  - crée order en RTDB paymentStatus="pending"
  - crée session Stripe Checkout
  - stocke sessionId dans order.payment.sessionId
  - renvoie checkoutUrl + orderId

- stripeWebhook (http)
  - vérifie signature webhook
  - sur checkout.session.completed :
    - retrouve orderId (metadata de session)
    - met paymentStatus="paid" + status="received" + timeline.receivedAt
    - lance la progression MVP 4 minutes (voir section 7)
  - idempotent : si déjà paid, ne pas rejouer

## 7) Suivi commande “temps réel” (MVP 4 minutes) — sans sleep fragile
Interdiction : faire des setTimeout long dans une function HTTP (non fiable).
Approche MVP robuste :
- Quand paymentStatus devient "paid", on stocke :
  - timeline.receivedAt = now
  - nextStepAt = now + 60s
- Une function planifiée (scheduler) tourne toutes les 30-60 secondes et :
  - scanne les orders paid non ready
  - si now >= nextStepAt :
    - avance status received→prep→cook→ready
    - met timeline.*At correspondant
    - met nextStepAt au palier suivant
- Le front écoute `orders/{orderId}` via RTDB onValue() et anime l’affichage.

## 8) Géoloc + distance + filtres
- Le front peut demander la géoloc. Si refus -> champ recherche (ville/CP).
- MVP : charger une liste de trucks (limite raisonnable) et calculer distance côté client.
- Tri :
  - distance
  - note
  - popularité (ratingCount)
- Filtres :
  - distance : <1km, <5km, <10km
  - badges multi-select
  - ouvert maintenant
  - note minimum

## 9) Structure attendue du code (à créer)
src/
  app/
    App.jsx
    routes.jsx
  pages/
    Explore.jsx
    TruckDetail.jsx
    Cart.jsx
    Checkout.jsx
    OrderTracking.jsx
    Account.jsx
    Orders.jsx
    PizzaioloStart.jsx
    PizzaioloDashboard.jsx
    PizzaioloOrders.jsx
  components/
    ui/
      GlassPanel.jsx
      GlassButton.jsx
      GlassInput.jsx
      GlassDrawer.jsx
      BadgePill.jsx
      Stars.jsx
      DistancePill.jsx
      EmptyState.jsx
    trucks/
      TruckCard.jsx
      TruckList.jsx
      TruckFilters.jsx
      MenuItemCard.jsx
    cart/
      CartItem.jsx
      CartSummary.jsx
    order/
      OrderStepper.jsx
      OrderTimeline.jsx
  hooks/
    useAuth.jsx
    useUserProfile.jsx
    useTrucks.jsx
    useGeoLocation.jsx
    useCart.jsx
    useOrder.jsx
  lib/
    firebase/
      client.js
      auth.js
      rtdb.js
    stripe/
      checkout.js
  styles/
    glass.css

functions/
  src/
    index.js
    stripe/
      createCheckoutSession.js
      webhook.js
    orders/
      schedulerAdvanceOrders.js
  package.json

## 10) Critères d’acceptation (Copilot doit livrer ça)
- Explore fonctionne sans compte (listing, filtres, détails, panier).
- Checkout impose auth + téléphone (au moins collecte).
- Paiement : checkout session crée via callable function.
- Webhook Stripe met paid et déclenche suivi.
- OrderTracking se met à jour en live (RTDB listener).
- Pizzaiolo onboarding crée truck + dashboard visible.
- UI Liquid Glass homogène, composants réutilisés, pas de duplication massive.

## 11) Conventions
- Prix en cents (int) partout.
- Dates en timestamps (ms).
- Un composant = un fichier.
- Pas de logique Stripe côté front autre que redirection.
- Ne jamais stocker de secrets dans repo.
