# 🧪 Guide de Test : Guest Checkout avec signInAnonymously

## 📋 Checklist de Test Complète

### Phase 1 : Guest Checkout (Sans compte)

#### Test 1.1 : Navigation basique guest
- [ ] Ouvrir le site en navigation privée (ou vider cookies/localStorage)
- [ ] Vérifier : Pas de login automatique
- [ ] Naviguer vers `/explore` → Choisir un truck
- [ ] Ajouter des items au panier
- [ ] Cliquer "Payer"

**Résultat attendu** :
- La page Checkout affiche : "💡 Vous pouvez payer sans créer de compte..."
- Pas d'erreur dans la console

---

#### Test 1.2 : Création compte anonyme au checkout
- [ ] Cliquer sur "Payer sur Stripe"
- [ ] Ouvrir DevTools → Console
- [ ] Vérifier qu'un `signInAnonymously()` est appelé

**Résultat attendu** :
```javascript
// Dans la console DevTools
[PLANIZZA] Firebase non configuré (mode DEV)...
// OU si Firebase configuré :
auth.currentUser.isAnonymous === true
auth.currentUser.uid !== null  // UID Firebase valide (ex: "abc123xyz")
```

---

#### Test 1.3 : Redirection Stripe
- [ ] Après création du compte anonyme, vérifier la redirection Stripe Checkout

**Résultat attendu** :
- Redirection vers `https://checkout.stripe.com/...`
- Aucune erreur 401 "Vous devez être connecté pour payer"

---

#### Test 1.4 : Paiement test Stripe
- [ ] Sur la page Stripe Checkout, utiliser une carte de test :
  - **Numéro** : `4242 4242 4242 4242`
  - **Expiration** : N'importe quelle date future (ex: `12/34`)
  - **CVC** : N'importe quel 3 chiffres (ex: `123`)
- [ ] Cliquer "Payer"

**Résultat attendu** :
- Redirection vers `/checkout/success?orderId=xxx&session_id=yyy`

---

#### Test 1.5 : Page CheckoutSuccess (guest)
- [ ] Vérifier l'affichage initial : "Commande en cours de validation"
- [ ] Attendre 3 secondes → Le webhook Stripe devrait passer
- [ ] Vérifier l'affichage final : "Paiement validé !"

**Résultat attendu** :
- **Bloc de création de compte visible** avec texte :
  > "🎉 Créez un compte pour suivre votre commande !"
  > "Votre paiement est confirmé ! En créant un compte maintenant..."
- Bouton "Créer mon compte"

---

### Phase 2 : Upgrade du Compte Anonyme

#### Test 2.1 : Clic sur "Créer mon compte"
- [ ] Cliquer sur "Créer mon compte"
- [ ] Vérifier la redirection vers `/register`

**Résultat attendu** :
- URL : `/register`
- `location.state.orderId` contient l'ID de la commande
- Titre : "Sauvegarder votre commande" (au lieu de "Créer un compte")

---

#### Test 2.2 : Inscription avec email/password
- [ ] Remplir le formulaire :
  - Email : `test+guest@example.com`
  - Password : `password123`
- [ ] Cliquer "S'inscrire"

**Résultat attendu dans DevTools Console** :
```javascript
[PLANIZZA] Compte anonyme upgradé avec succès ! abc123xyz
```

**Vérifications Firebase** :
- [ ] Ouvrir Firebase Console → Authentication → Users
- [ ] Chercher l'UID du user (ex: `abc123xyz`)
- [ ] Vérifier :
  - Provider : `password` (plus `anonymous`)
  - Email : `test+guest@example.com`
  - UID : **IDENTIQUE** à celui créé au checkout

---

#### Test 2.3 : Préservation de l'historique
- [ ] Après inscription, vérifier la redirection vers `/order/{orderId}`
- [ ] Vérifier que la commande s'affiche correctement
- [ ] Ouvrir Firebase Console → Realtime Database → `orders/{orderId}`

**Résultat attendu dans RTDB** :
```json
{
  "userUid": "abc123xyz",  // ← Même UID !
  "status": "received",
  "payment": {
    "paymentStatus": "paid"
  },
  // ... reste des données
}
```

**✅ Preuve que l'upgrade a fonctionné** : L'UID n'a pas changé, donc la commande reste liée au même utilisateur.

---

### Phase 3 : Cleanup Auto (48h)

#### Test 3.1 : Déployer la Cloud Function
```bash
cd functions
npm run lint
cd ..
npm run firebase:functions
```

**Résultat attendu** :
```
✔  functions[us-central1-cleanupAnonymousUsers]: Successful create operation.
```

---

#### Test 3.2 : Tester le cleanup manuellement (local)

**Option A : Modifier le code temporairement**
```javascript
// Dans functions/index.js, ligne 1720
const RETENTION_MS = 10 * 1000; // 10 secondes (au lieu de 48h)
```

**Puis exécuter** :
```bash
# Lancer les émulateurs
npm run emulators

# Dans un autre terminal, déclencher manuellement la fonction
firebase functions:shell
> cleanupAnonymousUsers()
```

**Résultat attendu dans les logs** :
```
[PLANIZZA][cleanupAnonymousUsers] Found 1 anonymous users older than 48h
[PLANIZZA] Keeping anonymous user abc123xyz (has orders)
[PLANIZZA][cleanupAnonymousUsers] Completed: 0 deleted, 1 protected, 0 errors
```

---

#### Test 3.3 : Vérifier qu'un anonyme SANS commande est supprimé

1. **Créer un compte anonyme orphelin** :
   ```javascript
   // Dans la console DevTools du site
   await firebase.auth().signInAnonymously();
   // Noter l'UID (ex: "orphan123")
   console.log(firebase.auth().currentUser.uid);
   ```

