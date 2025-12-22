/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { get, onValue, ref, remove, serverTimestamp, set } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { useAuth } from '../../../app/providers/AuthProvider';

const CartContext = createContext(null);

const CART_TTL_MS = 30 * 60 * 1000;
const CART_SAVE_DEBOUNCE_MS = 350;
const CART_EXPIRES_MAX_AHEAD_MS = 35 * 60 * 1000; // tolérance côté rules/clients
const CART_STORAGE_KEY = 'planizza:cart:v1';

function safeParseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadCartFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return null;
  const parsed = safeParseJSON(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  const expiresAt = typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null;
  if (expiresAt != null && expiresAt <= Date.now()) {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    return null;
  }

  return {
    truckId: parsed.truckId ?? null,
    items: Array.isArray(parsed.items) ? parsed.items : null,
  };
}

function saveCartToStorage({ truckId, items, expiresAt }) {
  if (typeof window === 'undefined' || !window.localStorage) return;

  if (!Array.isArray(items) || items.length === 0) {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    return;
  }

  const now = Date.now();
  const safeExpiresAt =
    typeof expiresAt === 'number' && Number.isFinite(expiresAt) ? expiresAt : now + CART_TTL_MS;
  const payload = {
    truckId: truckId ?? null,
    items: items.map((it) => ({
      id: String(it.id),
      name: it.name == null ? '' : String(it.name),
      priceCents: Number(it.priceCents || 0),
      qty: normalizeQty(it.qty),
      available: it.available !== false,
    })),
    savedAt: now,
    expiresAt: safeExpiresAt,
  };

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
}

function normalizeQty(n) {
  const q = Number(n);
  if (!Number.isFinite(q) || q <= 0) return 1;
  return Math.min(99, Math.floor(q));
}

function serializeItems(items) {
  const out = {};
  (Array.isArray(items) ? items : []).forEach((it) => {
    if (!it || !it.id) return;
    out[String(it.id)] = {
      id: String(it.id),
      name: it.name == null ? '' : String(it.name),
      priceCents: Number(it.priceCents || 0),
      qty: normalizeQty(it.qty),
      available: it.available !== false,
    };
  });
  return out;
}

