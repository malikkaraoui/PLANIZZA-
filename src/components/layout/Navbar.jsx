import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import { useAuth } from '../../app/providers/AuthProvider';
import { ROUTES } from '../../app/routes';
import { useCart } from '../../features/cart/hooks/useCart.jsx';

export default function Navbar() {
  const { isAuthenticated, user } = useAuth();
  const { items } = useCart();

  const accountHref = isAuthenticated ? ROUTES.account : ROUTES.login;

  return (
    <header className="sticky top-0 z-50 border-b bg-white/85 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <Link to={ROUTES.explore} className="font-extrabold tracking-tight text-gray-900">
            PLANIZZA
          </Link>
          <span className="text-sm font-semibold text-gray-700">camion à pizza</span>
        </div>

        <div className="flex-1" />

        <nav className="flex items-center gap-2">

          {items.length > 0 && (
            <Link to={ROUTES.cart}>
              <Button variant="outline">Panier</Button>
            </Link>
          )}

          <Link to={ROUTES.becomePartner}>
            <Button variant="outline">Je suis un professionnel</Button>
          </Link>

          <Link to={accountHref}>
            <Button>{isAuthenticated ? (user?.email ? 'Mon compte' : 'Mon compte') : 'Mon compte'}</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
