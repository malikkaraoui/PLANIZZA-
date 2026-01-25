/* eslint-disable require-jsdoc */
const functions = require("firebase-functions");
const {onRequest, onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const stripe = require("stripe");
const crypto = require("crypto");
const { rtdbServerTimestamp } = require("./utils/timestamps");

// Hash UID pour les logs (privacy - ne pas exposer les UIDs complets)
function hashUid(uid) {
  if (!uid) return "unknown";
  return crypto.createHash("sha256").update(uid).digest("hex").substring(0, 12);
}

// Sanitisation adresse de livraison (évite injection si utilisé avec API externe)
function sanitizeAddress(address) {
  if (!address || typeof address !== "string") return null;
  // Trim et limite la longueur
  let sanitized = address.trim().substring(0, 500);
  // Supprime les caractères de contrôle (0-31, 127) et < >
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\u0000-\u001F\u007F<>]/g, "");
  // Normalise les espaces multiples
  sanitized = sanitized.replace(/\s+/g, " ");
  return sanitized.length > 0 ? sanitized : null;
}

// Initialiser Firebase Admin
admin.initializeApp();

const DEBUG_V2 = process.env.DEBUG_V2_TRANSITIONS === "true";
function debugLog(...args) {
  if (!DEBUG_V2) return;
  console.log(...args);
}

// Firebase RTDB n'accepte pas les valeurs `undefined` (même côté Admin SDK).
// On nettoie donc systématiquement les payloads avant écriture.
function omitUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value
      .map((v) => omitUndefinedDeep(v))
      .filter((v) => v !== undefined);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      const next = omitUndefinedDeep(v);
      if (next === undefined) continue;
      out[k] = next;
    }
    return out;
  }
  return value;
}

function writeOrderEvent(orderId, event) {
  if (!orderId) return Promise.resolve();
  const nowIso = new Date().toISOString();
  const payload = omitUndefinedDeep({
    orderId,
    at: nowIso,
    atMs: rtdbServerTimestamp(),
    ...event,
  });
  return admin.database().ref(`orderEvents/${orderId}`).push(payload);
}

function v2IsActiveKitchenStatus(ks) {
  return ks === "NEW" || ks === "QUEUED" || ks === "PREPPING" || ks === "READY";
}

function v2ShouldAutoExpire(orderV2, nowMs) {
  if (!orderV2) return false;
  if (orderV2.fulfillment !== "PICKUP") return false;
  if (orderV2.paymentStatus !== "UNPAID") return false;
  if (!v2IsActiveKitchenStatus(orderV2.kitchenStatus)) return false;

  const promisedAtMs =
    (typeof orderV2.promisedAtMs === "number" && Number.isFinite(orderV2.promisedAtMs)
      ? orderV2.promisedAtMs
      : typeof orderV2.promisedAt === "string"
        ? new Date(orderV2.promisedAt).getTime()
        : NaN);

  if (!Number.isFinite(promisedAtMs)) return false;
  const deadlineMs = promisedAtMs + 60 * 60 * 1000;
  return nowMs > deadlineMs;
}

// Secrets Stripe (Firebase Secrets Manager)
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const STRIPE_CONNECT_WEBHOOK_SECRET = defineSecret("STRIPE_CONNECT_WEBHOOK_SECRET");

// URL front utilisée pour success/cancel
const FRONTEND_URL = process.env.FRONTEND_URL || "https://planizza-ac827.web.app";

// Commission plateforme PLANIZZA (en pourcentage)
// Pour changer: modifier cette valeur et redéployer
// 10 = 10%, 0 = offre de lancement sans commission
const PLATFORM_FEE_PERCENT = parseInt(process.env.PLATFORM_FEE_PERCENT || "10", 10);

// Origines autorisées pour CORS (sécurité)
const ALLOWED_ORIGINS = [
  "https://planizza-ac827.web.app",
  "https://planizza-ac827.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Access-Control-Allow-Credentials", "true");
  }
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Headers", "authorization, content-type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

async function requireAuthUid(req) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!idToken) {
    const err = new Error("unauthenticated");
    err.status = 401;
    throw err;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded?.uid) {
      const err = new Error("unauthenticated");
      err.status = 401;
      throw err;
    }
    return decoded.uid;
  } catch (e) {
    const err = new Error("unauthenticated");
    err.status = 401;
    throw err;
  }
}

async function assertPizzaioloOwnsTruck({ uid, truckId }) {
  if (!uid || !truckId) {
    const err = new Error("forbidden");
    err.status = 403;
    throw err;
  }

  const [pizzSnap, truckSnap, publicTruckSnap] = await Promise.all([
    admin.database().ref(`pizzaiolos/${uid}/truckId`).get(),
    admin.database().ref(`trucks/${truckId}/ownerUid`).get(),
    admin.database().ref(`public/trucks/${truckId}/ownerUid`).get(),
  ]);

  const pizzTruckId = pizzSnap.exists() ? pizzSnap.val() : null;
  const ownerUid = truckSnap.exists()
    ? truckSnap.val()
    : (publicTruckSnap.exists() ? publicTruckSnap.val() : null);

  if (pizzTruckId === truckId) return;
  if (ownerUid === uid) return;

  const err = new Error("forbidden");
  err.status = 403;
  throw err;
}

// --- Orders v2 materialized view (orders/{orderId}/v2) ---

function v2IsoFromMs(ms, fallbackIso = null) {
  if (typeof ms === "number" && Number.isFinite(ms) && ms > 0) {
    return new Date(ms).toISOString();
  }
  return fallbackIso;
}

function v2InferFulfillment(order) {
  return order?.deliveryMethod === "delivery" ? "DELIVERY" : "PICKUP";
}

function v2InferChannel(order) {
  const provider = order?.payment?.provider;
  if (provider === "stripe") return "WEB";
  if (provider === "manual") return "ON_SITE";
  return "WEB";
}

function v2MapPaymentStatus(order) {
  const ps = order?.payment?.paymentStatus;
  if (ps === "paid") return "PAID";
  if (ps === "failed") return "ISSUE";
  return "UNPAID";
}

function v2MapKitchenStatusFromV1Status(status) {
  switch (status) {
    case "received":
      return "NEW";
    case "accepted":
      return "QUEUED";
    case "prep":
    case "cook":
      return "PREPPING";
    case "ready":
      return "READY";
    case "delivered":
      // v1 n'a pas l'étape HANDOFF: on map sur DONE (MVP)
      return "DONE";
    case "cancelled":
      return "CANCELED";
    case "lost":
      return "EXPIRED";
    default:
      return "NEW";
  }
}

function v2InferPromisedAtIso({ order, createdAtIso, createdAtMs }) {
  const pickupTime = order?.pickupTime;
  if (typeof pickupTime === "string" && /^\d{2}:\d{2}$/.test(pickupTime) && createdAtIso) {
    const base = new Date(createdAtIso);
    const [hh, mm] = pickupTime.split(":").map(Number);
    const projected = new Date(base);
    projected.setHours(hh, mm, 0, 0);
    if (Number.isFinite(projected.getTime())) {
      return projected.toISOString();
    }
  }

  const fulfillment = v2InferFulfillment(order);
  const leadMin = fulfillment === "DELIVERY" ? 40 : 20;
  const baseMs = typeof createdAtMs === "number" && Number.isFinite(createdAtMs)
    ? createdAtMs
    : Date.now();
  return new Date(baseMs + leadMin * 60 * 1000).toISOString();
}

function v2BuildBase(order, { nowIso, nowMs }) {
  const createdAtMs =
    (typeof order?.createdAt === "number" && Number.isFinite(order.createdAt) ? order.createdAt : null) ||
    (typeof order?.createdAtClient === "number" && Number.isFinite(order.createdAtClient) ? order.createdAtClient : null) ||
    null;
  const createdAtIso = v2IsoFromMs(createdAtMs, nowIso) || nowIso;

  const updatedAtMs =
    (typeof order?.updatedAt === "number" && Number.isFinite(order.updatedAt) ? order.updatedAt : null) ||
    null;

  const promisedAtIso = v2InferPromisedAtIso({
    order,
    createdAtIso,
    createdAtMs: createdAtMs || nowMs,
  });
  const promisedAtMs = new Date(promisedAtIso).getTime();

  return {
    id: order?.id,
    createdAt: createdAtIso,
    createdAtMs: typeof createdAtMs === "number" ? createdAtMs : undefined,
    promisedAt: promisedAtIso,
    promisedAtMs: Number.isFinite(promisedAtMs) ? promisedAtMs : undefined,
    updatedAt: nowIso,
    // On essaie de dériver d'abord d'un updatedAt persistant (legacy) pour que l'optimistic locking
    // reste utile même si /v2 n'existe pas encore.
    updatedAtMs: (typeof updatedAtMs === "number" ? updatedAtMs : nowMs),
    kitchenStatus: v2MapKitchenStatusFromV1Status(order?.status),
    paymentStatus: v2MapPaymentStatus(order),
    fulfillment: v2InferFulfillment(order),
    channel: v2InferChannel(order),
    timestamps: {},
    flags: undefined,
  };
}

function v2DeriveTimestampsFromLegacyTimeline(order) {
  const t = order?.timeline || {};
  const out = {};
  // On stocke en ISO (best-effort)
  if (typeof t.acceptedAt === "number") out.acceptedAt = new Date(t.acceptedAt).toISOString();
  if (typeof t.prepAt === "number") out.startedAt = new Date(t.prepAt).toISOString();
  if (typeof t.cookAt === "number" && !out.startedAt) out.startedAt = new Date(t.cookAt).toISOString();
  if (typeof t.readyAt === "number") out.readyAt = new Date(t.readyAt).toISOString();
  if (typeof t.deliveredAt === "number") out.completedAt = new Date(t.deliveredAt).toISOString();
  if (typeof t.cancelledAt === "number") out.canceledAt = new Date(t.cancelledAt).toISOString();
  if (typeof t.expiredAt === "number") out.expiredAt = new Date(t.expiredAt).toISOString();
  return out;
}

function v2ApplyEventTimestamps({ nextKitchenStatus, nowIso, currentTimestamps }) {
  const ts = { ...(currentTimestamps || {}) };
  // 5.3 (best-effort)
  if (nextKitchenStatus === "QUEUED") ts.acceptedAt = ts.acceptedAt || nowIso;
  if (nextKitchenStatus === "PREPPING") ts.startedAt = ts.startedAt || nowIso;
  if (nextKitchenStatus === "READY") ts.readyAt = ts.readyAt || nowIso;
  if (nextKitchenStatus === "HANDOFF") ts.handedOffAt = ts.handedOffAt || nowIso;
  if (nextKitchenStatus === "DONE") ts.completedAt = ts.completedAt || nowIso;
  if (nextKitchenStatus === "CANCELED") ts.canceledAt = ts.canceledAt || nowIso;
  if (nextKitchenStatus === "EXPIRED") ts.expiredAt = ts.expiredAt || nowIso;
  return ts;
}

