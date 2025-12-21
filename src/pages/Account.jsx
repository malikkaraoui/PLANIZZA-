import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { useAuth } from '../app/providers/AuthProvider';
import { ROUTES } from '../app/routes';
import Button from '../components/ui/Button';
import { auth, isFirebaseConfigured } from '../lib/firebase';

export default function Account() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(null);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-gray-600">Chargement…</div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>
        <p className="mt-2 text-sm text-gray-600">Connexion requise.</p>
        <div className="mt-6 flex gap-3">
          <Link to={ROUTES.login} className="underline text-sm">
            Se connecter
          </Link>
          <Link to={ROUTES.register} className="underline text-sm">
            Créer un compte
          </Link>
        </div>
      </div>
    );
  }

  const onSignOut = async () => {
    setSignOutError(null);

    if (!isFirebaseConfigured || !auth) {
      setSignOutError("Firebase n'est pas configuré sur cet environnement.");
      return;
    }

    setSigningOut(true);
    try {
      await signOut(auth);
      navigate(ROUTES.explore, { replace: true });
    } catch (err) {
      console.warn('[PLANIZZA] signOut error:', err);
      setSignOutError("Impossible de se déconnecter. Réessayez.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>
      <p className="mt-2 text-sm text-gray-600">
        {user?.email ? `Connecté: ${user.email}` : 'Connecté'}
      </p>

      <div className="mt-4">
        <Button variant="outline" onClick={onSignOut} disabled={signingOut}>
          {signingOut ? 'Déconnexion…' : 'Déconnexion'}
        </Button>
        {signOutError && <p className="mt-2 text-sm text-red-600">{signOutError}</p>}
      </div>

      <div className="mt-6 flex gap-3">
        <Link to={ROUTES.myOrders} className="underline text-sm">
          Mes commandes
        </Link>
        <Link to={ROUTES.pizzaioloStart} className="underline text-sm">
          Espace pizzaiolo
        </Link>
      </div>
    </div>
  );
}
