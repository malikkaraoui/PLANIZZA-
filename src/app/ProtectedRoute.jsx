import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import { useUserProfile } from '../features/users/hooks/useUserProfile';
import { usePizzaioloTruckId } from '../features/pizzaiolo/hooks/usePizzaioloTruckId';
import { devLog } from '../lib/devLog';

export default function ProtectedRoute({ children, requirePizzaiolo = false }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useUserProfile();
  const {
    truckId: pizzaioloTruckId,
    loading: pizzaioloTruckLoading,
    error: pizzaioloTruckError,
  } = usePizzaioloTruckId(requirePizzaiolo ? user?.uid : null);
  const location = useLocation();

  const isPizzaiolo = profile?.role === 'pizzaiolo' || Boolean(pizzaioloTruckId);

  useEffect(() => {
    devLog('[ProtectedRoute]', {
      path: location.pathname,
      requirePizzaiolo,
      authLoading,
      isAuthenticated,
      profileLoading,
      profileRole: profile?.role || null,
      hasProfileError: Boolean(profileError),
      pizzaioloTruckId: pizzaioloTruckId || null,
      pizzaioloTruckLoading,
      hasPizzaioloTruckError: Boolean(pizzaioloTruckError),
      isPizzaiolo,
    });
  }, [location.pathname, requirePizzaiolo, authLoading, isAuthenticated, profileLoading, profile?.role, profileError, pizzaioloTruckId, pizzaioloTruckLoading, pizzaioloTruckError, isPizzaiolo]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="text-gray-600">Chargement…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Les routes "pro" ont besoin du profil (rôle). On évite un loader infini si RTDB ne répond pas.
  if (requirePizzaiolo) {
    // On attend la meilleure info disponible: profil OU lien pizzaiolo.
    if (!isPizzaiolo && (profileLoading || pizzaioloTruckLoading)) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="text-gray-600">Chargement…</div>
        </div>
      );
    }

    // Si on ne peut pas lire le profil ni le lien pizzaiolo, on affiche une erreur réseau.
    if (profileError && pizzaioloTruckError) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold">Connexion au profil impossible</div>
            <div className="mt-1 text-sm text-gray-600">
              Un souci réseau empêche de vérifier votre statut pizzaiolo.
            </div>
            <div className="mt-3 text-xs text-gray-500 font-mono break-all">
              {String((profileError || pizzaioloTruckError)?.message || (profileError || pizzaioloTruckError))}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
            >
              Recharger
            </button>
          </div>
        </div>
      );
    }
  }

  // Si la route nécessite role pizzaiolo et que l'user n'en est pas un
  if (requirePizzaiolo && !isPizzaiolo) {
    return <Navigate to="/pizzaiolo/start" replace />;
  }

  return children;
}
