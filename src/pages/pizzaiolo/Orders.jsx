import Card from '../../components/ui/Card';
import { useMyOrders } from '../../features/orders/hooks/useMyOrders';

export default function PizzaioloOrders() {
  const { orders, loading } = useMyOrders();

  return (
    <Card className="p-6">
      <h1 className="text-xl font-bold text-gray-900">Commandes</h1>
      <p className="mt-2 text-gray-600">
        MVP : lister les commandes payées avec un statut.
      </p>

      <div className="mt-4">
        {loading ? (
          <div className="text-gray-600">Chargement…</div>
        ) : orders.length === 0 ? (
          <div className="text-gray-600">Aucune commande pour le moment.</div>
        ) : (
          <pre className="text-xs bg-gray-50 border rounded p-3 overflow-auto">
            {JSON.stringify(orders, null, 2)}
          </pre>
        )}
      </div>
    </Card>
  );
}
