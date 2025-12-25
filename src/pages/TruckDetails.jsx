import { useMemo } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Pizza } from 'lucide-react';
import TruckHeader from '../features/trucks/TruckHeader';
import { useTruck } from '../features/trucks/hooks/useTruck';
import { useMenu } from '../features/menu/hooks/useMenu';
import MenuItemCard from '../features/menu/MenuItemCard';
import CartDrawer from '../features/cart/CartDrawer';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { ROUTES } from '../app/routes';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';

export default function TruckDetails() {
  const { truckId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { truck, loading: loadingTruck } = useTruck(truckId);
  const { items: menuItems, loading: loadingMenu } = useMenu(truckId);
  const { addItem, items } = useCart();

  const isLoading = loadingTruck || loadingMenu;

  const hasMenu = useMemo(() => (menuItems?.length ?? 0) > 0, [menuItems]);

  const handleBack = () => {
    // Comportement attendu: revenir à la page précédente (ex: /explore avec sa recherche)
    // Si on arrive directement sur /truck/:id (pas d'historique SPA), on fallback sur la dernière URL /explore mémorisée.
    if (location.key && location.key !== 'default') {
      navigate(-1);
      return;
    }

    try {
      const lastExploreUrl = localStorage.getItem('planizza.lastExploreUrl');
      if (lastExploreUrl) {
        navigate(lastExploreUrl);
        return;
      }
    } catch {
      // noop
    }

    navigate(ROUTES.explore);
  };

  const handleCheckout = async () => {
    // Navigation MVP: passage par /cart puis /checkout
    navigate(ROUTES.cart, { state: { truckId } });
  };

  return (
    <div className="relative isolate mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12 overflow-hidden">
      {/* Background decorations - Ultra Dynamic */}
      <div className="absolute top-0 right-0 -z-10 w-150 h-150 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 left-0 -z-10 w-100 h-100 bg-blue-500/10 rounded-full blur-[100px] animate-pulse duration-700" />

      <div className="relative z-10">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl glass-premium border-white/40 text-sm font-black tracking-widest uppercase hover:bg-white/10 transition-all text-muted-foreground hover:text-primary group shadow-lg"
        >
          <span className="translate-x-0 group-hover:-translate-x-1 transition-transform">←</span>
          Retour aux camions
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-[60vh] flex-col items-center justify-center space-y-6">
          <div className="p-8 rounded-[40px] glass-premium glass-glossy shadow-2xl animate-bounce-subtle">
            <Pizza className="h-16 w-16 text-primary animate-spin" />
          </div>
          <div className="font-black tracking-[0.3em] text-primary/60 uppercase text-xs animate-pulse">
            Préparation de votre escale...
          </div>
        </div>
      ) : !truck ? (
        <Card className="glass-premium glass-glossy py-32 text-center rounded-[48px] border-white/20 shadow-2xl">
          <CardContent className="space-y-8">
            <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mx-auto text-5xl">
              🚫
            </div>
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tighter">Camion Introuvable</h2>
              <p className="text-muted-foreground font-medium">Ce pizzaiolo a peut-être changé sa route.</p>
            </div>
            <Button asChild className="rounded-2xl px-10 h-14 font-black bg-primary">
              <Link to={ROUTES.explore}>RETOURNER À L'EXPLORATION</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-12 items-start lg:grid-cols-[1fr_400px] lg:grid-rows-[auto_1fr]">
          {/* Truck Info Section */}
          <div className="lg:col-start-1 lg:row-start-1">
            <div className="glass-premium glass-glossy p-2 rounded-[40px] shadow-2xl overflow-hidden border-white/20">
              <TruckHeader truck={truck} />

              {/* Custom Detail Strip */}
              <div className="px-6 sm:px-8 py-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-5 bg-white/5">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">Temps d'attente</span>
                  <p className="font-black text-sm">{typeof truck.estimatedPrepMin === 'number' ? `~${Math.round(truck.estimatedPrepMin)} min` : '~15-20 min'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">Type</span>
                  <p className="font-black text-sm">{truck.ovenType ? `Four ${truck.ovenType}` : 'Four'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">Certifié</span>
                  <p className="font-black text-sm text-emerald-500">Qualité Premium</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">Note Globale</span>
                  <p className="font-black text-sm">⭐️ {truck.ratingAvg?.toFixed(1) || 'N/A'}</p>
                </div>
              </div>

              {/* Gallery (dans le même encart, sous les infos) */}
              {Array.isArray(truck.photos) && truck.photos.length > 0 && (
                <div className="px-6 sm:px-8 py-6 border-t border-white/10 bg-white/5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-1.5 bg-primary/20 rounded-full" />
                      <h2 className="text-sm font-black tracking-widest uppercase">Galerie photo</h2>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground/60">
                      {truck.photos.length} photo{truck.photos.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="mt-5 flex gap-5 overflow-x-auto pb-2 custom-scrollbar snap-x snap-mandatory">
                    {truck.photos.slice(0, 8).map((src, idx) => (
                      <div
                        key={src + idx}
                        className="group relative snap-start shrink-0 w-60 sm:w-70 aspect-16/10 overflow-hidden rounded-[28px] glass-premium border-white/40 shadow-lg cursor-zoom-in transition-all duration-500 hover:scale-[1.02] hover:shadow-xl"
                      >
                        <img
                          src={src}
                          alt={`Photo ${idx + 1} de ${truck.name}`}
                          className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-linear-to-tr from-primary/10 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="w-11 h-11 rounded-full glass-premium border-white/50 flex items-center justify-center text-white font-black">
                            +
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar / Sidebar "Control Center" */}
          <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-32 h-fit space-y-8 animate-in slide-in-from-right-8 duration-700">
            <CartDrawer onCheckout={handleCheckout} />

            {items.length > 0 && (
              <div className="glass-premium p-6 rounded-[24px] border-primary/20 text-center space-y-4 shadow-xl">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">
                    Paiement Sécurisé
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    Paiement via Apple Pay, Google Pay ou Carte Bancaire.
                  </p>
                </div>
                <div className="flex justify-center gap-2">
                  <div className="h-1 w-8 bg-primary/20 rounded-full" />
                  <div className="h-1 w-4 bg-primary/40 rounded-full" />
                </div>
              </div>
            )}
          </aside>

          {/* Menu Section */}
          <section className="lg:col-start-1 lg:row-start-2 space-y-8 pb-32">
            <div className="flex items-center gap-4 px-2">
              <div className="h-10 w-2 bg-orange-500/20 rounded-full" />
              <h2 className="text-3xl font-black tracking-tighter uppercase">La Carte du Chef</h2>
            </div>
            {!hasMenu ? (
              <div className="p-20 text-center glass-premium border-dashed border-white/20 rounded-[40px]">
                <p className="text-muted-foreground font-black italic text-lg tracking-tight">
                  Le menu de ce camion est en cours de mise à jour... <br />
                  Revenez dans quelques minutes !
                </p>
              </div>
            ) : (
              <div className="grid gap-8">
                {menuItems.map((it) => (
                  <MenuItemCard
                    key={it.id}
                    item={it}
                    onAdd={(item) => addItem(item, { truckId })}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
