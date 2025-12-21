import { useState } from 'react';

// MVP: placeholder — en V1 on créera une commande côté Firebase puis on lancera Stripe Checkout.
export function useCreateOrder() {
  const [loading, setLoading] = useState(false);

  const createOrder = async ({ truckId, items }) => {
    setLoading(true);
    try {
      // TODO: écrire dans Firestore/RTDB
      // TODO: appeler Cloud Function createCheckoutSession
      return {
        orderId: `order_${Date.now()}`,
        status: 'created',
        truckId,
        items,
      };
    } finally {
      setLoading(false);
    }
  };

  return { createOrder, loading };
}
