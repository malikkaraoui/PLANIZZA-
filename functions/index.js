const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe");

// Initialiser Firebase Admin
admin.initializeApp();

// Initialiser Stripe avec la clé secrète depuis les variables d'environnement
// Configuration via: firebase functions:config:set stripe.secret_key="YOUR_STRIPE_SECRET_KEY"
const stripeClient = stripe(functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY);

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
 * const response = await fetch('https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/createCheckoutSession', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ priceId: 'price_xxx', quantity: 1 })
 * });
 * const { sessionId, url } = await response.json();
 * // Rediriger vers Stripe Checkout avec la sessionId
 */
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
  try {
    // TODO: Vérifier que l'utilisateur est authentifié
    // if (!context.auth) {
    //   throw new functions.https.HttpsError('unauthenticated', 'L\'utilisateur doit être authentifié');
    // }

    // Extraire les paramètres de la requête
    const {priceId, quantity = 1} = data;

    // TODO: Valider les paramètres
    if (!priceId) {
      throw new functions.https.HttpsError(
          "invalid-argument",
          "Le paramètre 'priceId' est requis",
      );
    }

    // Créer la session Stripe Checkout
    const session = await stripeClient.checkout.sessions.create({
      mode: "payment", // ou 'subscription' pour un abonnement
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      success_url: `${data.successUrl || "https://votre-domaine.fr/success"}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: data.cancelUrl || "https://votre-domaine.fr/cancel",
      // TODO: Ajouter customer_email ou customer si l'utilisateur est connu
      // customer_email: context.auth.token.email,
      // metadata: { userId: context.auth.uid },
    });

    // TODO: Enregistrer la session dans Firestore pour le suivi
    // await admin.firestore().collection('checkoutSessions').doc(session.id).set({
    //   userId: context.auth.uid,
    //   sessionId: session.id,
    //   status: 'pending',
    //   createdAt: admin.firestore.FieldValue.serverTimestamp(),
    // });

    // Retourner l'ID de session et l'URL de paiement
    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (error) {
    console.error("Erreur lors de la création de la session Stripe:", error);
    throw new functions.https.HttpsError(
        "internal",
        "Impossible de créer la session de paiement",
        error.message,
    );
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
  const sig = req.headers["stripe-signature"];
  const webhookSecret = functions.config().stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;

  try {
    // TODO: Vérifier la signature du webhook
    // const event = stripeClient.webhooks.constructEvent(req.rawBody, sig, webhookSecret);

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

    res.json({received: true});
  } catch (error) {
    console.error("Erreur webhook Stripe:", error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});
