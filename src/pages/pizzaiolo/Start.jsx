import { Link } from 'react-router-dom';
import { ROUTES } from '../../app/routes';

export default function PizzaioloStart() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Espace pizzaiolo</h1>
      <p className="mt-2 text-sm text-gray-600">
        MVP navigation : point d’entrée /pizzaiolo/start.
      </p>

      <div className="mt-6 flex gap-3">
        <Link to={ROUTES.pizzaioloDashboard} className="underline text-sm">
          Accéder au dashboard
        </Link>
        <Link to={ROUTES.explore} className="underline text-sm">
          Retour explorer
        </Link>
      </div>
    </div>
  );
}
