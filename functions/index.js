/* eslint-disable require-jsdoc */
const functions = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const stripe = require("stripe");
const { rtdbServerTimestamp } = require("./utils/timestamps");

// Initialiser Firebase Admin
admin.initializeApp();

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

// URL front utilisée pour success/cancel
const FRONTEND_URL = process.env.FRONTEND_URL || "https://planizza-ac827.web.app";

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Credentials", "true");
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
    updatedAtMs: nowMs,
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
      return "accepted";
    case "PREPPING":
      return "prep";
    case "READY":
      return "ready";
    case "HANDOFF":
    case "DONE":
      // Compat v1: pas de HANDOFF => on compresse vers delivered.
      return "delivered";
    case "CANCELED":
      return "cancelled";
    case "EXPIRED":
      return "lost";
    case "NEW":
    default:
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

      const nowClientMs = Date.now();

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

          const safeItems = items.map((it) => ({
            id: it?.id || null,
            name: String(it?.name || "Article"),
            priceCents: Number(it?.priceCents || 0),
            qty: Number(it?.qty || 1),
          }));

          const normalizedDeliveryMethod = deliveryMethod === "delivery" ? "delivery" : "pickup";
          const deliveryCost = normalizedDeliveryMethod === "delivery" ? 350 : 0;

          order = {
            status: "created",
            truckId,
            userUid: uid,
            customerName: typeof customerName === "string" ? customerName.trim() : "Client",
            deliveryMethod: normalizedDeliveryMethod,
            deliveryCost,
            currency: "eur",
            items: safeItems,
            createdAt: rtdbServerTimestamp(),
            updatedAt: rtdbServerTimestamp(),
            createdAtClient: nowClientMs,
          };
        }
      } else {
        if (!truckId || typeof truckId !== "string") {
          return res.status(400).json({error: "truckId requis"});
        }
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({error: "items requis"});
        }

        const safeItems = items.map((it) => ({
          id: it?.id || null,
          name: String(it?.name || "Article"),
          priceCents: Number(it?.priceCents || 0),
          qty: Number(it?.qty || 1),
        }));

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
          currency: "eur",
          items: safeItems,
          createdAt: rtdbServerTimestamp(),
          updatedAt: rtdbServerTimestamp(),
          createdAtClient: nowClientMs,
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
      const frontendOrigin = req.headers.origin || FRONTEND_URL;
      const successUrl =
      `${frontendOrigin}/checkout/success?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${frontendOrigin}/panier?orderId=${orderId}`;

      try {
        const session = await stripeClient.checkout.sessions.create({
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
        });

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
        console.error("Erreur lors de la création de la session Stripe:", error);
        return res.status(500).json({error: "internal"});
      }
    },
);

