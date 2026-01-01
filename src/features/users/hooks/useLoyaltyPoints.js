import { useEffect, useState } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../../../lib/firebase';

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
  const [points, setPoints] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userUid) {
      setPoints(0);
      setTotalSpent(0);
      setLoading(false);
      return;
    }

    // Écouter le profil utilisateur pour les points stockés
    const userRef = ref(db, `users/${userUid}`);
    const unsubUser = onValue(userRef, async (userSnap) => {
      if (!userSnap.exists()) {
        setPoints(0);
        setTotalSpent(0);
        setLoading(false);
        return;
      }

      const userData = userSnap.val();
      const storedPoints = userData.loyaltyPoints || 0;
      const storedSpent = userData.totalSpentCents || 0;

      // Si les points ne sont pas initialisés, calculer depuis les commandes
      if (storedPoints === 0 && storedSpent === 0) {
        // Calcul initial depuis toutes les commandes
        const ordersRef = ref(db, 'orders');
        onValue(ordersRef, async (ordersSnap) => {
          if (!ordersSnap.exists()) {
            setPoints(0);
            setTotalSpent(0);
            setLoading(false);
            return;
          }

          const allOrders = ordersSnap.val();
          let total = 0;

          // Filtrer les commandes payées de l'utilisateur
          Object.values(allOrders).forEach(order => {
            if (order.userUid === userUid && order.payment?.paymentStatus === 'paid') {
              total += order.totalCents || 0;
            }
          });

          // Convertir en euros et arrondir à l'euro supérieur
          const totalEuros = Math.ceil(total / 100);
          const calculatedPoints = Math.floor(totalEuros / 5);

          // Sauvegarder dans le profil
          try {
            await set(ref(db, `users/${userUid}/loyaltyPoints`), calculatedPoints);
            await set(ref(db, `users/${userUid}/totalSpentCents`), total);
          } catch (err) {
            console.error('[PLANIZZA] Erreur sauvegarde points fidélité:', err);
          }

          setPoints(calculatedPoints);
          setTotalSpent(totalEuros);
          setLoading(false);
        }, { onlyOnce: true });
      } else {
        // Utiliser les points stockés
        setPoints(storedPoints);
        setTotalSpent(Math.ceil(storedSpent / 100));
        setLoading(false);
      }
    });

    return () => unsubUser();
  }, [userUid]);

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
    points,
    totalSpent,
    loading,
    currentTier,
    nextTier,
    progress,
    maxTierReached: !nextTier,
    tiers: LOYALTY_TIERS
  };
}
