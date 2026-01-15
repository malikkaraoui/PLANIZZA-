# Orders v2 — Contrat (RTDB + Domain)

Objectif : rendre la partie commandes **pilotée par le temps** (`promisedAt`) + **traçable** (timestamps) + **séparable** (cuisine vs paiement), avec une migration progressive depuis le modèle v1.

## 1) Représentation des dates

### Choix
- **Champs canoniques en ISO 8601 (string)** : faciles à auditer, stables et compatibles avec le document `instructions_commandes.md`.
- **Champs dérivés en millisecondes (number)** : utiles pour tri/filtrage rapides côté UI et queries RTDB.

### Règle
Pour chaque date ISO importante, on stocke aussi sa version ms :
- `createdAt` (ISO) + `createdAtMs` (number)
- `promisedAt` (ISO) + `promisedAtMs` (number)
- `updatedAt` (ISO) + `updatedAtMs` (number)

Les timestamps métier (`timestamps.*`) restent en ISO (pas de duplication ms au MVP).

## 2) Schéma minimal (v2)

```ts
type KitchenStatus =
  | "NEW" | "QUEUED" | "PREPPING" | "READY"
  | "HANDOFF" | "DONE" | "CANCELED" | "EXPIRED";

type PaymentStatus = "PAID" | "UNPAID" | "ISSUE";

type Fulfillment = "PICKUP" | "DELIVERY";

type Channel = "WEB" | "PHONE" | "ON_SITE" | "UBER";

type OrderV2 = {
  id: string;

  // Temps
  createdAt: string;
  createdAtMs: number;
  promisedAt: string;
  promisedAtMs: number;

  // Concurrence
  updatedAt: string;
  updatedAtMs: number;

  // États
  kitchenStatus: KitchenStatus;
  paymentStatus: PaymentStatus;

  // Origine
  fulfillment: Fulfillment;
  channel: Channel;

  // Contenu
  items: Array<{ name: string; qty: number; options?: string[] }>;
  notes?: string;

  // Client (MVP)
  customer?: { name?: string; phone?: string };

  // Audit / métriques
  timestamps: {
    acceptedAt?: string;
    startedAt?: string;
    readyAt?: string;
    handedOffAt?: string;
    completedAt?: string;
    canceledAt?: string;
    expiredAt?: string;
  };

  // Overrides
  flags?: { managerOverride?: boolean };

  // Migration (optionnel)
  legacy?: {
    orderId?: string;      // id v1 si dual-write
    source?: "v1" | "v2"; // trace
  };
};
```

## 3) Invariants (MVP)

- `promisedAt` obligatoire.
- Les statuts terminaux (`DONE`, `CANCELED`, `EXPIRED`) ne bougent plus (sauf admin explicite).
- `HANDOFF` et `DONE` impliquent `paymentStatus === "PAID"` (sauf `flags.managerOverride`).
- `updatedAtMs` doit être **monotone** (défini côté serveur).

## 4) Migration depuis v1

Pendant la transition :
- **dual-read** via un adaptateur `legacyToOrderV2()` pour afficher l’UI v2 à partir des données v1.
- plus tard : **dual-write** (Functions) vers un node `ordersV2/` (ou `orders/{id}/v2`) avec `legacy.orderId`.
