import { useState, useEffect, useMemo } from 'react';
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
import { useServerNow } from '../../hooks/useServerNow';
import { OrderCard } from '../../features/orders/components/OrderCard';
import { OrderSection } from '../../features/orders/components/OrderSection';
import BackButton from '../../components/ui/BackButton';
import { ReorderableOrderList } from '../../features/orders/components/ReorderableOrderList';
import { usePizzaioloOrderRanking } from '../../features/orders/hooks/usePizzaioloOrderRanking';
import { coalesceMs, toMs } from '../../lib/timestamps';
import { pizzaioloMarkOrderPaid } from '../../lib/ordersApi';
import { useAutoDismissMessage } from '../../hooks/useAutoDismissMessage';
import { 
  getEstimatedDeliveryTime, 
  formatDeliveryTime, 
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
  const { nowMs: currentTime } = useServerNow({ tickMs: 1000 });
  const [pizzaPerHour, setPizzaPerHour] = useState(30); // Cadence du pizzaiolo
  const [_openingHours, setOpeningHours] = useState(null); // Horaires d'ouverture
  const { orders, loading: ordersLoading } = useTruckOrders(truckId, { navigate });
  const { updateStatus, loading: updating, error: updateError } = useUpdateOrderStatus();

  const [message, setMessage] = useState('');
  // Les messages de succès/info disparaissent (les ❌ restent).
  useAutoDismissMessage(message, setMessage, { delayMs: 5000, dismissErrors: false });

  // Optimistic UI: on applique le changement immédiatement (localStorage), puis RTDB rattrape.
  // Objectif: retrouver l'effet “instantané” qu'apporte normalement le SDK RTDB (latency compensation)
  // tout en gardant les writes orders côté serveur only (Functions).
  const overridesStorageKey = useMemo(() => {
    if (!truckId) return null;
    return `planizza:pizzaiolo:orderStatusOverrides:${truckId}`;
  }, [truckId]);

  const [statusOverrides, setStatusOverrides] = useState({});

  useEffect(() => {
    if (!overridesStorageKey) {
      setStatusOverrides({});
      return;
    }

    try {
      const raw = localStorage.getItem(overridesStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      const loaded = parsed && typeof parsed === 'object' ? parsed : {};

      // IMPORTANT: ne pas écraser un override optimistic posé entre-temps.
      // Exemple bug: clic "Prise en charge" -> override ajouté -> effect load localStorage (retardé)
      // écrase avec un snapshot plus ancien => la tuile revient à l'état initial (flicker).
      setStatusOverrides((prev) => {
        const prevObj = prev && typeof prev === 'object' ? prev : {};
        const merged = { ...loaded };

        for (const [orderId, ov] of Object.entries(prevObj)) {
          const cur = merged[orderId];
          const ovTs = typeof ov?.ts === 'number' ? ov.ts : 0;
          const curTs = typeof cur?.ts === 'number' ? cur.ts : 0;

          // Garder la version la plus récente (ou celle du runtime si aucun ts côté loaded)
          if (!cur || ovTs >= curTs) {
            merged[orderId] = ov;
          }
        }

        return merged;
      });
    } catch {
      setStatusOverrides({});
    }
  }, [overridesStorageKey]);

  useEffect(() => {
    if (!overridesStorageKey) return;
    try {
      localStorage.setItem(overridesStorageKey, JSON.stringify(statusOverrides || {}));
    } catch {
      // best-effort
    }
  }, [overridesStorageKey, statusOverrides]);

  const uiOrders = useMemo(() => {
    if (!Array.isArray(orders) || !orders.length) return [];
    if (!statusOverrides || typeof statusOverrides !== 'object') return orders;

    return orders.map((o) => {
      const ov = statusOverrides[o.id];
      if (!ov) return o;

      const next = { ...o };
      if (ov.status) next.status = ov.status;
      if (ov.timelinePatch && typeof ov.timelinePatch === 'object') {
        next.timeline = { ...(o.timeline || {}), ...ov.timelinePatch };
      }
      return next;
    });
  }, [orders, statusOverrides]);

  // Réconciliation: si RTDB a déjà la valeur finale, on retire l'override.
  useEffect(() => {
    if (!statusOverrides || typeof statusOverrides !== 'object') return;
    if (!Array.isArray(orders) || !orders.length) return;

    const byId = new Map(orders.map((o) => [o.id, o]));
    const next = { ...statusOverrides };
    let changed = false;

    for (const [orderId, ov] of Object.entries(statusOverrides)) {
      const live = byId.get(orderId);
      if (!live) continue;

      // Si le statut côté serveur correspond à l'optimistic, on peut purger.
      if (ov?.status && live.status === ov.status) {
        delete next[orderId];
        changed = true;
      }
    }

    if (changed) setStatusOverrides(next);
  }, [orders, statusOverrides]);

  const applyOptimisticStatus = (orderId, nextStatus) => {
    if (!orderId || !nextStatus) return;
    const now = Date.now();
    const patch = {};
    if (nextStatus === 'accepted') patch.acceptedAt = now;
    if (nextStatus === 'delivered') patch.deliveredAt = now;

    setStatusOverrides((prev) => ({
      ...(prev || {}),
      [orderId]: {
        status: nextStatus,
        timelinePatch: patch,
        ts: now,
      },
    }));
  };

  const clearOptimisticStatus = (orderId) => {
    if (!orderId) return;
    setStatusOverrides((prev) => {
      if (!prev || typeof prev !== 'object' || !prev[orderId]) return prev;
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  };

  // États des filtres
  const [filters, setFilters] = useState({
    status: 'all', // 'all', 'lost', 'delivered_pickup', 'delivered_delivery'
    payment: 'all', // 'all', 'online', 'cash'
    period: 'all', // 'all', 'today', 'week', 'month', 'year'
  });

  const [filtersVisible, setFiltersVisible] = useState(false); // Afficher/cacher les filtres

  // Détails inline (accordion) : une seule carte ouverte à la fois
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Historique : pop-up type ticket de caisse
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState(null);

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

  // Calculer le temps écoulé (pour les commandes non prises en charge)
  const getElapsedTime = (createdAtMs) => {
    if (!createdAtMs) return '—';
    
    // Debug: afficher les timestamps
    console.log('[CHRONO] createdAt:', createdAtMs, 'currentTime:', currentTime, 'diff:', (currentTime - createdAtMs) / 1000, 's');
    
    const diff = Math.floor((currentTime - createdAtMs) / 1000);
    
    // Si le temps est négatif (peut arriver avec désync horloge), afficher en positif
    const absDiff = Math.abs(diff);
    
    // TOUJOURS afficher en secondes pour plus d'impact
    return `${absDiff}s`;
  };

  // Calculer le temps restant basé sur la cadence du pizzaiolo (pour commandes prises en charge)
  const getRemainingTime = (order, pizzaPerHour) => {
    const acceptedAtMs = toMs(order.timeline?.acceptedAt);
    if (!acceptedAtMs || !pizzaPerHour) return null;
    
    const totalPizzas = order.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 1;
    // Calculer le temps estimé basé sur la cadence (pizzas par heure)
    const minutesPerPizza = 60 / pizzaPerHour;
    const estimatedMs = totalPizzas * minutesPerPizza * 60 * 1000;
    
    const elapsed = currentTime - acceptedAtMs;
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
    applyOptimisticStatus(orderId, 'accepted');
    const result = await updateStatus(orderId, 'accepted');
    console.log('[Orders] Résultat:', result);
    if (result?.ok) {
      setMessage('✅ Commande prise en charge.');
    } else {
      clearOptimisticStatus(orderId);
      const statusSuffix = result?.status ? ` (HTTP ${result.status})` : '';
      setMessage(`❌ Impossible de prendre en charge${statusSuffix}. ${result?.error || updateError || ''}`.trim());
    }
  };

  // Marquer comme livrée
  const handleDeliver = async (orderId) => {
    console.log('[Orders] Clic sur Délivré, orderId:', orderId);
    
    const order = uiOrders.find((o) => o.id === orderId);
    const paymentStatus = order?.payment?.paymentStatus;
    const paymentProvider = order?.payment?.provider;

    // IMPORTANT: le serveur refuse delivered si paymentStatus !== 'paid' (409)
    // On rend ça explicite dans l'UI (sinon "ça ne marche pas" sans explication).
    if (paymentStatus !== 'paid') {
      if (paymentProvider === 'manual') {
        const confirmed = window.confirm(
          `⚠️ Cette commande n'est pas marquée PAYÉE.\n\n` +
          `Voulez-vous la marquer payée puis la délivrer ?`
        );
        if (!confirmed) return;

        try {
          await pizzaioloMarkOrderPaid({ orderId, method: 'CASH' });
          setMessage('✅ Paiement enregistré.');
        } catch (err) {
          console.error('[Orders] Erreur lors du marquage payé (auto):', err);
          setMessage(`❌ Paiement: ${err?.message || 'Erreur inconnue'}`);
          return;
        }
      } else {
        setMessage('❌ Paiement en attente: impossible de délivrer tant que Stripe n’a pas confirmé.');
        return;
      }
    }

    applyOptimisticStatus(orderId, 'delivered');
    const result = await updateStatus(orderId, 'delivered');
    console.log('[Orders] Résultat:', result);
    if (result?.ok) {
      setMessage('✅ Commande délivrée.');
    } else {
      clearOptimisticStatus(orderId);
      // Exemple fréquent: 409 — Paiement requis avant livraison/remise
      const statusSuffix = result?.status ? ` (HTTP ${result.status})` : '';
      setMessage(`❌ Livraison refusée${statusSuffix}. ${result?.error || updateError || ''}`.trim());
    }
  };

  // Marquer comme payée (pour commandes manuelles)
  const handleMarkPaid = async (orderId) => {
    try {
      await pizzaioloMarkOrderPaid({ orderId, method: 'CASH' });
      console.log('[Orders] Commande marquée comme payée:', orderId);
    } catch (error) {
      console.error('[Orders] Erreur lors du marquage payé:', error);
    }
  };

  // Appliquer les filtres sur TOUTES les commandes (actives + historique)
  const allFilteredOrders = getFilteredOrders(uiOrders, filters);
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

  const getCreatedAtMs = (order) => coalesceMs(order?.createdAt, order?.createdAtClient, 0) || 0;

  // Ordre de base = chronologie d'arrivée (createdAt croissant)
  const baseNotAcceptedPaid = [...orderGroups.notAcceptedPaid].sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b));
  const baseNotAcceptedUnpaid = [...orderGroups.notAcceptedUnpaid].sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b));
  const baseAcceptedPaid = [...orderGroups.acceptedPaid].sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b));
  const baseAcceptedUnpaid = [...orderGroups.acceptedUnpaid].sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b));

  // Rangement pizzaiolo (override) : localStorage + Firebase
  const notAcceptedPaidRanking = usePizzaioloOrderRanking({
    uid: user?.uid,
    truckId,
    groupKey: 'notAcceptedPaid',
    baseIds: baseNotAcceptedPaid.map((o) => o.id),
  });
  const notAcceptedUnpaidRanking = usePizzaioloOrderRanking({
    uid: user?.uid,
    truckId,
    groupKey: 'notAcceptedUnpaid',
    baseIds: baseNotAcceptedUnpaid.map((o) => o.id),
  });
  const acceptedPaidRanking = usePizzaioloOrderRanking({
    uid: user?.uid,
    truckId,
    groupKey: 'acceptedPaid',
    baseIds: baseAcceptedPaid.map((o) => o.id),
  });
  const acceptedUnpaidRanking = usePizzaioloOrderRanking({
    uid: user?.uid,
    truckId,
    groupKey: 'acceptedUnpaid',
    baseIds: baseAcceptedUnpaid.map((o) => o.id),
  });

  const baseNotAcceptedPaidById = new Map(baseNotAcceptedPaid.map((o) => [o.id, o]));
  const baseNotAcceptedUnpaidById = new Map(baseNotAcceptedUnpaid.map((o) => [o.id, o]));
  const baseAcceptedPaidById = new Map(baseAcceptedPaid.map((o) => [o.id, o]));
  const baseAcceptedUnpaidById = new Map(baseAcceptedUnpaid.map((o) => [o.id, o]));

  console.log('[PizzaioloOrders] Ordre base=chronologie + override pizzaiolo');

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
      <Card className="glass-premium glass-glossy border-white/20 p-12 rounded-4xl text-center">
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
      {/* En-tête compact: Retour + titre sur une seule ligne */}
      <div className="flex items-center gap-3">
        <BackButton to="/pro/truck" />
        <h1 className="text-xl sm:text-2xl font-black tracking-tight">Commandes</h1>
      </div>

      {(message || updateError) && (
        <div
          className={`sticky top-3 z-50 rounded-2xl border p-4 backdrop-blur-xl shadow-xl ${
            (message || updateError).includes('✅')
              ? 'bg-emerald-950/60 text-emerald-100 border-emerald-500/25'
              : 'bg-red-950/60 text-red-100 border-red-500/25'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-sm font-bold leading-relaxed">
              {message || `❌ ${updateError}`}
            </div>
            <button
              type="button"
              onClick={() => setMessage('')}
              className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:bg-white/15 transition-colors"
              aria-label="Fermer"
              title="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filtres des commandes */}
      <Card className={`glass-premium glass-glossy border-white/20 rounded-3xl transition-all duration-300 ${
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
          <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-4xl text-center">
            <Pizza className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Chargement...</p>
          </Card>
        ) : filteredActiveOrders.length === 0 ? (
          <Card className="glass-premium glass-glossy border-white/20 p-12 rounded-4xl text-center">
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
              count={baseNotAcceptedPaid.length}
              color="green-500"
            >
              <ReorderableOrderList
                orderedIds={notAcceptedPaidRanking.orderedIds}
                groupKey="notAcceptedPaid"
                onOrderedIdsChange={notAcceptedPaidRanking.setManualOrder}
                renderItem={(id) => {
                  const order = baseNotAcceptedPaidById.get(id);
                  if (!order) return null;

                  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
                  const elapsed = getElapsedTime(getCreatedAtMs(order));
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
                      expanded={expandedOrderId === order.id}
                      onToggleExpanded={() =>
                        setExpandedOrderId((prev) => (prev === order.id ? null : order.id))
                      }
                      updating={updating}
                      borderVariant="paid"
                    />
                  );
                }}
              />
            </OrderSection>

            {/* Section 2: Commandes non prises en charge - NON PAYÉES */}
            <OrderSection 
              title="Non prises en charge · Non payées" 
              count={baseNotAcceptedUnpaid.length}
              color="orange-500"
            >
              <ReorderableOrderList
                orderedIds={notAcceptedUnpaidRanking.orderedIds}
                groupKey="notAcceptedUnpaid"
                onOrderedIdsChange={notAcceptedUnpaidRanking.setManualOrder}
                renderItem={(id) => {
                  const order = baseNotAcceptedUnpaidById.get(id);
                  if (!order) return null;

                  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
                  const elapsed = getElapsedTime(getCreatedAtMs(order));
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
                      expanded={expandedOrderId === order.id}
                      onToggleExpanded={() =>
                        setExpandedOrderId((prev) => (prev === order.id ? null : order.id))
                      }
                      updating={updating}
                      borderVariant="unpaid"
                    />
                  );
                }}
              />
            </OrderSection>

            {/* Section 3: Commandes prises en charge - PAYÉES */}
            <OrderSection 
              title="En préparation · Payées" 
              count={baseAcceptedPaid.length}
              color="green-500"
            >
              <ReorderableOrderList
                orderedIds={acceptedPaidRanking.orderedIds}
                groupKey="acceptedPaid"
                onOrderedIdsChange={acceptedPaidRanking.setManualOrder}
                renderItem={(id) => {
                  const order = baseAcceptedPaidById.get(id);
                  if (!order) return null;

                  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
                  const elapsed = getElapsedTime(getCreatedAtMs(order));
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
                      expanded={expandedOrderId === order.id}
                      onToggleExpanded={() =>
                        setExpandedOrderId((prev) => (prev === order.id ? null : order.id))
                      }
                      updating={updating}
                      borderVariant="paid"
                    />
                  );
                }}
              />
            </OrderSection>

            {/* Section 4: Commandes prises en charge - NON PAYÉES */}
            <OrderSection 
              title="En préparation · Non payées" 
              count={baseAcceptedUnpaid.length}
              color="orange-500"
            >
              <ReorderableOrderList
                orderedIds={acceptedUnpaidRanking.orderedIds}
                groupKey="acceptedUnpaid"
                onOrderedIdsChange={acceptedUnpaidRanking.setManualOrder}
                renderItem={(id) => {
                  const order = baseAcceptedUnpaidById.get(id);
                  if (!order) return null;

                  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
                  const elapsed = getElapsedTime(getCreatedAtMs(order));
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
                      expanded={expandedOrderId === order.id}
                      onToggleExpanded={() =>
                        setExpandedOrderId((prev) => (prev === order.id ? null : order.id))
                      }
                      updating={updating}
                      borderVariant="unpaid"
                    />
                  );
                }}
              />
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
              const createdAtMs = getCreatedAtMs(order);
              
              return (
                <Card 
                  key={order.id} 
                  className="glass-premium glass-glossy border-white/20 p-4 rounded-3xl opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => setSelectedHistoryOrder(order)}
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
                        {createdAtMs ? new Date(createdAtMs).toLocaleDateString('fr-FR', { 
                          day: 'numeric', 
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '—'}
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

      {/* Historique: pop-up type ticket de caisse */}
      <Dialog open={!!selectedHistoryOrder} onOpenChange={() => setSelectedHistoryOrder(null)}>
        <DialogContent className="max-w-xl glass-premium glass-glossy border-white/20 rounded-4xl max-h-[90vh] overflow-y-auto">
          {selectedHistoryOrder ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black">Ticket</span>
                    <span className="text-sm font-black text-muted-foreground">
                      #{selectedHistoryOrder.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <Badge className={`${(isExpired(selectedHistoryOrder) ? STATUS_CONFIG.lost : STATUS_CONFIG[selectedHistoryOrder.status] || STATUS_CONFIG.delivered).color} text-white rounded-full`}>
                    {isExpired(selectedHistoryOrder) ? 'Perdue' : (STATUS_CONFIG[selectedHistoryOrder.status] || STATUS_CONFIG.delivered).label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {/* En-tête */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-bold">Date</span>
                    <span className="font-black">
                      {(() => {
                        const ms = getCreatedAtMs(selectedHistoryOrder);
                        if (!ms) return '—';
                        return new Date(ms).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-bold">Client</span>
                    <span className="font-black">
                      {selectedHistoryOrder.customerName || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-bold">Retrait</span>
                    <span className="font-black inline-flex items-center gap-2">
                      {selectedHistoryOrder.deliveryMethod === 'delivery' ? (
                        <>
                          <Bike className="h-4 w-4" />
                          Livraison
                        </>
                      ) : (
                        <>
                          <Store className="h-4 w-4" />
                          Camion
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-bold">Paiement</span>
                    <span className="font-black inline-flex items-center gap-2">
                      <CreditCard className={`h-4 w-4 ${selectedHistoryOrder.payment?.provider === 'stripe' ? 'text-emerald-500' : 'text-purple-500'}`} />
                      {selectedHistoryOrder.payment?.provider === 'stripe' ? 'En ligne' : 'Manuel'}
                      <Badge className={`${selectedHistoryOrder.payment?.paymentStatus === 'paid' ? 'bg-emerald-600/90' : 'bg-orange-600/90'} text-white rounded-full text-xs`}>
                        {selectedHistoryOrder.payment?.paymentStatus === 'paid' ? 'Payé' : 'En attente'}
                      </Badge>
                    </span>
                  </div>
                </div>

                {/* Articles */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="text-sm font-black mb-3">Articles</div>
                  <div className="space-y-2">
                    {(Array.isArray(selectedHistoryOrder.items) ? selectedHistoryOrder.items : []).map((item, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="font-black truncate">
                            <span className="text-primary">{item.qty}x</span> {item.name}
                          </div>
                          {/* Modifs ingrédients (ticket) */}
                          {(item.removedIngredients?.length > 0 || item.addedIngredients?.length > 0) ? (
                            <div className="mt-1 text-xs space-y-1">
                              {item.removedIngredients?.length > 0 ? (
                                <div className="text-red-500 font-bold">➖ Sans: {item.removedIngredients.join(', ')}</div>
                              ) : null}
                              {item.addedIngredients?.length > 0 ? (
                                <div className="text-green-500 font-bold">➕ Avec: {item.addedIngredients.join(', ')}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 font-black text-muted-foreground">
                          {typeof item.priceCents === 'number'
                            ? `${(((item.priceCents || 0) * (item.qty || 0)) / 100).toFixed(2)} €`
                            : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totaux */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-bold">Total HT</span>
                    <span className="font-black">
                      {typeof selectedHistoryOrder.totalCents === 'number'
                        ? `${(selectedHistoryOrder.totalCents / (1 + TVA_RATE) / 100).toFixed(2)} €`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-bold">TVA (10%)</span>
                    <span className="font-black">
                      {typeof selectedHistoryOrder.totalCents === 'number'
                        ? `${(selectedHistoryOrder.totalCents / 100 - selectedHistoryOrder.totalCents / (1 + TVA_RATE) / 100).toFixed(2)} €`
                        : '—'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-lg font-black">Total TTC</span>
                    <span className="text-xl font-black text-primary">
                      {typeof selectedHistoryOrder.totalCents === 'number'
                        ? `${(selectedHistoryOrder.totalCents / 100).toFixed(2)} €`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
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

