import { useEffect, useState } from 'react';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { useAuth } from '../../../app/providers/AuthProvider';

/**
 * Hook pour vérifier si un utilisateur peut noter un pizzaiolo/camion
 *
 * Règles :
 * - Doit avoir un compte client (pas guest)
 * - Ne peut pas être pizzaiolo (interdit de se noter entre pizzaiolos)
 * - Doit avoir commandé chez ce pizzaiolo
 * - La commande doit être payée (paidAt existe)
 * - Ne peut pas noter le jour même de la commande
 * - Ne peut pas noter deux fois la même commande
 *
 * @param {string} truckId - ID du camion à noter
 * @returns {Object} { canRate, reason, eligibleOrders, loading, alreadyRated }
 */
export function useCanRate(truckId) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({
    canRate: false,
    reason: null,
    eligibleOrders: [],
    alreadyRated: false,
    loading: true,
  });

  useEffect(() => {
    if (authLoading) return;

    // Pas de Firebase configuré
    if (!isFirebaseConfigured || !db) {
      setState({
        canRate: false,
        reason: 'service_unavailable',
        eligibleOrders: [],
        alreadyRated: false,
        loading: false,
      });
      return;
    }

    // Pas connecté = guest
    if (!user) {
      setState({
        canRate: false,
        reason: 'guest', // "Créez un compte pour donner votre avis"
        eligibleOrders: [],
        alreadyRated: false,
        loading: false,
      });
      return;
    }

    if (!truckId) {
      setState({
        canRate: false,
        reason: 'no_truck',
        eligibleOrders: [],
        alreadyRated: false,
        loading: false,
      });
      return;
    }

    const checkEligibility = async () => {
      try {
        // 1. Vérifier si l'utilisateur est un pizzaiolo
        const pizzaioloRef = ref(db, `pizzaiolos/${user.uid}`);
        const pizzaioloSnap = await get(pizzaioloRef);

        if (pizzaioloSnap.exists()) {
          setState({
            canRate: false,
            reason: 'is_pizzaiolo', // "Les pizzaiolos ne peuvent pas noter"
            eligibleOrders: [],
            alreadyRated: false,
            loading: false,
          });
          return;
        }

        // 2. Récupérer les commandes de l'utilisateur pour ce camion
        const ordersRef = ref(db, 'orders');
        const userOrdersQuery = query(
          ordersRef,
          orderByChild('userUid'),
          equalTo(user.uid)
        );

        const ordersSnap = await get(userOrdersQuery);

        if (!ordersSnap.exists()) {
          setState({
            canRate: false,
            reason: 'no_orders', // "Commandez d'abord pour pouvoir noter"
            eligibleOrders: [],
            alreadyRated: false,
            loading: false,
          });
          return;
        }

        const orders = [];
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        let hasRatedThisTruck = false;

        ordersSnap.forEach((snap) => {
          const order = { id: snap.key, ...snap.val() };

          // Filtrer : seulement les commandes de ce camion
          if (order.truckId !== truckId) return;

          // Vérifier si déjà noté ce camion (via cette commande)
          if (order.pizzaioloRating) {
            hasRatedThisTruck = true;
            return;
          }

          // Doit être payée
          if (!order.paidAt) return;

          // Ne peut pas noter le jour même
          const orderDate = order.paidAt || order.createdAt;
          if (now - orderDate < oneDayMs) return;

          orders.push(order);
        });

        if (hasRatedThisTruck) {
          setState({
            canRate: false,
            reason: 'already_rated', // "Vous avez déjà noté ce pizzaiolo"
            eligibleOrders: [],
            alreadyRated: true,
            loading: false,
          });
          return;
        }

        if (orders.length === 0) {
          // A des commandes mais pas éligibles (pas payées ou trop récentes)
          setState({
            canRate: false,
            reason: 'no_eligible_orders', // "Vos commandes ne sont pas encore éligibles"
            eligibleOrders: [],
            alreadyRated: false,
            loading: false,
          });
          return;
        }

        // Peut noter !
        setState({
          canRate: true,
          reason: null,
          eligibleOrders: orders,
          alreadyRated: false,
          loading: false,
        });

      } catch (error) {
        console.error('[useCanRate] Error:', error);
        setState({
          canRate: false,
          reason: 'error',
          eligibleOrders: [],
          alreadyRated: false,
          loading: false,
        });
      }
    };

    checkEligibility();
  }, [user, authLoading, truckId]);

  return state;
}

/**
 * Hook simplifié pour vérifier si on peut noter une commande spécifique
 * @param {Object} order - L'objet commande
 * @returns {Object} { canRate, reason }
 */
export function useCanRateOrder(order) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({
    canRate: false,
    reason: null,
    loading: true,
  });

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setState({ canRate: false, reason: 'guest', loading: false });
      return;
    }

    if (!order) {
      setState({ canRate: false, reason: 'no_order', loading: false });
      return;
    }

    // Déjà noté ?
    if (order.pizzaioloRating) {
      setState({ canRate: false, reason: 'already_rated', loading: false });
      return;
    }

    // Pas payée ?
    if (!order.paidAt) {
      setState({ canRate: false, reason: 'not_paid', loading: false });
      return;
    }

    // Trop récent ? (moins de 24h)
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const orderDate = order.paidAt || order.createdAt;

    if (now - orderDate < oneDayMs) {
      setState({ canRate: false, reason: 'too_recent', loading: false });
      return;
    }

    // Vérifier si pizzaiolo (async)
    const checkPizzaiolo = async () => {
      if (!isFirebaseConfigured || !db) {
        setState({ canRate: false, reason: 'service_unavailable', loading: false });
        return;
      }

      try {
        const pizzaioloRef = ref(db, `pizzaiolos/${user.uid}`);
        const snap = await get(pizzaioloRef);

        if (snap.exists()) {
          setState({ canRate: false, reason: 'is_pizzaiolo', loading: false });
        } else {
          setState({ canRate: true, reason: null, loading: false });
        }
      } catch (error) {
        console.error('[useCanRateOrder] Error:', error);
        setState({ canRate: false, reason: 'error', loading: false });
      }
    };

    checkPizzaiolo();
  }, [user, authLoading, order]);

  return state;
}