function v2CanTransition(orderV2, nextKitchenStatus, { managerOverride = false } = {}) {
  const from = orderV2?.kitchenStatus;
  const paymentStatus = orderV2?.paymentStatus;

  // DEBUG: log exact des paramètres
  debugLog("[PLANIZZA][v2CanTransition] check", {
    from,
    fromType: typeof from,
    nextKitchenStatus,
    paymentStatus,
    hasOrderV2: Boolean(orderV2),
    orderV2Keys: orderV2 ? Object.keys(orderV2) : null,
  });

  const allowed = {
    NEW: ["QUEUED", "CANCELED"],
    QUEUED: ["PREPPING", "CANCELED"],
    PREPPING: ["READY", "CANCELED"],
    READY: ["HANDOFF", "CANCELED"],
    HANDOFF: ["DONE"],
    DONE: [],
    CANCELED: [],
    EXPIRED: [],
  };

  if (!from || !allowed[from]) return { ok: false, reason: "Statut cuisine invalide" };
  if (!nextKitchenStatus || !allowed[nextKitchenStatus]) return { ok: false, reason: "Statut cible invalide" };

  if (["DONE", "CANCELED", "EXPIRED"].includes(from)) {
    return { ok: false, reason: "Statut terminal" };
  }

  if (!allowed[from].includes(nextKitchenStatus)) {
    return { ok: false, reason: "Transition non autorisée" };
  }

  if (from === "READY" && nextKitchenStatus === "HANDOFF") {
    if (paymentStatus !== "PAID" && !managerOverride) {
      return { ok: false, reason: "Paiement requis avant remise" };
    }
  }

  if (nextKitchenStatus === "DONE") {
    if (paymentStatus !== "PAID" && !managerOverride) {
      return { ok: false, reason: "Paiement requis avant clôture" };
    }
  }

  return { ok: true };
}

function v2MapKitchenStatusToV1Status(kitchenStatus) {
  switch (kitchenStatus) {
    case "QUEUED":
      // QUEUED = Acceptée (en file d'attente) → Client voit "Reçue"
      return "received";
    case "PREPPING":
    case "READY":
      // PREPPING et READY = En cours de préparation → Client voit "En préparation"
      return "accepted";
    case "HANDOFF":
    case "DONE":
      // HANDOFF et DONE = Terminée → Client voit "Prête !"
      return "delivered";
    case "CANCELED":
      return "cancelled";
    case "EXPIRED":
      return "lost";
    case "NEW":
    default:
      // NEW = Nouvelle commande → Client voit "Reçue"
      return "received";
  }
}

function v2TimelineKeyForV1Status(v1Status) {
  switch (v1Status) {
    case "received":
      return "timeline/receivedAt";
    case "accepted":
      return "timeline/acceptedAt";
    case "prep":
      return "timeline/prepAt";
    case "cook":
      return "timeline/cookAt";
    case "ready":
      return "timeline/readyAt";
    case "delivered":
      return "timeline/deliveredAt";
    case "cancelled":
      return "timeline/cancelledAt";
    case "lost":
      return "timeline/expiredAt";
    default:
      return null;
  }
}

function buildLineItems(order) {
  if (!order?.items || !Array.isArray(order.items)) return [];

  const lineItems = order.items
      .filter((it) => typeof it.priceCents === "number" && it.priceCents > 0)
      .map((item) => {
        // Les prix sont déjà HT, on ajoute la TVA 10%
        const priceWithTVA = Math.round(Number(item.priceCents) * 1.10);
        return {
          price_data: {
            currency: order.currency || "eur",
            product_data: {name: item.name || "Article"},
            unit_amount: priceWithTVA,
          },
          quantity: Number(item.qty) || 1,
        };
      });

  // Ajouter les frais de livraison si applicable (déjà TTC)
  if (order.deliveryMethod === "delivery" && order.deliveryCost > 0) {
    lineItems.push({
      price_data: {
        currency: order.currency || "eur",
        product_data: {name: "Frais de livraison"},
        unit_amount: Number(order.deliveryCost),
      },
      quantity: 1,
    });
  }

  return lineItems;
}

// Garde-fou : ne conserver que les N derniers paniers archivés
async function pruneCartArchive(uid, max = 5) {
  try {
    const archiveRoot = admin.database().ref(`cartsArchive/${uid}`);
    const snap = await archiveRoot.orderByChild("archivedAt").get();
    if (!snap.exists()) return;

    const entries = [];
    snap.forEach((child) => {
      entries.push({key: child.key, ts: child.child("archivedAt").val() || 0});
    });

    if (entries.length <= max) return;

    entries.sort((a, b) => a.ts - b.ts);
    const toRemove = entries.slice(0, entries.length - max);

    const updates = {};
    toRemove.forEach((entry) => {
      updates[entry.key] = null;
    });

    await archiveRoot.update(updates);
  } catch (err) {
    // Ne pas bloquer le webhook si l'archivage échoue
    console.warn("[PLANIZZA] pruneCartArchive failed (non-blocking):", err.message);
  }
}

/**
 * Valide et recalcule les prix des items contre le menu du truck.
 * Retourne des items avec les prix validés côté serveur.
 *
 * @param {Array} clientItems - Items envoyés par le client avec leurs prix
 * @param {string} truckId - ID du truck pour récupérer le menu
 * @returns {Promise<{validatedItems: Array, warnings: Array}>}
 */
async function validateAndRecalculateItemPrices(clientItems, truckId) {
  const warnings = [];

  // 1. Récupérer le menu du truck depuis RTDB
  const menuRef = admin.database().ref(`public/trucks/${truckId}/menu`);
  const menuSnap = await menuRef.get();

  if (!menuSnap.exists()) {
    throw new Error(`Menu introuvable pour le truck ${truckId}`);
  }

  const menuData = menuSnap.val();
  const validatedItems = [];

  console.log("[PLANIZZA][validateAndRecalculateItemPrices] Menu structure:", {
    truckId,
    hasMenuData: Boolean(menuData),
    menuKeys: menuData ? Object.keys(menuData).slice(0, 5) : [],
    hasItems: Boolean(menuData?.items),
  });

  // 2. Pour chaque item client, valider le prix
  for (const clientItem of clientItems) {
    const rawItemId = clientItem.id;
    const clientPrice = Number(clientItem.priceCents || 0);
    const qty = Number(clientItem.qty || 1);

    // Si l'item a un baseItemId (ex: "margherita" pour "margherita_s"), l'utiliser
    // Sinon, extraire le baseId si l'id contient un underscore (format: baseId_size)
    let baseItemId = clientItem.baseItemId || null;
    if (!baseItemId && rawItemId && typeof rawItemId === "string") {
      const idx = rawItemId.lastIndexOf("_");
      if (idx > 0) {
        baseItemId = rawItemId.slice(0, idx);
      }
    }
    const itemId = baseItemId || rawItemId;

    console.log("[PLANIZZA][validateAndRecalculateItemPrices] Processing item:", {
      rawItemId,
      baseItemId,
      itemId,
      clientPrice,
      qty,
    });

    // Chercher l'item dans le menu
    let menuItem = null;
    let serverPrice = null;

    // Le menu peut avoir plusieurs structures:
    // 1. public/trucks/{truckId}/menu/{itemId} (ancien format catégories)
    // 2. public/trucks/{truckId}/menu/items/{itemId} (nouveau format)

    // Nouveau format: menu/items/{itemId}
    if (menuData && menuData.items && typeof menuData.items === "object") {
      menuItem = menuData.items[itemId];
      console.log("[PLANIZZA][validateAndRecalculateItemPrices] Checking items format:", {
        itemId,
        found: Boolean(menuItem),
      });
    }

    // Ancien format: menu/{itemId} ou menu/catégories/{itemId}
    if (!menuItem && menuData && typeof menuData === "object") {
      // D'abord chercher directement sous menu
      if (menuData[itemId] && typeof menuData[itemId] === "object") {
        menuItem = menuData[itemId];
        console.log("[PLANIZZA][validateAndRecalculateItemPrices] Found in direct format:", itemId);
      } else {
        // Sinon chercher dans les catégories
        for (const [key, category] of Object.entries(menuData)) {
          if (key === "items") continue; // Skip items car déjà vérifié
          if (category && typeof category === "object" && category[itemId]) {
            menuItem = category[itemId];
            console.log("[PLANIZZA][validateAndRecalculateItemPrices] Found in category:", key, itemId);
            break;
          }
        }
      }
    }

    if (!menuItem) {
      // Item introuvable dans le menu
      warnings.push({
        itemId,
        itemName: clientItem.name,
        reason: "item_not_in_menu",
        message: `Item ${itemId} (${clientItem.name}) introuvable dans le menu`,
      });
      // On rejette cet item (sécurité)
      continue;
    }

    // Calculer le prix serveur en fonction de la structure du menu
    // Structure possible 1: item.priceCents (prix unique)
    // Structure possible 2: item.sizes.{s,m,l}.priceCents (pizzas avec tailles)

    if (menuItem.priceCents != null) {
      // Prix simple
      serverPrice = Number(menuItem.priceCents);
    } else if (menuItem.sizes && typeof menuItem.sizes === "object") {
      // Prix par taille
      // 1. Utiliser client.size si fourni (ex: "s", "m", "l")
      // 2. Sinon détecter depuis le nom (ex: "Margherita S (26cm)")
      // 3. Fallback: extraire depuis rawItemId (ex: "margherita_s" → "s")
      let detectedSize = clientItem.size || null;

      if (!detectedSize && rawItemId && typeof rawItemId === "string") {
        const idx = rawItemId.lastIndexOf("_");
        if (idx > 0) {
          const sizePart = rawItemId.slice(idx + 1).toLowerCase();
          if (["s", "m", "l"].includes(sizePart)) {
            detectedSize = sizePart;
          }
        }
      }

      if (!detectedSize) {
        const sizeName = clientItem.name?.toLowerCase() || "";
        if (sizeName.includes("petite") || sizeName.includes("small") || sizeName.includes(" s ")) {
          detectedSize = "s";
        } else if (sizeName.includes("moyenne") || sizeName.includes("medium") || sizeName.includes(" m ")) {
          detectedSize = "m";
        } else if (sizeName.includes("grande") || sizeName.includes("large") || sizeName.includes(" l ")) {
          detectedSize = "l";
        }
      }

      console.log("[PLANIZZA][validateAndRecalculateItemPrices] Size detection:", {
        rawItemId,
        itemId,
        clientSize: clientItem.size,
        detectedSize,
        availableSizes: Object.keys(menuItem.sizes || {}),
      });

      // Si taille détectée, utiliser son prix
      if (detectedSize && menuItem.sizes[detectedSize]?.priceCents != null) {
        serverPrice = Number(menuItem.sizes[detectedSize].priceCents);
      } else {
        // Sinon, prendre la première taille disponible
        const firstSize = Object.values(menuItem.sizes).find((s) => s?.priceCents != null);
        if (firstSize) {
          serverPrice = Number(firstSize.priceCents);
        }
      }
    }

    if (serverPrice == null || serverPrice === 0) {
      warnings.push({
        itemId,
        itemName: clientItem.name,
        reason: "invalid_server_price",
        message: `Prix serveur invalide pour ${itemId}`,
      });
      continue;
    }

    // 3. Comparer prix client vs prix serveur
    if (clientPrice !== serverPrice) {
      warnings.push({
        itemId,
        itemName: clientItem.name,
        reason: "price_mismatch",
        clientPrice,
        serverPrice,
        message: `Prix manipulé détecté: client=${clientPrice}¢, serveur=${serverPrice}¢`,
      });

      // Log pour détection de fraude
      console.warn("[PLANIZZA][FRAUD_DETECTION]", {
        truckId,
        itemId,
        itemName: clientItem.name,
        clientPrice,
        serverPrice,
        diff: clientPrice - serverPrice,
      });
    }

    // 4. Utiliser TOUJOURS le prix serveur (source de vérité)
    validatedItems.push({
      id: itemId,
      name: String(clientItem.name || "Article"),
      priceCents: serverPrice, // ✅ Prix validé serveur
      qty,
    });
  }

  return { validatedItems, warnings };
}

