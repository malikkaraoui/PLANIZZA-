import { useState } from 'react';
import { createCheckoutSession } from '../../../lib/stripe';

// MVP RTDB: crée une commande status=created, puis lance Stripe Checkout via Cloud Function.
export function useCreateOrder() {
  const [loading, setLoading] = useState(false);

  const createOrder = async ({
    truckId,
    items,
    userUid,
    customerName,
    deliveryMethod,
    pickupTime,
    deliveryAddress,
  }) => {
    setLoading(true);
    try {
      if (!userUid) {
        throw new Error('Vous devez être connecté pour créer une commande.');
      }
      if (!truckId) {
        throw new Error('truckId manquant');
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Panier vide');
      }

      // Déléguer la création de la commande + session Stripe à la Cloud Function.
      // La Function calcule/normalise le total (server-side) et écrit orders/{orderId}.
      await createCheckoutSession({
        truckId,
        items: items.map((it) => ({
          id: it.id,
          name: it.name,
          priceCents: it.priceCents,
          qty: it.qty,
        })),
        deliveryMethod: deliveryMethod || 'pickup',
        customerName: customerName || 'Client',
        pickupTime: pickupTime || null,
        deliveryAddress: deliveryAddress || null,
      });

      return { ok: true };
    } finally {
      setLoading(false);
    }
  };

  return { createOrder, loading };
}
