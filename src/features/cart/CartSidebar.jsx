import { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingBag, Pizza, Trash2, Minus, Plus, ChevronDown } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useCart } from './hooks/useCart.jsx';
import { buildCartSections } from './utils/cartSections';
import { formatCartItemName } from './utils/formatCartItemName';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

function isPizzaLikeCartItem(it) {
  const t = String(it?.type || '').toLowerCase();
  return t === 'pizza' || t === 'calzone';
}

/**
 * Composant sidebar de panier réutilisable
 * Peut être utilisé en mode sticky (TruckDetails) ou inline (Checkout)
 */
export default function CartSidebar({
  onCheckout,
  disabled = false,
  checkoutButtonText = "Valider la commande",
  showCheckoutButton = true,
  showPaymentInfo = true,
  compact = false,
  className = ""
}) {
  const { items, removeItem, updateItemQty, totalCents } = useCart();
  const sections = useMemo(() => buildCartSections(items), [items]);

  const scrollRef = useRef(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const compute = () => {
      // +1 pour éviter les faux positifs liés aux arrondis
      const scrollable = el.scrollHeight > el.clientHeight + 1;
      setIsScrollable(scrollable);

      if (!scrollable) {
        setAtTop(true);
        setAtBottom(true);
        return;
      }

      const top = el.scrollTop <= 1;
      const bottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      setAtTop(top);
      setAtBottom(bottom);
    };

    compute();

    // Recalc si le contenu/tailles changent
    let ro;
    try {
      ro = new ResizeObserver(compute);
      ro.observe(el);
    } catch {
      // noop (fallback: window resize)
    }

    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('resize', compute);
      ro?.disconnect?.();
    };
  }, [items.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (!isScrollable) return;

    const top = el.scrollTop <= 1;
    const bottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    setAtTop(top);
    setAtBottom(bottom);
  };

  const headerPadding = compact ? 'p-6 pb-4' : 'p-8 pb-6';
  const headerIconSize = compact ? 'h-5 w-5' : 'h-6 w-6';
  const headerIconWrap = compact ? 'p-2.5 rounded-2xl' : 'p-3 rounded-2xl';
  const headerTitleClass = compact ? 'text-xl' : 'text-2xl';

  const bodyXPadding = compact ? 'px-6' : 'px-8';
  const bodyYPadding = compact ? 'py-5 pb-8' : 'py-6 pb-10';

  const footerPadding = compact ? 'p-6 pt-4 space-y-4' : 'p-8 pt-6 space-y-6';
  const totalClass = compact ? 'text-2xl' : 'text-3xl';
  const ctaHeight = compact ? 'h-14 rounded-[22px]' : 'h-16 rounded-[24px]';
  const ctaText = compact ? 'text-xs' : 'text-sm';
  const scrollGutterRight = compact ? 'pr-3' : 'pr-4';

  // Hauteur max = viewport - top dynamique - blanc bas
  const maxCardHeight = 'calc(100vh - var(--cart-top, 112px) - var(--cart-bottom-gap, 40px))';

  return (
    <Card
      style={{ maxHeight: maxCardHeight }}
      className={`glass-premium glass-glossy rounded-[32px] border-white/30 shadow-xl relative overflow-hidden flex flex-col transition-all duration-300 ${className}`}>
      <div className="absolute top-0 right-0 -z-10 w-24 h-24 bg-primary/8 rounded-full blur-2xl" />

      {/* Header panier - fixe */}
      <div className={`flex items-center gap-4 border-b border-white/10 ${headerPadding}`}>
        <div className={`${headerIconWrap} glass-premium border-white/30 text-primary shadow-lg`}>
          <ShoppingBag className={headerIconSize} />
        </div>
        <div className={`font-black tracking-tighter uppercase ${headerTitleClass}`}>Panier</div>
      </div>

      {/* Contenu scrollable */}
      {/* NOTE: en flex-col, il faut min-h-0 sur la zone scrollable sinon elle pousse le footer hors de la Card. */}
      <div className="relative flex-1 min-h-0 w-full flex flex-col">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={`flex-1 overflow-y-auto custom-scrollbar ${bodyXPadding} ${bodyYPadding} ${scrollGutterRight}`}
        >
          {items.length === 0 ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Pizza className="h-10 w-10 text-primary/20 animate-pulse" />
              </div>
              <div className="text-sm font-black text-muted-foreground/40 uppercase tracking-[0.2em]">
                Votre panier est vide
              </div>
              <p className="text-xs font-medium text-muted-foreground/60 max-w-50 mx-auto">
                Ajoutez une création artisanale pour commencer l'aventure.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {sections.map((section) => (
                <div key={section.key} className="space-y-2">
                  <div className="px-1 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/50">
                    {section.label}
                  </div>

                  <div className="space-y-3">
                    {section.items.map((it) => (
                      <div
                        key={it.id}
                        className="group flex items-center justify-between gap-3 p-3 rounded-[24px] glass-premium hover:bg-white/10 transition-all border-white/10 shadow-sm relative overflow-hidden"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-sm tracking-tight truncate group-hover:text-primary transition-colors pr-8">
                            {formatCartItemName(it.name)}
                          </div>

                          {isPizzaLikeCartItem(it) && it.description && (
                            <div className="mt-1 text-[11px] font-medium text-muted-foreground/70 line-clamp-2 pr-8">
                              {it.description}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1.5 p-1 rounded-xl glass-deep border-white/10">
                              <button
                                className={`p-1.5 rounded-lg transition-colors ${it.qty > 1
                                  ? 'hover:bg-white/10 text-muted-foreground/60 cursor-pointer'
                                  : 'text-transparent pointer-events-none'
                                  }`}
                                onClick={() => it.qty > 1 && updateItemQty(it.id, it.qty - 1)}
                                disabled={it.qty === 1}
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-xs font-black">{it.qty}</span>
                              <button
                                className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground/60 transition-colors"
                                onClick={() => updateItemQty(it.id, it.qty + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-xs font-black text-primary/80 tracking-tight">
                              {formatEUR(it.priceCents * it.qty)}
                            </span>
                          </div>
                        </div>
                        <button
                          className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
                          onClick={() => removeItem(it.id)}
                          title="Retirer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Indication persistante : fondu (liquid glass) quand du contenu est hors champ */}
        {items.length > 0 && isScrollable && !atTop && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-10 z-10">
            <div className="absolute inset-0 bg-linear-to-b from-background/80 via-background/35 to-transparent backdrop-blur-[2px]" />
          </div>
        )}

        {items.length > 0 && isScrollable && !atBottom && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-14 z-10 border-b-[24px] border-transparent">
            <div className="absolute inset-0 bg-linear-to-t from-background/80 via-background/35 to-transparent backdrop-blur-[2px]" />
            {/* Petit hint ultra discret, toujours présent tant qu'il reste du contenu dessous */}
            <div className="absolute inset-x-0 bottom-1.5 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full glass-premium border-white/10 px-3 py-1.5 shadow-lg">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">
                  Plus d'articles
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground/60 animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer avec total + bouton - fixe */}
      {items.length > 0 && showCheckoutButton && (
        <div className={`relative z-20 border-t border-white/10 ${footerPadding}`}>
          {/* Total + Bouton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                  Total Premium
                </div>
                <div className="text-xs font-bold text-muted-foreground/40 italic">TVA incluse</div>
              </div>
              <div className={`${totalClass} font-black text-premium-gradient tracking-tighter`}>
                {formatEUR(totalCents)}
              </div>
            </div>

            <Button
              className={`w-full ${ctaHeight} bg-linear-to-r from-primary to-orange-500 hover:shadow-2xl hover:shadow-primary/40 transition-all ${ctaText} font-black tracking-widest uppercase gap-3 disabled:opacity-20 relative overflow-hidden group`}
              onClick={onCheckout}
              disabled={disabled}
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              <span className="relative z-10">{checkoutButtonText}</span>
              <div className="relative z-10 p-1.5 rounded-full bg-white/20">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