exports.createCheckoutSession = onRequest(
    {
      region: "us-central1",
      secrets: [STRIPE_SECRET_KEY],
    },
    async (req, res) => {
    // CORS permissif pour dev/localhost/production hosting
      const origin = req.headers.origin || "*";
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Credentials", "true");
      res.set("Access-Control-Allow-Headers", "authorization, content-type");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }

      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }

      const stripeSecret = (STRIPE_SECRET_KEY.value() || "").trim();
      const stripeClient = stripe(stripeSecret);

      // Auth: jeton Firebase ID dans Authorization: Bearer <token>
      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
      if (!idToken) {
        return res.status(401).json({error: "unauthenticated"});
      }

      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch (err) {
        console.error("ID token invalide:", err);
        return res.status(401).json({error: "unauthenticated"});
      }

      const uid = decoded.uid;
      const providedOrderId = req.body?.orderId;
      const truckId = req.body?.truckId;
      const items = req.body?.items;
      const customerName = req.body?.customerName;
      const deliveryMethod = req.body?.deliveryMethod;
      const pickupTime = req.body?.pickupTime;
      const deliveryAddress = req.body?.deliveryAddress;

      const nowClientMs = Date.now();
      const normalizedPickupTime = typeof pickupTime === "string" && /^\d{2}:\d{2}$/.test(pickupTime)
        ? pickupTime
        : null;
      const normalizedDeliveryAddress = sanitizeAddress(deliveryAddress);

      /** @type {string | null} */
      let orderId = typeof providedOrderId === "string" ? providedOrderId : null;
      /** @type {any} */
      let order = null;
      /** @type {import('firebase-admin').database.Reference | null} */
      let orderRef = null;
      /** @type {boolean} */
      let orderExisted = false;

      // Mode legacy: le front a déjà créé orders/{orderId}.
      // Mode prod: si aucun orderId n'est fourni, on crée la commande côté serveur.
      if (orderId) {
        orderRef = admin.database().ref(`orders/${orderId}`);
        const snap = await orderRef.get();
        if (snap.exists()) {
          orderExisted = true;
          order = snap.val();
        } else {
          // Compat: certains clients/backends historiques exigent `orderId` mais ne créent pas forcément la commande.
          // Si l'orderId est fourni ET qu'on a un draft (truckId/items), on crée la commande côté serveur à cet ID.
          if (!truckId || typeof truckId !== "string") {
            return res.status(400).json({error: "truckId requis"});
          }
          if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({error: "items requis"});
          }

          // ✅ Validation des prix côté serveur contre le menu
          const {validatedItems, warnings} = await validateAndRecalculateItemPrices(items, truckId);

          if (warnings.length > 0) {
            console.warn("[PLANIZZA][PRICE_VALIDATION] Warnings détectés:", {
              orderId,
              truckId,
              userUid: hashUid(uid),
              warnings,
            });
          }

          if (validatedItems.length === 0) {
            return res.status(400).json({
              error: "Aucun article valide dans le panier",
              warnings,
            });
          }

          const safeItems = validatedItems;

          const normalizedDeliveryMethod = deliveryMethod === "delivery" ? "delivery" : "pickup";
          const deliveryCost = normalizedDeliveryMethod === "delivery" ? 350 : 0;

          order = {
            status: "created",
            truckId,
            userUid: uid,
            customerName: typeof customerName === "string" ? customerName.trim() : "Client",
            deliveryMethod: normalizedDeliveryMethod,
            deliveryCost,
            deliveryAddress: normalizedDeliveryAddress,
            currency: "eur",
            items: safeItems,
            createdAt: rtdbServerTimestamp(),
            updatedAt: rtdbServerTimestamp(),
            createdAtClient: nowClientMs,
            pickupTime: normalizedPickupTime,
          };
        }
      } else {
        if (!truckId || typeof truckId !== "string") {
          return res.status(400).json({error: "truckId requis"});
        }
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({error: "items requis"});
        }

        // ✅ Validation des prix côté serveur contre le menu
        const {validatedItems, warnings} = await validateAndRecalculateItemPrices(items, truckId);

        if (warnings.length > 0) {
          console.warn("[PLANIZZA][PRICE_VALIDATION] Warnings détectés:", {
            truckId,
            userUid: hashUid(uid),
            warnings,
          });
        }

        if (validatedItems.length === 0) {
          return res.status(400).json({
            error: "Aucun article valide dans le panier",
            warnings,
          });
        }

        const safeItems = validatedItems;

        const normalizedDeliveryMethod = deliveryMethod === "delivery" ? "delivery" : "pickup";
        const deliveryCost = normalizedDeliveryMethod === "delivery" ? 350 : 0;

        const ordersRef = admin.database().ref("orders");
        const newOrderRef = ordersRef.push();
        orderId = newOrderRef.key;
        if (!orderId) {
          return res.status(500).json({error: "internal"});
        }

        orderRef = newOrderRef;
        order = {
          status: "created",
          truckId,
          userUid: uid,
          customerName: typeof customerName === "string" ? customerName.trim() : "Client",
          deliveryMethod: normalizedDeliveryMethod,
          deliveryCost,
          deliveryAddress: normalizedDeliveryAddress,
          currency: "eur",
          items: safeItems,
          createdAt: rtdbServerTimestamp(),
          updatedAt: rtdbServerTimestamp(),
          createdAtClient: nowClientMs,
          pickupTime: normalizedPickupTime,
        };
      }

      if (order.userUid && order.userUid !== uid) {
        return res.status(403).json({error: "forbidden"});
      }

      const lineItems = buildLineItems(order);
      if (lineItems.length === 0) {
        return res.status(400).json({error: "Aucun article valide"});
      }

      const totalCentsServer = lineItems.reduce(
          (sum, li) => sum + li.price_data.unit_amount * li.quantity,
          0,
      );

      // Utiliser l'origine de la requête pour les redirections (support localhost + production)
      // Valider que l'origin a un schéma valide (https:// ou http://)
      const rawOrigin = req.headers.origin;
      const hasValidScheme = rawOrigin && /^https?:\/\//.test(rawOrigin);
      const frontendOrigin = hasValidScheme ? rawOrigin : FRONTEND_URL;
      const successUrl =
      `${frontendOrigin}/checkout/success?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${frontendOrigin}/panier?orderId=${orderId}`;

      try {
        // ========== STRIPE CONNECT ==========
        // Récupérer le stripeAccountId du pizzaiolo pour le transfert
        let connectedAccountId = null;
        const truckIdForConnect = order.truckId;

        if (truckIdForConnect) {
          // 1. Récupérer l'ownerUid du truck
          const truckSnap = await admin.database().ref(`trucks/${truckIdForConnect}/ownerUid`).get();
          const ownerUid = truckSnap.val();

          if (ownerUid) {
            // 2. Récupérer le stripeAccountId du pizzaiolo
            const pizzaioloSnap = await admin.database().ref(`pizzaiolos/${ownerUid}`).get();
            const pizzaioloData = pizzaioloSnap.val();

            if (pizzaioloData?.stripeAccountId && pizzaioloData?.stripeOnboardingComplete) {
              connectedAccountId = pizzaioloData.stripeAccountId;
              console.log(`[PLANIZZA][createCheckoutSession] Connect activé pour truck ${truckIdForConnect}`);
            }
          }
        }

        // Calculer les frais de plateforme (commission configurable)
        const applicationFeeAmount = connectedAccountId && PLATFORM_FEE_PERCENT > 0
          ? Math.round(totalCentsServer * (PLATFORM_FEE_PERCENT / 100))
          : null;

        const sessionParams = {
          mode: "payment",
          payment_method_types: ["card"],
          metadata: {
            orderId,
            userUid: uid,
          },
          line_items: lineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: order.email || undefined,
        };

        // Ajouter les paramètres Connect si le pizzaiolo a un compte configuré
        if (connectedAccountId && applicationFeeAmount) {
          sessionParams.payment_intent_data = {
            application_fee_amount: applicationFeeAmount,
            transfer_data: {
              destination: connectedAccountId,
            },
          };
          console.log(`[PLANIZZA][createCheckoutSession] Commission ${PLATFORM_FEE_PERCENT}%: ${applicationFeeAmount}c sur ${totalCentsServer}c`);
        }

        const session = await stripeClient.checkout.sessions.create(sessionParams);

        // ✅ NE PAS changer le status en "pending" ici
        // La commande reste "created" jusqu'à confirmation du webhook
        if (!orderRef || !orderId) {
          return res.status(500).json({error: "internal"});
        }

        // Si la commande vient d'être créée côté serveur, on fait un set complet.
        // Sinon, on met à jour la commande existante.
        const base = order || {};
        const patch = {
          totalCents: totalCentsServer,
          payment: {
            provider: "stripe",
            sessionId: session.id,
            paymentStatus: "pending",
          },
          stripeCheckoutSessionId: session.id,
          updatedAt: rtdbServerTimestamp(),
          pickupTime: normalizedPickupTime || undefined,
          deliveryAddress: normalizedDeliveryAddress || undefined,
        };

        // - Si la commande existait déjà, on ne touche qu'aux champs Stripe/total.
        // - Sinon (commande créée à l'instant, ou inexistante mais orderId fourni), on fait un set complet.
        if (providedOrderId && orderExisted) {
          await orderRef.update(omitUndefinedDeep(patch));
        } else {
          await orderRef.set(omitUndefinedDeep({
            ...base,
            ...patch,
          }));
        }

        return res.json({sessionId: session.id, url: session.url, orderId});
      } catch (error) {
        // Gestion d'erreur structurée - ne pas exposer les détails internes
        const errorType = error?.type || error?.code || "unknown";
        const safeMessage = error?.message?.substring(0, 100) || "Unknown error";

        console.error("[PLANIZZA][createCheckoutSession] Erreur:", {
          type: errorType,
          message: safeMessage,
          // Ne pas logger l'objet error complet (peut contenir des données sensibles)
        });

        // Codes d'erreur spécifiques pour le client
        if (error?.type === "StripeCardError") {
          return res.status(400).json({ error: "card_error", code: error.code });
        }
        if (error?.type === "StripeInvalidRequestError") {
          return res.status(400).json({ error: "invalid_request" });
        }
        if (error?.type === "StripeAPIError" || error?.type === "StripeConnectionError") {
          return res.status(503).json({ error: "payment_service_unavailable" });
        }
        if (error?.type === "StripeRateLimitError") {
          return res.status(429).json({ error: "rate_limited" });
        }

        return res.status(500).json({ error: "internal" });
      }
    },
);

