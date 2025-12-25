import { Link } from 'react-router-dom';
import { ShoppingCart, User, ChefHat, Pizza } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useAuth } from '../../app/providers/AuthProvider';
import { ROUTES } from '../../app/routes';
import { useCart } from '../../features/cart/hooks/useCart.jsx';

export default function Navbar() {
  const { isAuthenticated, user } = useAuth();
  const { items } = useCart();

  const cartItemsCount = items.reduce((sum, item) => sum + (item.qty || 0), 0);
  const cartHasItems = cartItemsCount > 0;

  return (
    <header className="sticky top-0 z-50 flex justify-center w-full pointer-events-none">
      <div className="container max-w-7xl w-full px-4 sm:px-6 lg:px-8 pointer-events-auto">
        <div className="floating-island w-full h-20 items-center justify-between flex px-8 transition-transform duration-500 hover:scale-[1.01]">
          {/* Logo */}
          <Link
            to={ROUTES.explore}
            className="flex items-center gap-3 font-black text-2xl tracking-tighter group"
          >
            <div className="relative grid place-items-center h-11 w-11 rounded-full">
              {/* Halo circulaire (évite le carré visible sur Safari/Chrome) */}
              <div className="absolute inset-0 rounded-full bg-primary blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
              <Pizza className="relative h-7 w-7 text-primary animate-bounce-subtle" />
            </div>
            <span className="hidden sm:inline text-premium-gradient">PLANIZZA</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-2 sm:gap-6">
            {/* Panier */}
            <Link to={ROUTES.cart}>
              <Button variant="ghost" size="icon" className="relative group/cart h-12 w-12 rounded-full hover:bg-white/10 transition-all">
                <ShoppingCart
                  className={`h-6 w-6 transition-transform group-hover/cart:-rotate-12 ${cartHasItems ? 'text-primary' : 'text-muted-foreground/70'}`}
                />
                {cartHasItems && (
                  <Badge
                    className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center bg-primary text-white border-2 border-white/20 shadow-lg shadow-primary/40 animate-in zoom-in"
                  >
                    {cartItemsCount}
                  </Badge>
                )}
                <span className="sr-only">Panier</span>
              </Button>
            </Link>

            {/* Devenir partenaire */}
            <Link to={ROUTES.becomePartner} className="hidden lg:block">
              <Button variant="outline" className="gap-2 glass-premium border-white/20 hover:border-primary/50 rounded-full px-8 h-11 font-bold transition-all hover:shadow-lg hover:shadow-primary/5">
                <ChefHat className="h-4 w-4 text-primary" />
                Professionnel
              </Button>
            </Link>

            {/* Compte utilisateur */}
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-3 h-12 rounded-full pl-2 pr-5 transition-all group hover:bg-white/10">
                    <Avatar className="h-9 w-9 border-2 border-white/40 shadow-xl group-hover:scale-110 transition-transform">
                      <AvatarImage src={user.photoURL} alt={user.displayName || 'User'} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                        {user.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline text-sm font-black tracking-tight">{user.displayName || 'Mon compte'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 glass-deep border-white/20 p-2 mt-4 rounded-3xl shadow-2xl animate-in slide-in-from-top-2">
                  <DropdownMenuLabel className="px-5 py-4">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-black">{user.displayName || 'Utilisateur'}</p>
                      <p className="text-xs text-muted-foreground font-medium opacity-60">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10 mx-5" />
                  <DropdownMenuItem asChild>
                    <Link to={ROUTES.account} className="flex items-center gap-3 px-5 py-3 rounded-2xl hover:bg-primary/10 cursor-pointer transition-colors font-bold m-1">
                      <User className="h-4 w-4 text-primary" />
                      Profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={ROUTES.myOrders} className="flex items-center gap-3 px-5 py-3 rounded-2xl hover:bg-primary/10 cursor-pointer transition-colors font-bold m-1">
                      <ShoppingCart className="h-4 w-4 text-primary" />
                      Commandes
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to={ROUTES.login}>
                <Button className="h-11 rounded-full bg-linear-to-r from-primary to-orange-500 shadow-xl shadow-primary/20 hover:shadow-primary/40 px-8 font-black transition-all hover:scale-105 active:scale-95">
                  <User className="mr-2 h-4 w-4" />
                  Connexion
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
