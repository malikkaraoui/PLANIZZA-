import { Link } from 'react-router-dom';
import { Home, Pizza, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../app/routes';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      {/* Illustration */}
      <div className="relative mb-8">
        <div className="text-[150px] font-black text-gray-100 leading-none select-none">
          404
        </div>
        <Pizza className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-24 w-24 text-primary opacity-80" />
      </div>

      {/* Message */}
      <h1 className="text-3xl font-black tracking-tight text-gray-900 mb-3">
        Page introuvable
      </h1>
      <p className="text-muted-foreground max-w-md mb-8">
        Oups ! Cette page n'existe pas ou a été déplacée.
        Peut-être cherchiez-vous une pizza ?
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link to={ROUTES.explore}>
          <Button className="gap-2 rounded-2xl px-6">
            <Home className="h-4 w-4" />
            Explorer les camions
          </Button>
        </Link>
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="gap-2 rounded-2xl px-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
      </div>
    </div>
  );
}