// Endpoint pizzaiolo (HTTP) : mise à jour du statut d'une commande.
// Objectif: éviter les writes directs depuis le client et centraliser les garde-fous.
exports.pizzaioloUpdateOrderStatus = onRequest(
  { region: "us-central1", invoker: "public" },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      const uid = await requireAuthUid(req);

      const orderId = req.body?.orderId;
      const newStatus = req.body?.newStatus;
      const managerOverride = Boolean(req.body?.managerOverride);

      if (!orderId || typeof orderId !== "string") {
        return res.status(400).json({ error: "orderId requis" });
      }
      if (!newStatus || typeof newStatus !== "string") {
        return res.status(400).json({ error: "newStatus requis" });
      }

      const allowed = new Set(["received", "accepted", "prep", "cook", "ready", "delivered", "cancelled", "lost"]);
      if (!allowed.has(newStatus)) {
        return res.status(400).json({ error: "newStatus invalide" });
      }

      const orderRef = admin.database().ref(`orders/${orderId}`);
      const snap = await orderRef.get();
      if (!snap.exists()) return res.status(404).json({ error: "Commande introuvable" });
      const order = snap.val();

      const truckId = order?.truckId;
      await assertPizzaioloOwnsTruck({ uid, truckId });

      const legacyPaid = order?.payment?.paymentStatus === "paid";
      const v2Paid = order?.v2?.paymentStatus === "PAID";
      if (newStatus === "delivered" && !legacyPaid && !v2Paid && !managerOverride) {
        return res.status(409).json({ error: "Paiement requis avant livraison/remise" });
      }

      const nowIso = new Date().toISOString();
      const nowMs = Date.now();
      const existingV2 = order?.v2 && typeof order.v2 === "object" ? order.v2 : null;
      const baseV2 = existingV2 || v2BuildBase({ ...order, id: orderId }, { nowIso, nowMs });

      const nextKitchenStatus = v2MapKitchenStatusFromV1Status(newStatus);
      const nextPaymentStatus = v2MapPaymentStatus(order);
      if (nextKitchenStatus === "DONE" && nextPaymentStatus !== "PAID" && !managerOverride) {
        return res.status(409).json({ error: "Paiement requis avant clôture" });
      }

      /** @type {Record<string, any>} */
      const updates = {
        status: newStatus,
        updatedAt: rtdbServerTimestamp(),
      };

      // Timeline: conserver la convention actuelle côté front.
      if (newStatus === "received") updates["timeline/receivedAt"] = rtdbServerTimestamp();
      if (newStatus === "accepted") updates["timeline/acceptedAt"] = rtdbServerTimestamp();
      if (newStatus === "prep") updates["timeline/prepAt"] = rtdbServerTimestamp();
      if (newStatus === "cook") updates["timeline/cookAt"] = rtdbServerTimestamp();
      if (newStatus === "ready") updates["timeline/readyAt"] = rtdbServerTimestamp();
      if (newStatus === "delivered") updates["timeline/deliveredAt"] = rtdbServerTimestamp();
      if (newStatus === "cancelled") updates["timeline/cancelledAt"] = rtdbServerTimestamp();
      if (newStatus === "lost") updates["timeline/expiredAt"] = rtdbServerTimestamp();

      // Vue v2 (materialized) : champs canoniques + timestamps ISO.
      const promisedAtIso = baseV2.promisedAt || v2InferPromisedAtIso({
        order,
        createdAtIso: baseV2.createdAt || nowIso,
        createdAtMs: baseV2.createdAtMs || nowMs,
      });
      const promisedAtMs = new Date(promisedAtIso).getTime();

      updates["v2/kitchenStatus"] = nextKitchenStatus;
      updates["v2/paymentStatus"] = nextPaymentStatus;
      updates["v2/fulfillment"] = baseV2.fulfillment || v2InferFulfillment(order);
      updates["v2/channel"] = baseV2.channel || v2InferChannel(order);
      updates["v2/createdAt"] = baseV2.createdAt || nowIso;
      if (typeof baseV2.createdAtMs === "number") updates["v2/createdAtMs"] = baseV2.createdAtMs;
      updates["v2/promisedAt"] = promisedAtIso;
      if (Number.isFinite(promisedAtMs)) updates["v2/promisedAtMs"] = promisedAtMs;
      updates["v2/updatedAt"] = nowIso;
      updates["v2/updatedAtMs"] = nowMs;

      const derived = v2DeriveTimestampsFromLegacyTimeline(order);
      const nextTs = v2ApplyEventTimestamps({
        nextKitchenStatus,
        nowIso,
        currentTimestamps: {
          ...derived,
          ...(baseV2.timestamps || {}),
        },
      });
      updates["v2/timestamps"] = nextTs;
      if (managerOverride) updates["v2/flags/managerOverride"] = true;

      await orderRef.update(omitUndefinedDeep(updates));
      return res.json({ ok: true });
    } catch (err) {
      const status = err?.status || 500;
      console.error("[PLANIZZA][pizzaioloUpdateOrderStatus] error", err);
      return res.status(status).json({ error: status === 500 ? "internal" : String(err.message || err) });
    }
  }
);

// Endpoint pizzaiolo (HTTP) : marquer une commande manuelle comme payée.
exports.pizzaioloMarkOrderPaid = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      const uid = await requireAuthUid(req);

      const orderId = req.body?.orderId;
      const method = req.body?.method;

      if (!orderId || typeof orderId !== "string") {
        return res.status(400).json({ error: "orderId requis" });
      }

      const allowedMethods = new Set(["CASH", "CARD", "OTHER"]);
      const normalizedMethod = typeof method === "string" ? method.toUpperCase() : "OTHER";
      if (!allowedMethods.has(normalizedMethod)) {
        return res.status(400).json({ error: "method invalide" });
      }

      const orderRef = admin.database().ref(`orders/${orderId}`);
      const snap = await orderRef.get();
      if (!snap.exists()) return res.status(404).json({ error: "Commande introuvable" });
      const order = snap.val();

      const truckId = order?.truckId;
      await assertPizzaioloOwnsTruck({ uid, truckId });

      const nowIso = new Date().toISOString();
      const nowMs = Date.now();
      const existingV2 = order?.v2 && typeof order.v2 === "object" ? order.v2 : null;
      const baseV2 = existingV2 || v2BuildBase({ ...order, id: orderId }, { nowIso, nowMs });
      const promisedAtIso = baseV2.promisedAt || v2InferPromisedAtIso({
        order,
        createdAtIso: baseV2.createdAt || nowIso,
        createdAtMs: baseV2.createdAtMs || nowMs,
      });

      await orderRef.update(omitUndefinedDeep({
        payment: {
          provider: "manual",
          paymentStatus: "paid",
          paidAt: rtdbServerTimestamp(),
          method: normalizedMethod,
        },
        paidAt: rtdbServerTimestamp(),
        updatedAt: rtdbServerTimestamp(),
        "v2/paymentStatus": "PAID",
        "v2/updatedAt": nowIso,
        "v2/updatedAtMs": nowMs,
        "v2/createdAt": baseV2.createdAt || nowIso,
        "v2/promisedAt": promisedAtIso,
      }));

      await writeOrderEvent(orderId, {
        type: "PAYMENT_CHANGED",
        actor: "PIZZAIOLO",
        source: "pizzaioloMarkOrderPaid",
        from: { paymentStatus: baseV2?.paymentStatus || v2MapPaymentStatus(order) },
        to: { paymentStatus: "PAID", method: normalizedMethod },
      });

      return res.json({ ok: true });
    } catch (err) {
      const status = err?.status || 500;
      console.error("[PLANIZZA][pizzaioloMarkOrderPaid] error", err);
      return res.status(status).json({ error: status === 500 ? "internal" : String(err.message || err) });
    }
  }
);

