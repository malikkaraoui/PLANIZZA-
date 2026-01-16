import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { Bike, Store } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../app/providers/AuthProvider';

const STEPS = [
  { key: 'created', label: 'Confirmée', icon: '✅' },
  { key: 'received', label: 'Reçue', icon: '📋' },
  { key: 'accepted', label: 'En préparation', icon: '👨‍🍳' },
  { key: 'delivered', label: 'Prête !', icon: '🍕' },
];

export default function OrderTracking() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) {
      // Évite un setState synchrone dans le corps de l'effet (règle ESLint)
      const t = setTimeout(() => {
        setError('ID de commande manquant');
        setLoading(false);
      }, 0);
      return () => clearTimeout(t);
    }

    const orderRef = ref(db, `orders/${orderId}`);
    const unsub = onValue(
      orderRef,
      (snap) => {
        if (!snap.exists()) {
          setError('Commande introuvable');
          setOrder(null);
        } else {
          const data = snap.val();
          // Vérifier que l'utilisateur est bien le propriétaire (ou invité avec guestUserId)
          const guestId = localStorage.getItem('planizza:guestUserId');
          const isOwner = user && data.userUid === user.uid;
          const isGuest = !user && guestId && data.userUid === guestId;

          if (!isOwner && !isGuest) {
            setError('Accès non autorisé');
            setOrder(null);
          } else {
            setOrder(data);
            setError(null);
          }
        }
        setLoading(false);
      },
      (err) => {
        console.error('Erreur lecture commande:', err);
        setError('Impossible de charger la commande');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [orderId, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-gray-900 text-xl animate-pulse">Chargement...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Commande introuvable'}</h1>
          <Link
            to="/trucks"
            className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors shadow-sm"
          >
            Retour à l'exploration
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus = order.status || 'created';
  const timeline = order.timeline || {};
  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStatus);
  const desiredTime = typeof order.pickupTime === 'string' && order.pickupTime.length > 0
    ? order.pickupTime
    : order.v2?.promisedAt
      ? new Date(order.v2.promisedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '-';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Suivi de commande</h1>
            <button
              onClick={() => navigate('/commandes')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-gray-900 transition-colors font-semibold"
            >
              Mes commandes
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
            <div>
              <span className="text-gray-500 text-sm font-medium">Commande</span>
              <p className="text-gray-900 font-mono text-lg font-bold">#{orderId.slice(0, 8)}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm font-medium">Heure</span>
              <p className="text-gray-900 font-bold text-lg">
                {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('fr-FR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }) : '-'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-sm font-medium">Heure souhaitée</span>
              <p className="text-gray-900 font-bold text-lg">
                {desiredTime}
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-sm font-medium">Articles</span>
              <p className="text-gray-900 font-bold text-lg">{order.items?.length || 0}</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm font-medium">Total</span>
              <p className="text-gray-900 font-bold text-lg">{((order.totalCents || 0) / 100).toFixed(2)} €</p>
            </div>
            <div>
              <span className="text-gray-500 text-sm font-medium">Statut paiement</span>
              <p className={
                order.paidAt
                  ? "text-emerald-600 font-bold text-lg flex items-center gap-2"
                  : "text-amber-600 font-bold text-lg flex items-center gap-2"
              }>
                {order.paidAt ? (
                  <>
                    <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                    Payé
                  </>
                ) : (
                  <>
                    <span className="inline-block w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></span>
                    En attente
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Méthode de livraison */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <span className="text-gray-500 text-sm font-medium block mb-3">🚚 Mode de récupération</span>
            <div className="flex gap-4">
              {/* Retrait au camion */}
              <div
                className={`flex-1 relative overflow-hidden rounded-2xl p-4 transition-all ${
                  order.deliveryMethod !== 'delivery'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-gray-100 text-gray-400 opacity-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    order.deliveryMethod !== 'delivery' 
                      ? 'bg-white/20' 
                      : 'bg-gray-200'
                  }`}>
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">Retrait au camion</div>
                    <div className={`text-xs mt-0.5 ${
                      order.deliveryMethod !== 'delivery' 
                        ? 'text-white/80' 
                        : 'text-gray-400'
                    }`}>
                      Gratuit • 15-20 min
                    </div>
                  </div>
                  {order.deliveryMethod !== 'delivery' && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-white flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    </div>
                  )}
                </div>
              </div>

              {/* Livraison à domicile */}
              <div
                className={`flex-1 relative overflow-hidden rounded-2xl p-4 transition-all ${
                  order.deliveryMethod === 'delivery'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-gray-100 text-gray-400 opacity-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    order.deliveryMethod === 'delivery' 
                      ? 'bg-white/20' 
                      : 'bg-gray-200'
                  }`}>
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">Livraison à domicile</div>
                    <div className={`text-xs mt-0.5 ${
                      order.deliveryMethod === 'delivery' 
                        ? 'text-white/80' 
                        : 'text-gray-400'
                    }`}>
                      + 3,50€ • 30-40 min
                    </div>
                  </div>
                  {order.deliveryMethod === 'delivery' && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-white flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Adresse de livraison si applicable */}
            {order.deliveryMethod === 'delivery' && order.deliveryAddress && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <p className="text-sm font-medium text-emerald-900 mb-1">📍 Adresse de livraison</p>
                <p className="text-sm text-emerald-700">{order.deliveryAddress}</p>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-2xl font-bold text-gray-900">Progression</h2>
            <div className="text-right">
              <p className="text-sm text-gray-500 font-medium">Statut actuel</p>
              <p className="text-emerald-600 font-bold text-lg capitalize">
                {currentStatus === 'created' && '✅ Confirmée'}
                {currentStatus === 'received' && '📋 Reçue'}
                {currentStatus === 'accepted' && '👨‍🍳 En préparation'}
                {currentStatus === 'delivered' && '🍕 Prête !'}
                {!['created', 'received', 'accepted', 'delivered'].includes(currentStatus) && '⏳ En attente...'}
              </p>
            </div>
          </div>

          <div className="relative">
            {/* Barre de progression */}
            <div className="absolute top-8 left-8 right-8 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                style={{
                  width: `${currentStepIndex >= 0 ? ((currentStepIndex + 1) / STEPS.length) * 100 : 0}%`,
                }}
              />
            </div>

            {/* Étapes */}
            <div className="relative flex justify-between">
              {STEPS.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const timestamp = timeline[`${step.key}At`];

                return (
                  <div key={step.key} className="flex flex-col items-center" style={{ flex: 1 }}>
                    {/* Icône */}
                    <div
                      className={`
                        w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-4 transition-all duration-500
                        ${isCompleted
                          ? 'bg-emerald-500 border-4 border-emerald-100 text-white shadow-md'
                          : 'bg-white border-4 border-gray-100 text-gray-300'
                        }
                        ${isCurrent ? 'ring-4 ring-emerald-500/20 scale-110' : ''}
                      `}
                    >
                      {step.icon}
                    </div>

                    {/* Label */}
                    <p
                      className={`
                        font-bold mb-2 transition-colors text-center text-sm
                        ${isCompleted ? 'text-gray-900' : 'text-gray-400'}
                      `}
                    >
                      {step.label}
                    </p>

                    {/* Timestamp */}
                    {timestamp && (
                      <p className="text-xs text-gray-400">
                        {new Date(timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Message en fonction du statut */}
          <div className="mt-12 p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
            {currentStatus === 'created' && (
              <p className="text-emerald-900 text-center text-lg font-medium">
                ✅ Commande confirmée ! En attente de réception par le pizzaiolo...
              </p>
            )}
            {currentStatus === 'received' && (
              <p className="text-emerald-900 text-center text-lg font-medium">
                📋 Votre commande a été reçue ! Le pizzaiolo va bientôt la prendre en charge...
              </p>
            )}
            {currentStatus === 'accepted' && (
              <p className="text-emerald-900 text-center text-lg font-medium">
                👨‍🍳 C'est parti ! Votre pizza est en cours de préparation avec soin...
              </p>
            )}
            {currentStatus === 'delivered' && (
              <p className="text-emerald-900 text-center text-lg font-bold animate-pulse">
                🍕 Votre commande est prête ! Régalez-vous ! 🎊
              </p>
            )}
          </div>
        </div>

        {/* Détails articles */}
        <div className="mt-8 bg-white border border-gray-200 shadow-sm rounded-2xl p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Détails de la commande</h3>
          <div className="space-y-4">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-gray-900 font-bold">{item.name}</p>
                  <p className="text-gray-500 text-sm font-medium">Quantité: {item.qty || 1}</p>
                </div>
                <p className="text-gray-900 font-bold text-lg">{((item.priceCents || 0) / 100).toFixed(2)} €</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
