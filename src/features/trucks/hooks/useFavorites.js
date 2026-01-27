import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, set, remove, serverTimestamp } from 'firebase/database';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../app/providers/AuthProvider';
import { notify } from '../../../lib/notifications';

/**
 * Hook pour gérer les favoris d'un utilisateur
 * Stockage: /users/{userId}/favorites/{truckId}
 */
export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !db) {
      setFavorites({});
      setLoading(false);
      return;
    }

    const favRef = ref(db, `users/${user.uid}/favorites`);
    const unsubscribe = onValue(
      favRef,
      (snapshot) => {
        setFavorites(snapshot.val() || {});
        setLoading(false);
      },
      (error) => {
        console.error('[useFavorites] Error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const isFavorite = useCallback(
    (truckId) => {
      return Boolean(favorites[truckId]);
    },
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (truckId, truckName) => {
      if (!user?.uid || !db) {
        notify.profileIncomplete('Connectez-vous pour ajouter des favoris');
        return false;
      }

      const favRef = ref(db, `users/${user.uid}/favorites/${truckId}`);
      const truckFavRef = ref(db, `public/trucks/${truckId}/favorites/${user.uid}`);
      const isCurrentlyFavorite = isFavorite(truckId);

      try {
        if (isCurrentlyFavorite) {
          // Retirer des favoris
          await remove(favRef);
          await remove(truckFavRef);
          notify.favoriteRemoved(truckName || 'Ce camion');
        } else {
          // Ajouter aux favoris
          const favoriteData = {
            addedAt: serverTimestamp(),
            truckId,
          };
          await set(favRef, favoriteData);
          await set(truckFavRef, {
            userId: user.uid,
            addedAt: serverTimestamp(),
          });
          notify.favoriteAdded(truckName || 'Ce camion');
        }
        return true;
      } catch (error) {
        console.error('[useFavorites] Toggle error:', error);
        return false;
      }
    },
    [user?.uid, isFavorite]
  );

  const favoritesList = Object.keys(favorites);

  return {
    favorites,
    favoritesList,
    isFavorite,
    toggleFavorite,
    loading,
    count: favoritesList.length,
  };
}

/**
 * Hook simplifié pour un seul camion
 */
export function useFavorite(truckId, truckName) {
  const { isFavorite, toggleFavorite, loading } = useFavorites();

  const isLiked = isFavorite(truckId);

  const toggle = useCallback(() => {
    return toggleFavorite(truckId, truckName);
  }, [truckId, truckName, toggleFavorite]);

  return {
    isFavorite: isLiked,
    toggle,
    loading,
  };
}

export default useFavorites;