// Endpoint pizzaiolo (Callable) : transition v2 atomique (transaction) + optimistic locking.
exports.pizzaioloTransitionOrderV2 = onCall(
  { region: "us-central1" },
  async (request) => {
    const errorId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      const uid = request?.auth?.uid;
      if (!uid) {
        throw new HttpsError("unauthenticated", "unauthenticated");
      }

      const payload = request?.data || {};
      const orderId = payload?.orderId;
      const action = payload?.action;
      const expectedUpdatedAtMs = payload?.expectedUpdatedAtMs;
      const managerOverride = Boolean(payload?.managerOverride);

      if (!orderId || typeof orderId !== "string") {
        throw new HttpsError("invalid-argument", "orderId requis", { error: "orderId requis" });
      }
      if (!action || typeof action !== "string") {
        console.log("[V2 INPUT INVALID]", {
          errorId,
          payloadKeys: Object.keys(payload || {}),
        });
        throw new HttpsError("invalid-argument", "action requis", { error: "action requis" });
      }

      // Matrice action → targetStatus
      const ACTION_TO_STATUS = {
        ACCEPT: "QUEUED",
        START: "PREPPING",
        READY: "READY",
        HANDOFF: "HANDOFF",
        DONE: "DONE",
        CANCEL: "CANCELED",
      };

      const targetStatus = ACTION_TO_STATUS[action];
      if (!targetStatus) {
        throw new HttpsError("invalid-argument", "action invalide", {
          error: "action invalide",
          allowedActions: Object.keys(ACTION_TO_STATUS),
        });
      }

      const orderPath = `orders/${orderId}`;
      const orderRef = admin.database().ref(orderPath);

      debugLog("🔍 [V2 LOOKUP]", {
        errorId,
        orderId,
        path: orderPath,
        uid,
        action,
        targetStatus,
      });

      const snap = await orderRef.get();

      debugLog("🔍 [V2 LOOKUP RESULT]", {
        errorId,
        orderId,
        exists: snap.exists(),
        hasVal: snap.val() !== null,
        keys: snap.exists() ? Object.keys(snap.val() || {}).slice(0, 10) : null,
      });

      if (!snap.exists()) {
        throw new HttpsError("not-found", "Commande introuvable", {
          error: "Commande introuvable",
          requestedOrderId: orderId,
          pathTried: orderPath,
        });
      }

      const pre = snap.val();

      debugLog("[PLANIZZA][pizzaioloTransitionOrderV2] request", {
        errorId,
        uid,
        orderId,
        action,
        targetStatus,
        expectedUpdatedAtMsType: typeof expectedUpdatedAtMs,
        managerOverride,
        origin: request?.rawRequest?.headers?.origin || null,
      });

      await assertPizzaioloOwnsTruck({ uid, truckId: pre?.truckId });

      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      const preKitchenStatus = pre?.v2?.kitchenStatus ||
        v2MapKitchenStatusFromV1Status(pre?.status);
      const prePaymentStatus = pre?.v2?.paymentStatus || v2MapPaymentStatus(pre);

      // 🔍 LOG BACKEND: état reçu
      debugLog("🟧 [BACK] Action reçue:", {
        errorId,
        orderId,
        action,
        targetStatus,
        currentKitchenStatus: preKitchenStatus,
        currentPaymentStatus: prePaymentStatus,
        legacyStatus: pre?.status,
        hasV2Embedded: Boolean(pre?.v2),
        v2EmbeddedKitchenStatus: pre?.v2?.kitchenStatus || null,
      });

      const computeBaseV2 = (orderLike) => {
        const existingV2 = orderLike?.v2 && typeof orderLike.v2 === "object" ? orderLike.v2 : null;
        const computed = existingV2 ||
          v2BuildBase({ ...orderLike, id: orderId }, { nowIso, nowMs });

        // DEBUG: log l'état v2 calculé pour diagnostiquer les transitions refusées
        debugLog("[PLANIZZA][pizzaioloTransitionOrderV2] computeBaseV2", {
          errorId,
          orderId,
          hasEmbeddedV2: Boolean(existingV2),
          legacyStatus: orderLike?.status,
          computedKitchenStatus: computed?.kitchenStatus,
          computedPaymentStatus: computed?.paymentStatus,
          targetStatus,
        });

        return computed;
      };

      const runTx = async ({ enforceExpectedUpdatedAt = true } = {}) => {
        // NOTE: Admin SDK transaction signature is (updateFn, onComplete?, applyLocally?)
        // Passing an options object as 2nd arg crashes with:
        // "Reference.transaction failed: onComplete argument must be a valid function."

        // Variables pour capturer les détails d'échec hors transaction
        let abortReason = null;
        let wasIdempotent = false;

        const result = await orderRef.transaction(
          (current) => {
            const baseOrder = current || pre;
            if (!baseOrder) {
              abortReason = "order_not_found";
              return;
            }

            const baseV2 = computeBaseV2(baseOrder);

            // Idempotence: si la commande est déjà dans l'état demandé,
            // on retourne undefined pour aborter proprement
            if (baseV2?.kitchenStatus === targetStatus) {
              wasIdempotent = true;
              abortReason = "already_in_target_state";
              return; // abort proprement (pas d'écriture nécessaire)
            }

            if (enforceExpectedUpdatedAt && typeof expectedUpdatedAtMs === "number") {
              const cur = baseV2.updatedAtMs;
              if (typeof cur === "number" && cur !== expectedUpdatedAtMs) {
                abortReason = `optimistic_lock_mismatch (expected: ${expectedUpdatedAtMs}, current: ${cur})`;
                return; // abort => conflict
              }
            }

            const check = v2CanTransition(baseV2, targetStatus, { managerOverride });
            if (!check.ok) {
              abortReason = check.reason || "transition_check_failed";
              debugLog("[PLANIZZA][pizzaioloTransitionOrderV2] transition refused in tx", {
                errorId,
                orderId,
                from: baseV2?.kitchenStatus,
                to: targetStatus,
                reason: abortReason,
                paymentStatus: baseV2?.paymentStatus,
                enforceExpectedUpdatedAt,
              });
              return; // abort
            }

            const nextV2 = omitUndefinedDeep({
              ...baseV2,
              kitchenStatus: targetStatus,
              updatedAt: nowIso,
              updatedAtMs: nowMs,
              timestamps: v2ApplyEventTimestamps({
                nextKitchenStatus: targetStatus,
                nowIso,
                currentTimestamps: {
                  ...v2DeriveTimestampsFromLegacyTimeline(baseOrder),
                  ...(baseV2.timestamps || {}),
                },
              }),
            });

            if (managerOverride) {
              nextV2.flags = { ...(nextV2.flags || {}), managerOverride: true };
            }

            const v1Status = v2MapKitchenStatusToV1Status(targetStatus);
            const timelineKey = v2TimelineKeyForV1Status(v1Status);

            const next = { ...baseOrder };
            next.v2 = nextV2;
            next.status = v1Status;
            next.updatedAt = rtdbServerTimestamp();
            if (!next.timeline) next.timeline = {};
            if (timelineKey) {
              // timelineKey est un chemin, on gère les 2 niveaux.
              const [, key] = timelineKey.split("/");
              next.timeline[key] = rtdbServerTimestamp();
            }

            return omitUndefinedDeep(next);
          },
          undefined,
          false
        );

        // Log l'abort reason après la transaction
        if (!result.committed && abortReason) {
          debugLog("[PLANIZZA][pizzaioloTransitionOrderV2] tx not committed", {
            errorId,
            orderId,
            abortReason,
            wasIdempotent,
            enforceExpectedUpdatedAt,
          });
        }

        return { result, wasIdempotent, abortReason };
      };

      let result;
      let wasIdempotent = false;
      let txAbortReason = null;
      try {
        const txResult = await runTx({ enforceExpectedUpdatedAt: true });
        result = txResult.result;
        wasIdempotent = txResult.wasIdempotent;
        txAbortReason = txResult.abortReason;
      } catch (txErr) {
        console.error("[PLANIZZA][pizzaioloTransitionOrderV2] transaction failed", {
          errorId,
          message: txErr?.message,
          name: txErr?.name,
          stack: txErr?.stack,
        });

        throw txErr;
      }

      // Si c'était idempotent (déjà dans le bon état), on retourne succès immédiatement
      if (!result.committed && wasIdempotent) {
        console.log("[PLANIZZA][pizzaioloTransitionOrderV2] idempotent (no-op)", {
          errorId,
          orderId,
          kitchenStatus: targetStatus,
        });
        return { ok: true, noop: true, kitchenStatus: targetStatus };
      }

      if (!result.committed) {
        // On re-lit pour distinguer précisément conflit vs transition refusée,
        // et rendre l'opération idempotente (double-clic / UI en retard).
        const latestSnap = await orderRef.get();
        const latest = latestSnap.exists() ? latestSnap.val() : null;
        const latestV2 = latest ? computeBaseV2(latest) : null;

        const curKitchen = latestV2?.kitchenStatus;
        const curUpdatedAtMs = latestV2?.updatedAtMs;

        const canNow = latestV2
          ? v2CanTransition(latestV2, targetStatus, { managerOverride })
          : { ok: false, reason: "Commande introuvable" };

        // Si l'optimistic lock a échoué mais que la transition est toujours valide,
        // on tente 1 retry sans expectedUpdatedAtMs (évite des 409 liés à des updates annexes).
        if (typeof expectedUpdatedAtMs === "number" && canNow.ok) {
          const retryResult = await runTx({ enforceExpectedUpdatedAt: false });
          const retry = retryResult.result;
          const retryWasIdempotent = retryResult.wasIdempotent;

          if (retry.committed) {
            await writeOrderEvent(orderId, {
              type: "STATUS_CHANGED",
              actor: "PIZZAIOLO",
              source: "pizzaioloTransitionOrderV2",
              from: {
                kitchenStatus: curKitchen || preKitchenStatus,
                paymentStatus: prePaymentStatus,
              },
              to: { kitchenStatus: targetStatus, paymentStatus: prePaymentStatus },
            });
            return {
              ok: true,
              updatedAtMs: nowMs,
              updatedAt: nowIso,
              retried: true,
            };
          } else if (retryWasIdempotent) {
            // Le retry a constaté que c'était déjà fait (idempotent)
            debugLog("[PLANIZZA][pizzaioloTransitionOrderV2] retry was idempotent", {
              errorId,
              orderId,
            });
            return {
              ok: true,
              noop: true,
              kitchenStatus: targetStatus,
              retried: true,
            };
          } else {
            debugLog("[PLANIZZA][pizzaioloTransitionOrderV2] retry also failed", {
              errorId,
              orderId,
            });
          }
        }

        if (
          typeof expectedUpdatedAtMs === "number" &&
          typeof curUpdatedAtMs === "number" &&
          curUpdatedAtMs !== expectedUpdatedAtMs
        ) {
          throw new HttpsError("failed-precondition", "conflict", {
            error: "conflict",
            currentKitchenStatus: curKitchen,
            currentUpdatedAtMs: curUpdatedAtMs,
          });
        }

        console.warn("[PLANIZZA][pizzaioloTransitionOrderV2] FINAL 409", {
          errorId,
          orderId,
          txAbortReason,
          canNowOk: canNow?.ok,
          canNowReason: canNow?.reason,
          curKitchen,
          targetStatus,
          expectedUpdatedAtMs,
          curUpdatedAtMs,
        });

        throw new HttpsError("failed-precondition", "transition_refused", {
          error: "transition_refused",
          reason: canNow?.reason || "transition_refused",
          currentKitchenStatus: curKitchen,
          debugAbortReason: txAbortReason,
        });
      }

      await writeOrderEvent(orderId, {
        type: "STATUS_CHANGED",
        actor: "PIZZAIOLO",
        source: "pizzaioloTransitionOrderV2",
        from: { kitchenStatus: preKitchenStatus, paymentStatus: prePaymentStatus },
        to: { kitchenStatus: targetStatus, paymentStatus: prePaymentStatus },
      });

      return { ok: true, updatedAtMs: nowMs, updatedAt: nowIso };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }

      const status = err?.status || 500;
      console.error("[PLANIZZA][pizzaioloTransitionOrderV2] error", {
        errorId,
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
        status,
      });

      if (status === 401) {
        throw new HttpsError("unauthenticated", "unauthenticated");
      }
      if (status === 403) {
        throw new HttpsError("permission-denied", "forbidden");
      }
      if (status === 404) {
        throw new HttpsError("not-found", err?.message || "not_found");
      }
      if (status === 409) {
        throw new HttpsError("failed-precondition", err?.message || "conflict");
      }
      throw new HttpsError("internal", "internal", { errorId });
    }
  }
);

