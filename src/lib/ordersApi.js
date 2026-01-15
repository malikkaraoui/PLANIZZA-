import { httpsCallable } from 'firebase/functions';
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
  action,
  expectedUpdatedAtMs,
  managerOverride = false,
}) {
  if (!isFirebaseConfigured || !functions) {
    throw new Error(
      "Firebase Functions n'est pas configuré. Configurez .env.local (Firebase) et démarrez les émulateurs ou déployez les functions."
    );
  }

  try {
    const callTransition = httpsCallable(functions, 'pizzaioloTransitionOrderV2');
    const res = await callTransition({
      orderId,
      action,
      expectedUpdatedAtMs,
      managerOverride,
    });
    return res.data;
  } catch (err) {
    const code = err?.code;
    const details = err?.details || null;
    const message = err?.message || 'Callable error';

    const e = new Error(`pizzaioloTransitionOrderV2 ${message}`);
    e.details = details;
    e.code = code;

    switch (code) {
      case 'invalid-argument':
        e.status = 400;
        break;
      case 'unauthenticated':
        e.status = 401;
        break;
      case 'permission-denied':
        e.status = 403;
        break;
      case 'not-found':
        e.status = 404;
        break;
      case 'failed-precondition':
        e.status = 409;
        break;
      default:
        e.status = 500;
        break;
    }

    throw e;
  }
}

export async function pizzaioloCreateManualOrder({ truckId, customerName, pickupTime, items, totalCents }) {
  return postJson('pizzaioloCreateManualOrder', { truckId, customerName, pickupTime, items, totalCents });
}
