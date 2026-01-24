# Stripe Connect - Documentation PLANIZZA

> **Version:** 1.0
> **Date:** Janvier 2026
> **Auteur:** Claude + Malik

---

## Table des matières

1. [Qu'est-ce que Stripe Connect ?](#1-quest-ce-que-stripe-connect)
2. [Pourquoi Stripe Connect pour PLANIZZA ?](#2-pourquoi-stripe-connect-pour-planizza)
3. [Architecture choisie](#3-architecture-choisie)
4. [Flux d'onboarding pizzaiolo](#4-flux-donboarding-pizzaiolo)
5. [Functions Firebase](#5-functions-firebase)
6. [Webhook Connect](#6-webhook-connect)
7. [Structure Firebase RTDB](#7-structure-firebase-rtdb)
8. [Statuts et UI](#8-statuts-et-ui)
9. [Modèle de commission](#9-modèle-de-commission)
10. [Flux de paiement marketplace](#10-flux-de-paiement-marketplace)
11. [Remboursements](#11-remboursements)
12. [Sécurité](#12-sécurité)
13. [Configuration Stripe Dashboard](#13-configuration-stripe-dashboard)
14. [Tests](#14-tests)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Qu'est-ce que Stripe Connect ?

Stripe Connect est une solution de paiement pour les **marketplaces** et **plateformes**. Elle permet à PLANIZZA de :

- **Accepter des paiements** pour le compte des pizzaiolos
- **Distribuer automatiquement** l'argent entre la plateforme et les pizzaiolos
- **Prélever une commission** sur chaque transaction
- **Gérer la conformité** (KYC, fiscalité) via Stripe

### Sans Stripe Connect (ancien modèle)
```
Client paie 25€ → Compte PLANIZZA → Redistribution manuelle aux pizzaiolos
```
**Problèmes:** Comptabilité complexe, délais, responsabilité fiscale

### Avec Stripe Connect (nouveau modèle)
```
Client paie 25€ → Stripe split automatique:
                    ├── 22.50€ → Pizzaiolo (direct)
                    └── 2.50€  → PLANIZZA (commission)
```
**Avantages:** Automatique, instantané, conforme

---

## 2. Pourquoi Stripe Connect pour PLANIZZA ?

| Besoin PLANIZZA | Solution Stripe Connect |
|-----------------|------------------------|
| Pizzaiolos indépendants | Chaque pizzaiolo a son propre compte Stripe |
| Commission plateforme | `application_fee_amount` automatique |
| Conformité légale | Stripe gère KYC, 1099, TVA |
| Paiements rapides | Virements instantanés possibles |
| Multi-vendeurs | Un paiement = split automatique |

---

## 3. Architecture choisie

### Types de comptes Connect

| Type | Description | Choix PLANIZZA |
|------|-------------|----------------|
| **Standard** | Dashboard Stripe complet, le pizzaiolo gère tout | ❌ Trop complexe |
| **Express** | Onboarding simplifié par Stripe, UX maîtrisée | ✅ **Choisi** |
| **Custom** | Contrôle total, on gère KYC/compliance nous-même | ❌ Trop lourd |

### Pourquoi Express ?

1. **Onboarding rapide** - Stripe gère le formulaire KYC
2. **Dashboard simplifié** - Le pizzaiolo voit ses revenus sans complexité
3. **Conformité automatique** - Stripe vérifie identité, IBAN, etc.
4. **Maintenance réduite** - Pas de mise à jour réglementaire à gérer

---

## 4. Flux d'onboarding pizzaiolo

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESPACE PRO PIZZAIOLO                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Pizzaiolo clique "Configurer mes paiements"                 │
│     └── App appelle: createConnectedAccount({ email })          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Stripe crée un compte Express (acct_xxx)                    │
│     └── On stocke: pizzaiolos/{uid}/stripeAccountId             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. App appelle: createOnboardingLink()                         │
│     └── Stripe retourne une URL d'onboarding                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Redirection vers Stripe (externe)                           │
│     └── Le pizzaiolo remplit: identité, IBAN, documents...      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Stripe redirige vers: /pro/onboarding?complete=true         │
│     └── L'app affiche "Vérification en cours..."                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Stripe envoie webhook: account.updated                      │
│     └── stripeConnectWebhook met à jour le statut               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Statut final: "active" (peut recevoir des paiements)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Functions Firebase

### 5.1 `createConnectedAccount`

**Type:** Callable (2nd Gen)
**Authentification:** Requise (pizzaiolo connecté)
**Secrets:** `STRIPE_SECRET_KEY`

**Entrée:**
```javascript
{ email: "pizzaiolo@example.com" }
```

**Sortie:**
```javascript
{ accountId: "acct_1SsVlMRVWXv80bBd" }
```

**Ce qu'elle fait:**
1. Vérifie que l'utilisateur est un pizzaiolo (a un `truckId`)
2. Vérifie qu'il n'a pas déjà un compte Stripe
3. Crée un compte Express chez Stripe avec:
   - `type: "express"`
   - `country: "FR"`
   - `capabilities: { card_payments, transfers }`
   - `business_profile.mcc: "5812"` (restaurants)
4. Stocke `stripeAccountId` dans Firebase
5. Retourne l'ID du compte

**Erreurs possibles:**
| Code | Message | Cause |
|------|---------|-------|
| `unauthenticated` | Non connecté | Pas de token auth |
| `permission-denied` | Pas un pizzaiolo | Pas de `truckId` |
| `already-exists` | Compte déjà associé | `stripeAccountId` existe |
| `invalid-argument` | Email invalide | Format email incorrect |

---

### 5.2 `createOnboardingLink`

**Type:** Callable (2nd Gen)
**Authentification:** Requise
**Secrets:** `STRIPE_SECRET_KEY`

**Entrée:** Aucune (utilise l'UID de l'auth)

**Sortie:**
```javascript
{ url: "https://connect.stripe.com/setup/s/..." }
```

**Ce qu'elle fait:**
1. Récupère le `stripeAccountId` du pizzaiolo
2. Génère un lien d'onboarding Stripe avec:
   - `refresh_url`: Si le lien expire, où renvoyer
   - `return_url`: Où revenir après onboarding
   - `type: "account_onboarding"`
3. Retourne l'URL

**URLs de retour:**
- **Succès:** `https://planizza.com/pro/onboarding?complete=true`
- **Refresh:** `https://planizza.com/pro/onboarding?refresh=true`

**Erreurs possibles:**
| Code | Message | Cause |
|------|---------|-------|
| `not-found` | Profil introuvable | UID invalide |
| `failed-precondition` | Pas de compte Stripe | Doit d'abord créer le compte |

---

### 5.3 `stripeConnectWebhook`

**Type:** HTTP (onRequest)
**Authentification:** Signature Stripe
**Secrets:** `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_WEBHOOK_SECRET`

**Événements gérés:**

| Événement | Description | Action |
|-----------|-------------|--------|
| `account.updated` | Infos du compte changent | Met à jour le statut |
| `v2.core.account.updated` | Version thin event | Fetch API puis MAJ |
| `account.application.deauthorized` | Révocation accès | Marque `deauthorized` |

**Ce qu'elle fait:**
1. Vérifie la signature Stripe
2. Parse l'événement
3. Récupère les détails du compte (charges_enabled, payouts_enabled, requirements)
4. Calcule le statut (`active`, `pending`, `action_required`, `restricted`)
5. Met à jour le profil pizzaiolo dans Firebase

---

## 6. Webhook Connect

### Configuration Stripe Dashboard

1. Aller sur [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Cliquer "Add endpoint"
3. URL: `https://stripeconnectwebhook-lffp46mpdq-uc.a.run.app`
4. Événements à écouter:
   - `account.updated`
   - `account.application.deauthorized`
5. Copier le "Signing secret" → `whsec_xxx`

### Ajouter le secret Firebase

```bash
firebase functions:secrets:set STRIPE_CONNECT_WEBHOOK_SECRET
# Coller: whsec_xxx
```

### Format des événements

**account.updated (v1 legacy):**
```json
{
  "type": "account.updated",
  "data": {
    "object": {
      "id": "acct_xxx",
      "charges_enabled": true,
      "payouts_enabled": true,
      "details_submitted": true,
      "requirements": {
        "currently_due": [],
        "eventually_due": [],
        "past_due": [],
        "disabled_reason": null
      }
    }
  }
}
```

**v2.core.account.updated (thin event):**
```json
{
  "type": "v2.core.account.updated",
  "data": {
    "id": "acct_xxx"
  }
}
```
> Note: Les thin events nécessitent un appel API pour récupérer les détails

---

## 7. Structure Firebase RTDB

### Avant Connect
```
pizzaiolos/
  └── {uid}/
      └── truckId: "pizza-art-74"
```

### Après Connect
```
pizzaiolos/
  └── {uid}/
      ├── truckId: "pizza-art-74"
      │
      │   // Identifiant Stripe
      ├── stripeAccountId: "acct_1SsVlMRVWXv80bBd"
      │
      │   // Statut calculé
      ├── stripeStatus: "active" | "pending" | "action_required" | "restricted" | "deauthorized"
      │
      │   // Capacités
      ├── stripeChargesEnabled: true       // Peut accepter des paiements
      ├── stripePayoutsEnabled: true       // Peut recevoir des virements
      ├── stripeDetailsSubmitted: true     // A soumis ses infos
      │
      │   // Onboarding
      ├── stripeOnboardingComplete: true
      ├── stripeOnboardingCompletedAt: 1706123456789
      │
      │   // Requirements (ce que Stripe demande)
      ├── stripeRequirements: {
      │     currentlyDue: [],              // À faire maintenant
      │     eventuallyDue: [],             // À faire plus tard
      │     pastDue: [],                   // En retard (bloquant)
      │     disabledReason: null           // Pourquoi bloqué
      │   }
      │
      │   // Timestamps
      ├── stripeAccountCreatedAt: 1706100000000
      └── stripeLastUpdated: 1706123456789
```

### Index RTDB

```json
{
  "pizzaiolos": {
    ".indexOn": ["stripeAccountId"]
  }
}
```

---

## 8. Statuts et UI

### Mapping statuts → UI

| stripeStatus | Condition | UI pizzaiolo | Action |
|--------------|-----------|--------------|--------|
| *(null)* | Pas de `stripeAccountId` | "Configurer vos paiements" | Bouton → `createConnectedAccount` |
| `pending` | Compte créé, pas soumis | "Compléter l'inscription" | Bouton → `createOnboardingLink` |
| `pending_verification` | Soumis, en attente Stripe | "Vérification en cours..." | Aucune (attendre webhook) |
| `action_required` | `currentlyDue` non vide | "Action requise" + liste | Bouton → `createOnboardingLink` |
| `restricted` | `pastDue` non vide | "Compte restreint" | Bouton → `createOnboardingLink` |
| `active` | `charges + payouts = true` | "✅ Paiements activés" | Lien dashboard Stripe |
| `deauthorized` | Accès révoqué | "Accès révoqué" | Bouton → re-créer compte |

### Exemples de requirements

| Requirement | Description FR |
|-------------|----------------|
| `individual.verification.document` | Pièce d'identité |
| `individual.verification.additional_document` | Justificatif de domicile |
| `external_account` | Coordonnées bancaires (IBAN) |
| `business_profile.url` | URL du site web |
| `tos_acceptance.date` | Acceptation CGU |

### Composant React suggéré

```jsx
function StripeConnectStatus({ pizzaiolo }) {
  const status = pizzaiolo.stripeStatus;

  if (!pizzaiolo.stripeAccountId) {
    return (
      <div className="alert warning">
        <p>Configurez vos paiements pour recevoir l'argent de vos commandes.</p>
        <Button onClick={handleSetupStripe}>Configurer Stripe</Button>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="alert success">
        <p>✅ Vos paiements sont activés</p>
        <a href={stripeExpressDashboardUrl}>Voir mes revenus</a>
      </div>
    );
  }

  if (status === "action_required" || status === "restricted") {
    return (
      <div className="alert error">
        <p>⚠️ Action requise pour activer vos paiements</p>
        <ul>
          {pizzaiolo.stripeRequirements.currentlyDue.map(req => (
            <li key={req}>{translateRequirement(req)}</li>
          ))}
        </ul>
        <Button onClick={handleContinueOnboarding}>Compléter</Button>
      </div>
    );
  }

  // pending, pending_verification
  return (
    <div className="alert info">
      <p>⏳ Vérification en cours...</p>
    </div>
  );
}
```

---

## 9. Modèle de commission

### Configuration choisie

| Paramètre | Valeur |
|-----------|--------|
| **Commission plateforme** | 10% du montant |
| **Frais Stripe** | Payés par la plateforme |
| **Versement pizzaiolo** | Instantané (T+0) |

### Calcul exemple

```
Commande client: 25.00€

Frais Stripe (1.4% + 0.25€): 0.60€
Commission PLANIZZA (10%):   2.50€

Le pizzaiolo reçoit: 25.00€ - 0.60€ - 2.50€ = 21.90€
PLANIZZA reçoit:     2.50€ - 0.60€ = 1.90€ net
```

### Code de calcul

```javascript
// Dans createCheckoutSession
const totalAmount = 2500; // en centimes
const platformFeePercent = 10;
const platformFee = Math.round(totalAmount * (platformFeePercent / 100));

// platformFee = 250 (2.50€)
```

---

## 10. Flux de paiement marketplace

### Avant Connect (actuel)
```javascript
const session = await stripe.checkout.sessions.create({
  line_items: [...],
  mode: "payment",
  success_url: "...",
  cancel_url: "...",
});
// L'argent va sur le compte PLANIZZA
```

### Avec Connect (à implémenter)
```javascript
const session = await stripe.checkout.sessions.create({
  line_items: [...],
  mode: "payment",
  success_url: "...",
  cancel_url: "...",

  // NOUVEAU: Split automatique
  payment_intent_data: {
    application_fee_amount: platformFee,  // Commission PLANIZZA
    transfer_data: {
      destination: pizzaioloStripeAccountId,  // acct_xxx du pizzaiolo
    },
    on_behalf_of: pizzaioloStripeAccountId,   // Apparaît sur relevé client
  },
});
```

### Diagramme de flux

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │────▶│ PLANIZZA │────▶│    Stripe    │────▶│  Pizzaiolo   │
│          │     │  (App)   │     │   Connect    │     │  (Express)   │
└──────────┘     └──────────┘     └──────────────┘     └──────────────┘
     │                │                   │                    │
     │  1. Commande   │                   │                    │
     │───────────────▶│                   │                    │
     │                │                   │                    │
     │                │  2. Checkout      │                    │
     │                │   + transfer_data │                    │
     │                │──────────────────▶│                    │
     │                │                   │                    │
     │  3. Paiement   │                   │                    │
     │────────────────────────────────────▶                    │
     │                │                   │                    │
     │                │                   │  4. Split auto     │
     │                │                   │───────────────────▶│
     │                │                   │                    │
     │                │  5. Webhook       │                    │
     │                │◀──────────────────│                    │
     │                │                   │                    │
     │  6. Confirmation                   │                    │
     │◀───────────────│                   │                    │
```

---

## 11. Remboursements

### Remboursement total

```javascript
const refund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
  reverse_transfer: true,        // Annule le transfert vers pizzaiolo
  refund_application_fee: true,  // Rembourse aussi la commission
});
```

### Remboursement partiel

```javascript
const refund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
  amount: 1000, // 10€ en centimes
  reverse_transfer: true,
  refund_application_fee: true,
});
```

### Qui perd quoi ?

| Scénario | Pizzaiolo | PLANIZZA |
|----------|-----------|----------|
| Remboursement total | Perd sa part | Perd sa commission |
| Remboursement partiel | Perd au prorata | Perd au prorata |

---

## 12. Sécurité

### Secrets à protéger

| Secret | Usage | Où le stocker |
|--------|-------|---------------|
| `STRIPE_SECRET_KEY` | API Stripe | Firebase Secrets |
| `STRIPE_WEBHOOK_SECRET` | Webhook paiements | Firebase Secrets |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Webhook Connect | Firebase Secrets |

### Vérifications dans les functions

1. **Auth Firebase** - Toutes les Callable vérifient `request.auth.uid`
2. **Signature webhook** - `stripe.webhooks.constructEvent()`
3. **Validation ownership** - Vérifier que le pizzaiolo possède le `truckId`
4. **Rate limiting** - Sur les échecs de signature webhook

### Bonnes pratiques

- ❌ Ne jamais exposer `STRIPE_SECRET_KEY` côté client
- ❌ Ne jamais logger les secrets ou signatures
- ✅ Toujours utiliser HTTPS
- ✅ Vérifier les signatures webhook
- ✅ Utiliser l'idempotence pour les webhooks

---

## 13. Configuration Stripe Dashboard

### 1. Activer Connect

1. [Stripe Dashboard](https://dashboard.stripe.com) → Settings → Connect
2. "Get started with Connect"
3. Type: **Marketplace**
4. Comptes: **Express**
5. Remplir les infos plateforme

### 2. Configurer le branding

1. Connect → Settings → Branding
2. Logo PLANIZZA
3. Couleurs de la marque
4. Nom affiché: "PLANIZZA"

### 3. Configurer les webhooks

**Webhook paiements (existant):**
- URL: `https://stripewebhook-lffp46mpdq-uc.a.run.app`
- Events: `checkout.session.completed`

**Webhook Connect (nouveau):**
- URL: `https://stripeconnectwebhook-lffp46mpdq-uc.a.run.app`
- Events: `account.updated`, `account.application.deauthorized`

### 4. Mode Test vs Live

| Mode | Clés | Usage |
|------|------|-------|
| Test | `pk_test_`, `sk_test_` | Développement |
| Live | `pk_live_`, `sk_live_` | Production |

---

## 14. Tests

### Tester l'onboarding (console navigateur)

```javascript
// 1. Créer un compte Connect
(async () => {
  const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
  const createAccount = httpsCallable(window.__functions, 'createConnectedAccount');
  const result = await createAccount({ email: 'test@example.com' });
  console.log('Account ID:', result.data.accountId);
})();

// 2. Obtenir le lien d'onboarding
(async () => {
  const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
  const createLink = httpsCallable(window.__functions, 'createOnboardingLink');
  const result = await createLink({});
  console.log('URL:', result.data.url);
  window.open(result.data.url);
})();
```

### Comptes de test Stripe

Pour tester l'onboarding sans vrais documents:
- Numéro de téléphone: `000 000 0000`
- Code de vérification: `000000`
- IBAN test: `FR1420041010050500013M02606`
- Document: Uploader n'importe quelle image

### Tester le webhook localement

```bash
# Installer Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward les webhooks
stripe listen --forward-to localhost:5001/planizza-ac827/us-central1/stripeConnectWebhook

# Déclencher un événement test
stripe trigger account.updated
```

---

## 15. Troubleshooting

### "Un compte Stripe est déjà associé"

**Cause:** Le pizzaiolo a déjà un `stripeAccountId`

**Solution:**
- Vérifier dans Firebase: `pizzaiolos/{uid}/stripeAccountId`
- Si le compte existe sur Stripe, utiliser `createOnboardingLink`
- Si le compte a été supprimé sur Stripe, supprimer `stripeAccountId` dans Firebase

### "Profil pizzaiolo introuvable"

**Cause:** L'UID n'existe pas dans `pizzaiolos/`

**Solution:**
- Vérifier que l'utilisateur est bien un pizzaiolo
- Vérifier qu'il a un `truckId`

### Webhook ne met pas à jour le statut

**Causes possibles:**
1. Secret webhook incorrect
2. Mauvais events sélectionnés sur Stripe
3. L'`accountId` ne correspond à aucun pizzaiolo

**Debug:**
```bash
# Voir les logs
firebase functions:log --only stripeConnectWebhook

# Vérifier le secret
firebase functions:secrets:access STRIPE_CONNECT_WEBHOOK_SECRET
```

### Onboarding bloqué sur "En cours de vérification"

**Cause:** Stripe vérifie les documents (peut prendre 24-48h en mode live)

**Solution en test:** Utiliser les documents de test Stripe

### Paiement n'arrive pas au pizzaiolo

**Vérifier:**
1. `stripeAccountId` est correct
2. `stripeChargesEnabled: true`
3. `stripePayoutsEnabled: true`
4. Le `transfer_data.destination` est le bon `acct_xxx`

---

## Annexes

### A. Checklist de mise en production

- [ ] Activer mode Live sur Stripe
- [ ] Mettre à jour `STRIPE_SECRET_KEY` (live)
- [ ] Mettre à jour `STRIPE_WEBHOOK_SECRET` (live)
- [ ] Créer le webhook Connect en production
- [ ] Mettre à jour `STRIPE_CONNECT_WEBHOOK_SECRET` (live)
- [ ] Vérifier les URLs de retour (HTTPS)
- [ ] Tester un paiement end-to-end
- [ ] Vérifier que les virements arrivent

### B. Liens utiles

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Express Accounts Guide](https://stripe.com/docs/connect/express-accounts)
- [Webhook Events Reference](https://stripe.com/docs/webhooks)
- [Test Mode Cards](https://stripe.com/docs/testing)
- [Firebase Functions Secrets](https://firebase.google.com/docs/functions/config-env)

### C. Contacts support

- Stripe Support: support@stripe.com
- Firebase Support: https://firebase.google.com/support
- PLANIZZA Tech: (ton email)

---

*Documentation générée le 24 janvier 2026*