2. **Ne PAS créer de commande** (juste se déconnecter)

3. **Attendre 48h** (ou modifier `RETENTION_MS` pour test)

4. **Exécuter `cleanupAnonymousUsers()`**

**Résultat attendu** :
```
[PLANIZZA] Deleted anonymous user orphan123
[PLANIZZA][cleanupAnonymousUsers] Completed: 1 deleted, 0 protected, 0 errors
```

---

## 🐛 Troubleshooting

### Erreur : "Vous devez être connecté pour payer"
**Cause** : `signInAnonymously()` a échoué ou n'a pas été appelé.

**Debug** :
```javascript
// Dans Checkout.jsx, ajouter un console.log
console.log('User UID:', userUid);
console.log('Auth currentUser:', auth.currentUser);
```

**Solution** :
- Vérifier que `auth` est bien importé depuis `lib/firebase.js`
- Vérifier que Firebase est configuré (`.env.local` rempli)

---

### Erreur : "auth/credential-already-in-use"
**Cause** : L'email existe déjà dans un autre compte Firebase.

**Solution** :
1. Supprimer le compte existant dans Firebase Console
2. OU utiliser un autre email de test

---

### Le compte anonyme n'est pas upgradé
**Symptômes** :
- Après inscription, l'UID dans RTDB a changé
- La commande n'est plus visible pour le nouveau compte

**Debug** :
```javascript
// Dans Register.jsx, avant linkWithCredential
console.log('Current user before link:', auth.currentUser.uid, auth.currentUser.isAnonymous);
```

**Solution** :
- Vérifier que `useAuth()` retourne bien `user.isAnonymous === true`
- Vérifier que `auth.currentUser` n'est pas `null`

---

### La Cloud Function ne se déclenche pas
**Debug** :
```bash
# Vérifier que la fonction est déployée
firebase functions:list

# Vérifier les logs
firebase functions:log --only cleanupAnonymousUsers
```

**Solution** :
- Vérifier que le schedule est correct (`every 24 hours`)
- Pour forcer l'exécution : Firebase Console → Functions → cleanupAnonymousUsers → "Test function"

---

## 📊 Métriques de Succès

Après 1 semaine de prod, vérifier dans Firebase Analytics :

1. **Taux de conversion Guest → Compte** :
   - Combien de guests créent un compte après paiement ?
   - Cible : > 30%

2. **Erreurs de paiement** :
   - Est-ce que les erreurs 401 "Vous devez être connecté" ont disparu ?
   - Cible : 0 erreur

3. **Comptes anonymes actifs** :
   - Combien de comptes anonymes ont > 48h et ont des commandes ?
   - Ces comptes doivent être **protégés** (pas supprimés)

4. **Cleanup efficace** :
   - Combien de comptes anonymes sans commandes sont supprimés par jour ?
   - Cible : Réduction progressive du nombre total d'anonymes

---

## 🎯 Checklist de Déploiement

Avant de pousser en production :

- [ ] Tests 1.1 à 1.5 passent en local
- [ ] Tests 2.1 à 2.3 passent en local
- [ ] Cloud Function déployée et testée
- [ ] Cleanup orphan testé (au moins 1 suppression réussie)
- [ ] Pas de console.log sensibles (tokens, emails) en prod
- [ ] `.env.local` ne contient que des clés TEST Stripe
- [ ] README.md mis à jour avec la nouvelle doc guest checkout

---

## 📚 Documentation Technique

### Flow Complet

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Guest arrive sur le site (pas de compte)                    │
│    → auth.currentUser === null                                 │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Guest ajoute items au panier (localStorage)                 │
│    → Aucun compte créé à ce stade                              │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Guest clique "Payer sur Stripe"                             │
│    → Checkout.jsx : signInAnonymously(auth)                    │
│    → Firebase crée un compte anonyme (UID: "abc123")           │
│    → auth.currentUser.isAnonymous === true                     │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. createCheckoutSession (Function)                            │
│    → Reçoit le token Firebase du compte anonyme                │
│    → Crée orders/{orderId} avec userUid: "abc123"              │
│    → Crée session Stripe                                       │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Paiement Stripe + Webhook                                   │
│    → orders/{orderId}/status = "received"                      │
│    → payment.paymentStatus = "paid"                            │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. CheckoutSuccess affiche "Créer mon compte"                  │
│    → Guest clique → Navigate to /register                      │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Register.jsx détecte user.isAnonymous === true              │
│    → linkWithCredential(currentUser, emailPasswordCredential)  │
│    → UID reste "abc123" (pas de nouvel UID créé)               │
│    → providerData change : [password] au lieu de []            │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Historique préservé                                         │
│    → orders/{orderId}/userUid === "abc123" (inchangé)          │
│    → User peut suivre sa commande                              │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Cleanup après 48h (si pas upgradé)                          │
│    → cleanupAnonymousUsers() scanne les anonymes               │
│    → Si commande existe → PROTÉGÉ                              │
│    → Si pas de commande → SUPPRIMÉ                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Validation Finale

Une fois tous les tests passés, exécuter ce dernier test end-to-end :

```bash
# 1. Build production
npm run build

# 2. Déployer
npm run firebase:deploy

# 3. Test sur l'URL de production
# https://planizza-ac827.web.app

# 4. Navigation privée → Guest checkout complet → Upgrade compte

# 5. Vérifier Firebase Console :
#    - Auth : 1 user avec email + password provider
#    - RTDB : 1 order avec le bon userUid
#    - Functions logs : cleanupAnonymousUsers scheduled
```

**Si tout passe** : Fix #1 validé ✅

---

**Prochaine étape** : Fix #2 (Validation prix serveur)