function deserializeItems(itemsObj) {
  if (!itemsObj || typeof itemsObj !== 'object') return [];
  return Object.values(itemsObj)
    .filter(Boolean)
    .map((it) => ({
      id: String(it.id),
      name: it.name == null ? '' : String(it.name),
      priceCents: Number(it.priceCents || 0),
      qty: normalizeQty(it.qty),
      available: it.available !== false,
    }));
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [truckId, setTruckId] = useState(null);
  const [items, setItems] = useState([]);

  const applyingRemoteRef = useRef(false);
  // Empêche les boucles: quand on applique un snapshot RTDB -> React state,
  // on ne doit pas réécrire ce même state vers RTDB.
  const suppressRtdbPersistRef = useRef(false);
  const saveTimerRef = useRef(null);
  const storageTimerRef = useRef(null);
  const didHydrateFromStorageRef = useRef(false);
  const itemsRef = useRef(items);
  const truckIdRef = useRef(truckId);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    truckIdRef.current = truckId;
  }, [truckId]);

  // Hydratation depuis le storage navigateur (invite/fallback). Ensuite RTDB (si uid) prendra le relais.
  useEffect(() => {
    if (didHydrateFromStorageRef.current) return;
    didHydrateFromStorageRef.current = true;

    const stored = loadCartFromStorage();
    if (!stored) return;

    applyingRemoteRef.current = true;
    try {
      if (stored.truckId) setTruckId(stored.truckId);
      if (stored.items) setItems(stored.items.map((it) => ({
        id: String(it.id),
        name: it.name == null ? '' : String(it.name),
        priceCents: Number(it.priceCents || 0),
        qty: normalizeQty(it.qty),
        available: it.available !== false,
      })));
    } finally {
      queueMicrotask(() => {
        applyingRemoteRef.current = false;
      });
    }
  }, []);

  // Au login: si l'utilisateur n'a pas de panier distant, on pousse le panier local.
  useEffect(() => {
    if (!uid || !isFirebaseConfigured || !db) return;

    const cartRef = ref(db, `carts/${uid}/active`);
    let cancelled = false;

    (async () => {
      try {
        const snap = await get(cartRef);
        if (cancelled) return;

        if (!snap.exists() && itemsRef.current.length > 0) {
          const now = Date.now();
          await set(cartRef, {
            truckId: truckIdRef.current ?? null,
            items: serializeItems(itemsRef.current),
            updatedAt: serverTimestamp(),
            expiresAt: now + CART_TTL_MS,
          });
        }
      } catch (err) {
        console.warn('[PLANIZZA] Impossible de synchroniser le panier au login:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Écoute temps réel du panier distant
  useEffect(() => {
    if (!uid || !isFirebaseConfigured || !db) return;

    const cartRef = ref(db, `carts/${uid}/active`);
    const unsub = onValue(cartRef, (snap) => {
      applyingRemoteRef.current = true;
      suppressRtdbPersistRef.current = true;
      try {
        if (!snap.exists()) {
          setItems([]);
          setTruckId(null);

          // Important: si le panier distant disparaît (logout depuis autre device, purge, etc.)
          // on reflète immédiatement cet état en localStorage.
          try {
            saveCartToStorage({ truckId: null, items: [] });
          } catch {
            // ignore
          }
          return;
        }

        const v = snap.val() || {};
        const expiresAt = typeof v.expiresAt === 'number' ? v.expiresAt : null;
        const now = Date.now();

        // Si expiré, on supprime (best-effort) et on vide côté UI
        if (expiresAt != null && expiresAt <= now) {
          remove(cartRef).catch(() => {});
          setItems([]);
          setTruckId(null);

          // Refléter aussi l'expiration côté storage navigateur
          try {
            saveCartToStorage({ truckId: null, items: [] });
          } catch {
            // ignore
          }
          return;
        }

        const nextTruckId = v.truckId ?? null;
        const nextItems = deserializeItems(v.items);

        setTruckId(nextTruckId);
        setItems(nextItems);

        // Crucial: synchroniser le panier distant vers localStorage.
        // Sinon, si l'utilisateur se déconnecte juste après un refresh (panier uniquement chargé depuis RTDB),
        // il peut perdre le panier en mode invité.
        try {
          saveCartToStorage({ truckId: nextTruckId, items: nextItems, expiresAt: expiresAt ?? undefined });
        } catch {
          // localStorage peut échouer (quota, mode privé, etc.)
        }
      } finally {
        // Relâcher IMMÉDIATEMENT (synchro) pour empêcher boucle infinie
        applyingRemoteRef.current = false;
        suppressRtdbPersistRef.current = false;
      }
    });

    return () => {
      unsub();
    };
  }, [uid]);

  const addItem = (item, options = {}) => {
    setItems((prev) => {
      const nextTruckId = options.truckId ?? truckIdRef.current ?? null;

      // MVP: 1 panier = 1 camion. Si l'utilisateur ajoute depuis un autre camion, on redémarre un nouveau panier.
      if (truckIdRef.current && nextTruckId && truckIdRef.current !== nextTruckId) {
        console.warn('[PLANIZZA] Panier multi-camions détecté, on redémarre un nouveau panier.');
        setTruckId(nextTruckId);
        return [{ ...item, qty: 1 }];
      }

      if (!truckIdRef.current && nextTruckId) {
        setTruckId(nextTruckId);
      }

      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) => (p.id === item.id ? { ...p, qty: p.qty + 1 } : p));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeItem = (itemId) => {
    setItems((prev) => prev.filter((p) => p.id !== itemId));
  };

  const clear = () => {
    setItems([]);
    setTruckId(null);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    }
  };

  // Persist localStorage: toujours (connecté ou non) pour conserver une UX robuste.
  useEffect(() => {
    if (applyingRemoteRef.current) return;

    if (storageTimerRef.current) {
      clearTimeout(storageTimerRef.current);
      storageTimerRef.current = null;
    }

    storageTimerRef.current = setTimeout(() => {
      try {
        saveCartToStorage({ truckId: truckIdRef.current, items: itemsRef.current });
      } catch (err) {
        // localStorage peut échouer (quota, mode privé, etc.)
        console.warn('[PLANIZZA] Impossible de sauvegarder le panier en storage navigateur:', err);
      }
    }, CART_SAVE_DEBOUNCE_MS);

    return () => {
      if (storageTimerRef.current) clearTimeout(storageTimerRef.current);
    };
  }, [items, truckId]);

  // Persist: dès qu'on a un uid, on sauvegarde le panier actif avec TTL 30min.
  useEffect(() => {
    if (!uid || !isFirebaseConfigured || !db) return;
    if (suppressRtdbPersistRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const cartRef = ref(db, `carts/${uid}/active`);

    saveTimerRef.current = setTimeout(() => {
      const now = Date.now();

      // Si panier vide, on supprime côté RTDB
      if (itemsRef.current.length === 0) {
        remove(cartRef).catch((err) => {
          console.warn('[PLANIZZA] Impossible de supprimer le panier:', err);
        });
        return;
      }

      const expiresAt = now + CART_TTL_MS;

      // Anti-prise de tête: si une clock client est bizarre, on garde une valeur raisonnable.
      const safeExpiresAt = Math.min(expiresAt, now + CART_EXPIRES_MAX_AHEAD_MS);

      set(cartRef, {
        truckId: truckIdRef.current ?? null,
        items: serializeItems(itemsRef.current),
        updatedAt: serverTimestamp(),
        expiresAt: safeExpiresAt,
      }).catch((err) => {
        console.warn('[PLANIZZA] Impossible de sauvegarder le panier:', err);
      });

      if (import.meta.env.DEV) {
        // Aide debug: permet de vérifier en console que l'écriture RTDB a bien été tentée.
        console.debug('[PLANIZZA] Cart saved to RTDB', {
          path: `carts/${uid}/active`,
          truckId: truckIdRef.current ?? null,
          itemsCount: itemsRef.current.length,
          expiresAt: safeExpiresAt,
        });
      }
    }, CART_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [uid, items, truckId]);

  const totalCents = useMemo(
    () => items.reduce((sum, it) => sum + it.priceCents * it.qty, 0),
    [items]
  );

  const flushToStorage = useCallback(() => {
    try {
      saveCartToStorage({ truckId: truckIdRef.current, items: itemsRef.current });
    } catch (err) {
      console.warn('[PLANIZZA] Impossible de flusher le panier en storage navigateur:', err);
    }
  }, []);

  const value = useMemo(
    () => ({ truckId, setTruckId, items, addItem, removeItem, clear, totalCents, flushToStorage }),
    [truckId, items, totalCents, flushToStorage]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider />');
  return ctx;
}
