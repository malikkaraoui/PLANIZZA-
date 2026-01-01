import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, User, Pizza, CheckCircle, ChefHat, Package, ArrowLeft } from 'lucide-react';
import { ref, get } from 'firebase/database';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/providers/AuthProvider';
import { ROUTES } from '../../app/routes';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useTruckOrders } from '../../features/orders/hooks/useTruckOrders';
import { useUpdateOrderStatus } from '../../features/orders/hooks/useUpdateOrderStatus';

// Statuts possibles
const STATUS_CONFIG = {
  created: { label: 'Créée', color: 'bg-gray-500', icon: Package },
  received: { label: 'Reçue', color: 'bg-blue-500', icon: CheckCircle },
  accepted: { label: 'Prise en charge', color: 'bg-indigo-500', icon: ChefHat },
  delivered: { label: 'Livrée', color: 'bg-green-600', icon: CheckCircle },
  cancelled: { label: 'Annulée', color: 'bg-red-500', icon: Package },
  lost: { label: 'Perdue', color: 'bg-gray-600', icon: Package },
};

// Durée max avant de considérer une commande comme perdue (2h)
const MAX_ORDER_DURATION = 2 * 60 * 60 * 1000;

// Temps estimé par pizza (en minutes)
const TIME_PER_PIZZA = 8;

