import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, User, Pizza, CheckCircle, ChefHat, Package, ArrowLeft, Filter, Store, Bike, CreditCard, X, Calendar } from 'lucide-react';
import { ref, get, set } from 'firebase/database';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/providers/AuthProvider';
import { ROUTES } from '../../app/routes';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { useTruckOrders } from '../../features/orders/hooks/useTruckOrders';
import { useUpdateOrderStatus } from '../../features/orders/hooks/useUpdateOrderStatus';
import { usePizzaioloTruckId } from '../../features/pizzaiolo/hooks/usePizzaioloTruckId';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { getFilteredOrders, isExpired, MAX_ORDER_DURATION } from '../../features/orders/utils/orderFilters';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { OrderCard } from '../../features/orders/components/OrderCard';
import { OrderSection } from '../../features/orders/components/OrderSection';
import { 
  getEstimatedDeliveryTime, 
  formatDeliveryTime, 
  sortOrdersByDeliveryTime,
  groupOrdersByStatus 
} from '../../features/orders/utils/deliveryTimeCalculator';

// Statuts possibles (SIMPLIFIÉ)
const STATUS_CONFIG = {
  received: { label: 'Non prise en charge', color: 'bg-orange-500', icon: Clock },
  accepted: { label: 'Prise en charge', color: 'bg-blue-500', icon: ChefHat },
  delivered: { label: 'Délivrée', color: 'bg-green-600', icon: CheckCircle },
  cancelled: { label: 'Annulée', color: 'bg-red-500', icon: Package },
  lost: { label: 'Perdue', color: 'bg-gray-600', icon: Package },
};

const TVA_RATE = 0.10; // 10% TVA restauration

