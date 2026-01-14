import { onValue, ref } from 'firebase/database';
import { db, isFirebaseConfigured } from './firebase';

let offsetMs = 0;
let started = false;
let unsubscribe = null;

/**
 * Démarre la synchro de l'offset serveur via RTDB:
 *  - lit `/.info/serverTimeOffset`
 *  - met à jour un cache module-level
 */
export function startServerTimeSync() {
  if (started) return;
  started = true;

  if (!isFirebaseConfigured || !db) {
    return;
  }

  try {
    const offsetRef = ref(db, '.info/serverTimeOffset');
    unsubscribe = onValue(
      offsetRef,
      (snap) => {
        const val = snap.val();
        offsetMs = typeof val === 'number' && Number.isFinite(val) ? val : 0;
      },
      () => {
        // Si on ne peut pas lire l'offset, on retombe sur l'heure locale
        offsetMs = 0;
      }
    );
  } catch {
    offsetMs = 0;
  }
}

export function stopServerTimeSync() {
  if (unsubscribe) {
    try {
      unsubscribe();
    } catch {
      // ignore
    }
  }
  unsubscribe = null;
  started = false;
  offsetMs = 0;
}

/**
 * Retourne un "now" en ms basé sur l'heure serveur RTDB.
 * Tant que l'offset n'est pas chargé, c'est équivalent à Date.now().
 */
export function getServerNowMs() {
  return Date.now() + (offsetMs || 0);
}

export function getServerTimeOffsetMs() {
  return offsetMs || 0;
}
