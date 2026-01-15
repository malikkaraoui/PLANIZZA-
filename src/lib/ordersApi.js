import { auth, functions, isFirebaseConfigured } from './firebase';

const FUNCTIONS_BASE =
  import.meta.env.VITE_FUNCTIONS_ORIGIN ||
  `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`;

async function postJson(path, body) {
  if (!isFirebaseConfigured || !functions) {
    throw new Error(
      "Firebase Functions n'est pas configuré. Configurez .env.local (Firebase) et démarrez les émulateurs ou déployez les functions."
    );
  }

  const token = await auth?.currentUser?.getIdToken?.();
  if (!token) {
    throw new Error('Vous devez être connecté.');
  }

  const res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });

  if (!res.ok) {
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    let details = null;
    let msg = '';

    try {
      if (contentType.includes('application/json')) {
        details = await res.json();
        if (typeof details?.error === 'string') {
          msg = details.error;
          if (details?.errorId) {
            msg += ` (id: ${details.errorId})`;
          }
        } else {
          msg = JSON.stringify(details);
        }
      } else {
        msg = await res.text();
      }
    } catch {
      try {
        msg = await res.text();
      } catch {
        msg = '';
      }
    }

    const err = new Error(`${path} HTTP ${res.status}${msg ? ` — ${msg}` : ''}`);
    err.status = res.status;
    err.details = details;
    throw err;
  }

  return res.json();
}

export async function pizzaioloUpdateOrderStatus({ orderId, newStatus, managerOverride = false }) {
  return postJson('pizzaioloUpdateOrderStatus', { orderId, newStatus, managerOverride });
}

export async function pizzaioloMarkOrderPaid({ orderId, method = 'OTHER' }) {
  return postJson('pizzaioloMarkOrderPaid', { orderId, method });
}

export async function pizzaioloTransitionOrderV2({
  orderId,
  nextKitchenStatus,
  expectedUpdatedAtMs,
  managerOverride = false,
}) {
  return postJson('pizzaioloTransitionOrderV2', {
    orderId,
    nextKitchenStatus,
    expectedUpdatedAtMs,
    managerOverride,
  });
}

export async function pizzaioloCreateManualOrder({ truckId, customerName, pickupTime, items, totalCents }) {
  return postJson('pizzaioloCreateManualOrder', { truckId, customerName, pickupTime, items, totalCents });
}