// Endpoint pizzaiolo (HTTP) : mise à jour du statut d'une commande.
// Objectif: éviter les writes directs depuis le client et centraliser les garde-fous.
exports.pizzaioloUpdateOrderStatus = onRequest(
  { region: "us-central1" },
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

      const paymentStatus = order?.payment?.paymentStatus;
      if (newStatus === "delivered" && paymentStatus !== "paid" && !managerOverride) {
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

// Endpoint pizzaiolo (HTTP) : transition v2 atomique (transaction) + optimistic locking.
exports.pizzaioloTransitionOrderV2 = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      const uid = await requireAuthUid(req);

      const orderId = req.body?.orderId;
      const nextKitchenStatus = req.body?.nextKitchenStatus;
      const expectedUpdatedAtMs = req.body?.expectedUpdatedAtMs;
      const managerOverride = Boolean(req.body?.managerOverride);

      if (!orderId || typeof orderId !== "string") {
        return res.status(400).json({ error: "orderId requis" });
      }
      if (!nextKitchenStatus || typeof nextKitchenStatus !== "string") {
        return res.status(400).json({ error: "nextKitchenStatus requis" });
      }

      const allowedNext = new Set(["QUEUED", "PREPPING", "READY", "HANDOFF", "DONE", "CANCELED"]);
      if (!allowedNext.has(nextKitchenStatus)) {
        return res.status(400).json({ error: "nextKitchenStatus invalide" });
      }

      const orderRef = admin.database().ref(`orders/${orderId}`);
      const snap = await orderRef.get();
      if (!snap.exists()) return res.status(404).json({ error: "Commande introuvable" });
      const pre = snap.val();

      await assertPizzaioloOwnsTruck({ uid, truckId: pre?.truckId });

      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      const preKitchenStatus = pre?.v2?.kitchenStatus ||
        v2MapKitchenStatusFromV1Status(pre?.status);
      const prePaymentStatus = pre?.v2?.paymentStatus || v2MapPaymentStatus(pre);

      const result = await orderRef.transaction((current) => {
        if (!current) return;

        const existingV2 = current?.v2 && typeof current.v2 === "object" ? current.v2 : null;
        const baseV2 = existingV2 || v2BuildBase({ ...current, id: orderId }, { nowIso, nowMs });

        if (typeof expectedUpdatedAtMs === "number") {
          const cur = baseV2.updatedAtMs;
          if (typeof cur === "number" && cur !== expectedUpdatedAtMs) {
            return; // abort => conflict
          }
        }

        const check = v2CanTransition(baseV2, nextKitchenStatus, { managerOverride });
        if (!check.ok) {
          return; // abort
        }

        const nextV2 = omitUndefinedDeep({
          ...baseV2,
          kitchenStatus: nextKitchenStatus,
          updatedAt: nowIso,
          updatedAtMs: nowMs,
          timestamps: v2ApplyEventTimestamps({
            nextKitchenStatus,
            nowIso,
            currentTimestamps: {
              ...v2DeriveTimestampsFromLegacyTimeline(current),
              ...(baseV2.timestamps || {}),
            },
          }),
        });

        if (managerOverride) {
          nextV2.flags = { ...(nextV2.flags || {}), managerOverride: true };
        }

        const v1Status = v2MapKitchenStatusToV1Status(nextKitchenStatus);
        const timelineKey = v2TimelineKeyForV1Status(v1Status);

        const next = { ...current };
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
      }, { applyLocally: false });

      if (!result.committed) {
        // Differencier conflit vs transition invalid (best-effort)
        if (typeof expectedUpdatedAtMs === "number") {
          return res.status(409).json({ error: "conflict" });
        }
        return res.status(409).json({ error: "transition_refused" });
      }

      await writeOrderEvent(orderId, {
        type: "STATUS_CHANGED",
        actor: "PIZZAIOLO",
        source: "pizzaioloTransitionOrderV2",
        from: { kitchenStatus: preKitchenStatus, paymentStatus: prePaymentStatus },
        to: { kitchenStatus: nextKitchenStatus, paymentStatus: prePaymentStatus },
      });

      return res.json({ ok: true, updatedAtMs: nowMs, updatedAt: nowIso });
    } catch (err) {
      const status = err?.status || 500;
      console.error("[PLANIZZA][pizzaioloTransitionOrderV2] error", err);
      return res.status(status).json({ error: status === 500 ? "internal" : String(err.message || err) });
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

      // Diagnostic: log basic request meta (sans body)
      console.log("[PLANIZZA][stripeWebhook] incoming request", {
        contentType: req.headers["content-type"],
        len: req.headers["content-length"],
        sigPresent: Boolean(req.headers["stripe-signature"]),
      });

      const sig = req.headers["stripe-signature"];
      if (!sig || typeof sig !== "string") {
        console.warn("[PLANIZZA] Missing Stripe-Signature header");
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
        console.error("[PLANIZZA] Webhook signature verification failed:", err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      console.log("[PLANIZZA][stripeWebhook] event reçu", {type: event.type, id: event.id});

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const orderId = session?.metadata?.orderId;
        const userUid = session?.metadata?.userUid || null;

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
      }, { applyLocally: false });

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