// Endpoint pizzaiolo (HTTP) : création commande manuelle via serveur (bypass rules) + v2.
exports.pizzaioloCreateManualOrder = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      const uid = await requireAuthUid(req);

      const truckId = req.body?.truckId;
      const customerName = req.body?.customerName;
      const pickupTime = req.body?.pickupTime;
      const items = req.body?.items;
      const totalCents = req.body?.totalCents;

      if (!truckId || typeof truckId !== "string") {
        return res.status(400).json({ error: "truckId requis" });
      }
      await assertPizzaioloOwnsTruck({ uid, truckId });

      if (!customerName || typeof customerName !== "string") {
        return res.status(400).json({ error: "customerName requis" });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items requis" });
      }

      const safeItems = items.map((it) => ({
        id: it?.id || null,
        name: String(it?.name || "Article"),
        priceCents: Number(it?.priceCents || 0),
        qty: Number(it?.qty || 1),
      }));

      const safeTotalCents = typeof totalCents === "number" && Number.isFinite(totalCents)
        ? totalCents
        : safeItems.reduce((sum, it) => sum + it.priceCents * it.qty, 0);

      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      const ordersRef = admin.database().ref("orders");
      const newOrderRef = ordersRef.push();
      const orderId = newOrderRef.key;
      if (!orderId) return res.status(500).json({ error: "internal" });

      const orderLegacy = {
        truckId,
        uid,
        items: safeItems,
        totalCents: safeTotalCents,
        status: "received",
        createdAt: rtdbServerTimestamp(),
        createdAtClient: nowMs,
        timeline: {},
        payment: {
          provider: "manual",
          paymentStatus: "pending",
        },
        deliveryMethod: "pickup",
        customerName: customerName.trim(),
        pickupTime: typeof pickupTime === "string" ? pickupTime : null,
        source: "manual",
      };

      const baseV2 = v2BuildBase({ ...orderLegacy, id: orderId }, { nowIso, nowMs });
      const promisedAtIso = v2InferPromisedAtIso({
        order: orderLegacy,
        createdAtIso: baseV2.createdAt || nowIso,
        createdAtMs: baseV2.createdAtMs || nowMs,
      });
      const promisedAtMs = new Date(promisedAtIso).getTime();

      const orderV2 = omitUndefinedDeep({
        ...baseV2,
        id: orderId,
        kitchenStatus: "NEW",
        paymentStatus: "UNPAID",
        fulfillment: "PICKUP",
        channel: "ON_SITE",
        promisedAt: promisedAtIso,
        promisedAtMs: Number.isFinite(promisedAtMs) ? promisedAtMs : undefined,
        timestamps: {},
      });

      await newOrderRef.set(omitUndefinedDeep({
        ...orderLegacy,
        v2: orderV2,
      }));

      await admin.database().ref(`truckOrders/${truckId}/${orderId}`).set(true);

      await writeOrderEvent(orderId, {
        type: "STATUS_CHANGED",
        actor: "PIZZAIOLO",
        source: "pizzaioloCreateManualOrder",
        from: null,
        to: { kitchenStatus: "NEW", paymentStatus: "UNPAID" },
      });

      return res.json({ ok: true, orderId });
    } catch (err) {
      const status = err?.status || 500;
      console.error("[PLANIZZA][pizzaioloCreateManualOrder] error", err);
      return res.status(status).json({ error: status === 500 ? "internal" : String(err.message || err) });
    }
  }
);

// Rate limiting pour les échecs de signature webhook
const WEBHOOK_RATE_LIMIT = {
  maxFailures: 10, // Max échecs par IP
  windowMs: 15 * 60 * 1000, // Fenêtre de 15 minutes
};

async function checkWebhookRateLimit(ip) {
  if (!ip) return { allowed: true };

  const safeIp = ip.replace(/[.:/]/g, "_"); // Firebase key-safe
  const ref = admin.database().ref(`webhookRateLimit/${safeIp}`);
  const snap = await ref.get();

  if (!snap.exists()) return { allowed: true };

  const data = snap.val();
  const now = Date.now();

  // Reset si fenêtre expirée
  if (data.windowStart && (now - data.windowStart) > WEBHOOK_RATE_LIMIT.windowMs) {
    await ref.remove();
    return { allowed: true };
  }

  if (data.failures >= WEBHOOK_RATE_LIMIT.maxFailures) {
    return { allowed: false, failures: data.failures };
  }

  return { allowed: true };
}

async function recordWebhookFailure(ip) {
  if (!ip) return;

  const safeIp = ip.replace(/[.:/]/g, "_");
  const ref = admin.database().ref(`webhookRateLimit/${safeIp}`);

  await ref.transaction((current) => {
    const now = Date.now();
    if (!current || (now - (current.windowStart || 0)) > WEBHOOK_RATE_LIMIT.windowMs) {
      return { failures: 1, windowStart: now };
    }
    return { ...current, failures: (current.failures || 0) + 1 };
  });
}

exports.stripeWebhook = onRequest(
    {
      region: "us-central1",
      secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
    },
    async (req, res) => {
      const stripeSecret = (STRIPE_SECRET_KEY.value() || "").trim();
      const webhookSecret = (STRIPE_WEBHOOK_SECRET.value() || "").trim();
      const stripeClient = stripe(stripeSecret);

      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }

      // Rate limiting par IP sur les échecs de signature
      const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
                       req.ip || req.socket?.remoteAddress || "unknown";
      const rateCheck = await checkWebhookRateLimit(clientIp);
      if (!rateCheck.allowed) {
        console.warn("[PLANIZZA] Webhook rate limited", { ip: clientIp, failures: rateCheck.failures });
        return res.status(429).send("Too many failed attempts");
      }

      // Diagnostic: log basic request meta (sans body)
      console.log("[PLANIZZA][stripeWebhook] incoming request", {
        contentType: req.headers["content-type"],
        len: req.headers["content-length"],
        sigPresent: Boolean(req.headers["stripe-signature"]),
      });

      const sig = req.headers["stripe-signature"];
      if (!sig || typeof sig !== "string") {
        console.warn("[PLANIZZA] Missing Stripe-Signature header");
        await recordWebhookFailure(clientIp);
        return res.status(400).send("Missing Stripe-Signature header");
      }

      if (!req.rawBody || !req.rawBody.length) {
        console.error("[PLANIZZA] rawBody manquant pour le webhook (constructEvent nécessite le corps brut)");
        return res.status(400).send("Missing raw body");
      }

      let event;
      try {
        event = stripeClient.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
      } catch (err) {
        // Log limité - ne pas exposer les détails de signature
        console.error("[PLANIZZA] Webhook signature verification failed:", {
          errorType: err?.type || "unknown",
          // Ne pas logger err.message complet (peut contenir des infos de timing)
        });
        // Enregistrer l'échec pour le rate limiting
        await recordWebhookFailure(clientIp);
        // Message générique au client - ne pas révéler pourquoi la signature a échoué
        return res.status(400).send("Webhook signature verification failed");
      }

      console.log("[PLANIZZA][stripeWebhook] event reçu", {type: event.type, id: event.id});

      // Idempotence: vérifier si cet event a déjà été traité
      const eventId = event.id;
      const processedRef = admin.database().ref(`stripeWebhooksProcessed/${eventId}`);
      const alreadyProcessed = await processedRef.get();
      if (alreadyProcessed.exists()) {
        console.log("[PLANIZZA][stripeWebhook] Event déjà traité, skip", { eventId });
        return res.json({ received: true, type: event.type, cached: true });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const orderId = session?.metadata?.orderId;
        const userUid = session?.metadata?.userUid || null;

        // Validation des metadata
        if (!orderId || typeof orderId !== "string" || orderId.length > 128) {
          console.warn("[PLANIZZA][stripeWebhook] orderId invalide ou manquant", { orderId });
          return res.status(400).json({ error: "invalid_order_id" });
        }

        // Marquer l'event comme traité AVANT le processing (at-most-once)
        await processedRef.set({
          processedAt: admin.database.ServerValue.TIMESTAMP,
          eventType: event.type,
          orderId,
        });

        if (orderId) {
          const orderRef = admin.database().ref(`orders/${orderId}`);
          const snap = await orderRef.get();

          if (snap.exists()) {
            const current = snap.val();

            const preKitchenStatus = current?.v2?.kitchenStatus ||
              v2MapKitchenStatusFromV1Status(current?.status);
            const prePaymentStatus = current?.v2?.paymentStatus || v2MapPaymentStatus(current);

            if (current.status !== "paid" && current.payment?.paymentStatus !== "paid") {
              if (userUid) {
                try {
                  const activeCartRef = admin.database().ref(`carts/${userUid}/active`);
                  const archiveRef = admin.database().ref(`cartsArchive/${userUid}/${orderId}`);

                  const [cartSnap, archiveSnap] = await Promise.all([
                    activeCartRef.get(),
                    archiveRef.get(),
                  ]);

                  if (cartSnap.exists() && !archiveSnap.exists()) {
                    const cart = cartSnap.val();
                    await archiveRef.set({
                      ...cart,
                      orderId,
                      archivedAt: admin.database.ServerValue.TIMESTAMP,
                      archivedReason: "paid",
                      stripeCheckoutSessionId: session.id,
                      stripePaymentIntentId: session.payment_intent || null,
                      stripePaymentStatus: session.payment_status || null,
                    });

                    // Ne garder que les 5 derniers paniers archivés
                    await pruneCartArchive(userUid, 5);
                  }

                  await activeCartRef.remove();
                } catch (err) {
                  console.warn("[PLANIZZA] Archive panier impossible (best-effort):", err);
                }
              }

              const nowIso = new Date().toISOString();
              const nowMs = Date.now();
              const baseV2 = v2BuildBase({ ...current, id: orderId }, { nowIso, nowMs });
              const derived = v2DeriveTimestampsFromLegacyTimeline(current);

              await orderRef.update(omitUndefinedDeep({
                status: "received",
                paidAt: rtdbServerTimestamp(),
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: session.payment_intent || null,
                stripePaymentStatus: session.payment_status || null,
                payment: {
                  provider: "stripe",
                  sessionId: session.id,
                  paymentStatus: "paid",
                },
                updatedAt: rtdbServerTimestamp(),
                timeline: {
                  ...(current.timeline || {}),
                  receivedAt: rtdbServerTimestamp(),
                },
                v2: {
                  ...baseV2,
                  kitchenStatus: "NEW",
                  paymentStatus: "PAID",
                  channel: "WEB",
                  timestamps: {
                    ...(baseV2.timestamps || {}),
                    ...derived,
                  },
                },
              // nextStepAt retiré: workflow entièrement manuel (clic pizzaiolo)
              }));

              await writeOrderEvent(orderId, {
                type: "PAYMENT_CHANGED",
                actor: "STRIPE",
                source: "stripeWebhook.checkout.session.completed",
                from: { kitchenStatus: preKitchenStatus, paymentStatus: prePaymentStatus },
                to: { kitchenStatus: "NEW", paymentStatus: "PAID" },
              });

              if (current.truckId) {
                await admin.database().ref(`truckOrders/${current.truckId}/${orderId}`).set(true);
              }
            }
          }
        }
      }

      return res.json({received: true, type: event.type});
    },
);

/**
 * Purge automatique des paniers expirés (TTL 30 min)
 *
 * - Scanne carts/{uid}/active/expiresAt <= now
 * - Supprime uniquement /carts/{uid}/active
 */
