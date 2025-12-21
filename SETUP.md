# 📋 Guide de Configuration PLANIZZA

Ce guide vous accompagne pas à pas pour configurer le projet PLANIZZA de zéro.

## ✅ Checklist rapide

- [ ] Node.js LTS installé
- [ ] Firebase CLI installé globalement
- [ ] Compte Firebase créé
- [ ] Compte Stripe créé (mode test)
- [ ] Variables d'environnement configurées
- [ ] Git configuré avec remote GitHub

---

## 1️⃣ Installation des prérequis

### Node.js (via nvm - recommandé)

```bash
# Installer nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Installer Node LTS
nvm install --lts
nvm use --lts

# Vérifier
node -v  # Devrait afficher v18.x ou v20.x
npm -v
```

### Firebase CLI

```bash
# Installation globale
npm install -g firebase-tools

# Vérifier
firebase --version

# Login Firebase
firebase login
```

---

## 2️⃣ Configuration Firebase

### A) Créer un projet Firebase

1. Aller sur https://console.firebase.google.com/
2. Cliquer sur **"Ajouter un projet"**
3. Nom du projet : **PLANIZZA** (ou votre choix)
4. Activer Google Analytics (optionnel)
5. Créer le projet

### B) Activer les services Firebase

#### Authentication
1. Dans Firebase Console, aller dans **Authentication**
2. Cliquer sur **"Commencer"**
3. Activer les fournisseurs :
   - **Email/Password** (recommandé pour commencer)
   - **Google** (optionnel)
   - Autres selon vos besoins

#### Firestore Database
1. Dans Firebase Console, aller dans **Firestore Database**
2. Cliquer sur **"Créer une base de données"**
3. Choisir le mode :
   - **Mode test** (pour commencer - expire après 30 jours)
   - **Mode production** (règles de sécurité strictes)
4. Sélectionner la région (ex: `europe-west1` pour la France)

#### Hosting
1. Aller dans **Hosting**
2. Cliquer sur **"Commencer"**
3. Le reste se fera via CLI

### C) Récupérer les clés Firebase

1. Dans Firebase Console, aller dans **⚙️ Paramètres du projet**
2. Scroller jusqu'à **"Vos applications"**
3. Cliquer sur l'icône **Web** (`</>`)
4. Donner un nom à l'app : **PLANIZZA Web**
5. Cocher **"Configurer Firebase Hosting"**
6. Copier les valeurs de `firebaseConfig`

### D) Configurer le fichier .env.local

```bash
# Dans la racine du projet
cp .env.example .env.local
```

Ouvrir `.env.local` et remplir avec vos valeurs Firebase :

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=votre-projet-id
VITE_FIREBASE_STORAGE_BUCKET=votre-projet.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### E) Connecter le projet local à Firebase

```bash
# Dans la racine du projet
firebase use --add

# Sélectionner votre projet dans la liste
# Donner un alias : production (ou dev)
```

---

## 3️⃣ Configuration Stripe

### A) Créer un compte Stripe

1. Aller sur https://dashboard.stripe.com/register
2. Créer un compte (utiliser le **mode test** pour commencer)
3. Vérifier votre email

### B) Récupérer les clés API Stripe

1. Dans Stripe Dashboard, aller dans **Développeurs > Clés API**
2. Copier la **clé publique** (commence par `pk_test_...`)
3. Copier la **clé secrète** (elle commence généralement par `sk_`)

⚠️ **IMPORTANT** : 
- La clé publique (`pk_test_...`) va dans `.env.local` (frontend)
- La clé secrète va dans Firebase Functions (backend uniquement)

### C) Configurer Stripe dans le frontend

Dans `.env.local` :

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX
```

### D) Configurer Stripe dans Firebase Functions

```bash
# Depuis la racine du projet
firebase functions:config:set stripe.secret_key="YOUR_STRIPE_SECRET_KEY"

