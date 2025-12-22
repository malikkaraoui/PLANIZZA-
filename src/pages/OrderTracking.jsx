import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { useAuth } from '../app/providers/AuthProvider';

const STEPS = [
  { key: 'created', label: 'Confirmée', icon: '✅' },
  { key: 'received', label: 'Réception', icon: '📋' },
  { key: 'prep', label: 'Préparation', icon: '👨‍🍳' },
  { key: 'cooking', label: 'Cuisson', icon: '🔥' },
  { key: 'ready', label: 'Dégustez !', icon: '🍕' },
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
      setError('ID de commande manquant');
      setLoading(false);
      return;
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-white text-xl animate-pulse">Chargement...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-white mb-4">{error || 'Commande introuvable'}</h1>
          <Link
            to="/trucks"
            className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors"
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-white">Suivi de commande</h1>
            <button
              onClick={() => navigate('/commandes')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-colors"
            >
              Mes commandes
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Commande</span>
              <p className="text-white font-mono text-lg">#{orderId.slice(0, 8)}</p>
            </div>
            <div>
              <span className="text-gray-400">Articles</span>
              <p className="text-white font-semibold text-lg">{order.items?.length || 0}</p>
            </div>
            <div>
              <span className="text-gray-400">Total</span>
              <p className="text-white font-semibold text-lg">{((order.totalCents || 0) / 100).toFixed(2)} €</p>
            </div>
            <div>
              <span className="text-gray-400">Statut paiement</span>
              <p className={
                order.paidAt 
                  ? "text-emerald-400 font-semibold text-lg flex items-center gap-2"
                  : "text-amber-400 font-semibold text-lg flex items-center gap-2"
              }>
                {order.paidAt ? (
                  <>
                    <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    Payé
                  </>
                ) : (
                  <>
                    <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                    En attente
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">Progression</h2>
            <div className="text-right">
              <p className="text-sm text-gray-400">Statut actuel</p>
              <p className="text-emerald-400 font-bold text-lg capitalize">
                {currentStatus === 'created' && '✅ Confirmée'}
                {currentStatus === 'received' && '📋 Réception'}
                {currentStatus === 'prep' && '👨‍🍳 Préparation'}
                {currentStatus === 'cooking' && '🔥 Cuisson'}
                {currentStatus === 'ready' && '🍕 Prête !'}
                {!['created', 'received', 'prep', 'cooking', 'ready'].includes(currentStatus) && '⏳ En attente...'}
              </p>
            </div>
          </div>

          <div className="relative">
            {/* Barre de progression */}
            <div className="absolute top-8 left-8 right-8 h-1 bg-white/20 rounded-full">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
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
                        ${
                          isCompleted
                            ? 'bg-emerald-500 border-4 border-emerald-400 shadow-lg shadow-emerald-500/50'
                            : 'bg-white/10 border-4 border-white/20'
                        }
                        ${isCurrent ? 'animate-pulse scale-110' : ''}
                      `}
                    >
                      {step.icon}
                    </div>

                    {/* Label */}
                    <p
                      className={`
                        font-semibold mb-2 transition-colors text-center
                        ${isCompleted ? 'text-white' : 'text-gray-400'}
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
          <div className="mt-12 p-6 bg-white/5 rounded-xl border border-white/10">
            {currentStatus === 'received' && (
              <p className="text-white text-center text-lg">
                🎉 Votre commande a été reçue ! Le pizzaiolo démarre la préparation...
              </p>
            )}
            {currentStatus === 'prep' && (
              <p className="text-white text-center text-lg">
                👨‍🍳 Votre pizza est en cours de préparation avec soin...
              </p>
            )}
            {currentStatus === 'cooking' && (
              <p className="text-white text-center text-lg">
                🔥 La magie opère dans le four ! Votre pizza cuit à la perfection...
              </p>
            )}
            {currentStatus === 'ready' && (
              <p className="text-white text-center text-lg font-bold animate-pulse">
                🍕 Votre commande est prête ! Bon appétit ! 🎊
              </p>
            )}
          </div>
        </div>

        {/* Détails articles */}
        <div className="mt-8 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8">
          <h3 className="text-xl font-bold text-white mb-4">Détails de la commande</h3>
          <div className="space-y-3">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-white/10 last:border-0">
                <div>
                  <p className="text-white font-semibold">{item.name}</p>
                  <p className="text-gray-400 text-sm">Quantité: {item.qty || 1}</p>
                </div>
                <p className="text-white font-semibold">{((item.priceCents || 0) / 100).toFixed(2)} €</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
