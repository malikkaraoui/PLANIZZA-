import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Pizza, X, Star, MessageCircle } from 'lucide-react';
import TruckHeader from '../features/trucks/TruckHeader';
import { useTruck } from '../features/trucks/hooks/useTruck';
import { useReviews } from '../features/trucks/hooks/useReviews';
import { useMenu } from '../features/menu/hooks/useMenu';
import { useIngredients } from '../features/menu/hooks/useIngredients';
import MenuItemCard from '../features/menu/MenuItemCard';
import MenuPizzaTile from '../features/menu/MenuPizzaTile';
import CartSidebar from '../features/cart/CartSidebar';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { ROUTES } from '../app/routes';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { isCurrentlyOpen } from '../lib/openingHours';
import StickyCartBar from '../features/cart/StickyCartBar';
import BackButton from '../components/ui/BackButton';

export default function TruckDetails() {
  const { truckId: slugOrId } = useParams();
  const navigate = useNavigate();
  const { truck, loading: loadingTruck, error: truckError } = useTruck(slugOrId);
  const { items: menuItems, loading: loadingMenu } = useMenu(truck?.id);
  const { ingredients } = useIngredients(truck?.id);
  const { addItem, items: cartItems } = useCart();
  const { reviews } = useReviews(truck?.id, 5);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [openItemKey, setOpenItemKey] = useState(null);
  const truckCardRef = useRef(null);
  const [cartTopPx, setCartTopPx] = useState(112);

  useEffect(() => {
    const baseTop = 112; // aligné sous la topbar
    const updateTop = () => {
      const el = truckCardRef.current;
      if (!el) {
        setCartTopPx(baseTop);
        return;
      }

      const rect = el.getBoundingClientRect();
      const nextTop = Math.max(baseTop, Math.round(rect.top));
      setCartTopPx(nextTop);
    };

    // Initial: on attend que le DOM soit stable
    const initialUpdate = setTimeout(() => {
      updateTop();
    }, 0);

    // Puis un second recalcul après 100ms pour être sûr (images chargées, etc.)
    const delayedUpdate = setTimeout(() => {
      updateTop();
    }, 100);

    window.addEventListener('scroll', updateTop, { passive: true });
    window.addEventListener('resize', updateTop);

    let ro;
    try {
      ro = new ResizeObserver(updateTop);
      if (truckCardRef.current) {
        ro.observe(truckCardRef.current);
      }
    } catch {
      // noop
    }

    return () => {
      clearTimeout(initialUpdate);
      clearTimeout(delayedUpdate);
      window.removeEventListener('scroll', updateTop);
      window.removeEventListener('resize', updateTop);
      ro?.disconnect?.();
    };
  }, []);

  // Recalculer la position du panier quand les items changent (retour depuis /panier)
  useEffect(() => {
    if (cartItems.length === 0) return;
    
    const baseTop = 112;
    const updateTop = () => {
      const el = truckCardRef.current;
      if (!el) {
        setCartTopPx(baseTop);
        return;
      }
      const rect = el.getBoundingClientRect();
      const nextTop = Math.max(baseTop, Math.round(rect.top));
      setCartTopPx(nextTop);
    };

    // Petit délai pour laisser le DOM se stabiliser
    const timer = setTimeout(updateTop, 50);
    return () => clearTimeout(timer);
  }, [cartItems.length]);

  const formatShortAddress = (addr) => {
    if (!addr) return 'Adresse non renseignée';
    let parts = addr.split(',').map((p) => p.trim());
    // Retirer 'France' si présent en dernier
    if (parts.length > 1 && parts[parts.length - 1].toLowerCase() === 'france') {
      parts.pop();
    }
    // Si on a encore beaucoup de parties (format Google complet), 
    // on garde Numéro, Rue, Ville.
    if (parts.length >= 3) {
      return parts.slice(0, 3).join(', ');
    }
    return parts.join(', ');
  };

  const embeddedMenuItems = useMemo(() => {
    const raw = truck?.menu?.items;
    if (!raw || typeof raw !== 'object') return [];
    return Object.entries(raw).map(([id, item]) => ({ id, ...(item && typeof item === 'object' ? item : {}) }));
  }, [truck]);

  const effectiveMenuItems = (menuItems?.length ?? 0) > 0 ? menuItems : embeddedMenuItems;
  const hasEmbeddedMenu = embeddedMenuItems.length > 0;

  // IMPORTANT: si le camion contient déjà un menu embarqué, on ne bloque pas l'écran sur un listener RTDB menu.
  const isLoading = loadingTruck || (!hasEmbeddedMenu && loadingMenu);
  const isPaused = truck?.isPaused === true;
  const isOpen = isCurrentlyOpen(truck?.openingHours);
  const canOrder = isOpen && !isPaused;

  const hasMenu = useMemo(() => (effectiveMenuItems?.length ?? 0) > 0, [effectiveMenuItems]);

  const menuSections = useMemo(() => {
    const items = Array.isArray(effectiveMenuItems) ? effectiveMenuItems : [];

    const classify = (it) => {
      const t = String(it?.type || '').toLowerCase();
      switch (t) {
        case 'pizza':
        case 'calzone':
          return 'pizza';
        case 'soda':
        case 'eau':
        case 'biere':
        case 'vin':
          return 'boisson';
        case 'dessert':
          return 'dessert';
        default:
          return 'autres';
      }
    };

    const sectionOrder = ['pizza', 'boisson', 'dessert', 'autres'];
    const titles = {
      pizza: 'Pizza',
      boisson: 'Boisson',
      dessert: 'Dessert',
      autres: 'Autres',
    };

    const grouped = sectionOrder
      .map((key) => ({
        key,
        title: titles[key],
        items: items.filter((it) => it?.available !== false && classify(it) === key),
      }))
      .filter((section) => section.items.length > 0);

    return grouped;
  }, [effectiveMenuItems]);

  const handleCheckout = async () => {
    // Navigation MVP: passage par /cart puis /checkout
    navigate(ROUTES.cart, { state: { truckId: truck.id } });
  };

  return (
    <div className="relative isolate mx-auto max-w-[92rem] px-4 py-12 sm:px-6 lg:px-8 space-y-12">
      {/* Background decorations - Ultra Dynamic */}
      <div className="absolute top-0 right-0 -z-10 w-150 h-150 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 left-0 -z-10 w-100 h-100 bg-blue-500/10 rounded-full blur-[100px] animate-pulse duration-700" />

      <div
        className={`relative z-20 w-full mb-10 ${
          cartItems.length > 0
            ? 'lg:pr-[310px]'
            : 'lg:max-w-4xl lg:mx-auto'
        }`}
      >
        <BackButton />
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
      ) : truckError ? (
        <Card className="glass-premium glass-glossy py-24 text-center rounded-[48px] border-white/20 shadow-2xl">
          <CardContent className="space-y-6">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto text-4xl">
              ⚠️
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black tracking-tighter">Connexion au camion impossible</h2>
              <p className="text-muted-foreground font-medium">
                Un souci réseau empêche de récupérer les données en temps réel.
              </p>
              <p className="text-xs text-muted-foreground/70 font-mono break-all">
                {String(truckError?.message || truckError)}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button className="rounded-2xl px-8 h-12 font-black bg-primary" onClick={() => window.location.reload()}>
                RECHARGER
              </Button>
              <Button asChild variant="secondary" className="rounded-2xl px-8 h-12 font-black">
                <Link to={ROUTES.explore}>RETOURNER À L'EXPLORATION</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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
        <div className={`flex flex-col gap-8 transition-all duration-500 ${
          cartItems.length > 0
            ? 'lg:flex-row lg:pr-[310px]'
            : 'lg:max-w-4xl lg:mx-auto'
          }`}>
          <div className="flex-1 space-y-12">
            {/* Truck Info Section */}
            <div ref={truckCardRef} className="glass-premium glass-glossy p-2 rounded-[40px] shadow-2xl overflow-hidden border-white/20">
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
                  {reviews.length > 0 ? (
                    <button
                      onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                      className="font-black text-sm hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      {truck.ratingAvg ? truck.ratingAvg.toFixed(1) : 'N/A'}
                      {truck.ratingCount > 0 && (
                        <span className="text-muted-foreground/60 font-medium ml-1 hover:text-primary/60">({truck.ratingCount})</span>
                      )}
                    </button>
                  ) : (
                    <p className="font-black text-sm">
                      <Star className="h-4 w-4 text-muted-foreground/30 inline" /> N/A
                    </p>
                  )}
                </div>
              </div>

              {/* Emplacement */}
              {truck.location && (truck.location.address || (truck.location.lat && truck.location.lng)) && (
                <div className="px-6 sm:px-8 py-6 border-t border-white/10 bg-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-7 w-1.5 bg-primary/20 rounded-full" />
                    <h2 className="text-sm font-black tracking-widest uppercase">Emplacement</h2>
                  </div>

                  <div className="space-y-4">
                    {/* Info adresse - Cliquable */}
                    <button
                      onClick={() => setShowMap(!showMap)}
                      className="w-full flex items-start gap-4 p-5 rounded-[24px] glass-premium border-white/20 hover:border-primary/30 transition-all shadow-lg hover:shadow-xl group"
                    >
                      <div className="p-3 rounded-2xl glass-premium border-white/30 text-primary shadow-lg group-hover:scale-110 transition-transform">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="flex-1 text-left space-y-1">
                        <p className="font-black text-sm tracking-tight group-hover:text-primary transition-colors">
                          {formatShortAddress(truck.location.address)}
                        </p>
                        {truck.location.lat && truck.location.lng && (
                          <p className="text-xs text-muted-foreground/60 font-medium">
                            {showMap ? '👆 Cliquez pour réduire la carte' : '👉 Cliquez pour voir sur la carte'}
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Carte intégrée - Animée */}
                    {truck.location.lat && truck.location.lng && (
                      <div className={`grid transition-all duration-500 ease-in-out ${showMap ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="relative rounded-[24px] overflow-hidden shadow-2xl border-2 border-white/30">
                            <iframe
                              src={`https://www.google.com/maps?q=${truck.location.lat},${truck.location.lng}&hl=fr&z=16&output=embed`}
                              className="w-full h-100 border-0"
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              title="Emplacement du camion"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                        onClick={() => setZoomedImage(src)}
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
                          <div className="w-11 h-11 rounded-full glass-premium border-white/50 flex items-center justify-center text-white font-black text-xl">
                            🔍
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section Avis clients */}
            {reviews.length > 0 && (
              <section id="reviews-section" className="glass-premium glass-glossy p-6 sm:p-8 rounded-[40px] shadow-2xl border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-1.5 bg-amber-500/30 rounded-full" />
                    <h2 className="text-sm font-black tracking-widest uppercase">Avis clients</h2>
                    <span className="text-xs font-bold text-muted-foreground/60">({truck.ratingCount || reviews.length})</span>
                  </div>
                  {truck.ratingAvg > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      <span className="font-black text-sm">{truck.ratingAvg.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3.5 w-3.5 ${
                                star <= review.score
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-muted-foreground/20'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground/50">
                          {review.submittedAt
                            ? new Date(review.submittedAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                              })
                            : ''}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground/80 font-medium leading-relaxed">
                          "{review.comment}"
                        </p>
                      )}
                      {!review.comment && (
                        <p className="text-xs text-muted-foreground/40 italic">Aucun commentaire</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Menu Section */}
            <section className="space-y-12">
              <div className="flex items-center gap-4 px-2">
                <div className="h-10 w-2 bg-orange-500/20 rounded-full" />
                <h2 className="text-3xl font-black tracking-tighter uppercase text-gray-900 dark:text-white">La Carte du Chef</h2>
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
                  {!canOrder && (
                    <div className="p-8 text-center glass-premium border-amber-500/30 rounded-[32px] bg-amber-50/5">
                      {isPaused && (
                        <>
                          <p className="text-lg font-black text-amber-500 mb-2">☕ Pause en cours</p>
                          <p className="text-muted-foreground font-medium">
                            Le pizzaiolo prend un instant de repos. Les commandes sont temporairement suspendues.
                          </p>
                        </>
                      )}
                      {!isOpen && !isPaused && (
                        <>
                          <p className="text-lg font-black text-red-500 mb-2">🔒 Actuellement fermé</p>
                          <p className="text-muted-foreground font-medium">
                            Le camion est fermé. Consultez les horaires d'ouverture ci-dessus.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  {menuSections.map((section) => (
                    <div key={section.key} className="space-y-4">
                      <div className="flex items-center justify-between rounded-2xl border border-orange-500/30 bg-orange-500/5 px-4 py-3">
                        <h3 className="text-sm font-black tracking-widest uppercase text-gray-900 dark:text-white">
                          {section.title}
                        </h3>
                        <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                          {section.items.length}
                        </span>
                      </div>
                      <div className="grid gap-4 items-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {section.items.map((it, idx) => {
                          const type = String(it?.type || '').toLowerCase();
                          const isPizzaLike = type === 'pizza' || type === 'calzone';
                          const rawKey = it?.id ?? it?.menuId ?? it?.slug ?? it?.name ?? 'item';
                          const itemKey = `${section.key}-${String(rawKey)}-${idx}`;

                          if (isPizzaLike) {
                            return (
                              <MenuPizzaTile
                                key={itemKey}
                                item={it}
                                onAdd={(item) => addItem(item, { truckId: truck.id })}
                                isDisabled={!canOrder}
                                enableCustomization
                                availableIngredients={ingredients}
                                open={openItemKey === itemKey}
                                onToggle={() =>
                                  setOpenItemKey((prev) => (prev === itemKey ? null : itemKey))
                                }
                                onAutoClose={() => setOpenItemKey(null)}
                              />
                            );
                          }

                          return (
                            <MenuItemCard
                              key={itemKey}
                              item={it}
                              onAdd={(item) => addItem(item, { truckId: truck.id })}
                              isDisabled={!canOrder}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          {cartItems.length > 0 && (
            <aside
              className="hidden lg:block fixed right-[38px] w-[360px] z-40"
              style={{
                top: cartTopPx,
                bottom: 40,
                '--cart-top': `${cartTopPx}px`,
                '--cart-bottom-gap': '40px',
              }}
            >
              <div className="relative">
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-bounce shadow-lg border border-white/30 z-10" />
                <div className="animate-in slide-in-from-right-4 fade-in duration-500 ease-out">
                  <CartSidebar
                    onCheckout={handleCheckout}
                    disabled={!canOrder}
                    compact={cartItems.length === 1}
                  />
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Sidebar / Cart "Control Center" - géré dans le flux (sticky) */}

      {/* Modal de zoom pour les photos */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setZoomedImage(null)}
        >
          {/* Bouton fermer */}
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-6 right-6 z-10 w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-lg"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Image zoomée */}
          <div
            className="relative max-w-[95vw] max-h-[95vh] animate-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomedImage}
              alt="Photo du camion"
              className="max-w-full max-h-[95vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Mobile Sticky Cart Bar */}
      <StickyCartBar />
    </div>
  );
}
