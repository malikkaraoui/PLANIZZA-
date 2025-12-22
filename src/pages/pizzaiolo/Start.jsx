import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { useUserProfile } from '../../features/users/hooks/useUserProfile';
import { ref, update } from 'firebase/database';
import { db } from '../../lib/firebase';
import { ROUTES } from '../../app/routes';

export default function PizzaioloStart() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Si déjà pizzaiolo, rediriger vers dashboard
  if (profile?.role === 'pizzaiolo') {
    navigate(ROUTES.pizzaioloDashboard, { replace: true });
    return null;
  }

  const handleBecomePizzaiolo = async () => {
    if (!isAuthenticated || !user?.uid) {
      navigate(ROUTES.login);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userRef = ref(db, `users/${user.uid}`);
      await update(userRef, {
        role: 'pizzaiolo',
        updatedAt: Date.now(),
      });

      // Redirection vers dashboard
      navigate(ROUTES.pizzaioloDashboard);
    } catch (err) {
      console.error('[PLANIZZA] Erreur upgrade pizzaiolo:', err);
      setError('Impossible de créer votre compte professionnel. Réessayez plus tard.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">
          🍕 Devenez Pizzaiolo sur PLANIZZA
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Créez votre camion, gérez votre menu et recevez des commandes en temps réel.
        </p>
      </div>

      {/* Avantages */}
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-3xl">🚚</div>
          <h3 className="mt-3 font-semibold text-gray-900">Votre camion</h3>
          <p className="mt-2 text-sm text-gray-600">
            Créez et personnalisez votre profil : logo, photos, badges (bio, terroir, halal...).
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-3xl">📋</div>
          <h3 className="mt-3 font-semibold text-gray-900">Menu dynamique</h3>
          <p className="mt-2 text-sm text-gray-600">
            Ajoutez vos pizzas, calzones, desserts. Modifiez prix et disponibilité en 1 clic.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-3xl">📦</div>
          <h3 className="mt-3 font-semibold text-gray-900">Commandes live</h3>
          <p className="mt-2 text-sm text-gray-600">
            Suivez les commandes en temps réel. Notifications instantanées à chaque paiement.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-8 text-center">
        {!isAuthenticated ? (
          <>
            <h2 className="text-xl font-semibold text-gray-900">
              Connectez-vous pour commencer
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Créez un compte gratuitement avec Google en quelques secondes.
            </p>
            <button
              onClick={() => navigate(ROUTES.login)}
              className="mt-4 rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
            >
              Se connecter avec Google
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-gray-900">
              Prêt à rejoindre PLANIZZA ?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Vous allez pouvoir créer votre camion et commencer à recevoir des commandes.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleBecomePizzaiolo}
              disabled={loading}
              className="mt-4 rounded-lg bg-emerald-600 px-8 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Création en cours...' : 'Créer mon espace professionnel'}
            </button>

            <p className="mt-3 text-xs text-gray-500">
              En cliquant, vous acceptez nos conditions d'utilisation.
            </p>
          </>
        )}
      </div>

      {/* Retour */}
      <div className="mt-8 text-center">
        <button
          onClick={() => navigate(ROUTES.explore)}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          ← Retour à l'exploration
        </button>
      </div>
    </div>
  );
}
