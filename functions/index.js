const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe");

// Initialiser Firebase Admin
admin.initializeApp();

// Initialiser Stripe avec la clé secrète depuis les variables d'environnement
// Configuration via: firebase functions:config:set stripe.secret_key="YOUR_STRIPE_SECRET_KEY"
const _stripeSecretKey =
  functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY;
if (!_stripeSecretKey) {
  console.warn("[PLANIZZA] STRIPE_SECRET_KEY manquante. Configurez functions:config:set stripe.secret_key=... ou définissez STRIPE_SECRET_KEY dans functions/.env");
}
const stripeClient = _stripeSecretKey ? stripe(_stripeSecretKey) : null;

/**
 * Cloud Function HTTPS pour créer une session Stripe Checkout
 *
 * TODO:
 * 1. Configurer la clé secrète Stripe:
 *    firebase functions:config:set stripe.secret_key="YOUR_STRIPE_SECRET_KEY"
 *
 * 2. Adapter les paramètres de la session selon vos besoins:
 *    - line_items (produits/services)
 *    - success_url / cancel_url
 *    - mode (payment, subscription, setup)
 *
 * 3. Ajouter la logique métier:
 *    - Vérifier l'authentification de l'utilisateur
 *    - Valider les données d'entrée
 *    - Enregistrer la transaction dans Firestore
 *
 * 4. Gérer les webhooks Stripe pour les confirmations de paiement
 *
 * @example
 * // Appel depuis le front:
 * const fn = httpsCallable(functions, 'createCheckoutSession');
 * const { data } = await fn({ orderId: '...' });
 * // Rediriger vers Stripe Checkout via sessionId ou url
 */
exports.createCheckoutSession = functions.https.onCall(async (data, _context) => {
  try {
    if (!stripeClient) {
      throw new functions.https.HttpsError("failed-precondition", "Stripe n'est pas configuré côté backend (STRIPE_SECRET_KEY manquante).");
    }

    const {orderId} = data || {};
    if (!orderId || typeof orderId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "Le paramètre 'orderId' est requis");
    }

    const appUrl =
      functions.config().app?.url ||
      process.env.APP_URL ||
      functions.config().stripe?.app_url ||
      null;

    if (!appUrl) {
      throw new functions.https.HttpsError("failed-precondition", "APP_URL manquante côté Functions. Définissez APP_URL dans functions/.env ou via functions:config:set app.url=...");
    }

    // Lire la commande depuis RTDB
    const orderRef = admin.database().ref(`orders/${orderId}`);
    const snap = await orderRef.get();

    if (!snap.exists()) {
      throw new functions.https.HttpsError("not-found", "Commande introuvable");
    }

    const order = snap.val();

    if (order.status !== "created") {
      throw new functions.https.HttpsError("failed-precondition", `Statut de commande invalide: ${order.status}`);
    }

    if (!Array.isArray(order.items) || order.items.length === 0) {
      throw new functions.https.HttpsError("failed-precondition", "Commande vide (items manquants)");
    }

    const currency = (order.currency || "eur").toLowerCase();
    const lineItems = order.items.map((it) => {
      const name = String(it.name || "Article");
      const unitAmount = Number(it.priceCents);
      const quantity = Number(it.qty || it.quantity || 1);

      if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
        throw new functions.https.HttpsError("failed-precondition", "priceCents invalide dans la commande");
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new functions.https.HttpsError("failed-precondition", "qty invalide dans la commande");
      }

      return {
        price_data: {
          currency,
          product_data: {name},
          unit_amount: unitAmount,
        },
        quantity,
      };
    });

    const truckId = order.truckId || null;

    const baseUrl = appUrl.replace(/\/$/, "");
    const encOrderId = encodeURIComponent(orderId);
    const successUrl = `${baseUrl}/checkout/success?orderId=${encOrderId}&session_id={CHECKOUT_SESSION_ID}`;
    let cancelUrl = `${baseUrl}/trucks?canceled=1&orderId=${encOrderId}`;
    if (truckId) {
      cancelUrl = `${baseUrl}/t/${encodeURIComponent(truckId)}?canceled=1&orderId=${encOrderId}`;
    }

    // Créer la session Stripe Checkout
    const session = await stripeClient.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orderId,
        truckId: truckId || "",
        userUid: order.userUid || "",
      },
      client_reference_id: orderId,
    });

    // Sauvegarder les infos checkout sur la commande (pas le statut paid)
    await orderRef.update({
      stripeCheckoutSessionId: session.id,
      stripeCheckoutUrl: session.url || null,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    });

    // Index côté pizzaiolo (lecture ownerUid via règles)
    if (truckId) {
      await admin.database().ref(`truckOrders/${truckId}/${orderId}`).set(true);
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (error) {
    console.error("Erreur lors de la création de la session Stripe:", error);
    throw new functions.https.HttpsError("internal", "Impossible de créer la session de paiement", error.message);
  }
});

