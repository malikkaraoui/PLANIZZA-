import { useEffect, useState } from 'react';
import { get, ref, onValue, set, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';

/**
 * Hook pour gérer les points de fidélité d'un utilisateur
 * Les points sont stockés dans le profil utilisateur (users/{uid}/loyaltyPoints)
 * 1 point = 5€ d'achat
 * Paliers:
 * - 10 points = 10% de remise
 * - 20 points = dessert offert (min 20€)
 * - 30 points = pizza classic offerte
 * - 50 points = 15€ de réduction (min 35€)
 */

const LOYALTY_TIERS = [
  { points: 10, label: '10% de remise', description: 'sur votre prochaine commande' },
  { points: 20, label: 'Dessert offert', description: 'minimum panier 20€' },
  { points: 30, label: 'Pizza classic offerte', description: 'au choix' },
  { points: 50, label: '15€ de réduction', description: 'minimum panier 35€' }
];

export function useLoyaltyPoints(userUid) {
  const enabled = Boolean(userUid);
  const [points, setPoints] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) return;

    queueMicrotask(() => setLoading(true));

    // Écouter le profil utilisateur pour les points stockés
    const userRef = ref(db, rtdbPaths.user(userUid));
    const unsubUser = onValue(userRef, async (userSnap) => {
      if (!userSnap.exists()) {
        if (!cancelled) {
          setPoints(0);
          setTotalSpent(0);
          setLoading(false);
        }
        return;
      }

      const userData = userSnap.val();
      const storedPoints = userData.loyaltyPoints || 0;
      const storedSpent = userData.totalSpentCents || 0;

      async function computePaidTotalCentsForUser() {
        // ⚠️ Important: les rules RTDB n'autorisent plus la lecture globale de `orders`.
        // On fait donc une lecture ciblée via query (userUid/uid) et on agrège côté client.

        const totals = [];

        // Schéma le plus courant côté app: `userUid`
        try {
          const snapByUserUid = await get(
            query(ref(db, rtdbPaths.ordersRoot()), orderByChild('userUid'), equalTo(userUid))
          );
          if (snapByUserUid.exists()) {
            totals.push(snapByUserUid.val());
          }
        } catch (err) {
          // Peut échouer si l'index n'existe pas ou si les rules refusent (ex: uid != auth.uid).
          console.warn('[PLANIZZA] computePaidTotalCentsForUser(userUid) query failed:', err);
        }

        // Fallback legacy: certains écrits utilisent `uid`
        try {
          const snapByUid = await get(
            query(ref(db, rtdbPaths.ordersRoot()), orderByChild('uid'), equalTo(userUid))
          );
          if (snapByUid.exists()) {
            totals.push(snapByUid.val());
          }
        } catch (err) {
          console.warn('[PLANIZZA] computePaidTotalCentsForUser(uid) query failed:', err);
        }

        let total = 0;
        const seenOrderIds = new Set();

        for (const maybeOrders of totals) {
          if (!maybeOrders) continue;

          for (const [orderId, order] of Object.entries(maybeOrders)) {
            if (seenOrderIds.has(orderId)) continue;
            seenOrderIds.add(orderId);

            const paymentStatus = order?.v2?.paymentStatus || order?.payment?.paymentStatus;
            if (paymentStatus !== 'paid') continue;

            const cents =
              typeof order?.v2?.totalCents === 'number'
                ? order.v2.totalCents
                : typeof order?.totalCents === 'number'
                  ? order.totalCents
                  : 0;

            total += cents;
          }
        }

        return total;
      }

      // Si les points ne sont pas initialisés, calculer depuis les commandes
      if (storedPoints === 0 && storedSpent === 0) {
        const total = await computePaidTotalCentsForUser();

        // Convertir en euros et arrondir à l'euro supérieur
        const totalEuros = Math.ceil(total / 100);
        const calculatedPoints = Math.floor(totalEuros / 5);

        // Sauvegarder dans le profil
        try {
          await set(ref(db, `${rtdbPaths.user(userUid)}/loyaltyPoints`), calculatedPoints);
          await set(ref(db, `${rtdbPaths.user(userUid)}/totalSpentCents`), total);
        } catch (err) {
          console.error('[PLANIZZA] Erreur sauvegarde points fidélité:', err);
        }

        if (!cancelled) {
          setPoints(calculatedPoints);
          setTotalSpent(totalEuros);
          setLoading(false);
        }
      } else {
        // Utiliser les points stockés
        if (!cancelled) {
          setPoints(storedPoints);
          setTotalSpent(Math.ceil(storedSpent / 100));
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubUser();
    };
  }, [enabled, userUid]);

  // Trouver le prochain palier
  const getNextTier = () => {
    for (const tier of LOYALTY_TIERS) {
      if (points < tier.points) {
        return tier;
      }
    }
    return null; // Max tier atteint
  };

  // Trouver le palier actuel
  const getCurrentTier = () => {
    let current = null;
    for (const tier of LOYALTY_TIERS) {
      if (points >= tier.points) {
        current = tier;
      } else {
        break;
      }
    }
    return current;
  };

  const nextTier = getNextTier();
  const currentTier = getCurrentTier();
  
  // Calcul du pourcentage de progression
  const prevTierPoints = currentTier ? currentTier.points : 0;
  const nextTierPoints = nextTier ? nextTier.points : LOYALTY_TIERS[LOYALTY_TIERS.length - 1].points;
  const progress = nextTier 
    ? ((points - prevTierPoints) / (nextTierPoints - prevTierPoints)) * 100
    : 100;

  return {
    points: enabled ? points : 0,
    totalSpent: enabled ? totalSpent : 0,
    loading: enabled ? loading : false,
    currentTier: enabled ? currentTier : null,
    nextTier: enabled ? nextTier : null,
    progress: enabled ? progress : 0,
    maxTierReached: enabled ? !nextTier : false,
    tiers: LOYALTY_TIERS,
  };
}
