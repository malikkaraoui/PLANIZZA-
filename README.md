# 🍕 PLANIZZA

Plateforme web moderne de gestion et planification construite avec Vite, React, TailwindCSS, Firebase et Stripe.

## 📁 Structure du projet

```
PLANIZZA/
├── src/
│   ├── app/              # Router et configuration app principale
│   │   ├── App.jsx       # Composant racine avec RouterProvider
│   │   └── router.jsx    # Configuration des routes
│   ├── components/       # Composants réutilisables
│   ├── lib/              # Utilitaires et configurations
│   │   └── firebase.js   # Configuration Firebase avec variables d'env
│   ├── pages/            # Pages de l'application
│   │   └── Home.jsx      # Page d'accueil
│   └── styles/           # Styles personnalisés
├── functions/            # Firebase Cloud Functions (backend)
│   ├── index.js          # Functions (createCheckoutSession, stripeWebhook)
│   └── package.json      # Dépendances Functions (stripe, firebase-admin)
├── .env.example          # Template des variables d'environnement
├── .env.local            # Variables d'environnement locales (NON COMMITÉ)
├── firebase.json         # Configuration Firebase (hosting, functions, emulators)
└── package.json          # Dépendances frontend et scripts npm
```

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
3. Activer **Authentication**, **Firestore** et **Hosting**

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
- **Firebase Auth** : Authentification
- **Firestore** : Base de données NoSQL
- **Stripe API** : Paiements sécurisés

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

### Backend (Functions)
- [ ] Implémenter l'authentification Firebase dans `createCheckoutSession`
- [ ] Valider les paramètres d'entrée (priceId, quantity)
- [ ] Enregistrer les sessions Stripe dans Firestore
- [ ] Configurer les webhooks Stripe pour les confirmations
- [ ] Gérer les erreurs et les cas limites
- [ ] Ajouter des logs pour le debugging

### Frontend
- [ ] Créer un contexte AuthContext pour gérer l'authentification
- [ ] Implémenter les pages Login/Register
- [ ] Créer un Dashboard utilisateur
- [ ] Intégrer le flow Stripe Checkout
- [ ] Ajouter une page de succès/échec de paiement
- [ ] Implémenter la gestion d'état (Context API ou Redux)

### DevOps
- [ ] Configurer GitHub Actions pour CI/CD
- [ ] Mettre en place les tests (Jest + React Testing Library)
- [ ] Configurer les règles de sécurité Firestore
- [ ] Optimiser les performances (lazy loading, code splitting)

## 📚 Documentation

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

