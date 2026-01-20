import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCart } from './hooks/useCart';
import { ROUTES } from '../../app/routes';

function formatEUR(cents) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function StickyCartBar() {
    const { items, totalCents } = useCart();
    const navigate = useNavigate();

    if (items.length === 0) return null;

    const totalItems = items.reduce((acc, item) => acc + (item.qty || 1), 0);

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 lg:hidden animate-in slide-in-from-bottom-4 duration-500">
            <div className="relative">
                {/* Indicateur d'attention */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse border-2 border-white" />
                
                <Button
                    onClick={() => navigate(ROUTES.cart)}
                    className="w-full h-16 rounded-2xl bg-black text-white shadow-2xl flex items-center justify-between px-6 hover:scale-[1.02] active:scale-95 transition-all border-2 border-primary/20"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/30 p-2.5 rounded-full border border-primary/40">
                            <ShoppingBag className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-xs font-medium text-white/80 uppercase tracking-wider">Mon Panier</span>
                            <span className="text-sm font-bold">{totalItems} article{totalItems > 1 ? 's' : ''}</span>
                        </div>
                    </div>

                    <div className="text-lg font-black tracking-tight text-primary-foreground">
                        {formatEUR(totalCents)}
                    </div>
                </Button>
            </div>
        </div>
    );
}
