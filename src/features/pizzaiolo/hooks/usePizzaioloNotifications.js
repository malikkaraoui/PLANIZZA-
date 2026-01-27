import { useEffect, useRef } from 'react';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { notifyPizzaiolo } from '../../../lib/notifications';

/**
 * Hook pour notifier le pizzaiolo des nouveaux avis sur son camion.
 * À utiliser dans le Dashboard pizzaiolo.
 * @param {string} truckId - ID du camion
 */
export function usePizzaioloReviewNotifications(truckId) {
  const previousReviewIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (!truckId || !isFirebaseConfigured || !db) {
      previousReviewIdsRef.current = new Set();
      isFirstLoadRef.current = true;
      return;
    }

    const reviewsRef = ref(db, `public/trucks/${truckId}/reviews`);

    const unsubscribe = onValue(
      reviewsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
          }
          return;
        }

        const data = snapshot.val();
        const reviews = Object.entries(data).map(([id, review]) => ({
          id,
          ...review,
        }));

        if (!isFirstLoadRef.current) {
          // Détecter les nouveaux avis
          for (const review of reviews) {
            if (!previousReviewIdsRef.current.has(review.id)) {
              // Nouvel avis !
              const score = review.score || 0;
              const hasComment = Boolean(review.comment);
              notifyPizzaiolo.newReview(score, hasComment);
            }
          }
        }

        // Mettre à jour la liste des IDs connus
        previousReviewIdsRef.current = new Set(reviews.map((r) => r.id));
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
        }
      },
      (error) => {
        console.error('[usePizzaioloReviewNotifications] Error:', error);
      }
    );

    return () => unsubscribe();
  }, [truckId]);
}

/**
 * Hook pour notifier le pizzaiolo quand une nouvelle commande arrive.
 * À utiliser dans le layout /pro (Dashboard pizzaiolo) pour être actif partout.
 * @param {string} truckId - ID du camion
 */
export function usePizzaioloOrderNotifications(truckId) {
  const navigate = useNavigate();
  const previousOrderIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (!truckId || !isFirebaseConfigured || !db) {
      previousOrderIdsRef.current = new Set();
      isFirstLoadRef.current = true;
      return;
    }

    const ordersRef = ref(db, 'orders');
    const q = query(ordersRef, orderByChild('truckId'), equalTo(truckId));

    const unsubscribe = onValue(
      q,
      (snapshot) => {
        if (!snapshot.exists()) {
          if (isFirstLoadRef.current) isFirstLoadRef.current = false;
          previousOrderIdsRef.current = new Set();
          return;
        }

        const data = snapshot.val();
        const orders = Object.entries(data)
          .map(([id, order]) => ({ id, ...order }))
          // on ignore les brouillons
          .filter((o) => o?.status && o.status !== 'created');

        const currentIds = new Set(orders.map((o) => o.id));

        if (!isFirstLoadRef.current) {
          for (const o of orders) {
            // Nouveau id visible côté pizzaiolo
            if (!previousOrderIdsRef.current.has(o.id) && o.status === 'received') {
              const customerName = o.customerName || 'Client';
              const total = ((o.totalCents || 0) / 100).toFixed(2);
              notifyPizzaiolo.newOrder(customerName, total, o.id, navigate);
            }
          }
        }

        previousOrderIdsRef.current = currentIds;
        if (isFirstLoadRef.current) isFirstLoadRef.current = false;
      },
      (error) => {
        console.error('[usePizzaioloOrderNotifications] Error:', error);
      }
    );

    return () => unsubscribe();
  }, [truckId, navigate]);
}

/**
 * Hook pour notifier le pizzaiolo quand un client ajoute son camion en favoris.
 * À utiliser dans le Dashboard pizzaiolo.
 * @param {string} truckId - ID du camion
 */
export function usePizzaioloFavoriteNotifications(truckId) {
  const previousFavoriteIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (!truckId || !isFirebaseConfigured || !db) {
      previousFavoriteIdsRef.current = new Set();
      isFirstLoadRef.current = true;
      return;
    }

    const favoritesRef = ref(db, `public/trucks/${truckId}/favorites`);

    const unsubscribe = onValue(
      favoritesRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
          }
          return;
        }

        const data = snapshot.val();
        const favorites = Object.keys(data);

        if (!isFirstLoadRef.current) {
          // Détecter les nouveaux favoris
          for (const userId of favorites) {
            if (!previousFavoriteIdsRef.current.has(userId)) {
              // Nouveau favori !
              notifyPizzaiolo.newFavorite();
            }
          }
        }

        // Mettre à jour la liste des IDs connus
        previousFavoriteIdsRef.current = new Set(favorites);
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
        }
      },
      (error) => {
        console.error('[usePizzaioloFavoriteNotifications] Error:', error);
      }
    );

    return () => unsubscribe();
  }, [truckId]);
}

export default usePizzaioloReviewNotifications;
