import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useAuth } from '../app/providers/AuthProvider';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { useCreateOrder } from '../features/orders/hooks/useCreateOrder';
import { ROUTES } from '../app/routes';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const { isAuthenticated, user, loading } = useAuth();
  const { items, totalCents, truckId: cartTruckId } = useCart();
  const { createOrder, loading: creatingOrder } = useCreateOrder();

  const [error, setError] = useState(null);

  const truckId = useMemo(() => {
    return (
      searchParams.get('truckId') ||
      location.state?.truckId ||
      cartTruckId ||
      null
    );
  }, [location.state, searchParams, cartTruckId]);

  const formatEUR = (cents) => (cents / 100).toFixed(2).replace('.', ',') + ' €';

  const startCheckout = async () => {
    setError(null);

    if (!truckId) {
      setError('truckId manquant. Revenez sur la fiche camion puis réessayez.');
      return;
    }

    try {
      await createOrder({
        truckId,
        items,
        userUid: user?.uid,
      });
      // createOrder déclenche le redirect Stripe via lib/stripe
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Erreur pendant le checkout');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-gray-600">
        Chargement…
      </div>
    );
  }

  if (!isAuthenticated) {
    // AuthGate minimal: rediriger vers login
    navigate(ROUTES.login, { replace: true, state: { from: ROUTES.checkout } });
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
      <p className="mt-2 text-sm text-gray-600">
        MVP navigation : cette page déclenche Stripe Checkout via Firebase
        Functions.
      </p>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="text-sm text-gray-700">
          <div>
            <span className="font-semibold">Truck:</span>{' '}
            {truckId ?? '—'}
          </div>
          <div>
            <span className="font-semibold">Articles:</span> {items.length}
          </div>
          <div>
            <span className="font-semibold">Total:</span> {formatEUR(totalCents)}
          </div>
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => navigate(ROUTES.cart, { state: { truckId } })}
            variant="outline"
          >
            Retour panier
          </Button>
          <Button
            onClick={startCheckout}
            disabled={creatingOrder || items.length === 0}
          >
            {creatingOrder ? 'Préparation…' : 'Payer sur Stripe'}
          </Button>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Rappel: le statut paid est écrit uniquement par le webhook Stripe côté
        Functions.
      </p>
    </div>
  );
}
