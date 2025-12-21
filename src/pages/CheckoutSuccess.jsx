import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { useCart } from '../features/cart/hooks/useCart.jsx';

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { clear } = useCart();

  useEffect(() => {
    // UX: on vide le panier local après un paiement réussi.
    clear();
  }, [clear]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-extrabold text-gray-900">Commande confirmée</h1>
      <p className="mt-3 text-gray-600">
        Merci ! Votre paiement a été validé. Le pizzaiolo voit maintenant votre commande.
      </p>

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

        <Link
          to={ROUTES.pizzaioloOrders}
          className="rounded-md bg-gray-100 px-4 py-2 text-gray-900 font-semibold hover:bg-gray-200"
        >
          Voir commandes (pizzaiolo)
        </Link>
      </div>
    </div>
  );
}
