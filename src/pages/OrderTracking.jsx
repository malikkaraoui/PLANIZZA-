import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '../app/routes';

export default function OrderTracking() {
  const { orderId } = useParams();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Suivi de commande</h1>
      <p className="mt-2 text-sm text-gray-600">
        MVP navigation : page /order/:orderId.
      </p>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="text-sm text-gray-700">
          <span className="font-semibold">OrderId:</span> {orderId}
        </div>
      </div>

      <div className="mt-6">
        <Link to={ROUTES.explore} className="text-sm text-gray-700 underline">
          Revenir à l’exploration
        </Link>
      </div>
    </div>
  );
}
