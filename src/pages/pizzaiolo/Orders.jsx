import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, User, Pizza, CheckCircle, ChefHat, Package, ArrowLeft, Filter, TrendingUp, Store, Bike, CreditCard, Calendar, CalendarRange, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { ref, get } from 'firebase/database';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/providers/AuthProvider';
import { ROUTES } from '../../app/routes';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useTruckOrders } from '../../features/orders/hooks/useTruckOrders';
import { useUpdateOrderStatus } from '../../features/orders/hooks/useUpdateOrderStatus';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Statuts possibles (SIMPLIFIÉ)
const STATUS_CONFIG = {
  received: { label: 'Non prise en charge', color: 'bg-orange-500', icon: Clock },
  accepted: { label: 'Prise en charge', color: 'bg-blue-500', icon: ChefHat },
  delivered: { label: 'Délivrée', color: 'bg-green-600', icon: CheckCircle },
  cancelled: { label: 'Annulée', color: 'bg-red-500', icon: Package },
  lost: { label: 'Perdue', color: 'bg-gray-600', icon: Package },
};

// Durée max avant de considérer une commande comme perdue (120 min après prise en charge)
const MAX_ORDER_DURATION = 120 * 60 * 1000;

export default function PizzaioloOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [truckId, setTruckId] = useState(null);
  const [loadingTruck, setLoadingTruck] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [pizzaPerHour, setPizzaPerHour] = useState(30); // Cadence du pizzaiolo
  const [openingHours, setOpeningHours] = useState(null); // Horaires d'ouverture
  const { orders, loading: ordersLoading } = useTruckOrders(truckId);
  const { updateStatus, loading: updating } = useUpdateOrderStatus();

  // États des filtres
  const [filters, setFilters] = useState({
    status: 'all', // 'all', 'lost', 'delivered_pickup', 'delivered_delivery'
    payment: 'all', // 'all', 'online'
    period: 'week', // 'today', 'week', 'month', 'year'
  });

  // Type de graphique
  const [chartType, setChartType] = useState('line'); // 'line', 'bar', 'doughnut'
  const [dataType, setDataType] = useState('revenue'); // 'revenue' ou 'pizzaCount'
  const [chartsVisible, setChartsVisible] = useState(true); // Afficher/cacher les graphiques
  const [filtersVisible, setFiltersVisible] = useState(true); // Afficher/cacher les filtres

  // Charger le truckId et la cadence du pizzaiolo
  useEffect(() => {
    if (!user?.uid) return;

    const loadTruckId = async () => {
      try {
        const pizzaioloRef = ref(db, `pizzaiolos/${user.uid}`);
        const snap = await get(pizzaioloRef);
        if (snap.exists() && snap.val().truckId) {
          const tid = snap.val().truckId;
          setTruckId(tid);
          
          // Charger la cadence et les horaires du camion
          const truckRef = ref(db, `public/trucks/${tid}`);
          const truckSnap = await get(truckRef);
          if (truckSnap.exists()) {
            const truckData = truckSnap.val();
            setPizzaPerHour(truckData.capacity?.pizzaPerHour || 30);
            setOpeningHours(truckData.openingHours || null);
          }
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

  // Calculer le temps écoulé (pour les commandes non prises en charge)
  const getElapsedTime = (createdAt) => {
    if (!createdAt) return '—';
    const diff = Math.floor((currentTime - createdAt) / 1000);
    
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    return `${Math.floor(diff / 3600)}h${Math.floor((diff % 3600) / 60)}min`;
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
    
    if (remaining <= 0) return { text: '0min', isLate: true };
    
    const remainingMin = Math.ceil(remaining / 1000 / 60);
    return { text: `${remainingMin}min`, isLate: false };
  };

  // Vérifier si une commande est perdue (>120min après prise en charge et pas délivrée)
  const isExpired = (order) => {
    if (!order.timeline?.acceptedAt) return false;
    // Perdue si prise en charge depuis plus de 120min ET pas encore livrée/annulée
    if (['delivered', 'cancelled'].includes(order.status)) return false;
    return currentTime - order.timeline.acceptedAt > MAX_ORDER_DURATION;
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

  // Calculer les données du graphique
  const getChartData = () => {
    const labels = [];
    const revenues = [];
    const pizzaCounts = []; // Nombre réel de pizzas
    const now = new Date();
    
    switch (filters.period) {
      case 'today': {
        // Heure par heure (11h à 23h ou selon horaires)
        const today = new Date();
        const currentHour = today.getHours();
        const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getDay()];
        const todayHours = openingHours?.[dayName];
        const startHour = todayHours?.enabled ? parseInt(todayHours.open?.split(':')[0] || 11) : 11;
        const endHour = todayHours?.enabled ? parseInt(todayHours.close?.split(':')[0] || 23) : 23;
        
        // S'arrêter à l'heure actuelle (pas afficher les heures futures)
        const maxHour = Math.min(currentHour, endHour);
        
        for (let hour = startHour; hour <= maxHour; hour++) {
          const hourStart = new Date(today);
          hourStart.setHours(hour, 0, 0, 0);
          const hourEnd = new Date(today);
          hourEnd.setHours(hour + 1, 0, 0, 0);
          
          const hourOrders = filteredCompletedOrders.filter((o) => {
            const orderDate = new Date(o.createdAt);
            return orderDate >= hourStart && orderDate < hourEnd && o.status === 'delivered';
          });
          
          labels.push(`${hour}h`);
          revenues.push(hourOrders.reduce((sum, o) => sum + (o.totalCents || 0) / 100, 0));
          pizzaCounts.push(hourOrders.reduce((sum, o) => sum + (o.items?.reduce((s, i) => s + (i.qty || 0), 0) || 0), 0));
        }
        break;
      }
      
      case 'week': {
        // Jour par jour sur 7 jours avec format DD.MM
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);
          
          const dayOrders = filteredCompletedOrders.filter((o) => {
            const orderDate = new Date(o.createdAt);
            return orderDate >= date && orderDate < nextDate && o.status === 'delivered';
          });
          
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          labels.push(`${day}.${month}`);
          revenues.push(dayOrders.reduce((sum, o) => sum + (o.totalCents || 0) / 100, 0));
          pizzaCounts.push(dayOrders.reduce((sum, o) => sum + (o.items?.reduce((s, i) => s + (i.qty || 0), 0) || 0), 0));
        }
        break;
      }
      
      case 'month': {
        // Semaine par semaine sur 4 semaines avec numéro de semaine
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Fonction pour obtenir le numéro de semaine ISO
        const getWeekNumber = (date) => {
          const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
          const dayNum = d.getUTCDay() || 7;
          d.setUTCDate(d.getUTCDate() + 4 - dayNum);
          const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        };
        
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(today);
          weekStart.setDate(weekStart.getDate() - (i * 7) - 6);
          const weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() - (i * 7) + 1);
          
          const weekOrders = filteredCompletedOrders.filter((o) => {
            const orderDate = new Date(o.createdAt);
            return orderDate >= weekStart && orderDate < weekEnd && o.status === 'delivered';
          });
          
          const weekNum = getWeekNumber(weekStart);
          labels.push(`S${weekNum}`);
          revenues.push(weekOrders.reduce((sum, o) => sum + (o.totalCents || 0) / 100, 0));
          pizzaCounts.push(weekOrders.reduce((sum, o) => sum + (o.items?.reduce((s, i) => s + (i.qty || 0), 0) || 0), 0));
        }
        break;
      }
      
      case 'year': {
        // Mois par mois sur 12 mois
        const today = new Date();
        
        for (let i = 11; i >= 0; i--) {
          const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
          
          const monthOrders = filteredCompletedOrders.filter((o) => {
            const orderDate = new Date(o.createdAt);
            return orderDate >= monthStart && orderDate < monthEnd && o.status === 'delivered';
          });
          
          labels.push(monthStart.toLocaleDateString('fr-FR', { month: 'short' }));
          revenues.push(monthOrders.reduce((sum, o) => sum + (o.totalCents || 0) / 100, 0));
          pizzaCounts.push(monthOrders.reduce((sum, o) => sum + (o.items?.reduce((s, i) => s + (i.qty || 0), 0) || 0), 0));
        }
        break;
      }
    }
    
    return { labels, revenues, pizzaCounts };
  };

  // Calculer les statistiques DIRECTEMENT depuis les données affichées dans le graphique
  const getGraphStats = () => {
    const data = getChartData();
    const totalRevenue = data.revenues.reduce((sum, val) => sum + val, 0);
    const totalPizzas = data.pizzaCounts.reduce((sum, val) => sum + val, 0);
    const totalCommands = deliveredPickupCount + deliveredDeliveryCount;
    const avgTicket = totalCommands > 0 ? totalRevenue / totalCommands : 0;
    
    return { totalRevenue, totalPizzas, totalCommands, avgTicket };
  };

  // Calculer les données de performance (temps moyens)
  const getPerformanceData = () => {
    const deliveredOrders = filteredCompletedOrders.filter(o => o.status === 'delivered');
    
    if (deliveredOrders.length === 0) {
      return {
        avgAcceptanceTime: 0,
        avgPreparationTime: 0
      };
    }
    
    let totalAcceptanceTime = 0;
    let totalPreparationTime = 0;
    let acceptanceCount = 0;
    let preparationCount = 0;
    
    deliveredOrders.forEach(order => {
      // Temps de prise en charge (createdAt -> acceptedAt)
      if (order.timeline?.acceptedAt && order.createdAt) {
        const acceptTime = (order.timeline.acceptedAt - order.createdAt) / 1000 / 60; // en minutes
        totalAcceptanceTime += acceptTime;
        acceptanceCount++;
      }
      
      // Temps de préparation (acceptedAt -> deliveredAt ou dernière étape)
      if (order.timeline?.acceptedAt) {
        const deliveredAt = order.timeline?.deliveredAt || Date.now();
        const prepTime = (deliveredAt - order.timeline.acceptedAt) / 1000 / 60; // en minutes
        if (prepTime > 0 && prepTime < 300) { // filtrer les valeurs aberrantes (> 5h)
          totalPreparationTime += prepTime;
          preparationCount++;
        }
      }
    });
    
    return {
      avgAcceptanceTime: acceptanceCount > 0 ? totalAcceptanceTime / acceptanceCount : 0,
      avgPreparationTime: preparationCount > 0 ? totalPreparationTime / preparationCount : 0
    };
  };

  // Configuration du graphique en ligne (CA ou pizzas)
  const lineChartData = () => {
    const data = getChartData();
    return {
      labels: data.labels,
      datasets: [
        {
          label: dataType === 'revenue' ? 'Chiffre d\'affaires' : 'Nombre de pizzas',
          data: dataType === 'revenue' ? data.revenues : data.pizzaCounts,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBackgroundColor: '#10B981',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }
      ]
    };
  };

  // Configuration du graphique en barres (nombre de commandes ou pizzas)
  const barChartData = () => {
    const data = getChartData();
    return {
      labels: data.labels,
      datasets: [
        {
          label: dataType === 'revenue' ? 'Chiffre d\'affaires' : 'Nombre de pizzas',
          data: dataType === 'revenue' ? data.revenues : data.pizzaCounts,
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: '#10B981',
          borderWidth: 2,
          borderRadius: 8,
        }
      ]
    };
  };

  // Configuration du graphique donut (répartition livraison)
  const doughnutChartData = () => {
    const pickup = filteredCompletedOrders.filter(o => o.status === 'delivered' && o.deliveryMethod === 'pickup').length;
    const delivery = filteredCompletedOrders.filter(o => o.status === 'delivered' && o.deliveryMethod === 'delivery').length;
    const lost = filteredCompletedOrders.filter(o => isExpired(o)).length;
    
    return {
      labels: ['Retrait Camion', 'Livraison', 'Perdues'],
      datasets: [
        {
          data: [pickup, delivery, lost],
          backgroundColor: [
            'rgba(16, 185, 129, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(107, 114, 128, 0.8)',
          ],
          borderColor: [
            '#10B981',
            '#3B82F6',
            '#6B7280',
          ],
          borderWidth: 2,
        }
      ]
    };
  };

  // Configuration du graphique de performance (temps moyens)
  const performanceChartData = () => {
    const perfData = getPerformanceData();
    
    return {
      labels: ['Prise en charge', 'Préparation'],
      datasets: [
        {
          label: 'Temps moyen (min)',
          data: [perfData.avgAcceptanceTime, perfData.avgPreparationTime],
          backgroundColor: [
            'rgba(249, 115, 22, 0.8)',
            'rgba(16, 185, 129, 0.8)',
          ],
          borderColor: [
            '#F97316',
            '#10B981',
          ],
          borderWidth: 3,
          borderRadius: 12,
        }
      ]
    };
  };

  // Options communes pour les graphiques
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (chartType === 'doughnut') {
              label += context.parsed;
            } else if (dataType === 'revenue') {
              label += context.parsed.y.toFixed(2) + '€';
            } else {
              label += context.parsed.y + ' pizza' + (context.parsed.y > 1 ? 's' : '');
            }
            return label;
          }
        }
      }
    },
    scales: chartType !== 'doughnut' ? {
      x: {
        position: 'bottom',
        grid: {
          display: true,
          drawBorder: true,
          drawOnChartArea: false,
          drawTicks: true,
          color: '#999999',
          lineWidth: 1,
          tickLength: 8,
          tickWidth: 1,
          tickColor: '#999999',
          borderColor: '#999999',
          borderWidth: 2
        },
        ticks: {
          display: true,
          color: '#999999',
          font: { size: 14, weight: 'bold' },
          padding: 10
        }
      },
      y: {
        position: 'left',
        grid: {
          display: true,
          drawBorder: true,
          drawOnChartArea: true,
          drawTicks: true,
          color: 'rgba(153, 153, 153, 0.2)',
          lineWidth: 1,
          tickLength: 8,
          tickWidth: 1,
          tickColor: '#999999',
          borderColor: '#999999',
          borderWidth: 2
        },
        ticks: {
          display: true,
          color: '#999999',
          font: { size: 14, weight: 'bold' },
          padding: 10,
          callback: function(value) {
            if (chartType === 'line' && dataType === 'revenue') return value.toFixed(0) + '€';
            if (chartType === 'bar' && dataType === 'revenue') return value.toFixed(0) + '€';
            return Number.isInteger(value) ? value : '';
          }
        },
        beginAtZero: true
      }
    } : undefined
  };

  // Filtrer les commandes selon les critères
  const getFilteredOrders = (ordersList) => {
    return ordersList.filter((order) => {
      // Filtre statut
      if (filters.status === 'lost' && !isExpired(order)) return false;
      if (filters.status === 'delivered_pickup' && !(order.status === 'delivered' && order.deliveryMethod === 'pickup')) return false;
      if (filters.status === 'delivered_delivery' && !(order.status === 'delivered' && order.deliveryMethod === 'delivery')) return false;
      
      // Filtre paiement
      if (filters.payment === 'online' && order.payment?.provider !== 'stripe') return false;
      
      // Filtre période
      const orderDate = new Date(order.createdAt);
      const now = new Date();
      
      switch (filters.period) {
        case 'today': {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (orderDate < today) return false;
          break;
        }
        case 'week': {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          weekAgo.setHours(0, 0, 0, 0);
          if (orderDate < weekAgo) return false;
          break;
        }
        case 'month': {
          const monthAgo = new Date();
          monthAgo.setDate(monthAgo.getDate() - 28);
          monthAgo.setHours(0, 0, 0, 0);
          if (orderDate < monthAgo) return false;
          break;
        }
        case 'year': {
          const yearAgo = new Date();
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          yearAgo.setHours(0, 0, 0, 0);
          if (orderDate < yearAgo) return false;
          break;
        }
      }
      
      return true;
    });
  };

  // Filtrer les commandes
  const activeOrders = orders.filter((o) => {
    if (['delivered', 'cancelled'].includes(o.status)) return false;
    if (isExpired(o)) return false;
    return true;
  });

  const completedOrders = orders.filter((o) => {
    if (['delivered', 'cancelled'].includes(o.status)) return true;
    if (isExpired(o)) return true;
    return false;
  });

  // Appliquer les filtres sur TOUTES les commandes (actives + historique)
  const allFilteredOrders = getFilteredOrders(orders);
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

  // Calculer les stats
  const totalRevenue = filteredCompletedOrders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + (o.totalCents || 0), 0) / 100;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Commandes Reçues</h1>
          <p className="text-muted-foreground font-medium mt-2">
            {activeOrders.length} commande{activeOrders.length > 1 ? 's' : ''} en cours
          </p>
        </div>
      </div>

      {/* Section Graphiques avec Card + toggle */}
      <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-black tracking-tight">Statistiques</h2>
          </div>
          
          <button
            onClick={() => setChartsVisible(!chartsVisible)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all glass-premium glass-glossy border-white/20 hover:border-primary/50"
          >
            <TrendingUp className="h-4 w-4" />
            {chartsVisible ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        {/* Graphiques en 2 colonnes avec animation */}
        <div 
          className={`grid lg:grid-cols-2 gap-6 transition-all duration-500 ease-in-out ${
            chartsVisible 
              ? 'opacity-100 max-h-[2000px] transform translate-y-0' 
              : 'opacity-0 max-h-0 overflow-hidden transform -translate-y-4'
          }`}
        >
        {/* Graphique CA / Commandes */}
        <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px]">
          <div className="flex items-center justify-between mb-6">
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity select-none"
              onClick={() => setDataType(prev => prev === 'revenue' ? 'pizzaCount' : 'revenue')}
              title="Cliquer pour basculer entre CA et nombre de pizzas"
            >
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <h2 className="text-xl font-black tracking-tight">
                {dataType === 'revenue' ? "Chiffre d'affaires" : "Nombre de pizzas"}
              </h2>
            </div>
            
            {/* Sélecteur de type de graphique */}
            <div className="flex gap-2">
              <button
                onClick={() => setChartType('line')}
                className={`p-2 rounded-xl transition-all ${
                  chartType === 'line'
                    ? 'bg-emerald-500 text-white'
                    : 'glass-premium glass-glossy border-white/20 hover:border-emerald-500/50'
                }`}
                title="Graphique linéaire"
              >
                <TrendingUp className="h-5 w-5" />
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`p-2 rounded-xl transition-all ${
                  chartType === 'bar'
                    ? 'bg-emerald-500 text-white'
                    : 'glass-premium glass-glossy border-white/20 hover:border-emerald-500/50'
                }`}
              title="Graphique en barres"
            >
              <BarChart3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setChartType('doughnut')}
              className={`p-2 rounded-xl transition-all ${
                chartType === 'doughnut'
                  ? 'bg-emerald-500 text-white'
                  : 'glass-premium glass-glossy border-white/20 hover:border-emerald-500/50'
              }`}
              title="Graphique circulaire"
            >
              <PieChartIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="h-80">
          {chartType === 'line' && <Line key={`${filters.period}-${dataType}-line`} data={lineChartData()} options={chartOptions} />}
          {chartType === 'bar' && <Bar key={`${filters.period}-${dataType}-bar`} data={barChartData()} options={chartOptions} />}
          {chartType === 'doughnut' && (
            <div className="flex items-center justify-center h-full">
              <div style={{ width: '300px', height: '300px' }}>
                <Doughnut key={`${filters.period}-doughnut`} data={doughnutChartData()} options={chartOptions} />
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="glass-premium glass-glossy border-white/20 p-4 rounded-xl text-center">
              <p className="text-sm text-muted-foreground mb-1">CA Total</p>
              <p className="text-2xl font-black text-emerald-500">{getGraphStats().totalRevenue.toFixed(2)} €</p>
            </div>
            <div className="glass-premium glass-glossy border-white/20 p-4 rounded-xl text-center">
              <p className="text-sm text-muted-foreground mb-1">Commandes</p>
              <p className="text-2xl font-black text-blue-500">
                {getGraphStats().totalCommands}
              </p>
            </div>
            <div className="glass-premium glass-glossy border-white/20 p-4 rounded-xl text-center">
              <p className="text-sm text-muted-foreground mb-1">Ticket Moyen</p>
              <p className="text-2xl font-black text-purple-500">
                {getGraphStats().avgTicket.toFixed(2)} €
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Graphique Performance */}
      <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px]">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="h-5 w-5 text-orange-500" />
          <h2 className="text-xl font-black tracking-tight">Performance</h2>
        </div>

        <div className="h-80">
          <Bar 
            key={`performance-${filters.period}`}
            data={performanceChartData()} 
            options={{
              ...chartOptions,
              scales: {
                x: chartOptions.scales?.x,
                y: {
                  ...chartOptions.scales?.y,
                  title: {
                    display: true,
                    text: '⏱️ Temps (minutes)',
                    color: '#10B981',
                    font: {
                      size: 16,
                      weight: 'bold',
                    },
                    padding: { bottom: 15 }
                  },
                  ticks: {
                    ...chartOptions.scales?.y?.ticks,
                    callback: function(value) {
                      return value.toFixed(0) + ' min';
                    }
                  }
                }
              }
            }} 
          />
        </div>
        
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-premium glass-glossy border-white/20 p-4 rounded-xl text-center">
              <p className="text-sm text-muted-foreground mb-1">⏱️ Prise en charge</p>
              <p className="text-2xl font-black text-orange-500">{getPerformanceData().avgAcceptanceTime.toFixed(1)} min</p>
            </div>
            <div className="glass-premium glass-glossy border-white/20 p-4 rounded-xl text-center">
              <p className="text-sm text-muted-foreground mb-1">🍕 Préparation</p>
              <p className="text-2xl font-black text-emerald-500">{getPerformanceData().avgPreparationTime.toFixed(1)} min</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </Card>

      {/* Filtres avec bouton toggle */}
      <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px]">
        <div className="flex items-center justify-between mb-4">
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
              ? 'opacity-100 max-h-[1000px] transform translate-y-0' 
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
            </div>
          </div>

          {/* Filtre Période */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground">Période</label>
            <div className="grid gap-2">
              <button
                onClick={() => setFilters(f => ({ ...f, period: 'today' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  filters.period === 'today' 
                    ? 'bg-orange-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-orange-600/50'
                }`}
              >
                <Clock className="h-4 w-4" />
                Aujourd'hui (heure/heure)
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, period: 'week' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  filters.period === 'week' 
                    ? 'bg-indigo-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-indigo-600/50'
                }`}
              >
                <Calendar className="h-4 w-4" />
                7 jours (jour/jour)
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, period: 'month' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  filters.period === 'month' 
                    ? 'bg-purple-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-purple-600/50'
                }`}
              >
                <CalendarRange className="h-4 w-4" />
                4 semaines (sem/sem)
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, period: 'year' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  filters.period === 'year' 
                    ? 'bg-emerald-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-emerald-600/50'
                }`}
              >
                <CalendarRange className="h-4 w-4" />
                12 mois (mois/mois)
              </button>
            </div>
          </div>
        </div>
      </Card>

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
          <div className="grid gap-4">
            {filteredActiveOrders.map((order) => {
              const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
              const StatusIcon = statusConfig.icon;
              const elapsed = getElapsedTime(order.createdAt);
              const remaining = getRemainingTime(order, pizzaPerHour);
              const totalPizzas = order.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;

              return (
                <Card
                  key={order.id}
                  className={`glass-premium glass-glossy ${
                    order.source === 'manual' 
                      ? 'border-purple-500/50 bg-purple-500/5' 
                      : 'border-white/20'
                  } p-6 rounded-[24px] ${
                    remaining?.isLate ? 'border-red-500/50' : ''
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
                              
                              {/* Badge Commande Manuelle */}
                              {order.source === 'manual' && (
                                <Badge className="bg-purple-600 text-white rounded-full text-xs font-bold">
                                  ✋ MANUELLE
                                </Badge>
                              )}
                              
                              {/* Badge Livraison */}
                              {order.deliveryMethod === 'delivery' ? (
                                <Badge className="bg-blue-600 text-white rounded-full text-xs font-bold flex items-center gap-1">
                                  <Bike className="h-3 w-3" />
                                  LIVRAISON À DOMICILE
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-600 text-white rounded-full text-xs font-bold flex items-center gap-1">
                                  <Store className="h-3 w-3" />
                                  RETRAIT AU CAMION
                                </Badge>
                              )}
                            </div>
                            
                            {/* Prénom du client mis en avant */}
                            <div className="mb-2 px-3 py-1.5 bg-primary/20 rounded-lg inline-flex items-center gap-2">
                              <User className="h-4 w-4 text-primary" />
                              <span className="font-black text-primary text-base">
                                {order.customerName || 'Client'}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                              <div className="text-2xl font-black text-orange-500">
                                {elapsed}
                              </div>
                              <span className="text-xs font-bold text-muted-foreground uppercase">Chrono</span>
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
                          className="w-full rounded-xl h-12 font-bold bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center gap-2"
                        >
                          {order.deliveryMethod === 'delivery' ? (
                            <>
                              <Bike className="h-4 w-4" />
                              Délivré à Uber Eats
                            </>
                          ) : (
                            <>
                              <Store className="h-4 w-4" />
                              Délivré
                            </>
                          )}
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
                <Card key={order.id} className="glass-premium glass-glossy border-white/20 p-4 rounded-3xl opacity-60">
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

