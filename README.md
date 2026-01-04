# 🍕 PLANIZZA

Plateforme web moderne de commande et gestion de pizzas itinérantes. Une application complète permettant aux clients de commander auprès de camions pizzas, et aux pizzaiolos de gérer leur activité (menu, commandes en temps réel, tableau de bord).

**Stack technique** : Vite + React 19 + TailwindCSS + Firebase (Auth, Realtime Database, Functions) + Stripe

## ✨ Fonctionnalités

### 👥 Côté Client
- 🔍 Exploration des camions pizzas (géolocalisation, filtres, badges)
- 🍕 Consultation des menus avec personnalisation des pizzas
- 🛒 Panier intelligent avec sauvegarde automatique
- 💳 Paiement sécurisé via Stripe Checkout
- 📱 Suivi de commande en temps réel
- 🎁 Programme de fidélité

### 🚚 Côté Pizzaiolo
- 📊 Dashboard complet avec statistiques
- 📋 Gestion du menu (création, modification, prix par taille)
- 🎨 Personnalisation avancée des pizzas (ingrédients)
- 📱 Mode Live pour commandes manuelles sur place
- ⏸️ Gestion des pauses et disponibilité
- 📦 Suivi des commandes en temps réel
- 💰 Historique des ventes

## 📁 Structure du projet

```
PLANIZZA/
├── src/
│   ├── app/              # Router et configuration app principale
│   │   ├── App.jsx       # Composant racine avec RouterProvider
│   │   ├── router.jsx    # Configuration des routes
│   │   └── providers/    # Providers React (Auth, etc.)
│   ├── components/       # Composants réutilisables
│   │   ├── layout/       # Layout (Header, Footer, etc.)
│   │   ├── loyalty/      # Composants fidélité
│   │   ├── partner/      # Composants partenaires
│   │   └── ui/           # Composants UI réutilisables
│   ├── features/         # 🆕 Modules métier (logique réutilisable)
│   │   ├── cart/         # Gestion du panier utilisateur
│   │   ├── menu/         # 🔥 Logique menu (hooks, utils, constants)
│   │   ├── orders/       # Gestion des commandes
│   │   ├── trucks/       # Gestion des camions
│   │   └── users/        # Gestion des utilisateurs
│   ├── lib/              # Utilitaires et configurations
│   │   ├── firebase.js   # Configuration Firebase
│   │   ├── stripe.js     # Configuration Stripe
│   │   └── utils.js      # Utilitaires généraux
│   ├── pages/            # Pages de l'application
│   │   ├── pizzaiolo/    # Pages pizzaiolo (Dashboard, Live, Menu, etc.)
│   │   └── ...           # Autres pages (Home, Login, etc.)
│   └── styles/           # Styles personnalisés
├── functions/            # Firebase Cloud Functions (backend)
│   ├── index.js          # Functions (createCheckoutSession, stripeWebhook)
│   └── package.json      # Dépendances Functions (stripe, firebase-admin)
├── .env.example          # Template des variables d'environnement
├── .env.local            # Variables d'environnement locales (NON COMMITÉ)
├── firebase.json         # Configuration Firebase (hosting, functions, emulators)
└── package.json          # Dépendances frontend et scripts npm
```

### 🔥 Module Menu (`src/features/menu/`)

Module réutilisable contenant toute la logique métier pour la gestion du menu, du panier et de la personnalisation.

```
src/features/menu/
├── constants/           # Constantes et configuration
│   ├── ingredients.js   # 50+ ingrédients organisés par catégories
│   ├── menuConfig.js    # Configuration (TVA, types, catégories, tailles)
│   └── index.js         # Export centralisé
├── hooks/               # Hooks React réutilisables
│   ├── useLiveCart.js   # Gestion panier mode Live (pizzaiolo)
│   ├── useLiveOrder.js  # Sync Firebase temps réel
│   ├── useMenuItem.js   # État et interactions d'un item
│   ├── usePizzaCustomization.js # Personnalisation pizzas
│   └── index.js         # Export centralisé
├── utils/               # Utilitaires purs
│   ├── menuHelpers.js   # Filtrage, formatage, helpers menu
│   ├── priceCalculations.js # Calculs de prix (TVA, TTC, etc.)
│   └── index.js         # Export centralisé
├── README.md            # Documentation complète du module
└── index.js             # Export centralisé du module complet
```

