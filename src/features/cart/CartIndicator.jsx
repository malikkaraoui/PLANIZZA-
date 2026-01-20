import { ShoppingBag } from 'lucide-react';

/**
 * Indicateur visuel pour montrer la position du panier
 * Affiché uniquement sur mobile/tablet quand le panier est vide
 */
export default function CartIndicator() {
    return (
        <div className="fixed top-20 left-4 z-40 lg:hidden animate-in slide-in-from-left-4 duration-500">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 text-white shadow-lg">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <ShoppingBag className="h-4 w-4 text-white/70" />
                <span className="text-xs font-medium text-white/80">Panier</span>
            </div>
        </div>
    );
}