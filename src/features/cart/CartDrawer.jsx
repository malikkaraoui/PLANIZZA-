import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ShoppingBag, Trash2, Pizza } from 'lucide-react';
import { useCart } from './hooks/useCart.jsx';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function CartDrawer({ onCheckout }) {
  const { items, removeItem, totalCents } = useCart();

  return (
    <Card className="glass-premium glass-glossy p-8 rounded-[40px] border-white/30 space-y-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 -z-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />

      <div className="flex items-center gap-4 pb-6 border-b border-white/10">
        <div className="p-3 rounded-2xl glass-premium border-white/30 text-primary shadow-lg">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <div className="space-y-0.5">
          <div className="font-black text-2xl tracking-tighter uppercase">Panier</div>
          <div className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">{items.length} SELECTA</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-12 text-center space-y-4">
          <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Pizza className="h-10 w-10 text-primary/20 animate-pulse" />
          </div>
          <div className="text-sm font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Votre panier est vide</div>
          <p className="text-xs font-medium text-muted-foreground/60 max-w-[200px] mx-auto">Ajoutez une création artisanale pour commencer l'aventure.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[440px] overflow-y-auto pr-2 custom-scrollbar">
          {items.map((it) => (
            <div key={it.id} className="group flex items-center justify-between gap-5 p-4 rounded-[24px] glass-premium hover:bg-white/10 transition-all border-white/10 shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="font-black text-sm tracking-tight truncate group-hover:text-primary transition-colors">
                  {it.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="h-5 px-1.5 rounded-md border-white/10 bg-white/5 text-[9px] font-black text-primary/80">
                    ×{it.qty}
                  </Badge>
                  <span className="text-xs font-bold text-muted-foreground/60">{formatEUR(it.priceCents * it.qty)}</span>
                </div>
              </div>
              <button
                className="p-2.5 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all transform scale-90 group-hover:scale-100"
                onClick={() => removeItem(it.id)}
                title="Retirer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-6 pt-6 border-t border-white/10">
        <div className="flex items-center justify-between px-2">
          <div className="space-y-0.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Total Premium</div>
            <div className="text-xs font-bold text-muted-foreground/40 italic">TVA incluse</div>
          </div>
          <div className="text-3xl font-black text-premium-gradient tracking-tighter">{formatEUR(totalCents)}</div>
        </div>

        <Button
          className="w-full h-16 rounded-[24px] bg-linear-to-r from-primary to-orange-500 hover:shadow-2xl hover:shadow-primary/40 transition-all text-sm font-black tracking-widest uppercase gap-3 disabled:opacity-20 relative overflow-hidden group"
          onClick={onCheckout}
          disabled={items.length === 0}
        >
          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          <span className="relative z-10">Valider la commande</span>
          <div className="relative z-10 p-1.5 rounded-full bg-white/20">
            <ShoppingBag className="h-4 w-4" />
          </div>
        </Button>
      </div>
    </Card>
  );
}
