/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { get, onValue, ref, remove, serverTimestamp, set } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { useAuth } from '../../../app/providers/AuthProvider';
import { notify } from '../../../lib/notifications';

const CartContext = createContext(null);

const CART_TTL_MS = 30 * 60 * 1000;
const CART_SAVE_DEBOUNCE_MS = 350;
const CART_EXPIRES_MAX_AHEAD_MS = 35 * 60 * 1000; // tolérance côté rules/clients
const CART_STORAGE_KEY = 'planizza:cart:v1';

function inferBaseItemIdFromCartItem(it) {
  if (!it) return null;
  if (it.baseItemId) return String(it.baseItemId);

  const id = it.id == null ? '' : String(it.id);
  if (!id) return null;

  // Les items ajoutés avec tailles sont sérialisés en `${baseId}_${sizeKey}`.
  // On prend le segment avant le dernier '_' (fallback).
  const idx = id.lastIndexOf('_');
  if (idx <= 0) return id;
  return id.slice(0, idx);
}

function normalizeMenuItemType(raw) {
  const t = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return t || '';
}

function pickDescriptionFromMenuItem(v) {
  // Pour les pizzas/calzones, la base de code utilise souvent `description` comme liste d'ingrédients.
  // On garde un fallback robuste.
  const d = typeof v?.description === 'string' ? v.description.trim() : '';
  if (d) return d;
  const ing = typeof v?.ingredients === 'string' ? v.ingredients.trim() : '';
  if (ing) return ing;
  const comp = typeof v?.composition === 'string' ? v.composition.trim() : '';
  if (comp) return comp;
  return '';
}

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
      type: it.type == null ? undefined : String(it.type),
      baseItemId: it.baseItemId == null ? undefined : String(it.baseItemId),
      description: it.description == null ? undefined : String(it.description),
      photo: it.photo == null ? undefined : String(it.photo),
      size: it.size == null ? undefined : String(it.size),
      diameter: typeof it.diameter === 'number' ? it.diameter : undefined,
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

    // IMPORTANT (Firebase RTDB): on ne doit JAMAIS écrire de valeurs `undefined`.
    // On omet donc les champs optionnels plutôt que de les définir à `undefined`.
    const next = {
      id: String(it.id),
      name: it.name == null ? '' : String(it.name),
      priceCents: Number(it.priceCents || 0),
      qty: normalizeQty(it.qty),
      available: it.available !== false,
    };

    if (it.type != null) {
      const v = String(it.type).trim();
      if (v) next.type = v;
    }
    if (it.baseItemId != null) {
      const v = String(it.baseItemId).trim();
      if (v) next.baseItemId = v;
    }
    if (it.description != null) {
      const v = String(it.description).trim();
      if (v) next.description = v;
    }
    if (it.photo != null) {
      const v = String(it.photo).trim();
      if (v) next.photo = v;
    }
    if (it.size != null) {
      const v = String(it.size).trim();
      if (v) next.size = v;
    }
    if (typeof it.diameter === 'number' && Number.isFinite(it.diameter)) {
      next.diameter = it.diameter;
    }

    out[String(it.id)] = next;
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
      type: it.type == null ? undefined : String(it.type),
      baseItemId: it.baseItemId == null ? undefined : String(it.baseItemId),
      description: it.description == null ? undefined : String(it.description),
      photo: it.photo == null ? undefined : String(it.photo),
      size: it.size == null ? undefined : String(it.size),
      diameter: typeof it.diameter === 'number' ? it.diameter : undefined,
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
  const lastSavedSignatureRef = useRef(null);

  // Quand on vient de se connecter, le panier distant peut ne pas exister encore (race entre lecture initiale et backfill).
  // Si on reçoit un snapshot "vide" au premier tick, on ne doit PAS écraser le panier local (invite) qui vient d'être hydraté.
  const hadMeaningfulRemoteCartRef = useRef(false);

  const enrichRef = useRef({ inFlight: false, lastKey: null });

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
        type: it.type == null ? undefined : String(it.type),
        baseItemId: it.baseItemId == null ? undefined : String(it.baseItemId),
        description: it.description == null ? undefined : String(it.description),
        photo: it.photo == null ? undefined : String(it.photo),
        size: it.size == null ? undefined : String(it.size),
        diameter: typeof it.diameter === 'number' ? it.diameter : undefined,
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

        const localHasItems = itemsRef.current.length > 0;
        if (!localHasItems) return;

        const remoteExists = snap.exists();
        const remoteVal = remoteExists ? (snap.val() || {}) : null;
        const remoteTruckId = remoteVal ? (remoteVal.truckId ?? null) : null;
        const remoteItems = remoteVal ? deserializeItems(remoteVal.items) : [];
        const remoteIsMeaningful = Boolean(remoteTruckId) || remoteItems.length > 0;

        // Garantie UX: si le panier distant est absent OU vide, on pousse le panier local.
        // On évite d'écraser un panier distant déjà rempli (autre device) -> remoteIsMeaningful=true.
        if (!remoteExists || !remoteIsMeaningful) {
          const now = Date.now();
          await set(cartRef, {
            truckId: truckIdRef.current ?? null,
            items: serializeItems(itemsRef.current),
            updatedAt: serverTimestamp(),
            expiresAt: now + CART_TTL_MS,
          });

          if (import.meta.env.DEV) {
            console.debug('[PLANIZZA] Cart backfilled to RTDB after login', {
              path: `carts/${uid}/active`,
              itemsCount: itemsRef.current.length,
            });
          }
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
    hadMeaningfulRemoteCartRef.current = false;
    const unsub = onValue(cartRef, (snap) => {
      applyingRemoteRef.current = true;
      suppressRtdbPersistRef.current = true;
      try {
        if (!snap.exists()) {
          // Si on n'a jamais vu de panier distant ET qu'on a déjà un panier local (invite),
          // on conserve le local le temps que le backfill (set) arrive.
          if (!hadMeaningfulRemoteCartRef.current) {
            const hasLocal = (itemsRef.current?.length || 0) > 0 || Boolean(truckIdRef.current);
            if (hasLocal) {
              return;
            }
          }

          setItems([]);
          setTruckId(null);

          // Si un panier distant a été supprimé (ou qu'on n'a aucun panier local), on reflète en localStorage.
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
          remove(cartRef).catch(() => { });
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

        const remoteIsMeaningful = Boolean(nextTruckId) || nextItems.length > 0;

        // Sur le premier tick post-login, un panier distant peut être vide (ancien état/écriture en retard).
        // On n'écrase pas un panier local existant tant qu'on n'a pas vu un panier distant "réel".
        if (!remoteIsMeaningful && !hadMeaningfulRemoteCartRef.current) {
          const hasLocal = (itemsRef.current?.length || 0) > 0 || Boolean(truckIdRef.current);
          if (hasLocal) {
            return;
          }
        }

        if (remoteIsMeaningful) {
          hadMeaningfulRemoteCartRef.current = true;
        }

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
        // Important: on relâche au tick suivant pour que le useEffect de persistance
        // voie bien suppressRtdbPersistRef=true et ne réécrive pas immédiatement en boucle.
        setTimeout(() => {
          applyingRemoteRef.current = false;
          suppressRtdbPersistRef.current = false;
        }, 0);
      }
    });

    return () => {
      unsub();
    };
  }, [uid]);

  // Backfill: certains anciens paniers (storage/RTDB) ne contiennent pas `type` / `description` / `photo`.
  // On les enrichit depuis le menu public du camion pour pouvoir trier et afficher les ingrédients.
  useEffect(() => {
    if (!truckIdRef.current) return;
    if (!isFirebaseConfigured || !db) return;
    if (itemsRef.current.length === 0) return;

    const missing = itemsRef.current.filter((it) => {
      if (!it) return false;
      // Si on n'a pas le type, impossible de classer correctement.
      if (!it.type) return true;

      const t = normalizeMenuItemType(it.type);
      const isPizzaLike = t === 'pizza' || t === 'calzone';
      // Pour pizzas/calzones, on veut le texte d'ingrédients (souvent `description`).
      if (isPizzaLike && !it.description) return true;
      // Photo optionnelle (best-effort)
      if (!it.photo) return true;

      return false;
    });

    if (missing.length === 0) return;

    const baseIds = Array.from(
      new Set(missing.map(inferBaseItemIdFromCartItem).filter(Boolean))
    );
    if (baseIds.length === 0) return;

    const key = `${truckIdRef.current}:${baseIds.slice().sort().join(',')}`;
    if (enrichRef.current.lastKey === key) return;
    if (enrichRef.current.inFlight) return;

    enrichRef.current.inFlight = true;
    enrichRef.current.lastKey = key;

    let cancelled = false;

    (async () => {
      try {
        const entries = await Promise.all(
          baseIds.map(async (baseId) => {
            try {
              const snap = await get(ref(db, `public/trucks/${truckIdRef.current}/menu/items/${baseId}`));
              if (!snap.exists()) return [baseId, null];
              const v = snap.val() || {};
              return [baseId, v];
            } catch {
              return [baseId, null];
            }
          })
        );

        if (cancelled) return;

        const byBaseId = new Map(entries);

        setItems((prev) => {
          let changed = false;

          const next = prev.map((it) => {
            const baseId = inferBaseItemIdFromCartItem(it);
            if (!baseId) return it;
            const v = byBaseId.get(baseId);
            if (!v) return it;

            const nextType = it.type ? it.type : normalizeMenuItemType(v.type) || undefined;
            const nextDesc = it.description ? it.description : pickDescriptionFromMenuItem(v) || undefined;
            const nextPhoto = it.photo ? it.photo : (v.photo || v.photoUrl || undefined);
            const nextBase = it.baseItemId ? it.baseItemId : baseId;

            // Éviter de recréer un objet si rien ne change (perf)
            if (
              it.type === nextType &&
              it.description === nextDesc &&
              it.photo === nextPhoto &&
              it.baseItemId === nextBase
            ) {
              return it;
            }

            changed = true;
            return {
              ...it,
              type: nextType,
              description: nextDesc,
              photo: nextPhoto,
              baseItemId: nextBase,
            };
          });

          return changed ? next : prev;
        });
      } finally {
        enrichRef.current.inFlight = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [truckId, items]);

  const addItem = useCallback((item, options = {}) => {
    const itemName = item.name || 'Article';

    setItems((prev) => {
      const nextTruckId = options.truckId ?? truckIdRef.current ?? null;

      // MVP: 1 panier = 1 camion. Si l'utilisateur ajoute depuis un autre camion, on redémarre un nouveau panier.
      if (truckIdRef.current && nextTruckId && truckIdRef.current !== nextTruckId) {
        notify.cartModified('Nouveau panier créé (camion différent)');
        setTruckId(nextTruckId);
        notify.itemAddedToCart(itemName);
        return [{ ...item, qty: 1 }];
      }

      if (!truckIdRef.current && nextTruckId) {
        setTruckId(nextTruckId);
      }

      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        notify.itemAddedToCart(itemName);
        return prev.map((p) => (p.id === item.id ? { ...p, qty: p.qty + 1 } : p));
      }
      notify.itemAddedToCart(itemName);
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const removeItem = useCallback((itemId) => {
    setItems((prev) => prev.filter((p) => p.id !== itemId));
  }, []);

  const updateItemQty = useCallback((itemId, newQty) => {
    const q = Math.floor(newQty);
    if (q <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, qty: Math.min(99, q) } : it))
    );
  }, [removeItem]);

  const clear = useCallback(() => {
    setItems([]);
    setTruckId(null);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, []);

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
      if (suppressRtdbPersistRef.current) return;

      const now = Date.now();

      // Si panier vide, on supprime côté RTDB
      if (itemsRef.current.length === 0) {
        remove(cartRef).catch((err) => {
          console.warn('[PLANIZZA] Impossible de supprimer le panier:', err);
        });
        lastSavedSignatureRef.current = null;
        return;
      }

      const expiresAt = now + CART_TTL_MS;

      // Anti-prise de tête: si une clock client est bizarre, on garde une valeur raisonnable.
      const safeExpiresAt = Math.min(expiresAt, now + CART_EXPIRES_MAX_AHEAD_MS);

      // Éviter les réécritures identiques (boucle inutile)
      const signature = JSON.stringify({
        truckId: truckIdRef.current ?? null,
        items: serializeItems(itemsRef.current),
      });
      if (signature === lastSavedSignatureRef.current) {
        return;
      }

      set(cartRef, {
        truckId: truckIdRef.current ?? null,
        items: serializeItems(itemsRef.current),
        updatedAt: serverTimestamp(),
        expiresAt: safeExpiresAt,
      }).catch((err) => {
        console.warn('[PLANIZZA] Impossible de sauvegarder le panier:', err);
      }).then(() => {
        lastSavedSignatureRef.current = signature;
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
    () => ({ truckId, setTruckId, items, addItem, removeItem, updateItemQty, clear, totalCents, flushToStorage }),
    [truckId, items, totalCents, addItem, removeItem, updateItemQty, clear, flushToStorage]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider />');
  return ctx;
}
