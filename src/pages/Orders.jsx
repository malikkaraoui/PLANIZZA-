import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { useAuth } from '../app/providers/AuthProvider';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const ordersRef = query(ref(db, 'orders'), orderByChild('userUid'), equalTo(user.uid));
    const unsub = onValue(
      ordersRef,
      (snap) => {
        if (!snap.exists()) {
          setOrders([]);
        } else {
          const data = [];
          snap.forEach((child) => {
            data.push({ id: child.key, ...child.val() });
          });
          data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setOrders(data.slice(0, 5));
        }
        setLoading(false);
      },
      (err) => {
        console.error('Erreur lecture commandes:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-4">Connexion requise</h1>
          <Link to="/login" className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold">Se connecter</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-white text-xl animate-pulse">Chargement...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter((order) => {
    if (filter === 'active') return ['created', 'received', 'prep', 'cooking'].includes(order.status);
    if (filter === 'completed') return ['ready', 'cancelled'].includes(order.status);
    return true;
  });

  const statusLabels = {
    created: 'En attente', received: 'Reçue', prep: 'En préparation',
    cooking: 'En cuisson', ready: 'Prête', cancelled: 'Annulée',
  };

  const statusColors = {
    created: 'bg-gray-500', received: 'bg-blue-500', prep: 'bg-yellow-500',
    cooking: 'bg-orange-500', ready: 'bg-emerald-500', cancelled: 'bg-red-500',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Mes commandes</h1>
        </div>

        <div className="flex gap-3 mb-8">
          {['all', 'active', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl font-semibold ${filter === f ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20 border border-white/20'}`}
            >
              {f === 'all' ? `Toutes (${orders.length})` : f === 'active' ? `En cours (${orders.filter(o => ['created','received','prep','cooking'].includes(o.status)).length})` : `Terminées (${orders.filter(o => ['ready','cancelled'].includes(o.status)).length})`}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🍕</div>
            <h2 className="text-2xl font-bold text-white mb-2">Aucune commande</h2>
            <Link to="/trucks" className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold">Explorer</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Link key={order.id} to={`/order/${order.id}`} className="block bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 hover:bg-white/15 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">Commande #{order.id.slice(0, 8)}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${statusColors[order.status] || 'bg-gray-500'}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Date inconnue'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{((order.totalCents || 0) / 100).toFixed(2)} €</p>
                    <p className="text-gray-400 text-sm">{order.items?.length || 0} article(s)</p>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-gray-300 text-sm">{order.items?.map(item => `${item.qty}x ${item.name}`).join(', ')}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {order.paidAt && <span className="text-emerald-400">✓ Payé</span>}
                  </div>
                  <span className="text-emerald-400 font-semibold text-sm">Voir le suivi →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