exports.purgeExpiredCarts = functions.pubsub
    .schedule("every 5 minutes")
    .timeZone("Europe/Paris")
    .onRun(async () => {
      const now = Date.now();

      const cartsRef = admin.database().ref("carts");
      // startAt(1) pour éviter les nodes sans expiresAt (null) qui seraient triés en premier.
      const snap = await cartsRef
          .orderByChild("active/expiresAt")
          .startAt(1)
          .endAt(now)
          .limitToFirst(500)
          .get();

      if (!snap.exists()) return null;

      const updates = {};
      snap.forEach((child) => {
        const uid = child.key;
        const expiresAt = child.child("active/expiresAt").val();
        if (typeof expiresAt === "number" && expiresAt <= now) {
          updates[`carts/${uid}/active`] = null;
        }
      });

      const keys = Object.keys(updates);
      if (keys.length === 0) return null;

      await admin.database().ref().update(updates);
      console.log(`[PLANIZZA] purgeExpiredCarts: ${keys.length} panier(s) supprimé(s).`);
      return null;
    });

/**
 * Purge des events webhook Stripe traités (TTL 7 jours)
 * Évite que la table stripeWebhooksProcessed grossisse indéfiniment
 */
exports.purgeProcessedWebhooks = functions.pubsub
    .schedule("every 24 hours")
    .timeZone("Europe/Paris")
    .onRun(async () => {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

      const webhooksRef = admin.database().ref("stripeWebhooksProcessed");
      const snap = await webhooksRef
          .orderByChild("processedAt")
          .startAt(1)
          .endAt(sevenDaysAgo)
          .limitToFirst(500)
          .get();

      if (!snap.exists()) return null;

      const updates = {};
      snap.forEach((child) => {
        updates[child.key] = null;
      });

      const count = Object.keys(updates).length;
      if (count === 0) return null;

      await webhooksRef.update(updates);
      console.log(`[PLANIZZA] purgeProcessedWebhooks: ${count} event(s) supprimé(s).`);
      return null;
    });

/**
 * Purge des données de rate limiting webhook (TTL 1 heure)
 * Nettoie les entrées expirées pour éviter accumulation
 */
exports.purgeWebhookRateLimit = functions.pubsub
    .schedule("every 30 minutes")
    .timeZone("Europe/Paris")
    .onRun(async () => {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      const rateLimitRef = admin.database().ref("webhookRateLimit");
      const snap = await rateLimitRef
          .orderByChild("windowStart")
          .startAt(1)
          .endAt(oneHourAgo)
          .limitToFirst(500)
          .get();

      if (!snap.exists()) return null;

      const updates = {};
      snap.forEach((child) => {
        updates[child.key] = null;
      });

      const count = Object.keys(updates).length;
      if (count === 0) return null;

      await rateLimitRef.update(updates);
      console.log(`[PLANIZZA] purgeWebhookRateLimit: ${count} entrée(s) supprimée(s).`);
      return null;
    });

/**
 * Auto-expire des commandes (no-show) — Orders v2
 *
 * Condition (instructions_commandes.md §6.1):
 * - fulfillment == PICKUP
 * - paymentStatus == UNPAID
 * - kitchenStatus dans [NEW,QUEUED,PREPPING,READY]
 * - now > promisedAt + 60min
 *
 * Action:
 * - kitchenStatus = EXPIRED
 * - timestamps.expiredAt = now
 * - compat v1: status = lost + timeline.expiredAt
 * - audit: orderEvents/{orderId}
 */
exports.autoExpireOrdersV2 = functions.pubsub
  .schedule("every 5 minutes")
  .timeZone("Europe/Paris")
  .onRun(async () => {
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const statuses = ["NEW", "QUEUED", "PREPPING", "READY"];
    const ordersRef = admin.database().ref("orders");

    const snaps = await Promise.all(
      statuses.map((ks) =>
        ordersRef
          .orderByChild("v2/kitchenStatus")
          .equalTo(ks)
          .limitToFirst(500)
          .get(),
      ),
    );

    const candidates = [];
    for (const snap of snaps) {
      if (!snap.exists()) continue;
      snap.forEach((child) => {
        candidates.push({ orderId: child.key, order: child.val() });
      });
    }

    if (candidates.length === 0) return null;

    let expiredCount = 0;

    // Traitement séquentiel: évite de déclencher trop de transactions en parallèle.
    for (const c of candidates) {
      const orderId = c.orderId;
      if (!orderId) continue;

      const pre = c.order;
      const preV2 = pre?.v2 && typeof pre.v2 === "object" ? pre.v2 : null;
      const baseV2 = preV2 || v2BuildBase({ ...pre, id: orderId }, { nowIso, nowMs });

      if (!v2ShouldAutoExpire(baseV2, nowMs)) continue;

      const orderRef = admin.database().ref(`orders/${orderId}`);
      // Admin SDK transaction signature: (updateFn, onComplete?, applyLocally?)
      const result = await orderRef.transaction((current) => {
        if (!current) return;

        const curV2 = current?.v2 && typeof current.v2 === "object" ? current.v2 : null;
        const curBase = curV2 || v2BuildBase({ ...current, id: orderId }, { nowIso, nowMs });

        if (!v2ShouldAutoExpire(curBase, nowMs)) return;

        const nextV2 = omitUndefinedDeep({
          ...curBase,
          kitchenStatus: "EXPIRED",
          updatedAt: nowIso,
          updatedAtMs: nowMs,
          timestamps: v2ApplyEventTimestamps({
            nextKitchenStatus: "EXPIRED",
            nowIso,
            currentTimestamps: {
              ...v2DeriveTimestampsFromLegacyTimeline(current),
              ...(curBase.timestamps || {}),
            },
          }),
        });

        const next = { ...current };
        next.v2 = nextV2;
        next.status = "lost";
        next.updatedAt = rtdbServerTimestamp();
        if (!next.timeline) next.timeline = {};
        next.timeline.expiredAt = rtdbServerTimestamp();
        return omitUndefinedDeep(next);
      }, undefined, false);

      if (result?.committed) {
        expiredCount += 1;
        await writeOrderEvent(orderId, {
          type: "STATUS_CHANGED",
          actor: "SYSTEM",
          source: "autoExpireOrdersV2",
          from: { kitchenStatus: baseV2.kitchenStatus, paymentStatus: baseV2.paymentStatus },
          to: { kitchenStatus: "EXPIRED", paymentStatus: baseV2.paymentStatus },
        });
      }
    }

    if (expiredCount > 0) {
      console.log(`[PLANIZZA] autoExpireOrdersV2: ${expiredCount} commande(s) expirée(s).`);
    }

    return null;
  });

/**
 * DÉSACTIVÉ: Avance automatiquement les commandes
 * Toutes les transitions de statut sont désormais manuelles (clic pizzaiolo)
 *
 * Workflow manuel:
 * - received (après paiement Stripe)
 * - accepted (clic "Prendre en charge")
 * - delivered (clic "Délivré")
 */
// exports.advanceOrders = functions.pubsub
//   .schedule("every 1 minutes")
//   .timeZone("Europe/Paris")
//   .onRun(async () => {
//     const now = Date.now();

//     const ordersRef = admin.database().ref("orders");
//     const snap = await ordersRef
//       .orderByChild("nextStepAt")
//       .startAt(1)
//       .endAt(now)
//       .limitToFirst(100)
//       .get();

//     if (!snap.exists()) return null;

//     const updates = {};
//     let count = 0;

//     snap.forEach((child) => {
//       const orderId = child.key;
//       const order = child.val();

//       if (!order.nextStepAt || order.nextStepAt > now) return;

//       const status = order.status;

//       if (status === "received") {
//         updates[`orders/${orderId}/status`] = "prep";
//         updates[`orders/${orderId}/timeline/prepAt`] = now;
//         updates[`orders/${orderId}/nextStepAt`] = now + 2 * 60 * 1000; // +2 min
//         updates[`orders/${orderId}/updatedAt`] = now;
//         count++;
//       } else if (status === "prep") {
//         updates[`orders/${orderId}/status`] = "cooking";
//         updates[`orders/${orderId}/timeline/cookingAt`] = now;
//         updates[`orders/${orderId}/nextStepAt`] = now + 2 * 60 * 1000; // +2 min
//         updates[`orders/${orderId}/updatedAt`] = now;
//         count++;
//       } else if (status === "cooking") {
//         updates[`orders/${orderId}/status`] = "ready";
//         updates[`orders/${orderId}/timeline/readyAt`] = now;
//         updates[`orders/${orderId}/nextStepAt`] = null; // terminé
//         updates[`orders/${orderId}/updatedAt`] = now;
//         count++;
//       }
//     });

//     if (count === 0) return null;

//     await admin.database().ref().update(updates);
//     console.log(`[PLANIZZA] advanceOrders: ${count} commande(s) avancée(s).`);
//     return null;
//   });

/**
 * Cleanup automatique des comptes Firebase anonymes après 48h
 *
 * - Scanne les utilisateurs anonymes créés il y a plus de 48h
 * - Vérifie qu'ils n'ont pas de commandes associées
 * - Supprime uniquement les comptes sans commandes
 *
 * Runs: every 24 hours
 */
exports.cleanupAnonymousUsers = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("Europe/Paris")
  .onRun(async () => {
    const RETENTION_MS = 48 * 60 * 60 * 1000; // 48 heures
    const cutoffTime = Date.now() - RETENTION_MS;

    let deletedCount = 0;
    let protectedCount = 0;
    let errorCount = 0;

    try {
      // Firebase Auth limite à 1000 users par batch
      const listUsersResult = await admin.auth().listUsers(1000);

      // Filtrer les comptes anonymes créés il y a plus de 48h
      const candidatesForDeletion = listUsersResult.users
        .filter((user) => {
          // Un compte est anonyme si providerData est vide
          const isAnonymous = !user.providerData || user.providerData.length === 0;
          if (!isAnonymous) return false;

          // Vérifier l'âge du compte
          const createdAt = new Date(user.metadata.creationTime).getTime();
          return createdAt < cutoffTime;
        });

      console.log(`[PLANIZZA][cleanupAnonymousUsers] Found ${candidatesForDeletion.length} anonymous users older than 48h`);

      // Pour chaque candidat, vérifier qu'il n'a pas de commandes
      for (const user of candidatesForDeletion) {
        try {
          const uid = user.uid;

          // Vérifier s'il existe des commandes pour cet UID
          const ordersSnap = await admin
            .database()
            .ref("orders")
            .orderByChild("userUid")
            .equalTo(uid)
            .limitToFirst(1)
            .get();

          if (ordersSnap.exists()) {
            // L'utilisateur a des commandes, on le garde
            protectedCount++;
            console.log(`[PLANIZZA] Keeping anonymous user ${hashUid(uid)} (has orders)`);
            continue;
          }

          // Pas de commandes, on peut supprimer
          await admin.auth().deleteUser(uid);
          deletedCount++;
        } catch (err) {
          errorCount++;
          console.error(`[PLANIZZA] Error processing user ${hashUid(user.uid)}:`, err);
        }
      }

      console.log(`[PLANIZZA][cleanupAnonymousUsers] Completed: ${deletedCount} deleted, ${protectedCount} protected, ${errorCount} errors`);
      return null;
    } catch (err) {
      console.error("[PLANIZZA][cleanupAnonymousUsers] Fatal error:", err);
      return null;
    }
  });