# Vérifier la configuration
firebase functions:config:get
```

### E) Créer des produits de test dans Stripe

1. Dans Stripe Dashboard, aller dans **Produits**
2. Cliquer sur **"Ajouter un produit"**
3. Nom : **Plan Basique** (exemple)
4. Prix : **9.99 EUR** (mode récurrent ou unique)
5. Copier l'ID du prix (commence par `price_...`)
6. Utiliser cet ID dans votre code pour créer des sessions de paiement

---

## 4️⃣ Configuration GitHub

### A) Créer le dépôt sur GitHub

1. Aller sur https://github.com/new
2. Nom du dépôt : **PLANIZZA** (ou autre)
3. Visibilité : **Privé** (recommandé) ou Public
4. Ne pas initialiser avec README, .gitignore, etc. (déjà créés localement)
5. Créer le dépôt

### B) Pousser le code sur GitHub

```bash
# Le remote est déjà configuré si vous avez suivi le bootstrap
# Sinon, l'ajouter :
git remote add origin https://github.com/VOTRE_USERNAME/PLANIZZA.git

# Vérifier les fichiers
git status

# Pousser vers GitHub
git push -u origin main
```

---

## 5️⃣ Développement local

### Démarrer le frontend

```bash
npm run dev
```

Ouvrir http://localhost:5173

### Démarrer les émulateurs Firebase

```bash
npm run firebase:emulators
```

Interfaces disponibles :
- **UI Emulators** : http://localhost:4000
- **Auth** : http://localhost:9099
- **Firestore** : http://localhost:8080
- **Functions** : http://localhost:5001
- **Hosting** : http://localhost:5000

### Tester une transaction Stripe

1. Utiliser les numéros de carte de test Stripe :
   - **Succès** : `4242 4242 4242 4242`
   - **Échec** : `4000 0000 0000 0002`
   - **3D Secure** : `4000 0027 6000 3184`
   - Date : n'importe quelle date future
   - CVC : n'importe quels 3 chiffres

---

## 6️⃣ Déploiement

### Build du projet

```bash
npm run build
```

Vérifier que `dist/` est créé sans erreurs.

### Déployer sur Firebase

```bash
# Déploiement complet (hosting + functions)
npm run firebase:deploy

# Ou séparément
npm run firebase:hosting    # Frontend seulement
npm run firebase:functions  # Backend seulement
```

Votre site sera accessible sur :
```
https://VOTRE_PROJET_ID.web.app
```

---

## 7️⃣ Configuration avancée

### Webhooks Stripe

Pour recevoir les événements de paiement en temps réel :

1. Dans Stripe Dashboard, aller dans **Développeurs > Webhooks**
2. Cliquer sur **"Ajouter un point de terminaison"**
3. URL : `https://REGION-PROJET_ID.cloudfunctions.net/stripeWebhook`
4. Événements à écouter :
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copier le **Secret de signature** du webhook
6. Configurer dans Functions :

```bash
firebase functions:config:set stripe.webhook_secret="YOUR_STRIPE_WEBHOOK_SECRET"
```

### Règles de sécurité Firestore

Créer `firestore.rules` :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Utilisateurs authentifiés seulement
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Autres collections selon vos besoins
  }
}
```

Déployer :
```bash
firebase deploy --only firestore:rules
```

### Variables d'environnement de production

Pour la production, créer `.env.production` (ne pas commiter) :

```env
# Production Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
# etc.

# Production Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Build pour production :
```bash
npm run build
```

---

## 🆘 Dépannage

### Erreur : "Firebase config is incomplete"

➡️ Vérifier que toutes les variables dans `.env.local` sont remplies.

### Erreur : "Stripe is not defined"

➡️ Vérifier que `VITE_STRIPE_PUBLISHABLE_KEY` est dans `.env.local`.

### Les émulateurs ne démarrent pas

➡️ Vérifier que les ports ne sont pas occupés (4000, 5000, 5001, 8080, 9099).

### Les fonctions ne se déploient pas

➡️ Vérifier que `functions/node_modules` est installé :
```bash
cd functions && npm install && cd ..
```

### Erreur lors du build

➡️ Nettoyer et réinstaller :
```bash
rm -rf node_modules dist
npm install
npm run build
```

---

## 📚 Ressources utiles

- [Documentation Firebase](https://firebase.google.com/docs)
- [Documentation Stripe](https://stripe.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [React Router Documentation](https://reactrouter.com/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)

---

**🎉 Votre environnement PLANIZZA est maintenant prêt !**

Pour toute question, consulter le [README.md](README.md) ou créer une issue sur GitHub.