**Documentation complète** : [`src/features/menu/README.md`](src/features/menu/README.md)

## 🚀 Démarrage rapide

### 1. Prérequis

- Node.js LTS (recommandé via [nvm](https://github.com/nvm-sh/nvm))
- npm ou yarn
- Firebase CLI : `npm i -g firebase-tools`

### 2. Installation

```bash
# Cloner le projet
git clone https://github.com/malikkaraoui/PLANIZZA-.git
cd PLANIZZA

# Installer les dépendances frontend
npm install

# Installer les dépendances Firebase Functions
cd functions && npm install && cd ..
```

### 3. Configuration Firebase

#### a) Créer un projet Firebase
1. Aller sur [Firebase Console](https://console.firebase.google.com/)
2. Créer un nouveau projet
3. Activer **Authentication**, **Realtime Database** et **Hosting**

#### b) Configurer les variables d'environnement
```bash
# Copier le template
cp .env.example .env.local

# Remplir avec vos vraies valeurs Firebase depuis Project Settings
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_PROJECT_ID=...
# etc.
```

#### c) Connecter le projet Firebase
```bash
firebase login
firebase use --add  # Sélectionner votre projet
```

### 4. Configuration Stripe

#### a) Créer un compte Stripe
1. Aller sur [Stripe Dashboard](https://dashboard.stripe.com/register)
2. Récupérer les clés API (mode test)

#### b) Configurer Stripe
```bash
# Frontend (dans .env.local)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Backend (Firebase Functions)
firebase functions:config:set stripe.secret_key="YOUR_STRIPE_SECRET_KEY"
firebase functions:config:set stripe.webhook_secret="YOUR_STRIPE_WEBHOOK_SECRET" # Pour les webhooks
```

## 💻 Scripts disponibles

### Frontend
```bash
npm run dev                    # Démarrer le serveur de développement Vite
npm run build                  # Build de production
npm run preview                # Prévisualiser le build
npm run lint                   # Linter le code
```

### Firebase
```bash
npm run emulators              # Alias: démarrer les émulateurs locaux
npm run deploy                 # Alias: deploy Firebase
npm run firebase:emulators     # Démarrer les émulateurs locaux
npm run firebase:deploy        # Build + deploy complet (hosting + functions)
npm run firebase:functions     # Deploy uniquement les functions
npm run firebase:hosting       # Build + deploy uniquement le hosting
```

## 🧪 Développement local avec émulateurs

Les émulateurs Firebase permettent de tester localement sans toucher à la production :

```bash
# Démarrer tous les émulateurs
npm run firebase:emulators
```

Émulateurs disponibles :
- **Auth** : http://localhost:9099
- **Realtime Database** : http://localhost:9000
- **Functions** : http://localhost:5001
- **Firestore** : http://localhost:8080
- **Hosting** : http://localhost:5000
- **UI Emulators** : http://localhost:4000

## 🔐 Sécurité

### ✅ Bonnes pratiques
- ✅ Variables d'environnement avec préfixe `VITE_` pour le frontend
- ✅ Clés Firebase publiques exposées côté client (normal)
- ✅ Clé secrète Stripe **uniquement côté backend** (Functions)
- ✅ `.env.local` dans `.gitignore`
- ✅ `.env.example` commité pour documentation

### ❌ À ne JAMAIS faire
- ❌ Commiter `.env.local` ou `.env`
- ❌ Mettre la clé secrète Stripe dans le code frontend
- ❌ Commiter `serviceAccountKey.json`
- ❌ Exposer les secrets dans les logs

## 📦 Technologies

### Frontend
- **Vite** : Build tool ultra-rapide
- **React 19** : Framework UI
- **React Router** : Routing côté client
- **TailwindCSS** : Utility-first CSS
- **Lucide React** : Icônes modernes
- **@stripe/stripe-js** : Intégration Stripe frontend

### Backend
- **Firebase Functions** : Serverless backend
- **Firebase Auth** : Authentification (Google OAuth)
- **Realtime Database (RTDB)** : Base de données temps réel
- **Firebase Hosting** : Hébergement web
- **Stripe API** : Paiements sécurisés

### Architecture
- **Feature-based** : Organisation par modules métier (`src/features/`)
- **Hooks personnalisés** : Logique réutilisable et testable
- **Utilitaires purs** : Fonctions isolées sans effets de bord
- **Constants centralisées** : Configuration unique et partagée

## 🔄 Workflow Git

```bash
# Créer une branche feature
git checkout -b feature/nom-feature

# Commiter vos changements
git add .
git commit -m "feat: description du changement"

# Pousser vers GitHub
git push origin feature/nom-feature

# Créer une Pull Request sur GitHub
```

## 📝 TODOs

### 🔥 Récemment complété
- [x] ♻️ **Refactoring module Menu** : Extraction de toute la logique métier
  - [x] 4 hooks réutilisables (`useLiveCart`, `usePizzaCustomization`, `useMenuItem`, `useLiveOrder`)
  - [x] 2 fichiers d'utilitaires (calculs prix, helpers menu)
  - [x] 2 fichiers de constantes (ingrédients, configuration)
  - [x] Documentation complète + exemples d'utilisation
  - [x] Architecture scalable et testable

### Backend (Functions)
- [x] Implémenter `createCheckoutSession` avec authentification
- [x] Valider les paramètres d'entrée
- [x] Configurer les webhooks Stripe pour les confirmations
- [ ] Enregistrer les sessions Stripe dans Firestore
- [ ] Ajouter plus de logs pour le debugging
- [ ] Gérer plus de cas limites

### Frontend
- [x] Créer un contexte AuthContext pour gérer l'authentification
- [x] Implémenter les pages Login/Register
- [x] Créer un Dashboard pizzaiolo complet
- [x] Intégrer le flow Stripe Checkout
- [x] Ajouter une page de succès/échec de paiement
- [x] Page Live pour commandes manuelles (pizzaiolo)
- [x] Gestion du menu avec personnalisation pizzas
- [x] Gestion des commandes temps réel
- [ ] Refactoriser la page Menu.jsx avec les nouveaux hooks
- [ ] Implémenter la gestion d'état globale (Context API)
- [ ] Ajouter la gestion de fidélité complète

### DevOps
- [ ] Configurer GitHub Actions pour CI/CD
- [ ] Mettre en place les tests (Jest + React Testing Library)
- [x] Configurer les règles de sécurité Realtime Database
- [ ] Optimiser les performances (lazy loading, code splitting)

## 📚 Documentation

### Projet
- [📖 Module Menu - Architecture complète](src/features/menu/README.md)
- [📋 Refactoring Live.jsx - Synthèse](REFACTORING_LIVE.md)

### Technologies externes
- [Vite](https://vite.dev/)
- [React](https://react.dev/)
- [TailwindCSS](https://tailwindcss.com/)
- [React Router](https://reactrouter.com/)
- [Firebase](https://firebase.google.com/docs)
- [Stripe](https://stripe.com/docs)

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche feature
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

MIT © 2025 PLANIZZA

## 👤 Auteur

**Malik Karaoui**
- GitHub: [@malikkaraoui](https://github.com/malikkaraoui)
- Repo: [PLANIZZA-](https://github.com/malikkaraoui/PLANIZZA-)

---

**🚀 Bon développement avec PLANIZZA !**

