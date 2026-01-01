import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ChefHat, Receipt, Pizza, Store, ArrowRight, TrendingUp, Clock, Star, Phone, LogOut, MapPin, Edit2, Pause, Play } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth } from '../app/providers/AuthProvider';
import { ROUTES } from '../app/routes';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { ref, get, remove, set } from 'firebase/database';
import { db, auth, isFirebaseConfigured } from '../lib/firebase';
import { useMyOrders } from '../features/orders/hooks/useMyOrders';
import { useLoyaltyPoints } from '../features/users/hooks/useLoyaltyPoints';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { useTruckPause } from '../features/trucks/hooks/useTruckPause';
import { useActiveOrdersCount } from '../features/orders/hooks/useActiveOrdersCount';
import LoyaltyProgressBar from '../components/loyalty/LoyaltyProgressBar';
import AddressAutocomplete from '../components/ui/AddressAutocomplete';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { orders, loading: ordersLoading } = useMyOrders();
  const { flushToStorage } = useCart();
  const [isPizzaiolo, setIsPizzaiolo] = useState(false);
  const [truckData, setTruckData] = useState(null);
  const [loadingTruck, setLoadingTruck] = useState(false);
  const [truckId, setTruckId] = useState(null);
  const { togglePause, isUpdating: isPauseUpdating } = useTruckPause(truckId);
  const { count: activeOrdersCount } = useActiveOrdersCount(truckId);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  
  // Adresse
  const [address, setAddress] = useState({
    streetNumber: '',
    street: '',
    postalCode: '',
    city: '',
    country: 'France'
  });
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressMessage, setAddressMessage] = useState('');
  
  // Carte de fidélité
  const { points, currentTier, nextTier, progress, maxTierReached, loading: loyaltyLoading } = useLoyaltyPoints(user?.uid);

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
          const tid = snap.val().truckId;
          setTruckId(tid);
          
          // Charger les infos du camion
          setLoadingTruck(true);
          const truckRef = ref(db, `public/trucks/${tid}`);
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

  // Charger le numéro de téléphone et l'adresse
  useEffect(() => {
    if (!user?.uid) return;

    const loadUserData = async () => {
      try {
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        if (snap.exists()) {
          const userData = snap.val();
          setPhoneNumber(userData.phoneNumber || '');
          
          // Charger l'adresse
          if (userData.address) {
            setAddress({
              streetNumber: userData.address.streetNumber || '',
              street: userData.address.street || '',
              postalCode: userData.address.postalCode || '',
              city: userData.address.city || '',
              country: userData.address.country || 'France'
            });
          }
        }
      } catch (err) {
        console.error('[PLANIZZA] Erreur chargement données:', err);
      }
    };

    loadUserData();
  }, [user?.uid]);

  // Fonction déconnexion
  const handleSignOut = async () => {
    if (!isFirebaseConfigured || !auth) return;

    setSigningOut(true);
    try {
      flushToStorage?.();

      if (isFirebaseConfigured && db && user?.uid) {
        try {
          await remove(ref(db, `carts/${user.uid}/active`));
        } catch (e) {
          console.warn('[PLANIZZA] Impossible de supprimer le panier:', e);
        }
      }

      await signOut(auth);
      navigate(ROUTES.explore, { replace: true });
    } catch (err) {
      console.error('[PLANIZZA] Erreur déconnexion:', err);
    } finally {
      setSigningOut(false);
    }
  };

  // Fonction toggle pause camion
  const handleTogglePause = async () => {
    if (!truckData || isPauseUpdating) return;

    // Si on veut passer en pause et qu'il y a des commandes actives
    if (!truckData.isPaused && activeOrdersCount > 0) {
      const confirmPause = window.confirm(
        `⚠️ Attention ! Vous avez ${activeOrdersCount} commande${activeOrdersCount > 1 ? 's' : ''} en cours.\n\n` +
        `En passant en pause, vous ne recevrez plus de nouvelles commandes, mais vous devrez honorer les commandes déjà acceptées.\n\n` +
        `Souhaitez-vous continuer ?`
      );
      
      if (!confirmPause) return;
    }

    try {
      const newIsPaused = await togglePause(truckData.isPaused || false);
      setTruckData(prev => ({ ...prev, isPaused: newIsPaused }));
    } catch (err) {
      console.error('[Dashboard] Erreur toggle pause:', err);
    }
  };

  // Fonction sauvegarde adresse
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!user?.uid) return;

    setSavingAddress(true);
    setAddressMessage('');

    try {
      const userRef = ref(db, `users/${user.uid}`);
      const snap = await get(userRef);
      const existingData = snap.exists() ? snap.val() : {};

      await set(userRef, {
        ...existingData,
        address,
        updatedAt: Date.now()
      });

      setAddressMessage('✅ Adresse sauvegardée avec succès !');
      setIsEditingAddress(false);
    } catch (err) {
      console.error('[PLANIZZA] Erreur sauvegarde adresse:', err);
      setAddressMessage('❌ Erreur lors de la sauvegarde.');
    } finally {
      setSavingAddress(false);
    }
  };

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

        {/* Téléphone */}
        {phoneNumber && (
          <div className="inline-flex items-center gap-2 text-sm text-gray-600 bg-white/50 px-4 py-2 rounded-full border border-gray-200 group hover:bg-white transition-all duration-300 cursor-default overflow-hidden">
            <Phone className="h-4 w-4 text-primary transition-all duration-[2000ms] ease-linear group-hover:-rotate-[360deg] group-hover:translate-x-1" />
            <span className="font-medium max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-[2000ms] ease-linear whitespace-nowrap">
              {phoneNumber}
            </span>
          </div>
        )}

        {/* Carte de fidélité */}
        {!loyaltyLoading && (
          <div className="max-w-md mx-auto mt-6">
            <LoyaltyProgressBar
              points={points}
              currentTier={currentTier}
              nextTier={nextTier}
              progress={progress}
              maxTierReached={maxTierReached}
            />
          </div>
        )}
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

        <div className="grid gap-6 md:grid-cols-1">
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
        </div>

        {/* Adresse postale */}
        <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-[32px]">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-6 w-6 text-primary" />
              <div>
                <h3 className="text-xl font-black tracking-tight">Mon Adresse</h3>
                <p className="text-sm text-muted-foreground">Adresse de livraison</p>
              </div>
            </div>
            {!isEditingAddress && (
              <Button onClick={() => setIsEditingAddress(true)} variant="outline" size="sm">
                <Edit2 className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            )}
          </div>

          {!isEditingAddress ? (
            <div className="text-gray-700">
              {address.streetNumber || address.street || address.postalCode || address.city ? (
                <div className="space-y-1">
                  {address.streetNumber && address.street && <p className="font-medium">{address.streetNumber} {address.street}</p>}
                  {!address.streetNumber && address.street && <p className="font-medium">{address.street}</p>}
                  {(address.postalCode || address.city) && (
                    <p>{address.postalCode} {address.city}</p>
                  )}
                  {address.country && <p className="text-sm text-muted-foreground">{address.country}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground italic">Aucune adresse renseignée</p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveAddress} className="space-y-4">
              <AddressAutocomplete 
                address={address}
                onAddressChange={setAddress}
              />

              {addressMessage && (
                <div className={`p-3 rounded-lg text-sm ${addressMessage.includes('✅') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                  {addressMessage}
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" disabled={savingAddress} className="flex-1">
                  {savingAddress ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsEditingAddress(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          )}
        </Card>

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
            <Link to={ROUTES.pizzaioloProfile} className="relative">
              <Card className="glass-premium glass-glossy border-orange-500/20 p-8 rounded-[32px] hover:scale-[1.02] hover:shadow-2xl hover:shadow-orange-500/10 transition-all group cursor-pointer h-full">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="p-4 rounded-2xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                      <Store className="h-8 w-8 text-orange-500" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTogglePause();
                        }}
                        disabled={isPauseUpdating || !truckData}
                        size="sm"
                        variant={truckData?.isPaused ? "default" : "outline"}
                        className={truckData?.isPaused ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                      >
                        {isPauseUpdating ? (
                          '...'
                        ) : truckData?.isPaused ? (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Relancer
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4 mr-1" />
                            Pause
                          </>
                        )}
                      </Button>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-black tracking-tight">Mon Camion</h3>
                    {loadingTruck ? (
                      <p className="text-sm text-muted-foreground font-medium">Chargement...</p>
                    ) : truckData ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-orange-500">{truckData.name}</p>
                          {truckData.isPaused && (
                            <Badge variant="secondary" className="text-xs">
                              <Pause className="h-3 w-3 mr-1" />
                              En pause
                            </Badge>
                          )}
                        </div>
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
            <Link to={ROUTES.pizzaioloOrders} className="relative">
              <Card className="glass-premium glass-glossy border-orange-500/20 p-8 rounded-[32px] hover:scale-[1.02] hover:shadow-2xl hover:shadow-orange-500/10 transition-all group cursor-pointer h-full">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="relative">
                      <div className="p-4 rounded-2xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                        <Receipt className="h-8 w-8 text-orange-500" />
                      </div>
                      {activeOrdersCount > 0 && (
                        <div className="absolute -top-2 -right-2 h-8 w-8 bg-red-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-pulse">
                          <span className="text-white text-xs font-black">{activeOrdersCount}</span>
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black tracking-tight">Commandes</h3>
                    <p className="text-sm text-muted-foreground font-medium">
                      {activeOrdersCount > 0 
                        ? `${activeOrdersCount} commande${activeOrdersCount > 1 ? 's' : ''} en cours`
                        : 'Gérer vos commandes en cours'
                      }
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

      {/* Bouton Déconnexion */}
      <div className="flex justify-center pt-8">
        <Button
          onClick={handleSignOut}
          disabled={signingOut}
          variant="outline"
          className="gap-2 rounded-2xl px-8 h-12 font-bold border-gray-300 hover:border-red-500 hover:text-red-500 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? 'Déconnexion...' : 'Se déconnecter'}
        </Button>
      </div>
    </div>
  );
}
