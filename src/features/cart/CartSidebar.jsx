import { ShoppingBag, Pizza, Trash2, Minus, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useCart } from './hooks/useCart.jsx';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
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
  className = ""
}) {
  const { items, removeItem, updateItemQty, totalCents } = useCart();

  return (
    <Card className={`glass-premium glass-glossy rounded-[40px] border-white/30 shadow-2xl relative overflow-hidden h-full flex flex-col ${className}`}>
      <div className="absolute top-0 right-0 -z-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />

      {/* Header panier - fixe */}
      <div className="flex items-center gap-4 pb-6 border-b border-white/10 p-8">
        <div className="p-3 rounded-2xl glass-premium border-white/30 text-primary shadow-lg">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <div className="space-y-0.5">
          <div className="font-black text-2xl tracking-tighter uppercase">Panier</div>
          <div className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">
            {items.length} SELECTA
          </div>
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8">
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
          <div className="space-y-4 py-6">
            {items.map((it) => (
              <div
                key={it.id}
                className="group flex items-center justify-between gap-4 p-4 rounded-[28px] glass-premium hover:bg-white/10 transition-all border-white/10 shadow-sm relative overflow-hidden"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm tracking-tight truncate group-hover:text-primary transition-colors pr-8">
                    {it.name}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5 p-1 rounded-xl glass-deep border-white/10">
                      {it.qty > 1 && (
                        <button
                          className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground/60 transition-colors"
                          onClick={() => updateItemQty(it.id, it.qty - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      )}
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
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                  onClick={() => removeItem(it.id)}
                  title="Retirer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer avec total + bouton - fixe */}
      {items.length > 0 && showCheckoutButton && (
        <div className="border-t border-white/10 p-8 pt-6 space-y-6">
          {/* Info paiement sécurisé */}
          <div className="text-center space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">
              Paiement Sécurisé
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              Apple Pay, Google Pay ou CB
            </p>
          </div>

          {/* Total + Bouton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                  Total Premium
                </div>
                <div className="text-xs font-bold text-muted-foreground/40 italic">TVA incluse</div>
              </div>
              <div className="text-3xl font-black text-premium-gradient tracking-tighter">
                {formatEUR(totalCents)}
              </div>
            </div>

            <Button
              className="w-full h-16 rounded-[24px] bg-linear-to-r from-primary to-orange-500 hover:shadow-2xl hover:shadow-primary/40 transition-all text-sm font-black tracking-widest uppercase gap-3 disabled:opacity-20 relative overflow-hidden group"
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
