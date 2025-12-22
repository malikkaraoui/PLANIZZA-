/* eslint-disable require-jsdoc */
const functions = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const stripe = require("stripe");

// Initialiser Firebase Admin
admin.initializeApp();

// Secrets Stripe (Firebase Secrets Manager)
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

// URL front utilisée pour success/cancel
const FRONTEND_URL = process.env.FRONTEND_URL || "https://planizza-ac827.web.app";

function buildLineItems(order) {
  if (!order?.items || !Array.isArray(order.items)) return [];
  return order.items
      .filter((it) => typeof it.priceCents === "number" && it.priceCents > 0)
      .map((item) => ({
        price_data: {
          currency: order.currency || "eur",
          product_data: {name: item.name || "Article"},
          unit_amount: Number(item.priceCents),
        },
        quantity: Number(item.qty) || 1,
      }));
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
      const orderId = req.body?.orderId;
      if (!orderId) {
        return res.status(400).json({error: "orderId requis"});
      }

      const orderRef = admin.database().ref(`orders/${orderId}`);
      const snap = await orderRef.get();
      if (!snap.exists()) {
        return res.status(404).json({error: "Commande introuvable"});
      }

      const order = snap.val();

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
      const cancelUrl = `${frontendOrigin}/cancel?orderId=${orderId}`;

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

        await orderRef.update({
          totalCents: totalCentsServer,
          status: order.status === "paid" ? order.status : "pending",
          payment: {
            provider: "stripe",
            sessionId: session.id,
            paymentStatus: "pending",
          },
          stripeCheckoutSessionId: session.id,
          updatedAt: Date.now(),
        });

        return res.json({sessionId: session.id, url: session.url});
      } catch (error) {
        console.error("Erreur lors de la création de la session Stripe:", error);
        return res.status(500).json({error: "internal"});
      }
    },
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
        console.error("[PLANIZZA] rawBody manquant pour le webhook (constructEvent nécessite le corps brut)" );
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

              const now = Date.now();
              await orderRef.update({
                status: "received",
                paidAt: now,
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: session.payment_intent || null,
                stripePaymentStatus: session.payment_status || null,
                payment: {
                  provider: "stripe",
                  sessionId: session.id,
                  paymentStatus: "paid",
                },
                updatedAt: admin.database.ServerValue.TIMESTAMP,
                timeline: {
                  ...(current.timeline || {}),
                  receivedAt: now,
                },
                nextStepAt: now + 60 * 1000,
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
 * Avance automatiquement les commandes received → prep → cooking → ready
 * Séquence totale: 5 minutes (1 min + 2 min + 2 min)
 *
 * - received → prep: 1 minute
 * - prep → cooking: 2 minutes
 * - cooking → ready: 2 minutes
 */
exports.advanceOrders = functions.pubsub
    .schedule("every 1 minutes")
    .timeZone("Europe/Paris")
    .onRun(async () => {
      const now = Date.now();

      const ordersRef = admin.database().ref("orders");
      const snap = await ordersRef
          .orderByChild("nextStepAt")
          .startAt(1)
          .endAt(now)
          .limitToFirst(100)
          .get();

      if (!snap.exists()) return null;

      const updates = {};
      let count = 0;

      snap.forEach((child) => {
        const orderId = child.key;
        const order = child.val();

        if (!order.nextStepAt || order.nextStepAt > now) return;

        const status = order.status;

        if (status === "received") {
          updates[`orders/${orderId}/status`] = "prep";
          updates[`orders/${orderId}/timeline/prepAt`] = now;
          updates[`orders/${orderId}/nextStepAt`] = now + 2 * 60 * 1000; // +2 min
          updates[`orders/${orderId}/updatedAt`] = now;
          count++;
        } else if (status === "prep") {
          updates[`orders/${orderId}/status`] = "cooking";
          updates[`orders/${orderId}/timeline/cookingAt`] = now;
          updates[`orders/${orderId}/nextStepAt`] = now + 2 * 60 * 1000; // +2 min
          updates[`orders/${orderId}/updatedAt`] = now;
          count++;
        } else if (status === "cooking") {
          updates[`orders/${orderId}/status`] = "ready";
          updates[`orders/${orderId}/timeline/readyAt`] = now;
          updates[`orders/${orderId}/nextStepAt`] = null; // terminé
          updates[`orders/${orderId}/updatedAt`] = now;
          count++;
        }
      });

      if (count === 0) return null;

      await admin.database().ref().update(updates);
      console.log(`[PLANIZZA] advanceOrders: ${count} commande(s) avancée(s).`);
      return null;
    });
