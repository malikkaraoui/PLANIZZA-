import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { useAuth } from '../app/providers/AuthProvider';

export default function Orders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!user) {
      // Évite un setState synchrone dans le corps de l'effet (règle ESLint)
      const t = setTimeout(() => {
        setLoading(false);
      }, 0);
      return () => clearTimeout(t);
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
            const order = { id: child.key, ...child.val() };
            
            // ✅ FILTRER : Ne garder que les commandes VRAIMENT PAYÉES
            // Exclure les commandes non payées (created ou pending sans confirmation)
            if (order.status === 'created') return;
            if (order.payment?.paymentStatus === 'pending' && order.status !== 'received') return;
            if (order.payment?.paymentStatus !== 'paid' && !['received', 'accepted', 'delivered'].includes(order.status)) return;
            
            data.push(order);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Connexion requise</h1>
          <Link to="/login" className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold shadow-sm">Se connecter</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-gray-900 text-xl animate-pulse">Chargement...</div>
      </div>
    );
  }

  const filteredOrders = orders.filter((order) => {
    if (filter === 'active') return ['received', 'accepted'].includes(order.status);
    if (filter === 'completed') return ['delivered', 'cancelled'].includes(order.status);
    return true;
  });

  const statusLabels = {
    received: 'Non prise en charge',
    accepted: 'Prise en charge',
    delivered: 'Délivrée',
    cancelled: 'Annulée',
  };

  const statusColors = {
    received: 'bg-orange-500',
    accepted: 'bg-blue-500',
    delivered: 'bg-emerald-500',
    cancelled: 'bg-red-500',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Bouton retour */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Mes commandes</h1>
        </div>

        <div className="flex gap-3 mb-8">
          {['all', 'active', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${filter === f ? 'bg-emerald-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 shadow-sm'}`}
            >
              {f === 'all' ? `Toutes (${orders.length})` : f === 'active' ? `En cours (${orders.filter(o => ['received', 'accepted'].includes(o.status)).length})` : `Terminées (${orders.filter(o => ['delivered', 'cancelled'].includes(o.status)).length})`}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🍕</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucune commande</h2>
            <Link to="/trucks" className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold shadow-sm">Explorer</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Link key={order.id} to={`/order/${order.id}`} className="block bg-white border border-gray-200 shadow-sm rounded-2xl p-6 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">Commande #{order.id.slice(0, 8)}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm ${statusColors[order.status] || 'bg-gray-500'}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Date inconnue'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{((order.totalCents || 0) / 100).toFixed(2)} €</p>
                    <p className="text-gray-500 text-sm font-medium">{order.items?.length || 0} article(s)</p>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-gray-600 text-sm font-medium">{order.items?.map(item => `${item.qty}x ${item.name}`).join(', ')}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {order.paidAt && <span className="text-emerald-600 font-bold">✓ Payé</span>}
                  </div>
                  <span className="text-emerald-600 font-bold text-sm">Voir le suivi →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