export default function PizzaioloOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isVisible: isScrolledUp } = useScrollDirection(10);

  const {
    truckId,
    loading: loadingTruckId,
    error: truckIdError,
  } = usePizzaioloTruckId(user?.uid);

  const [loadingTruckDetails, setLoadingTruckDetails] = useState(false);
  const loadingTruck = loadingTruckId || loadingTruckDetails;
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [pizzaPerHour, setPizzaPerHour] = useState(30); // Cadence du pizzaiolo
  const [_openingHours, setOpeningHours] = useState(null); // Horaires d'ouverture
  const { orders, loading: ordersLoading } = useTruckOrders(truckId);
  const { updateStatus, loading: updating } = useUpdateOrderStatus();

  // États des filtres
  const [filters, setFilters] = useState({
    status: 'all', // 'all', 'lost', 'delivered_pickup', 'delivered_delivery'
    payment: 'all', // 'all', 'online', 'cash'
    period: 'all', // 'all', 'today', 'week', 'month', 'year'
  });

  const [filtersVisible, setFiltersVisible] = useState(false); // Afficher/cacher les filtres
  
  // Modal de détails de commande
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Charger les détails du camion (cadence + horaires) dès que truckId est connu.
  useEffect(() => {
    let cancelled = false;

    // Si on n'a pas encore de truck, on évite d'afficher un loader infini.
    if (!truckId) {
      setLoadingTruckDetails(false);
      setOpeningHours(null);
      setPizzaPerHour(30);
      return () => {
        cancelled = true;
      };
    }

    if (!db) {
      // Mode DEV sans Firebase (on ne bloque pas l'UI)
      setLoadingTruckDetails(false);
      return () => {
        cancelled = true;
      };
    }

    setLoadingTruckDetails(true);

    (async () => {
      try {
        const truckRef = ref(db, `public/trucks/${truckId}`);
        const truckSnap = await get(truckRef);
        if (cancelled) return;

        if (truckSnap.exists()) {
          const truckData = truckSnap.val();
          console.log('[PizzaioloOrders] Données camion complètes:', truckData);
          console.log('[PizzaioloOrders] Horaires bruts:', truckData.openingHours);
          console.log('[PizzaioloOrders] Horaires schedule:', truckData.schedule);
          console.log('[PizzaioloOrders] Horaires hours:', truckData.hours);

          setPizzaPerHour(truckData.capacity?.pizzaPerHour || 30);

          // Essayer différentes clés possibles pour les horaires
          const hours = truckData.openingHours || truckData.schedule || truckData.hours || null;
          console.log('[PizzaioloOrders] Horaires finalement utilisés:', hours);
          setOpeningHours(hours);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[PizzaioloOrders] Erreur chargement détails camion:', err);
      } finally {
        if (!cancelled) setLoadingTruckDetails(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [truckId]);

  // Remonter l'erreur truckId si besoin (sans casser l'UI).
  useEffect(() => {
    if (!truckIdError) return;
    console.error('[PizzaioloOrders] Erreur chargement truckId:', truckIdError);
  }, [truckIdError]);

  // Mettre à jour le timer toutes les secondes
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculer le temps écoulé (pour les commandes non prises en charge)
  const getElapsedTime = (createdAt) => {
    if (!createdAt) return '—';
    
    // Debug: afficher les timestamps
    console.log('[CHRONO] createdAt:', createdAt, 'currentTime:', currentTime, 'diff:', (currentTime - createdAt) / 1000, 's');
    
    const diff = Math.floor((currentTime - createdAt) / 1000);
    
    // Si le temps est négatif (peut arriver avec désync horloge), afficher en positif
    const absDiff = Math.abs(diff);
    
    // TOUJOURS afficher en secondes pour plus d'impact
    return `${absDiff}s`;
  };

  // Calculer le temps restant basé sur la cadence du pizzaiolo (pour commandes prises en charge)
  const getRemainingTime = (order, pizzaPerHour) => {
    if (!order.timeline?.acceptedAt || !pizzaPerHour) return null;
    
    const totalPizzas = order.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 1;
    // Calculer le temps estimé basé sur la cadence (pizzas par heure)
    const minutesPerPizza = 60 / pizzaPerHour;
    const estimatedMs = totalPizzas * minutesPerPizza * 60 * 1000;
    
    const elapsed = currentTime - order.timeline.acceptedAt;
    const remaining = estimatedMs - elapsed;
    
    // Si en retard, afficher le temps de retard écoulé
    if (remaining <= 0) {
      const lateMs = Math.abs(remaining);
      const lateMinutes = Math.floor(lateMs / 1000 / 60);
      const lateSeconds = Math.floor((lateMs / 1000) % 60);
      
      // Afficher en minutes si >= 1min, sinon en secondes
      const lateText = lateMinutes >= 1 
        ? `${lateMinutes}min` 
        : `${lateSeconds}s`;
      
      return { text: lateText, isLate: true };
    }
    
    const remainingMin = Math.ceil(remaining / 1000 / 60);
    return { text: `${remainingMin}min`, isLate: false };
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
    
    // Vérifier si c'est une commande manuelle non payée
    const order = orders.find(o => o.id === orderId);
    if (order?.source === 'manual' && order?.payment?.paymentStatus !== 'paid') {
      const confirmed = window.confirm(
        `⚠️ ATTENTION : Cette commande n'a pas été marquée comme PAYÉE !\n\n` +
        `Client : ${order.customerName || 'Client'}\n` +
        `Montant : ${(order.totalCents / 100).toFixed(2)} €\n\n` +
        `Confirmez-vous que le client a bien payé et que vous voulez marquer cette commande comme délivrée ?`
      );
      
      if (!confirmed) {
        return; // Annuler la livraison
      }
    }
    
    const result = await updateStatus(orderId, 'delivered');
    console.log('[Orders] Résultat:', result);
  };

  // Marquer comme payée (pour commandes manuelles)
  const handleMarkPaid = async (orderId) => {
    if (!db) return;
    try {
      const orderRef = ref(db, `orders/${orderId}/payment`);
      await set(orderRef, {
        provider: 'manual',
        paymentStatus: 'paid',
        paidAt: Date.now()
      });
      console.log('[Orders] Commande marquée comme payée:', orderId);
    } catch (error) {
      console.error('[Orders] Erreur lors du marquage payé:', error);
    }
  };

  // Appliquer les filtres sur TOUTES les commandes (actives + historique)
  const allFilteredOrders = getFilteredOrders(orders, filters);
  const filteredActiveOrders = allFilteredOrders.filter((o) => {
    if (['delivered', 'cancelled'].includes(o.status)) return false;
    if (isExpired(o)) return false;
    return true;
  });
  const filteredCompletedOrders = allFilteredOrders.filter((o) => {
    if (['delivered', 'cancelled'].includes(o.status)) return true;
    if (isExpired(o)) return true;
    return false;
  });

  // Grouper les commandes actives par statut et paiement (4 groupes)
  const orderGroups = groupOrdersByStatus(filteredActiveOrders);
  console.log('[PizzaioloOrders] Groupes de commandes:', {
    notAcceptedPaid: orderGroups.notAcceptedPaid.length,
    notAcceptedUnpaid: orderGroups.notAcceptedUnpaid.length,
    acceptedPaid: orderGroups.acceptedPaid.length,
    acceptedUnpaid: orderGroups.acceptedUnpaid.length
  });

  // Trier chaque groupe par ordre chronologique de livraison
  const sortedNotAcceptedPaid = sortOrdersByDeliveryTime(orderGroups.notAcceptedPaid, pizzaPerHour);
  const sortedNotAcceptedUnpaid = sortOrdersByDeliveryTime(orderGroups.notAcceptedUnpaid, pizzaPerHour);
  const sortedAcceptedPaid = sortOrdersByDeliveryTime(orderGroups.acceptedPaid, pizzaPerHour);
  const sortedAcceptedUnpaid = sortOrdersByDeliveryTime(orderGroups.acceptedUnpaid, pizzaPerHour);

  console.log('[PizzaioloOrders] Commandes triées par heure de livraison');

  // Calculer les stats
  const lostCount = filteredCompletedOrders.filter(o => isExpired(o)).length;
  const deliveredPickupCount = filteredCompletedOrders.filter(o => o.status === 'delivered' && o.deliveryMethod === 'pickup').length;
  const deliveredDeliveryCount = filteredCompletedOrders.filter(o => o.status === 'delivered' && o.deliveryMethod === 'delivery').length;

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
      <div>
        <h1 className="text-3xl font-black tracking-tight">Commandes</h1>
        <p className="text-muted-foreground font-medium mt-2">
          {filteredActiveOrders.length} commande{filteredActiveOrders.length > 1 ? 's' : ''} en cours
        </p>
      </div>

      {/* Filtres des commandes */}
      <Card className={`glass-premium glass-glossy border-white/20 rounded-[24px] transition-all duration-300 ${
        filtersVisible ? 'p-6' : 'p-3'
      }`}>
        <div className={`flex items-center justify-between ${filtersVisible ? 'mb-4' : ''}`}>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-black tracking-tight">Filtres</h2>
          </div>
          
          <button
            onClick={() => setFiltersVisible(!filtersVisible)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all glass-premium glass-glossy border-white/20 hover:border-primary/50"
          >
            <Filter className="h-4 w-4" />
            {filtersVisible ? 'Masquer' : 'Afficher'}
          </button>
        </div>
        
        <div
          className={`grid md:grid-cols-3 gap-4 transition-all duration-500 ease-in-out ${
            filtersVisible 
              ? 'opacity-100 max-h-250 transform translate-y-0' 
              : 'opacity-0 max-h-0 overflow-hidden transform -translate-y-4'
          }`}
        >
          {/* Filtre Statut */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground">Statut</label>
            <div className="grid gap-2">
              <button
                onClick={() => setFilters(f => ({ ...f, status: 'all' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all ${
                  filters.status === 'all' 
                    ? 'bg-primary text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-primary/50'
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, status: f.status === 'lost' ? 'all' : 'lost' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between ${
                  filters.status === 'lost' 
                    ? 'bg-gray-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-gray-600/50'
                }`}
              >
                <span>Pertes</span>
                <Badge className="bg-gray-600 text-white rounded-full text-xs">{lostCount}</Badge>
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, status: f.status === 'delivered_pickup' ? 'all' : 'delivered_pickup' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between ${
                  filters.status === 'delivered_pickup' 
                    ? 'bg-emerald-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-emerald-600/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Livré Camion
                </span>
                <Badge className="bg-emerald-600 text-white rounded-full text-xs">{deliveredPickupCount}</Badge>
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, status: f.status === 'delivered_delivery' ? 'all' : 'delivered_delivery' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between ${
                  filters.status === 'delivered_delivery' 
                    ? 'bg-blue-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-blue-600/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Bike className="h-4 w-4" />
                  Livré Uber Eats
                </span>
                <Badge className="bg-blue-600 text-white rounded-full text-xs">{deliveredDeliveryCount}</Badge>
              </button>
            </div>
          </div>

          {/* Filtre Paiement */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground">Paiement</label>
            <div className="grid gap-2">
              <button
                onClick={() => setFilters(f => ({ ...f, payment: 'all' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all ${
                  filters.payment === 'all' 
                    ? 'bg-primary text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-primary/50'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, payment: f.payment === 'online' ? 'all' : 'online' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  filters.payment === 'online' 
                    ? 'bg-purple-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-purple-600/50'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                Paiement en ligne
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, payment: f.payment === 'cash' ? 'all' : 'cash' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  filters.payment === 'cash' 
                    ? 'bg-green-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-green-600/50'
                }`}
              >
                💵 Cash
              </button>
            </div>
          </div>

          {/* Filtre Période */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground">Période</label>
            <div className="grid gap-2">
              <button
                onClick={() => setFilters(f => ({ ...f, period: 'all' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all ${
                  filters.period === 'all' 
                    ? 'bg-primary text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-primary/50'
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, period: f.period === 'today' ? 'all' : 'today' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  filters.period === 'today' 
                    ? 'bg-primary text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-primary/50'
                }`}
              >
                <Calendar className="h-4 w-4" />
                Aujourd'hui
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, period: f.period === 'week' ? 'all' : 'week' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  filters.period === 'week' 
                    ? 'bg-purple-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-purple-600/50'
                }`}
              >
                📅 7 jours
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, period: f.period === 'month' ? 'all' : 'month' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  filters.period === 'month' 
                    ? 'bg-blue-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-blue-600/50'
                }`}
              >
                📆 4 semaines
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, period: f.period === 'year' ? 'all' : 'year' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  filters.period === 'year' 
                    ? 'bg-orange-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-orange-600/50'
                }`}
              >
                📊 12 mois
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* File d'attente */}
      <section className="space-y-8">
        <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-500" />
          File d'attente
        </h2>

        {ordersLoading ? (
          <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-[32px] text-center">
            <Pizza className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Chargement...</p>
          </Card>
        ) : filteredActiveOrders.length === 0 ? (
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
          <div className="space-y-8">
            {/* Section 1: Commandes non prises en charge - PAYÉES */}
            <OrderSection 
              title="Non prises en charge · Payées" 
              count={sortedNotAcceptedPaid.length}
              color="green-500"
            >
              {sortedNotAcceptedPaid.map((order) => {
                const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
                const elapsed = getElapsedTime(order.createdAt);
                const remaining = getRemainingTime(order, pizzaPerHour);
                const estimatedTime = getEstimatedDeliveryTime(order, pizzaPerHour);
                const estimatedTimeFormatted = formatDeliveryTime(estimatedTime);

                return (
                  <OrderCard
                    key={order.id}
                    order={order}
                    statusConfig={statusConfig}
                    elapsed={elapsed}
                    remaining={remaining}
                    estimatedDeliveryTime={estimatedTimeFormatted}
                    onAccept={handleAccept}
                    onDeliver={handleDeliver}
                    onMarkPaid={handleMarkPaid}
                    onClick={() => setSelectedOrder(order)}
                    updating={updating}
                    borderVariant="paid"
                  />
                );
              })}
            </OrderSection>

            {/* Section 2: Commandes non prises en charge - NON PAYÉES */}
            <OrderSection 
              title="Non prises en charge · Non payées" 
              count={sortedNotAcceptedUnpaid.length}
              color="orange-500"
            >
              {sortedNotAcceptedUnpaid.map((order) => {
                const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
                const elapsed = getElapsedTime(order.createdAt);
                const remaining = getRemainingTime(order, pizzaPerHour);
                const estimatedTime = getEstimatedDeliveryTime(order, pizzaPerHour);
                const estimatedTimeFormatted = formatDeliveryTime(estimatedTime);

                return (
                  <OrderCard
                    key={order.id}
                    order={order}
                    statusConfig={statusConfig}
                    elapsed={elapsed}
                    remaining={remaining}
                    estimatedDeliveryTime={estimatedTimeFormatted}
                    onAccept={handleAccept}
                    onDeliver={handleDeliver}
                    onMarkPaid={handleMarkPaid}
                    onClick={() => setSelectedOrder(order)}
                    updating={updating}
                    borderVariant="unpaid"
                  />
                );
              })}
            </OrderSection>

            {/* Section 3: Commandes prises en charge - PAYÉES */}
            <OrderSection 
              title="En préparation · Payées" 
              count={sortedAcceptedPaid.length}
              color="green-500"
            >
              {sortedAcceptedPaid.map((order) => {
                const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
                const elapsed = getElapsedTime(order.createdAt);
                const remaining = getRemainingTime(order, pizzaPerHour);
                const estimatedTime = getEstimatedDeliveryTime(order, pizzaPerHour);
                const estimatedTimeFormatted = formatDeliveryTime(estimatedTime);

                return (
                  <OrderCard
                    key={order.id}
                    order={order}
                    statusConfig={statusConfig}
                    elapsed={elapsed}
                    remaining={remaining}
                    estimatedDeliveryTime={estimatedTimeFormatted}
                    onAccept={handleAccept}
                    onDeliver={handleDeliver}
                    onMarkPaid={handleMarkPaid}
                    onClick={() => setSelectedOrder(order)}
                    updating={updating}
                    borderVariant="paid"
                  />
                );
              })}
            </OrderSection>

            {/* Section 4: Commandes prises en charge - NON PAYÉES */}
            <OrderSection 
              title="En préparation · Non payées" 
              count={sortedAcceptedUnpaid.length}
              color="orange-500"
            >
              {sortedAcceptedUnpaid.map((order) => {
                const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
                const elapsed = getElapsedTime(order.createdAt);
                const remaining = getRemainingTime(order, pizzaPerHour);
                const estimatedTime = getEstimatedDeliveryTime(order, pizzaPerHour);
                const estimatedTimeFormatted = formatDeliveryTime(estimatedTime);

                return (
                  <OrderCard
                    key={order.id}
                    order={order}
                    statusConfig={statusConfig}
                    elapsed={elapsed}
                    remaining={remaining}
                    estimatedDeliveryTime={estimatedTimeFormatted}
                    onAccept={handleAccept}
                    onDeliver={handleDeliver}
                    onMarkPaid={handleMarkPaid}
                    onClick={() => setSelectedOrder(order)}
                    updating={updating}
                    borderVariant="unpaid"
                  />
                );
              })}
            </OrderSection>
          </div>
        )}
      </section>

      {/* Historique */}
      {filteredCompletedOrders.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            Historique ({filteredCompletedOrders.length})
          </h2>
          <div className="grid gap-3">
            {filteredCompletedOrders.slice(0, 20).map((order) => {
              const expired = isExpired(order);
              const statusConfig = expired ? STATUS_CONFIG.lost : (STATUS_CONFIG[order.status] || STATUS_CONFIG.delivered);
              const deliveryIcon = order.deliveryMethod === 'delivery' ? <Bike className="h-3 w-3" /> : <Store className="h-3 w-3" />;
              const deliveryLabel = order.deliveryMethod === 'delivery' ? 'Livraison' : 'Camion';
              
              return (
                <Card 
                  key={order.id} 
                  className="glass-premium glass-glossy border-white/20 p-4 rounded-3xl opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={`${statusConfig.color} text-white rounded-full text-xs`}>
                        {expired ? 'Perdue (>2h)' : statusConfig.label}
                      </Badge>
                      {!expired && order.status === 'delivered' && (
                        <Badge className="bg-blue-600/90 text-white rounded-full text-xs flex items-center gap-1 font-bold">
                          {deliveryIcon}
                          {deliveryLabel}
                        </Badge>
                      )}
                      {order.payment?.provider === 'stripe' && (
                        <Badge className="bg-emerald-600/90 text-white rounded-full text-xs flex items-center gap-1 font-bold">
                          <CreditCard className="h-3 w-3" />
                          En ligne
                        </Badge>
                      )}
                      {order.source === 'manual' && (
                        <Badge className="bg-purple-600/90 text-white rounded-full text-xs font-bold">
                          ✋ MANUELLE
                        </Badge>
                      )}
                      <span className="font-bold text-sm">#{order.id.slice(-6).toUpperCase()}</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString('fr-FR', { 
                          day: 'numeric', 
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground mb-1">
                        HT: {(order.totalCents / (1 + TVA_RATE) / 100).toFixed(2)} € | TVA: {(order.totalCents / 100 - order.totalCents / (1 + TVA_RATE) / 100).toFixed(2)} €
                      </div>
                      <span className="font-bold text-primary">{(order.totalCents / 100).toFixed(2)} € TTC</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal de détails de commande */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl glass-premium glass-glossy border-white/20 rounded-[32px] max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-2xl">
                  <span>Commande #{selectedOrder.id.slice(-6).toUpperCase()}</span>
                  <Badge className={`${(isExpired(selectedOrder) ? STATUS_CONFIG.lost : STATUS_CONFIG[selectedOrder.status] || STATUS_CONFIG.delivered).color} text-white rounded-full`}>
                    {isExpired(selectedOrder) ? 'Perdue' : (STATUS_CONFIG[selectedOrder.status] || STATUS_CONFIG.delivered).label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Informations générales */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Date et heure</p>
                    <p className="font-bold">
                      {new Date(selectedOrder.createdAt).toLocaleDateString('fr-FR', { 
                        day: 'numeric', 
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {selectedOrder.customerName && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Client</p>
                      <p className="font-bold">{selectedOrder.customerName}</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Mode de retrait</p>
                    <div className="flex items-center gap-2">
                      {selectedOrder.deliveryMethod === 'delivery' ? (
                        <>
                          <Bike className="h-4 w-4" />
                          <span className="font-bold">Livraison à domicile</span>
                        </>
                      ) : (
                        <>
                          <Store className="h-4 w-4" />
                          <span className="font-bold">Retrait au camion</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Paiement</p>
                    <div className="flex items-center gap-2">
                      {selectedOrder.payment?.provider === 'stripe' ? (
                        <>
                          <CreditCard className="h-4 w-4 text-emerald-500" />
                          <span className="font-bold">En ligne</span>
                          <Badge className="bg-emerald-500 text-white text-xs rounded-full">
                            {selectedOrder.payment?.paymentStatus === 'paid' ? 'Payé' : 'En attente'}
                          </Badge>
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 text-purple-500" />
                          <span className="font-bold">Manuel</span>
                          <Badge className="bg-purple-500 text-white text-xs rounded-full">
                            {selectedOrder.payment?.paymentStatus === 'paid' ? 'Payé' : 'À payer'}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Articles */}
                <div className="space-y-3">
                  <p className="text-sm font-bold text-muted-foreground">Articles</p>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-primary">{item.qty}x</span>
                          <span className="font-bold">{item.name}</span>
                        </div>
                        <span className="font-bold text-muted-foreground">
                          {((item.priceCents * item.qty) / 100).toFixed(2)} €
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="space-y-2 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total HT</span>
                    <span className="font-bold">
                      {(selectedOrder.totalCents / (1 + TVA_RATE) / 100).toFixed(2)} €
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">TVA (10%)</span>
                    <span className="font-bold">
                      {(selectedOrder.totalCents / 100 - selectedOrder.totalCents / (1 + TVA_RATE) / 100).toFixed(2)} €
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-xl font-black">Total TTC</span>
                    <span className="text-2xl font-black text-primary">
                      {(selectedOrder.totalCents / 100).toFixed(2)} €
                    </span>
                  </div>
                </div>

                {/* Timeline */}
                {selectedOrder.timeline && (
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-muted-foreground">Chronologie</p>
                    <div className="space-y-2">
                      {selectedOrder.timeline.acceptedAt && (
                        <div className="flex items-center gap-3 text-sm">
                          <CheckCircle className="h-4 w-4 text-blue-500" />
                          <span>Prise en charge</span>
                          <span className="text-muted-foreground">
                            {new Date(selectedOrder.timeline.acceptedAt).toLocaleTimeString('fr-FR')}
                          </span>
                        </div>
                      )}
                      {selectedOrder.timeline.readyAt && (
                        <div className="flex items-center gap-3 text-sm">
                          <Pizza className="h-4 w-4 text-orange-500" />
                          <span>Prête</span>
                          <span className="text-muted-foreground">
                            {new Date(selectedOrder.timeline.readyAt).toLocaleTimeString('fr-FR')}
                          </span>
                        </div>
                      )}
                      {selectedOrder.timeline.deliveredAt && (
                        <div className="flex items-center gap-3 text-sm">
                          <Package className="h-4 w-4 text-green-500" />
                          <span>Délivrée</span>
                          <span className="text-muted-foreground">
                            {new Date(selectedOrder.timeline.deliveredAt).toLocaleTimeString('fr-FR')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cadence de production - Mobile uniquement (sticky en bas) */}
      <div 
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${
          isScrolledUp ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="px-4 pb-4 pt-2">
          <Card className="glass-premium glass-glossy border-white/20 p-4 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-center gap-3">
              <Pizza className="h-6 w-6 text-orange-500" />
              <button
                onClick={() => {
                  const newValue = Math.max(1, pizzaPerHour - 1);
                  setPizzaPerHour(newValue);
                  if (db && truckId) {
                    const capacityRef = ref(db, `public/trucks/${truckId}/capacity/pizzaPerHour`);
                    set(capacityRef, newValue).catch(err => 
                      console.error('[Orders] Erreur sauvegarde cadence:', err)
                    );
                  }
                }}
                className="w-12 h-12 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 active:bg-orange-500/30 flex items-center justify-center font-black text-2xl text-orange-500 transition-colors"
              >
                −
              </button>
              <span className="text-2xl font-black text-orange-500 min-w-16 text-center">
                {pizzaPerHour}
              </span>
              <button
                onClick={() => {
                  const newValue = Math.min(100, pizzaPerHour + 1);
                  setPizzaPerHour(newValue);
                  if (db && truckId) {
                    const capacityRef = ref(db, `public/trucks/${truckId}/capacity/pizzaPerHour`);
                    set(capacityRef, newValue).catch(err => 
                      console.error('[Orders] Erreur sauvegarde cadence:', err)
                    );
                  }
                }}
                className="w-12 h-12 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 active:bg-orange-500/30 flex items-center justify-center font-black text-2xl text-orange-500 transition-colors"
              >
                +
              </button>
              <span className="text-base font-bold text-muted-foreground">
                🍕/h
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

