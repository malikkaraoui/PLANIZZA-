import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { useAuth } from '../app/providers/AuthProvider';

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { clear } = useCart();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // UX: on vide le panier local après un paiement réussi.
    clear();
  }, [clear]);

  const isGuest = !isAuthenticated;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-extrabold text-gray-900">Commande confirmée</h1>
      <p className="mt-3 text-gray-600">
        Merci ! Votre paiement a été validé. Le pizzaiolo voit maintenant votre commande.
      </p>

      {isGuest && (
        <div className="mt-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6 max-w-md mx-auto">
          <h2 className="text-xl font-bold text-emerald-900 mb-2">🎉 Créez un compte pour suivre votre commande !</h2>
          <p className="text-sm text-emerald-800 mb-4">
            En créant un compte, vous pourrez suivre votre commande en temps réel (préparation, cuisson...) et retrouver votre historique.
          </p>
          <Link
            to={ROUTES.register}
            className="inline-block rounded-md bg-emerald-600 px-6 py-3 text-white font-semibold hover:bg-emerald-700"
          >
            Créer mon compte
          </Link>
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          to={ROUTES.explore}
          className="rounded-md bg-gray-900 px-4 py-2 text-white font-semibold hover:bg-gray-800"
        >
          Revenir à l’exploration
        </Link>

        {orderId && (
          <Link
            to={ROUTES.order(orderId)}
            className="rounded-md bg-gray-100 px-4 py-2 text-gray-900 font-semibold hover:bg-gray-200"
          >
            Suivre ma commande
          </Link>
        )}
      </div>
    </div>
  );
}
