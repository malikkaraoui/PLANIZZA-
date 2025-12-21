import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { ref, remove } from 'firebase/database';
import { useAuth } from '../app/providers/AuthProvider';
import { ROUTES } from '../app/routes';
import Button from '../components/ui/Button';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { useCart } from '../features/cart/hooks/useCart.jsx';

export default function Account() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(null);
  const { flushToStorage } = useCart();

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
      // 1) On s'assure que le panier est bien présent côté navigateur (mode invité) avant de perdre l'auth.
      // Important: si le panier vient d'être hydraté depuis RTDB (après refresh), on veut quand même le garder local.
      flushToStorage?.();

      // 2) On nettoie le panier RTDB tant qu'on est encore connecté, pour éviter qu'il reste 30min côté serveur.
      // Best-effort: si ça échoue, l'expiration serveur + les rules owner-only protègent quand même.
      if (isFirebaseConfigured && db && user?.uid) {
        try {
          await remove(ref(db, `carts/${user.uid}/active`));
        } catch (e) {
          console.warn('[PLANIZZA] Impossible de supprimer le panier RTDB avant logout:', e);
        }
      }

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
