import { Link } from 'react-router-dom';
import { ShoppingCart, User, ChefHat, Pizza } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
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

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link 
            to={ROUTES.explore} 
            className="flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-80 transition-opacity"
          >
            <Pizza className="h-6 w-6 text-primary" />
            <span className="hidden sm:inline">PLANIZZA</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-2 sm:gap-4">
            {/* Panier */}
            <Link to={ROUTES.cart}>
              <Button variant="ghost" size="sm" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {cartItemsCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -right-2 -top-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                  >
                    {cartItemsCount}
                  </Badge>
                )}
                <span className="sr-only">Panier</span>
              </Button>
            </Link>

            {/* Devenir partenaire */}
            <Link to={ROUTES.becomePartner} className="hidden sm:block">
              <Button variant="outline" size="sm" className="gap-2">
                <ChefHat className="h-4 w-4" />
                Professionnel
              </Button>
            </Link>

            {/* Compte utilisateur */}
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.photoURL} alt={user.displayName || 'User'} />
                      <AvatarFallback>
                        {user.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline text-sm">{user.displayName || 'Mon compte'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user.displayName || 'Utilisateur'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={ROUTES.account} className="cursor-pointer">
                      Mon compte
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={ROUTES.myOrders} className="cursor-pointer">
                      Mes commandes
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to={ROUTES.login}>
                <Button size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Connexion</span>
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
