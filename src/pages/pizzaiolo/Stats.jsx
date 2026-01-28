import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, TrendingUp, Clock, PieChart as PieChartIcon, BarChart3, Store, Bike, CreditCard, Calendar, CalendarRange, Send, FileText, Calculator, Sparkles, CheckCircle2, Mail, Download, Zap } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { ROUTES } from '../../app/routes';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useTruckOrders } from '../../features/orders/hooks/useTruckOrders';
import { usePizzaioloTruckId } from '../../features/pizzaiolo/hooks/usePizzaioloTruckId';
import { getFilteredOrders, isExpired } from '../../features/orders/utils/orderFilters';
import BackButton from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
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

const TVA_RATE = 0.10;

export default function PizzaioloStats() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { truckId, loading: loadingTruckId } = usePizzaioloTruckId(user?.uid);
  const { orders, loading: ordersLoading } = useTruckOrders(truckId);

  const [filters, setFilters] = useState({
    status: 'all',
    payment: 'all',
    period: 'today',
  });

  const [chartType, setChartType] = useState('line');
  const [dataType, setDataType] = useState('revenue');

  // Utiliser les fonctions utilitaires communes
  const allFilteredOrders = getFilteredOrders(orders, filters);
  const filteredCompletedOrders = allFilteredOrders.filter((o) => {
    if (['delivered', 'cancelled'].includes(o.status)) return true;
    if (isExpired(o)) return true;
    return false;
  });

  const lostCount = filteredCompletedOrders.filter(o => isExpired(o)).length;
  const deliveredPickupCount = filteredCompletedOrders.filter(o => o.status === 'delivered' && o.deliveryMethod === 'pickup').length;
  const deliveredDeliveryCount = filteredCompletedOrders.filter(o => o.status === 'delivered' && o.deliveryMethod === 'delivery').length;

  const getChartData = () => {
    const labels = [];
    const revenues = [];
    const pizzaCounts = [];
    
    switch (filters.period) {
      case 'today': {
        const today = new Date();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const todayDelivered = filteredCompletedOrders.filter(o => {
          const orderDate = new Date(o.createdAt);
          return o.status === 'delivered' && orderDate >= todayStart;
        });
        
        if (todayDelivered.length === 0) {
          for (let hour = 8; hour <= 23; hour++) {
            labels.push(`${hour}h`);
            revenues.push(0);
            pizzaCounts.push(0);
          }
        } else {
          const hours = todayDelivered.map(o => new Date(o.createdAt).getHours());
          const minHour = Math.min(...hours);
          const maxHour = Math.max(...hours);
          const startHour = Math.max(0, minHour - 1);
          const endHour = Math.min(23, maxHour + 1);
          
          for (let hour = startHour; hour <= endHour; hour++) {
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
        }
        break;
      }
      
      case 'week': {
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
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

  const getGraphStats = () => {
    const data = getChartData();
    const totalRevenue = data.revenues.reduce((sum, val) => sum + val, 0);
    const totalPizzas = data.pizzaCounts.reduce((sum, val) => sum + val, 0);
    const totalCommands = deliveredPickupCount + deliveredDeliveryCount;
    const avgTicket = totalCommands > 0 ? totalRevenue / totalCommands : 0;
    
    return { totalRevenue, totalPizzas, totalCommands, avgTicket };
  };

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
      if (order.timeline?.acceptedAt && order.createdAt) {
        const acceptTime = (order.timeline.acceptedAt - order.createdAt) / 1000 / 60;
        totalAcceptanceTime += acceptTime;
        acceptanceCount++;
      }
      
      if (order.timeline?.acceptedAt) {
        const deliveredAt = order.timeline?.deliveredAt || Date.now();
        const prepTime = (deliveredAt - order.timeline.acceptedAt) / 1000 / 60;
        if (prepTime > 0 && prepTime < 300) {
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

  if (authLoading || loadingTruckId || ordersLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground font-medium">Chargement...</p>
      </div>
    );
  }

  // Si pas d'utilisateur connecté, rediriger
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground font-medium">Vous devez être connecté pour voir cette page.</p>
        <Button onClick={() => navigate('/login')}>Se connecter</Button>
      </div>
    );
  }

  // Si pas de truckId, l'utilisateur n'est pas pizzaiolo
  if (!truckId) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground font-medium">Vous n'avez pas encore de camion.</p>
        <Button onClick={() => navigate('/pro/creer-camion')}>Créer mon camion</Button>
      </div>
    );
  }

  // Vérifier si on a des commandes
  const hasOrders = orders && orders.length > 0;
  const totalOrdersCount = orders?.length || 0;

  return (
    <div className="space-y-8">
      <BackButton to="/pro/truck" />

      <div>
        <h1 className="text-4xl font-black tracking-tight">Statistiques</h1>
        <p className="text-muted-foreground font-medium mt-2">
          Analyse des performances de votre camion
        </p>
      </div>

      {/* Section Envoi Comptable - Toujours visible */}
      <Card className="glass-premium glass-glossy border-2 border-emerald-500/30 p-6 rounded-[24px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-bl from-emerald-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <Send className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Export Comptable</h2>
              <p className="text-sm text-muted-foreground">Simplifiez votre comptabilité</p>
            </div>
            <span className="ml-auto px-3 py-1 rounded-full bg-amber-500/20 text-amber-600 text-xs font-bold">
              Bientot
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Rapport PDF</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  CA, TVA, moyennes... tout en un clic
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
                <Mail className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Envoi Direct</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  1 bouton = rapport chez votre comptable
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                <Calculator className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm">TVA Auto</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Calcul automatique, zéro erreur
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-linear-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              <p className="text-sm font-medium">
                <span className="font-black text-emerald-500">Le reve :</span> Fin de mois, vous appuyez sur "Envoyer", et hop, votre comptable recoit tout. Fini les tableaux Excel !
              </p>
            </div>
          </div>

          <Button
            disabled
            className="mt-6 w-full md:w-auto bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-2xl h-12 px-8 opacity-50 cursor-not-allowed"
          >
            <Send className="h-4 w-4 mr-2" />
            Envoyer a mon comptable
          </Button>
        </div>
      </Card>

      {/* Si aucune commande, afficher la présentation des fonctionnalités */}
      {!hasOrders && (
        <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-[24px]">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-linear-to-br from-orange-500 to-red-500 mb-4">
              <TrendingUp className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">Vos statistiques arrivent bientot !</h2>
            <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
              Des que vous aurez vos premieres commandes, vous decouvrirez ici un tableau de bord complet pour piloter votre activite.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-linear-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 mb-3">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold">Chiffre d'affaires</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Suivez votre CA en temps reel : jour, semaine, mois, annee
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-linear-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 mb-3">
                <Calculator className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold">TVA Automatique</h3>
              <p className="text-sm text-muted-foreground mt-1">
                TVA collectee calculee automatiquement. Plus d'erreurs !
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-linear-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500 mb-3">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold">Performance</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Temps de preparation moyen, prise en charge... Optimisez !
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-linear-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500 mb-3">
                <PieChartIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold">Repartition</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Retrait camion vs livraison, cash vs CB... Tout en graphiques
              </p>
            </div>
          </div>

          <div className="mt-8 grid md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <span className="text-sm font-medium">Ticket moyen calcule automatiquement</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <span className="text-sm font-medium">Best-sellers identifies</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <span className="text-sm font-medium">Heures de pointe detectees</span>
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-600 text-sm font-bold">
              <Zap className="h-4 w-4" />
              Commencez a vendre pour debloquer vos stats !
            </div>
          </div>
        </Card>
      )}

      {/* Afficher les stats si on a des commandes */}
      {hasOrders && (
        <>

      {/* Filtres */}
      <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px]">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-black tracking-tight">Filtres</h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-4">
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
                onClick={() => setFilters(f => ({ ...f, period: 'today' }))}
                className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                  filters.period === 'today' 
                    ? 'bg-orange-600 text-white' 
                    : 'glass-premium glass-glossy border-white/20 hover:border-orange-600/50'
                }`}
              >
                <Clock className="h-4 w-4" />
                Aujourd'hui
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
                7 jours
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
                4 semaines
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
                12 mois
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Graphiques */}
      <div className="grid lg:grid-cols-2 gap-6">
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
            <div className="grid md:grid-cols-4 gap-4">
              <div className="glass-premium glass-glossy border-white/20 p-4 rounded-xl text-center">
                <p className="text-sm text-muted-foreground mb-1">CA TTC</p>
                <p className="text-2xl font-black text-emerald-500">{getGraphStats().totalRevenue.toFixed(2)} €</p>
              </div>
              <div className="glass-premium glass-glossy border-white/20 p-4 rounded-xl text-center">
                <p className="text-sm text-muted-foreground mb-1">TVA collectée</p>
                <p className="text-2xl font-black text-orange-500">{(getGraphStats().totalRevenue / (1 + TVA_RATE) * TVA_RATE).toFixed(2)} €</p>
              </div>
              <div className="glass-premium glass-glossy border-white/20 p-4 rounded-xl text-center">
                <p className="text-sm text-muted-foreground mb-1">Commandes</p>
                <p className="text-2xl font-black text-blue-500">
                  {getGraphStats().totalCommands}
                </p>
              </div>
              <div className="glass-premium glass-glossy border-white/20 p-4 rounded-xl text-center">
                <p className="text-sm text-muted-foreground mb-1">Ticket Moyen TTC</p>
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
      </>
      )}
    </div>
  );
}