export default function PizzaioloOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [truckId, setTruckId] = useState(null);
  const [loadingTruck, setLoadingTruck] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const { orders, loading: ordersLoading } = useTruckOrders(truckId);
  const { updateStatus, loading: updating } = useUpdateOrderStatus();

  // Charger le truckId du pizzaiolo
  useEffect(() => {
    if (!user?.uid) return;

    const loadTruckId = async () => {
      try {
        const pizzaioloRef = ref(db, `pizzaiolos/${user.uid}`);
        const snap = await get(pizzaioloRef);
        if (snap.exists() && snap.val().truckId) {
          setTruckId(snap.val().truckId);
        }
      } catch (err) {
        console.error('[PizzaioloOrders] Erreur chargement truckId:', err);
      } finally {
        setLoadingTruck(false);
      }
    };

    loadTruckId();
  }, [user?.uid]);

  // Mettre à jour le timer toutes les secondes
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculer le temps écoulé
  const getElapsedTime = (createdAt) => {
    if (!createdAt) return '—';
    const diff = Math.floor((currentTime - createdAt) / 1000);
    
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    return `${Math.floor(diff / 3600)}h${Math.floor((diff % 3600) / 60)}min`;
  };

  // Calculer le temps restant (décompte)
  const getRemainingTime = (order) => {
    if (!order.timeline?.acceptedAt) return null;
    
    const totalPizzas = order.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 1;
    const estimatedMs = totalPizzas * TIME_PER_PIZZA * 60 * 1000;
    
    const elapsed = currentTime - order.timeline.acceptedAt;
    const remaining = estimatedMs - elapsed;
    
    if (remaining <= 0) return { text: '0min', isLate: true };
    
    const remainingMin = Math.ceil(remaining / 1000 / 60);
    return { text: `${remainingMin}min`, isLate: false };
  };

  // Vérifier si la commande n'est pas acceptée dans les 5 min
  const isNotAcceptedInTime = (order) => {
    if (order.status !== 'received') return false;
    return (currentTime - order.createdAt) / 1000 / 60 > 5;
  };

  // Vérifier si une commande est expirée (> 2h)
  const isExpired = (createdAt) => {
    if (!createdAt) return false;
    return currentTime - createdAt > MAX_ORDER_DURATION;
  };

  // Prendre en charge
  const handleAccept = async (orderId) => {
    console.log('[Orders] Clic sur Prendre en charge, orderId:', orderId);
    const result = await updateStatus(orderId, 'accepted');
    console.log('[Orders] Résultat:', result);
  };

  // Marquer comme livrée
  const handleDeliver = async (orderId) => {
    console.log('[Orders] Clic sur Délivré, orderId:', orderId);
    const result = await updateStatus(orderId, 'delivered');
    console.log('[Orders] Résultat:', result);
  };

  // Filtrer les commandes
  const activeOrders = orders.filter((o) => {
    if (['delivered', 'cancelled'].includes(o.status)) return false;
    if (isExpired(o.createdAt)) return false;
    return true;
  });

  const completedOrders = orders.filter((o) => {
    if (['delivered', 'cancelled'].includes(o.status)) return true;
    if (isExpired(o.createdAt)) return true;
    return false;
  });

  if (loadingTruck) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Pizza className="h-12 w-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!truckId) {
    return (
      <Card className="glass-premium glass-glossy border-white/20 p-12 rounded-[32px] text-center">
        <div className="space-y-4">
          <div className="inline-flex p-6 rounded-3xl bg-orange-500/10">
            <Pizza className="h-16 w-16 text-orange-500" />
          </div>
          <h2 className="text-2xl font-black">Aucun camion associé</h2>
          <p className="text-muted-foreground">
            Vous devez d'abord créer un camion pour recevoir des commandes.
          </p>
          <Button asChild className="rounded-2xl px-8 h-12 font-bold bg-orange-500">
            <Link to={ROUTES.pizzaioloProfile}>Créer mon camion</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Bouton retour */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Commandes Reçues</h1>
          <p className="text-muted-foreground font-medium mt-2">
            {activeOrders.length} commande{activeOrders.length > 1 ? 's' : ''} en cours
          </p>
        </div>
      </div>

      {/* File d'attente */}
      <section className="space-y-4">
        <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-500" />
          File d'attente
        </h2>

        {ordersLoading ? (
          <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-[32px] text-center">
            <Pizza className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Chargement...</p>
          </Card>
        ) : activeOrders.length === 0 ? (
          <Card className="glass-premium glass-glossy border-white/20 p-12 rounded-[32px] text-center">
            <div className="inline-flex p-6 rounded-3xl bg-primary/10 mb-4">
              <Pizza className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-black mb-2">Aucune commande active</h3>
            <p className="text-muted-foreground">
              Les nouvelles commandes apparaîtront ici
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {activeOrders.map((order) => {
              const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
              const StatusIcon = statusConfig.icon;
              const elapsed = getElapsedTime(order.createdAt);
              const remaining = getRemainingTime(order);
              const notAcceptedInTime = isNotAcceptedInTime(order);
              const totalPizzas = order.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;

              return (
                <Card
                  key={order.id}
                  className={`glass-premium glass-glossy border-white/20 p-6 rounded-[24px] ${
                    notAcceptedInTime || remaining?.isLate ? 'border-red-500/50' : ''
                  }`}
                >
                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <div className="space-y-4">
                      {/* En-tête */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-xl ${statusConfig.color}/10`}>
                            <StatusIcon className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-black">
                                #{order.id.slice(-6).toUpperCase()}
                              </h3>
                              <Badge className={`${statusConfig.color} text-white rounded-full text-xs`}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                {order.customerName || order.userUid?.slice(0, 8) || 'Anonyme'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {new Date(order.createdAt).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Pizza className="h-4 w-4" />
                                {totalPizzas} pizza{totalPizzas > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Timer */}
                        <div className="text-right">
                          {order.status === 'received' ? (
                            <>
                              <div className={`text-2xl font-black ${notAcceptedInTime ? 'text-red-500' : 'text-muted-foreground'}`}>
                                {elapsed}
                              </div>
                              {notAcceptedInTime && (
                                <span className="text-xs font-bold text-red-500 uppercase">&gt; 5 min</span>
                              )}
                            </>
                          ) : remaining ? (
                            <>
                              <div className={`text-2xl font-black ${remaining.isLate ? 'text-red-500' : 'text-emerald-500'}`}>
                                {remaining.text}
                              </div>
                              <span className="text-xs font-bold text-muted-foreground uppercase">Restant</span>
                              {remaining.isLate && (
                                <span className="text-xs font-bold text-red-500 uppercase block">Retard</span>
                              )}
                            </>
                          ) : (
                            <div className="text-2xl font-black text-muted-foreground">{elapsed}</div>
                          )}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-2">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm p-3 rounded-xl bg-white/5">
                            <span className="font-bold">{item.qty}x {item.name}</span>
                            <span className="text-muted-foreground">
                              {((item.priceCents * item.qty) / 100).toFixed(2)} €
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        <span className="font-black text-lg">Total</span>
                        <span className="font-black text-xl text-primary">
                          {(order.totalCents / 100).toFixed(2)} €
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2" style={{ minWidth: '180px' }}>
                      {order.status === 'received' ? (
                        <Button
                          onClick={() => handleAccept(order.id)}
                          disabled={updating}
                          className="w-full rounded-xl h-12 font-bold bg-blue-500 hover:bg-blue-600"
                        >
                          Prendre en charge
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleDeliver(order.id)}
                          disabled={updating}
                          className="w-full rounded-xl h-12 font-bold bg-emerald-500 hover:bg-emerald-600"
                        >
                          Délivré
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Historique */}
      {completedOrders.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            Historique ({completedOrders.length})
          </h2>
          <div className="grid gap-3">
            {completedOrders.slice(0, 10).map((order) => {
              const expired = isExpired(order.createdAt);
              const statusConfig = expired ? STATUS_CONFIG.lost : (STATUS_CONFIG[order.status] || STATUS_CONFIG.delivered);
              
              return (
                <Card key={order.id} className="glass-premium glass-glossy border-white/20 p-4 rounded-3xl opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={`${statusConfig.color} text-white rounded-full text-xs`}>
                        {expired ? 'Perdue (>2h)' : statusConfig.label}
                      </Badge>
                      <span className="font-bold text-sm">#{order.id.slice(-6).toUpperCase()}</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <span className="font-bold text-primary">{(order.totalCents / 100).toFixed(2)} €</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

