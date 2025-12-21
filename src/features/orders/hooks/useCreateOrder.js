import { useState } from 'react';
import { push, ref, set } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { createCheckoutSession } from '../../../lib/stripe';

// MVP RTDB: crée une commande status=created, puis lance Stripe Checkout via Cloud Function.
export function useCreateOrder() {
  const [loading, setLoading] = useState(false);

  const createOrder = async ({ truckId, items, userUid }) => {
    setLoading(true);
    try {
      if (!isFirebaseConfigured || !db) {
        throw new Error(
          'Firebase n\'est pas configuré. Ajoutez vos variables dans .env.local.'
        );
      }
      if (!userUid) {
        throw new Error('Vous devez être connecté pour créer une commande.');
      }
      if (!truckId) {
        throw new Error('truckId manquant');
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Panier vide');
      }

      const totalCents = items.reduce(
        (sum, it) => sum + Number(it.priceCents || 0) * Number(it.qty || 0),
        0
      );

      const orderRef = push(ref(db, 'orders'));
      const orderId = orderRef.key;
      if (!orderId) throw new Error('Impossible de générer un orderId');

      const payload = {
        status: 'created',
        truckId,
        userUid,
        currency: 'eur',
        items: items.map((it) => ({
          id: it.id,
          name: it.name,
          priceCents: it.priceCents,
          qty: it.qty,
        })),
        totalCents,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await set(orderRef, payload);

      // Déléguer la création de la session à la Cloud Function
      await createCheckoutSession({ orderId });

      return { orderId };
    } finally {
      setLoading(false);
    }
  };

  return { createOrder, loading };
}
