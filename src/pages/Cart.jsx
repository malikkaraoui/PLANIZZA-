import { useLocation, useNavigate } from 'react-router-dom';
import CartDrawer from '../features/cart/CartDrawer';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { ROUTES } from '../app/routes';

export default function Cart() {
  const navigate = useNavigate();
  const location = useLocation();
  const { truckId: cartTruckId } = useCart();

  const truckId = location.state?.truckId ?? cartTruckId ?? null;

  const handleCheckout = () => {
    const qs = truckId ? `?truckId=${encodeURIComponent(truckId)}` : '';
    navigate(`${ROUTES.checkout}${qs}`, { state: { truckId } });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Panier</h1>
      <p className="mt-2 text-sm text-gray-600">
        MVP navigation : récapitulatif panier + bouton vers /checkout.
      </p>

      <div className="mt-6">
        <CartDrawer onCheckout={handleCheckout} />
      </div>

      {!truckId && (
        <p className="mt-4 text-xs text-amber-700">
          Astuce: pour un checkout fiable, entrez depuis la fiche camion (on passe
          le truckId au panier).
        </p>
      )}
    </div>
  );
}
