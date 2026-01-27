import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import { useClientProfile } from '../features/users/hooks/useClientProfile';
import { usePizzaioloProfile } from '../features/users/hooks/usePizzaioloProfile';
import { devLog } from '../lib/devLog';

/**
 * ProtectedRoute - Séparation stricte Client/Pizzaiolo
 * 
 * @param {boolean} requireClient - Route réservée aux clients (users/)
 * @param {boolean} requirePizzaiolo - Route réservée aux pizzaiolos (pizzaiolos/)
 * 
 * Un compte ne peut être QUE client OU pizzaiolo, jamais les deux.
 */
export default function ProtectedRoute({ children, requireClient = false, requirePizzaiolo = false }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isClient, loading: clientLoading } = useClientProfile();
  const { isPizzaiolo, loading: pizzaioloLoading } = usePizzaioloProfile();
  const location = useLocation();

  useEffect(() => {
    devLog('[ProtectedRoute]', {
      path: location.pathname,
      requireClient,
      requirePizzaiolo,
      authLoading,
      isAuthenticated,
      isClient,
      isPizzaiolo,
      clientLoading,
      pizzaioloLoading,
    });
  }, [location.pathname, requireClient, requirePizzaiolo, authLoading, isAuthenticated, isClient, isPizzaiolo, clientLoading, pizzaioloLoading]);

  // Chargement de l'auth
  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="text-gray-600">Chargement…</div>
      </div>
    );
  }

  // Pas connecté -> login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Route client : vérifier qu'on a un profil client
  if (requireClient) {
    if (clientLoading) {
      devLog('[ProtectedRoute] Chargement profil client...');
      return (
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="text-gray-600">Chargement du profil…</div>
        </div>
      );
    }

    // Pas de profil client -> rediriger vers création profil client
    if (!isClient) {
      devLog('[ProtectedRoute] ⚠️ Pas de profil client détecté, redirection vers /register/client');
      return <Navigate to="/register/client" replace state={{ from: location }} />;
    }
    
    devLog('[ProtectedRoute] ✅ Profil client confirmé, accès autorisé');
  }

  // Route pizzaiolo : vérifier qu'on a un profil pizzaiolo
  if (requirePizzaiolo) {
    if (pizzaioloLoading) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="text-gray-600">Chargement du profil…</div>
        </div>
      );
    }

    // Pas de profil pizzaiolo -> rediriger vers onboarding pro
    if (!isPizzaiolo) {
      return <Navigate to="/pro/inscription" replace state={{ from: location }} />;
    }
  }

  // Sécurité : vérifier la mutuelle exclusion client/pizzaiolo
  // Un utilisateur ne peut pas être les deux à la fois
  if (!clientLoading && !pizzaioloLoading && isClient && isPizzaiolo) {
    devLog('[ProtectedRoute] ⚠️ ERREUR: Utilisateur est à la fois client ET pizzaiolo!');
    // Priorité au profil pizzaiolo s'il existe (choix métier)
    if (requireClient) {
      return <Navigate to="/pro/truck" replace />;
    }
  }

  return children;
}
