import { Link } from 'react-router-dom';
import { ROUTES } from '../app/routes';

export default function Orders() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Mes commandes</h1>
      <p className="mt-2 text-sm text-gray-600">
        MVP navigation : page /orders. Le listing RTDB sera branché ensuite.
      </p>

      <div className="mt-6">
        <Link to={ROUTES.explore} className="underline text-sm">
          Explorer les camions
        </Link>
      </div>
    </div>
  );
}
