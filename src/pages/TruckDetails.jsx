import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import TruckHeader from '../features/trucks/TruckHeader';
import { useTruck } from '../features/trucks/hooks/useTruck';
import { useMenu } from '../features/menu/hooks/useMenu';
import MenuItemCard from '../features/menu/MenuItemCard';
import CartDrawer from '../features/cart/CartDrawer';
import { useCart } from '../features/cart/hooks/useCart.jsx';

export default function TruckDetails() {
  const { truckId } = useParams();
  const { truck, loading: loadingTruck } = useTruck(truckId);
  const { items: menuItems, loading: loadingMenu } = useMenu(truckId);
  const { addItem, items } = useCart();

  const isLoading = loadingTruck || loadingMenu;

  const hasMenu = useMemo(() => (menuItems?.length ?? 0) > 0, [menuItems]);

  const handleCheckout = async () => {
    // MVP: on redirige vers /pricing (où Stripe est déjà câblé) en attendant l’ordre réel.
    // TODO: créer une commande + appeler Function createCheckoutSession avec line_items
    window.location.href = '/pricing';
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <Link to="/trucks" className="text-sm text-gray-600 hover:underline">
          ← Retour à la liste
        </Link>
      </div>

      {isLoading ? (
        <div className="text-gray-600">Chargement…</div>
      ) : !truck ? (
        <div className="text-gray-600">Camion introuvable.</div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <TruckHeader truck={truck} />

            {Array.isArray(truck.photos) && truck.photos.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-gray-900">Photos</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {truck.photos.slice(0, 4).map((src, idx) => (
                    <div key={src + idx} className="overflow-hidden rounded-xl border bg-white">
                      <img
                        src={src}
                        alt={`Photo ${idx + 1} de ${truck.name}`}
                        className="h-48 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-gray-900">Menu</h2>
              {!hasMenu ? (
                <div className="text-gray-600">Menu indisponible.</div>
              ) : (
                <div className="grid gap-3">
                  {menuItems.map((it) => (
                    <MenuItemCard key={it.id} item={it} onAdd={addItem} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-6 h-fit">
            <CartDrawer onCheckout={handleCheckout} />
            {items.length > 0 && (
              <p className="mt-3 text-xs text-gray-500">
                MVP : le checkout réel sera déclenché via Firebase Functions.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
