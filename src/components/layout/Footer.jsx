import { Pizza } from 'lucide-react';
import { ROUTES } from '../../app/routes';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="glass-border border-t bg-white/20 backdrop-blur-md mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tighter">
            <Pizza className="h-6 w-6 text-primary" />
            <span className="text-gradient">PLANIZZA</span>
          </div>

          <div className="flex gap-8 text-sm font-medium text-muted-foreground">
            <Link to={ROUTES.explore} className="hover:text-primary transition-colors">Explorer</Link>
            <Link to={ROUTES.becomePartner} className="hover:text-primary transition-colors">Devenir Partenaire</Link>
          </div>

          <div className="text-sm text-muted-foreground opacity-70">
            © {new Date().getFullYear()} PLANIZZA — Crafted with 🍕
          </div>
        </div>
      </div>
    </footer>
  );
}
