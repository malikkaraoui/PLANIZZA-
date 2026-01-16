# instruction_commandes.md

15 janvier refonte globale de la partie commandes. le but est de définir un moteur de gestion de commandes robuste, automatisé et traçable.

> Objectif : définir **un moteur de gestion de commandes** (statuts, règles, transitions, automatisations) pour Planizza.
> Scope : **technique uniquement**. UI volontairement basique (liste/colonnes simples) pour valider la logique.

---

## 0) Principes (non négociables)

1. **La production (cuisine) est pilotée par le TEMPS** (`promisedAt`) et un **flux cuisine** (`kitchenStatus`).
2. Le **paiement est une dimension séparée** (`paymentStatus`) et sert de **garde-fou** sur certaines transitions (ex: remise).
3. Toute commande doit être **traçable** (timestamps + audit minimal).
4. L’automatisation doit réduire au maximum les actions manuelles (ex: no-show / expiration).

---

## 1) Modèle de données (contrat minimal)

### 1.1 Enums

```ts
type KitchenStatus =
  | "NEW"        // créée, en attente d’acceptation
  | "QUEUED"     // acceptée, en file d’attente
  | "PREPPING"   // préparation en cours
  | "READY"      // prête
  | "HANDOFF"    // remise client/livreur effectuée
  | "DONE"       // terminée / archivée
  | "CANCELED"   // annulée (action humaine)
  | "EXPIRED";   // no-show automatique (pickup + unpaid + délai dépassé)

type PaymentStatus =
  | "PAID"       // Stripe OK ou cash confirmé
  | "UNPAID"     // à encaisser
  | "ISSUE";     // échec paiement / litige / anomalie

type Fulfillment = "PICKUP" | "DELIVERY";
type Channel = "WEB" | "PHONE" | "ON_SITE" | "UBER";

On repense et modifie complètement la logique et l'aspect visuel de la partie commande.
Les instructions sont formaliser dans le document instrcutions_commandes.md

Tu dois planifier un plan d'action complet pour arrivé à notre cible. 

Chaniter du 15 janvier. 

je te propose une structure : 
1.2 Structure Order

type Order = {
  id: string;

  // Timing
  createdAt: string;     // ISO
  promisedAt: string;    // ISO (heure de promesse de retrait/livraison)

  // États
  kitchenStatus: KitchenStatus;
  paymentStatus: PaymentStatus;

  // Origine & exécution
  fulfillment: Fulfillment;
  channel: Channel;

  // Contenu
  items: Array<{ name: string; qty: number; options?: string[] }>;
  notes?: string;

  // Client
  customer?: { name?: string; phone?: string };

  // Timestamps (audit + métriques)
  timestamps: {
    acceptedAt?: string;
    startedAt?: string;
    readyAt?: string;
    handedOffAt?: string;
    completedAt?: string;
    canceledAt?: string;
    expiredAt?: string;
  };

  // Ajustements / overrides (facultatifs mais utiles)
  flags?: {
    managerOverride?: boolean; // permet de bypass certains blocages (option)
  };
};


_________

2) Statuts : séparation stricte des responsabilités

2.1 kitchenStatus = flux opérationnel (cuisine)
Décrit où en est l’exécution de la commande.
Sert à organiser la file de production.

2.2 paymentStatus = dimension financière
Indépendante du flux cuisine.
Sert de condition bloquante uniquement quand nécessaire (ex: remise).

3) Calcul du temps (pilotage)

3.1 Timer
remainingMs = promisedAt - now
lateMs = now - promisedAt si now > promisedAt

3.2 Priorité
Tri canonique dans les listes :
promisedAt croissant
createdAt croissant


4) Création de commande : règles d’initialisation

4.1 Web (Stripe)
paymentStatus = PAID si webhook Stripe confirmé
kitchenStatus = NEW
promisedAt :
soit choisi par le client (créneau)
soit calculé (ASAP = now + leadTime)

4.2 Téléphone / sur place
paymentStatus = UNPAID
kitchenStatus = NEW
promisedAt obligatoire (saisie rapide)

4.3 Uber (si intégré via commande externe)
paymentStatus dépend du modèle (souvent PAID côté plateforme, mais à clarifier)
kitchenStatus = NEW
fulfillment = DELIVERY, channel = UBER

5) Transitions : règles et garde-fous
5.1 Transitions autorisées (kitchen)

-->> en image jointe dans le prompte. 

* READY -> HANDOFF soumis à condition paiement (voir 5.2).

5.2 Blocage critique : remise interdite si non payée
Règle :
Interdire READY -> HANDOFF si paymentStatus != PAID
Exception optionnelle : flags.managerOverride == true
Pseudo-code :

function canTransition(order: Order, next: KitchenStatus): { ok: boolean; reason?: string } {
  const from = order.kitchenStatus;

  // matrice simple (hard-coded ou config)
  const allowed = {
    NEW:      ["QUEUED", "CANCELED"],
    QUEUED:   ["PREPPING", "CANCELED"],
    PREPPING: ["READY", "CANCELED"],
    READY:    ["HANDOFF", "CANCELED"],
    HANDOFF:  ["DONE"],
  } as const;

  // EXPIRED/DONE/CANCELED: terminal
  if (["DONE","CANCELED","EXPIRED"].includes(from)) return { ok: false, reason: "Statut terminal" };

  if (!allowed[from as keyof typeof allowed]?.includes(next as any)) {
    return { ok: false, reason: "Transition non autorisée" };
  }

  if (from === "READY" && next === "HANDOFF") {
    if (order.paymentStatus !== "PAID" && !order.flags?.managerOverride) {
      return { ok: false, reason: "Paiement requis avant remise" };
    }
  }

  return { ok: true };
}


5.3 Mise à jour des timestamps lors des transitions
Règles d’écriture (toujours now au moment du changement) :
NEW -> QUEUED : acceptedAt
QUEUED -> PREPPING : startedAt
PREPPING -> READY : readyAt
READY -> HANDOFF : handedOffAt
HANDOFF -> DONE : completedAt
* -> CANCELED : canceledAt
* -> EXPIRED : expiredAt


6) Automatisations (systèmes auto)
6.1 Expiration / No-show (auto)
But : sortir automatiquement les commandes non payées non récupérées.
Condition :
fulfillment == PICKUP
paymentStatus == UNPAID
kitchenStatus dans ["NEW","QUEUED","PREPPING","READY"]
now > promisedAt + 60min
Action :
kitchenStatus = EXPIRED
timestamps.expiredAt = now

Pseudo-code :

function autoExpire(order: Order, now: Date): boolean {
  if (order.fulfillment !== "PICKUP") return false;
  if (order.paymentStatus !== "UNPAID") return false;
  if (!["NEW","QUEUED","PREPPING","READY"].includes(order.kitchenStatus)) return false;

  const promised = new Date(order.promisedAt).getTime();
  const deadline = promised + 60 * 60 * 1000;

  if (now.getTime() > deadline) {
    order.kitchenStatus = "EXPIRED";
    order.timestamps.expiredAt = now.toISOString();
    return true;
  }
  return false;
}



6.2 Paiement Stripe (webhook)
À la confirmation Stripe : paymentStatus = PAID
Ne pas changer automatiquement kitchenStatus (sauf option “auto-accept”).

7) Opérations “pizzaiolo” : actions minimales
Actions métier exposées (API / service layer) :
accept(orderId) → NEW -> QUEUED
start(orderId) → QUEUED -> PREPPING
markReady(orderId) → PREPPING -> READY
handoff(orderId) → READY -> HANDOFF (bloqué si non payé)
complete(orderId) → HANDOFF -> DONE
cancel(orderId, reason?) → * -> CANCELED
markPaid(orderId, method: "CASH" | "CARD" | "OTHER") → paymentStatus = PAID
setPromise(orderId, promisedAt) → modifie l’heure de promesse (audit conseillé)

8) Intégrité & validations
8.1 Invariants
promisedAt obligatoire (sinon pas de pilotage temps).
DONE implique paymentStatus == PAID (sauf override).
HANDOFF implique paymentStatus == PAID (sauf override).
Les statuts terminal (DONE, CANCELED, EXPIRED) ne doivent plus bouger (sauf action admin explicite).
8.2 Concurrence (important)
Protéger les transitions avec un mécanisme anti-conflit :
updatedAt + contrôle version (optimistic locking)
ou transaction DB (selon stockage)

9) Historique / audit minimal (recommandé)
Stocker un log simple des changements :

type OrderEvent = {
  orderId: string;
  at: string; // ISO
  type:
    | "STATUS_CHANGED"
    | "PAYMENT_CHANGED"
    | "PROMISE_CHANGED"
    | "NOTE_CHANGED";
  from?: any;
  to?: any;
  actor: "SYSTEM" | "PIZZAIOLO" | "ADMIN" | "STRIPE";
};

10) Tests (à écrire en priorité)
Transition interdite : READY -> HANDOFF quand UNPAID
Transition autorisée : READY -> HANDOFF quand PAID
autoExpire déclenche uniquement pour PICKUP + UNPAID + now > promisedAt+60m
DONE impossible si UNPAID (ou bloqué sur complete / handoff)
Matrice transitions : aucun saut non prévu (ex: NEW -> READY)
11) Implémentation recommandée (structure)

domain/orders/types.ts : enums + types
domain/orders/stateMachine.ts : canTransition, applyTransition
domain/orders/automation.ts : autoExpire, etc.
services/ordersService.ts : actions (accept/start/ready/handoff/complete/cancel/markPaid)
tests/ordersStateMachine.test.ts : tests unitaires

12) Version MVP (si tu veux vraiment minimal)
KitchenStatus: NEW, PREPPING, READY, DONE, CANCELED, EXPIRED
Garder les mêmes garde-fous paiement + autoExpire
Ajouter QUEUED/HANDOFF plus tard