// ========================================
// STRIPE CONNECT - Onboarding Pizzaiolos
// ========================================

/**
 * Crée un compte Stripe Connect Express pour un pizzaiolo.
 * Stocke le stripeAccountId dans RTDB pizzaiolos/{uid}/stripeAccountId
 */
exports.createConnectedAccount = onCall(
  {
    region: "us-central1",
    secrets: [STRIPE_SECRET_KEY],
  },
  async (request) => {
    // Vérifier l'authentification
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Vous devez être connecté");
    }

    const uid = request.auth.uid;

    // Vérifier que le user est bien un pizzaiolo (a un truckId)
    const pizzaioloRef = admin.database().ref(`pizzaiolos/${uid}`);
    const pizzaioloSnap = await pizzaioloRef.get();

    if (!pizzaioloSnap.exists() || !pizzaioloSnap.val()?.truckId) {
      throw new HttpsError("permission-denied", "Vous n'êtes pas enregistré comme pizzaiolo");
    }

    const pizzaioloData = pizzaioloSnap.val();

    // Vérifier si un compte Stripe existe déjà
    const existingAccountId = pizzaioloData?.stripeAccountId;

    // Récupérer l'email professionnel du profil (renseigné lors de la création du camion)
    const email = pizzaioloData?.professionalEmail;
    if (!email || typeof email !== "string") {
      throw new HttpsError("failed-precondition", "Email professionnel manquant. Veuillez compléter votre profil.");
    }
    if (existingAccountId) {
      throw new HttpsError("already-exists", "Un compte Stripe est déjà associé");
    }

    const stripeSecret = (STRIPE_SECRET_KEY.value() || "").trim();
    const stripeClient = stripe(stripeSecret);

    try {
      // Créer le compte Express
      const account = await stripeClient.accounts.create({
        type: "express",
        country: "FR",
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          url: "https://planizza-ac827.web.app",
          mcc: "5812", // Restaurants/Eating Places
        },
      });

      // Stocker dans RTDB
      await pizzaioloRef.update({
        stripeAccountId: account.id,
        stripeOnboardingComplete: false,
        stripeAccountCreatedAt: admin.database.ServerValue.TIMESTAMP,
      });

      console.log(`[PLANIZZA][createConnectedAccount] Compte créé: ${hashUid(uid)} -> ${account.id}`);

      return {
        accountId: account.id,
      };
    } catch (error) {
      console.error("[PLANIZZA][createConnectedAccount] Erreur Stripe:", {
        uid: hashUid(uid),
        type: error?.type,
        message: error?.message?.substring(0, 100),
      });
      throw new HttpsError("internal", "Erreur lors de la création du compte Stripe");
    }
  }
);

/**
 * Génère un lien d'onboarding Stripe pour un pizzaiolo.
 * Le pizzaiolo doit déjà avoir un stripeAccountId.
 */
exports.createOnboardingLink = onCall(
  {
    region: "us-central1",
    secrets: [STRIPE_SECRET_KEY],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Vous devez être connecté");
    }

    const uid = request.auth.uid;

    // Récupérer le stripeAccountId du pizzaiolo
    const pizzaioloRef = admin.database().ref(`pizzaiolos/${uid}`);
    const pizzaioloSnap = await pizzaioloRef.get();

    if (!pizzaioloSnap.exists()) {
      throw new HttpsError("not-found", "Profil pizzaiolo introuvable");
    }

    const accountId = pizzaioloSnap.val()?.stripeAccountId;
    if (!accountId) {
      throw new HttpsError("failed-precondition", "Aucun compte Stripe associé. Créez d'abord un compte.");
    }

    const stripeSecret = (STRIPE_SECRET_KEY.value() || "").trim();
    const stripeClient = stripe(stripeSecret);

    try {
      const accountLink = await stripeClient.accountLinks.create({
        account: accountId,
        refresh_url: `${FRONTEND_URL}/pro/onboarding?refresh=true`,
        return_url: `${FRONTEND_URL}/pro/onboarding?complete=true`,
        type: "account_onboarding",
      });

      console.log(`[PLANIZZA][createOnboardingLink] Lien créé pour ${hashUid(uid)}`);

      return {
        url: accountLink.url,
      };
    } catch (error) {
      console.error("[PLANIZZA][createOnboardingLink] Erreur Stripe:", {
        uid: hashUid(uid),
        type: error?.type,
        message: error?.message?.substring(0, 100),
      });
      throw new HttpsError("internal", "Erreur lors de la création du lien d'onboarding");
    }
  }
);

/**
 * Webhook Stripe Connect - écoute les événements liés aux comptes connectés
 * Supporte les événements v2 (thin events) comme v2.core.account.updated
 */
exports.stripeConnectWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [STRIPE_SECRET_KEY, STRIPE_CONNECT_WEBHOOK_SECRET],
  },
  async (req, res) => {
    const stripeSecret = (STRIPE_SECRET_KEY.value() || "").trim();
    const connectWebhookSecret = (STRIPE_CONNECT_WEBHOOK_SECRET.value() || "").trim();
    const stripeClient = stripe(stripeSecret);

    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      console.warn("[PLANIZZA][stripeConnectWebhook] Missing Stripe-Signature header");
      return res.status(400).send("Missing Stripe-Signature header");
    }

    if (!req.rawBody || !req.rawBody.length) {
      console.error("[PLANIZZA][stripeConnectWebhook] rawBody manquant");
      return res.status(400).send("Missing raw body");
    }

    let event;
    try {
      event = stripeClient.webhooks.constructEvent(req.rawBody, sig, connectWebhookSecret);
    } catch (err) {
      console.error("[PLANIZZA][stripeConnectWebhook] Signature verification failed:", {
        errorType: err?.type || "unknown",
      });
      return res.status(400).send("Webhook signature verification failed");
    }

    console.log("[PLANIZZA][stripeConnectWebhook] Event reçu:", { type: event.type, id: event.id });

    // Gérer v2.core.account.updated (thin event) ou account.updated (legacy)
    if (event.type === "v2.core.account.updated" || event.type === "account.updated") {
      let accountId;
      let account;

      if (event.type === "v2.core.account.updated") {
        // Format v2 "thin event" - on doit récupérer les détails via l'API
        accountId = event.data?.id || event.related_object?.id;

        if (!accountId) {
          console.warn("[PLANIZZA][stripeConnectWebhook] v2 event sans account ID");
          return res.status(400).json({ error: "missing_account_id" });
        }

        // Récupérer les détails complets du compte via l'API Stripe
        try {
          account = await stripeClient.accounts.retrieve(accountId);
        } catch (apiErr) {
          console.error("[PLANIZZA][stripeConnectWebhook] Erreur API retrieve:", {
            accountId,
            error: apiErr?.message?.substring(0, 100),
          });
          return res.status(500).json({ error: "api_error" });
        }
      } else {
        // Format legacy v1 - données incluses dans l'event
        account = event.data.object;
        accountId = account.id;
      }

      // Extraire les informations importantes
      const chargesEnabled = account.charges_enabled;
      const payoutsEnabled = account.payouts_enabled;
      const detailsSubmitted = account.details_submitted;
      const requirements = account.requirements || {};
      const currentlyDue = requirements.currently_due || [];
      const eventuallyDue = requirements.eventually_due || [];
      const pastDue = requirements.past_due || [];
      const disabledReason = requirements.disabled_reason || null;

      // Déterminer le statut du compte
      let stripeStatus;
      if (chargesEnabled && payoutsEnabled) {
        stripeStatus = "active";
      } else if (pastDue.length > 0) {
        stripeStatus = "restricted";
      } else if (currentlyDue.length > 0) {
        stripeStatus = "action_required";
      } else if (detailsSubmitted) {
        stripeStatus = "pending_verification";
      } else {
        stripeStatus = "pending";
      }

      console.log("[PLANIZZA][stripeConnectWebhook] account.updated:", {
        accountId,
        stripeStatus,
        chargesEnabled,
        payoutsEnabled,
        detailsSubmitted,
        currentlyDue: currentlyDue.length,
        pastDue: pastDue.length,
      });

      // Trouver le pizzaiolo avec ce stripeAccountId
      const pizzaiolosRef = admin.database().ref("pizzaiolos");
      const snap = await pizzaiolosRef.orderByChild("stripeAccountId").equalTo(accountId).get();

      if (snap.exists()) {
        const updates = {};
        snap.forEach((child) => {
          updates[`${child.key}/stripeStatus`] = stripeStatus;
          updates[`${child.key}/stripeChargesEnabled`] = chargesEnabled;
          updates[`${child.key}/stripePayoutsEnabled`] = payoutsEnabled;
          updates[`${child.key}/stripeDetailsSubmitted`] = detailsSubmitted;
          updates[`${child.key}/stripeOnboardingComplete`] = stripeStatus === "active";
          updates[`${child.key}/stripeRequirements`] = {
            currentlyDue,
            eventuallyDue,
            pastDue,
            disabledReason,
          };
          updates[`${child.key}/stripeLastUpdated`] = admin.database.ServerValue.TIMESTAMP;

          // Marquer la date de complétion si c'est la première fois qu'il devient actif
          if (stripeStatus === "active") {
            updates[`${child.key}/stripeOnboardingCompletedAt`] = admin.database.ServerValue.TIMESTAMP;
          }
        });

        await pizzaiolosRef.update(updates);
        console.log(`[PLANIZZA][stripeConnectWebhook] Statut mis à jour: ${accountId} → ${stripeStatus}`);
      } else {
        console.warn(`[PLANIZZA][stripeConnectWebhook] Aucun pizzaiolo trouvé pour ${accountId}`);
      }
    }

    // Gérer la déauthorisation (le pizzaiolo révoque l'accès)
    if (event.type === "account.application.deauthorized") {
      const accountId = event.account || event.data?.object?.id;

      if (accountId) {
        const pizzaiolosRef = admin.database().ref("pizzaiolos");
        const snap = await pizzaiolosRef.orderByChild("stripeAccountId").equalTo(accountId).get();

        if (snap.exists()) {
          const updates = {};
          snap.forEach((child) => {
            updates[`${child.key}/stripeStatus`] = "deauthorized";
            updates[`${child.key}/stripeChargesEnabled`] = false;
            updates[`${child.key}/stripePayoutsEnabled`] = false;
            updates[`${child.key}/stripeOnboardingComplete`] = false;
            updates[`${child.key}/stripeDeauthorizedAt`] = admin.database.ServerValue.TIMESTAMP;
          });

          await pizzaiolosRef.update(updates);
          console.log(`[PLANIZZA][stripeConnectWebhook] Compte déauthorisé: ${accountId}`);
        }
      }
    }

    return res.json({ received: true, type: event.type });
  }
);