/**
 * Cloud Function pour gérer les webhooks Stripe
 *
 * TODO:
 * 1. Configurer le webhook endpoint dans Stripe Dashboard
 * 2. Récupérer le webhook signing secret (depuis Stripe Dashboard)
 * 3. Configurer: firebase functions:config:set stripe.webhook_secret="YOUR_STRIPE_WEBHOOK_SECRET"
 * 4. Implémenter la logique pour chaque événement (payment_intent.succeeded, etc.)
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (!stripeClient) {
    res.status(500).send("Stripe n'est pas configuré côté backend (STRIPE_SECRET_KEY manquante).");
    return;
  }

  const _sig = req.headers["stripe-signature"];
  const _webhookSecret =
      functions.config().stripe?.webhook_secret ||
      process.env.STRIPE_WEBHOOK_SECRET;

  try {
    if (!_sig) {
      throw new Error("En-tête Stripe-Signature manquant");
    }
    if (!_webhookSecret) {
      throw new Error("Webhook secret manquant. Configurez functions:config:set stripe.webhook_secret=... ou STRIPE_WEBHOOK_SECRET dans functions/.env");
    }

    // Vérifier la signature du webhook (obligatoire en PROD)
    const event = stripeClient.webhooks.constructEvent(req.rawBody, _sig, _webhookSecret);

    // TODO: Traiter les différents types d'événements
    // switch (event.type) {
    //   case 'checkout.session.completed':
    //     // Paiement réussi
    //     break;
    //   case 'payment_intent.succeeded':
    //     // Mettre à jour le statut dans Firestore
    //     break;
    //   default:
    //     console.log(`Événement non géré: ${event.type}`);
    // }

    // Logique métier MVP: marquer la commande paid uniquement depuis le webhook
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session?.metadata?.orderId;

      if (orderId) {
        const orderRef = admin.database().ref(`orders/${orderId}`);
        const snap = await orderRef.get();

        if (snap.exists()) {
          const current = snap.val();

          // Archive panier (best-effort) au moment du paiement
          const userUid = current.userUid || session?.metadata?.userUid || null;

          // Idempotence: ne pas ré-écrire si déjà paid
          if (current.status !== "paid") {
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
                }

                // On supprime le panier actif après paiement (même si déjà archivé)
                await activeCartRef.remove();
              } catch (err) {
                console.warn("[PLANIZZA] Archive panier impossible (best-effort):", err);
              }
            }

            await orderRef.update({
              status: "paid",
              paidAt: admin.database.ServerValue.TIMESTAMP,
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: session.payment_intent || null,
              stripePaymentStatus: session.payment_status || null,
              updatedAt: admin.database.ServerValue.TIMESTAMP,
            });

            if (current.truckId) {
              await admin.database().ref(`truckOrders/${current.truckId}/${orderId}`).set(true);
            }
          }
        }
      }
    }

    res.json({received: true, type: event.type});
  } catch (error) {
    console.error("Erreur webhook Stripe:", error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

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
