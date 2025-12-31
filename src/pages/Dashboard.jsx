import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ChefHat, Receipt, Pizza, Store, ArrowRight, TrendingUp, Clock, Star } from 'lucide-react';
import { useAuth } from '../app/providers/AuthProvider';
import { ROUTES } from '../app/routes';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/Badge';
import { ref, get } from 'firebase/database';
import { db } from '../lib/firebase';
import { useMyOrders } from '../features/orders/hooks/useMyOrders';

export default function Dashboard() {
  const { user } = useAuth();
  const { orders, loading: ordersLoading } = useMyOrders();
  const [isPizzaiolo, setIsPizzaiolo] = useState(false);
  const [truckData, setTruckData] = useState(null);
  const [loadingTruck, setLoadingTruck] = useState(false);

  // Vérifier si l'utilisateur est pizzaiolo
  useEffect(() => {
    if (!user?.uid) {
      setIsPizzaiolo(false);
      return;
    }

    const checkPizzaiolo = async () => {
      try {
        const pizzaioloRef = ref(db, `pizzaiolos/${user.uid}`);
        const snap = await get(pizzaioloRef);
        
        if (snap.exists() && snap.val().truckId) {
          setIsPizzaiolo(true);
          
          // Charger les infos du camion
          setLoadingTruck(true);
          const truckRef = ref(db, `public/trucks/${snap.val().truckId}`);
          const truckSnap = await get(truckRef);
          
          if (truckSnap.exists()) {
            setTruckData({ id: snap.val().truckId, ...truckSnap.val() });
          }
          setLoadingTruck(false);
        } else {
          setIsPizzaiolo(false);
        }
      } catch (err) {
        console.error('[PLANIZZA] Erreur vérification pizzaiolo:', err);
        setIsPizzaiolo(false);
        setLoadingTruck(false);
      }
    };

    checkPizzaiolo();
  }, [user?.uid]);

  // Stats client
  const recentOrders = orders.slice(0, 3);
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'ready' || o.status === 'completed').length;

  return (
    <div className="relative isolate mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 -z-10 w-150 h-150 bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 -z-10 w-100 h-100 bg-orange-500/5 rounded-full blur-[100px]" />

      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center mb-6">
          <Avatar className="h-24 w-24 border-4 border-white/40 shadow-2xl">
            <AvatarImage src={user?.photoURL} alt={user?.displayName || 'User'} />
            <AvatarFallback className="bg-primary/20 text-primary font-black text-2xl">
              {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
        <h1 className="text-5xl font-black tracking-tighter text-premium-gradient">
          Salut, {user?.displayName?.split(' ')[0] || 'Chef'} ! 👋
        </h1>
        <p className="text-muted-foreground font-medium text-lg">
          Bienvenue sur votre tableau de bord personnel
        </p>
      </div>

      {/* Section Client */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-full" />
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
            <Pizza className="h-7 w-7 text-primary" />
            Mon Espace Client
          </h2>
          <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-full" />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Mes Commandes */}
          <Link to={ROUTES.myOrders}>
            <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-[32px] hover:scale-[1.02] hover:shadow-2xl transition-all group cursor-pointer h-full">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Receipt className="h-8 w-8 text-primary" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black tracking-tight">Mes Commandes</h3>
                  <p className="text-sm text-muted-foreground font-medium">
                    {totalOrders === 0 ? 'Aucune commande' : `${totalOrders} commande${totalOrders > 1 ? 's' : ''}`}
                  </p>
                  {totalOrders > 0 && (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
                      <TrendingUp className="h-3 w-3" />
                      {completedOrders} complétée{completedOrders > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </Link>

          {/* Mon Profil */}
          <Link to={ROUTES.account}>
            <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-[32px] hover:scale-[1.02] hover:shadow-2xl transition-all group cursor-pointer h-full">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-4 rounded-2xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.photoURL} />
                      <AvatarFallback className="bg-purple-500/20 text-purple-500 font-bold text-sm">
                        {user?.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black tracking-tight">Mon Profil</h3>
                  <p className="text-sm text-muted-foreground font-medium">
                    Gérer mes informations personnelles
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>

        {/* Dernières commandes */}
        {recentOrders.length > 0 && (
          <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-[32px]">
            <h3 className="text-lg font-black tracking-tight mb-6 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Commandes Récentes
            </h3>
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={ROUTES.order(order.id)}
                  className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <Pizza className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{order.truckName || 'Commande'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={order.status === 'ready' ? 'default' : 'secondary'}
                    className="rounded-full"
                  >
                    {order.status === 'ready' ? 'Prête' : order.status === 'cook' ? 'En cuisson' : 'En cours'}
                  </Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Section Pizzaiolo (si applicable) */}
      {isPizzaiolo ? (
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent rounded-full" />
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <ChefHat className="h-7 w-7 text-orange-500" />
              Mon Espace Pizzaiolo
            </h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent rounded-full" />
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Mon Camion */}
            <Link to={ROUTES.pizzaioloProfile}>
              <Card className="glass-premium glass-glossy border-orange-500/20 p-8 rounded-[32px] hover:scale-[1.02] hover:shadow-2xl hover:shadow-orange-500/10 transition-all group cursor-pointer h-full">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="p-4 rounded-2xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                      <Store className="h-8 w-8 text-orange-500" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black tracking-tight">Mon Camion</h3>
                    {loadingTruck ? (
                      <p className="text-sm text-muted-foreground font-medium">Chargement...</p>
                    ) : truckData ? (
                      <div className="space-y-2">
                        <p className="text-lg font-bold text-orange-500">{truckData.name}</p>
                        {truckData.ratingAvg && (
                          <div className="flex items-center gap-2 text-sm">
                            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                            <span className="font-bold">{truckData.ratingAvg.toFixed(1)}</span>
                            {truckData.ratingCount && (
                              <span className="text-muted-foreground">({truckData.ratingCount})</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground font-medium">Gérer votre établissement</p>
                    )}
                  </div>
                </div>
              </Card>
            </Link>

            {/* Menu */}
            <Link to={ROUTES.pizzaioloMenu}>
              <Card className="glass-premium glass-glossy border-orange-500/20 p-8 rounded-[32px] hover:scale-[1.02] hover:shadow-2xl hover:shadow-orange-500/10 transition-all group cursor-pointer h-full">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="p-4 rounded-2xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                      <Pizza className="h-8 w-8 text-orange-500" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black tracking-tight">Menu</h3>
                    <p className="text-sm text-muted-foreground font-medium">
                      Gérer vos pizzas et produits
                    </p>
                  </div>
                </div>
              </Card>
            </Link>

            {/* Commandes Reçues */}
            <Link to={ROUTES.pizzaioloOrders}>
              <Card className="glass-premium glass-glossy border-orange-500/20 p-8 rounded-[32px] hover:scale-[1.02] hover:shadow-2xl hover:shadow-orange-500/10 transition-all group cursor-pointer h-full">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="p-4 rounded-2xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                      <Receipt className="h-8 w-8 text-orange-500" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black tracking-tight">Commandes</h3>
                    <p className="text-sm text-muted-foreground font-medium">
                      Gérer vos commandes en cours
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        </section>
      ) : (
        // CTA Devenir Pizzaiolo
        <section>
          <Card className="glass-premium glass-glossy border-orange-500/20 p-12 rounded-[32px] text-center">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="inline-flex p-6 rounded-3xl bg-orange-500/10">
                <ChefHat className="h-16 w-16 text-orange-500" />
              </div>
              <h3 className="text-3xl font-black tracking-tight">
                Vous êtes Pizzaiolo ?
              </h3>
              <p className="text-muted-foreground font-medium text-lg">
                Rejoignez PLANIZZA et développez votre activité avec notre plateforme
              </p>
              <Button
                asChild
                size="lg"
                className="rounded-2xl px-10 h-14 font-black bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Link to={ROUTES.becomePartner}>
                  Devenir Partenaire
                </Link>
              </Button>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
