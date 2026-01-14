import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onValue, ref, set } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function readLocal(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = safeParse(raw);
    if (!parsed || !Array.isArray(parsed.order)) return null;
    return {
      order: parsed.order,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  if (typeof window === 'undefined') return;
  const raw = safeStringify(value);
  if (!raw) return;
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // ignore
  }
}

function applyRanking(baseIds, rankedIds) {
  const baseSet = new Set(baseIds);
  const seen = new Set();

  const result = [];

  for (const id of rankedIds) {
    if (!baseSet.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  for (const id of baseIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  return result;
}

/**
 * Gère le rangement personnalisé des commandes sur l'écran pizzaiolo.
 * - Ordre de base: fourni par `baseIds`
 * - Override: un tableau d'IDs ordonné, persistant localStorage + Firebase
 * - N'ajoute pas de logique métier : on ne fait que réordonner l'affichage
 */
export function usePizzaioloOrderRanking({ uid, truckId, groupKey, baseIds }) {
  const enabled = Boolean(uid && truckId && groupKey);
  const firebaseEnabled = Boolean(enabled && isFirebaseConfigured && db);

  const localKey = useMemo(() => {
    if (!enabled) return null;
    return `planizza:pizzaiolo:orders:ranking:v1:${uid}:${truckId}:${groupKey}`;
  }, [enabled, uid, truckId, groupKey]);

  const [remoteState, setRemoteState] = useState(null);
  const [localState, setLocalState] = useState(() => (localKey ? readLocal(localKey) : null));

  // 1) Écouter Firebase (si dispo)
  useEffect(() => {
    if (!firebaseEnabled) return;

    const rankingRef = ref(db, rtdbPaths.pizzaioloOrderRanking(uid, truckId, groupKey));

    const unsubscribe = onValue(
      rankingRef,
      (snap) => {
        if (!snap.exists()) {
          setRemoteState(null);
          return;
        }
        const val = snap.val();
        if (!val || !Array.isArray(val.order)) {
          setRemoteState(null);
          return;
        }
        setRemoteState({
          order: val.order,
          updatedAt: typeof val.updatedAt === 'number' ? val.updatedAt : 0,
        });
      },
      () => {
        // Si l'écoute échoue, on reste sur local
        setRemoteState(null);
      }
    );

    return () => unsubscribe();
  }, [firebaseEnabled, uid, truckId, groupKey]);

  // 2) À chaque changement de localKey, recharger depuis localStorage
  useEffect(() => {
    if (!localKey) return;
    queueMicrotask(() => {
      setLocalState(readLocal(localKey));
    });
  }, [localKey]);

  // 2bis) Si Firebase est plus récent que localStorage, on met à jour le local (offline-friendly)
  useEffect(() => {
    if (!localKey) return;
    if (!remoteState) return;
    const localUpdatedAt = localState?.updatedAt || 0;
    const remoteUpdatedAt = remoteState?.updatedAt || 0;
    if (remoteUpdatedAt <= localUpdatedAt) return;

    queueMicrotask(() => {
      writeLocal(localKey, remoteState);
      setLocalState(remoteState);
    });
  }, [localKey, remoteState, localState?.updatedAt]);

  // 3) Choisir la “meilleure” source (plus récent entre local/remote)
  const chosenRanking = useMemo(() => {
    const l = localState;
    const r = remoteState;
    if (!l && !r) return { order: [], updatedAt: 0 };
    if (!l) return r;
    if (!r) return l;
    return (r.updatedAt || 0) >= (l.updatedAt || 0) ? r : l;
  }, [localState, remoteState]);

  const orderedIds = useMemo(() => {
    if (!Array.isArray(baseIds)) return [];
    const ranked = Array.isArray(chosenRanking?.order) ? chosenRanking.order : [];
    return applyRanking(baseIds, ranked);
  }, [baseIds, chosenRanking]);

  const pendingWriteRef = useRef(null);

  const persist = useCallback(
    (next) => {
      if (!enabled || !localKey) return;

      // LocalStorage (best-effort)
      writeLocal(localKey, next);
      setLocalState(next);

      // Firebase (best-effort, debounce)
      if (!firebaseEnabled) return;

      if (pendingWriteRef.current) {
        clearTimeout(pendingWriteRef.current);
      }

      pendingWriteRef.current = setTimeout(() => {
        const rankingRef = ref(db, rtdbPaths.pizzaioloOrderRanking(uid, truckId, groupKey));
        set(rankingRef, next).catch(() => {
          // ignore
        });
      }, 600);
    },
    [enabled, firebaseEnabled, localKey, uid, truckId, groupKey]
  );

  const setManualOrder = useCallback(
    (nextOrderedIds) => {
      if (!enabled) return;
      const baseSet = new Set(baseIds || []);
      const filtered = Array.from(nextOrderedIds || []).filter((id) => baseSet.has(id));
      const payload = {
        order: filtered,
        updatedAt: Date.now(),
      };
      persist(payload);
    },
    [enabled, baseIds, persist]
  );

  const resetManualOrder = useCallback(() => {
    if (!enabled) return;
    persist({ order: [], updatedAt: Date.now() });
  }, [enabled, persist]);

  // Nettoyage du timer debounce
  useEffect(() => {
    return () => {
      if (pendingWriteRef.current) {
        clearTimeout(pendingWriteRef.current);
        pendingWriteRef.current = null;
      }
    };
  }, []);

  return {
    orderedIds,
    setManualOrder,
    resetManualOrder,
    source: chosenRanking,
  };
}
