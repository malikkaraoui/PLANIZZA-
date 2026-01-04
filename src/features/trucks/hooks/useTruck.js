import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, query, orderByChild, equalTo, limitToFirst } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';
import { devError, devWarn } from '../../../lib/devLog';
import { useTrucks } from './useTrucks';

function isLikelyRtdbKey(value) {
  // Clés push RTDB typiques: commencent par '-' et contiennent des caractères URL-safe.
  // On reste permissif pour ne pas casser d'IDs métiers.
  return typeof value === 'string' && value.startsWith('-') && value.length >= 12;
}

function normalizeTruck(id, val) {
  const safe = val && typeof val === 'object' ? val : {};

  const badgesArray = safe.badges && typeof safe.badges === 'object'
    ? Object.entries(safe.badges)
        .filter(([_, v]) => v === true)
        .map(([k]) => {
          const map = {
            bio: 'Bio',
            terroir: 'Terroir',
            sansGluten: 'Sans gluten',
            halal: 'Halal',
            kasher: 'Kasher',
            sucre: 'Sucré',
          };
          return map[k] || k;
        })
    : Array.isArray(safe.badges)
      ? safe.badges
      : [];

  return {
    ...safe,
    // IMPORTANT: on force l'id = clé RTDB (ne pas laisser un éventuel safe.id = null écraser).
    id,
    badges: badgesArray,
    tags: badgesArray,
    isOpenNow: safe.isOpenNow ?? true,
    openingToday: safe.openingToday || 'Ouvert maintenant',
    photos: Array.isArray(safe.photos)
      ? safe.photos
      : safe.photoUrl
        ? [safe.photoUrl]
        : [],
    estimatedPrepMin: safe.estimatedPrepMin || 15,
    capacity: safe.capacity || { minPerPizza: 10, pizzaPerHour: 30 },
  };
}

export function useTruck(slugOrId) {
  const firebaseEnabled = Boolean(slugOrId && isFirebaseConfigured && db);

  // Fallback (DEV sans Firebase): on continue à utiliser la liste mock.
  const { trucks: fallbackTrucks, loading: fallbackLoading } = useTrucks({ mockCount: 100 });
  const fallbackTruck = useMemo(() => {
    if (!slugOrId) return null;
    return fallbackTrucks.find((t) => t.slug === slugOrId || t.id === slugOrId) || null;
  }, [fallbackTrucks, slugOrId]);

  const [truck, setTruck] = useState(null);
  const [loading, setLoading] = useState(firebaseEnabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let resolved = false;
    let unsub = () => {};

    if (!firebaseEnabled) {
      // Mode DEV sans Firebase: pas de listener RTDB, on expose le fallback (liste mock).
      setTruck(null);
      setLoading(false);
      setError(null);

      return () => {
        cancelled = true;
      };
    }

    // IMPORTANT: setState synchrone pour éviter race condition.
    // Si on diffère setLoading(true) avec microtask/Promise, un re-render rapide
    // peut lancer un 2e listener avant que le 1er ne se nettoie → crash Firebase.
    setLoading(true);
    setTruck(null);
    setError(null);

    const trucksRootRef = ref(db, rtdbPaths.publicTrucksRoot());
    const byKey = isLikelyRtdbKey(slugOrId);

    const sourceRefOrQuery = byKey
      ? ref(db, rtdbPaths.truck(slugOrId))
      : query(trucksRootRef, orderByChild('slug'), equalTo(String(slugOrId)), limitToFirst(1));

    const resolveOnce = (nextTruck) => {
      if (resolved || cancelled) return;
      resolved = true;
      try {
        unsub();
      } catch {
        // noop
      }
      unsub = () => {};
      setTruck(nextTruck);
      setLoading(false);
    };

    unsub = onValue(
      sourceRefOrQuery,
      (snapshot) => {
        if (!snapshot.exists()) {
          resolveOnce(null);
          return;
        }

        if (byKey) {
          resolveOnce(normalizeTruck(slugOrId, snapshot.val()));
          return;
        }

        const data = snapshot.val();
        const firstEntry = data && typeof data === 'object' ? Object.entries(data)[0] : null;
        if (!firstEntry) {
          resolveOnce(null);
          return;
        }

        const [id, val] = firstEntry;
        resolveOnce(normalizeTruck(id, val));
      },
      (err) => {
        const e = err instanceof Error ? err : new Error(String(err));
        devError('[useTruck] RTDB onValue error:', e);
        setError(e);
        resolveOnce(null);
      }
    );

    // Fallback: si le SDK ne répond pas (souvent dû à un transport bloqué),
    // on récupère en REST (lecture publique) pour éviter un loader infini.
    const fallbackTimer = setTimeout(async () => {
      if (resolved || cancelled) return;
      const baseUrl = String(import.meta.env.VITE_FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
      if (!baseUrl) return;

      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 6000);

        const url = byKey
          ? `${baseUrl}/${rtdbPaths.truck(slugOrId)}.json`
          : `${baseUrl}/${rtdbPaths.publicTrucksRoot()}.json?orderBy=%22slug%22&equalTo=%22${encodeURIComponent(
              String(slugOrId)
            )}%22&limitToFirst=1`;

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(t);

        if (!res.ok) {
          throw new Error(`REST ${res.status} ${res.statusText}`);
        }

        const json = await res.json();
        if (!json) {
          resolveOnce(null);
          return;
        }

        if (byKey) {
          devWarn('[useTruck] Fallback REST utilisé (byKey).');
          resolveOnce(normalizeTruck(slugOrId, json));
          return;
        }

        const firstEntry = typeof json === 'object' ? Object.entries(json)[0] : null;
        if (!firstEntry) {
          resolveOnce(null);
          return;
        }

        const [id, val] = firstEntry;
        devWarn('[useTruck] Fallback REST utilisé (bySlug).');
        resolveOnce(normalizeTruck(id, val));
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        devError('[useTruck] Fallback REST error:', err);
        setError(err);
        resolveOnce(null);
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      try {
        unsub();
      } catch {
        // noop
      }
    };
  }, [firebaseEnabled, slugOrId]);

  return {
    truck: firebaseEnabled ? truck : fallbackTruck,
    loading: firebaseEnabled ? loading : fallbackLoading,
    error: firebaseEnabled ? error : null,
  };
}
