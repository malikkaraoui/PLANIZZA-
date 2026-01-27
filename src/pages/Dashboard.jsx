import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ChefHat, Receipt, Pizza, Store, ArrowRight, TrendingUp, Clock, Star, Phone, LogOut, MapPin, Edit2, Pause, Play, Bike, Radio, UserCircle } from 'lucide-react';
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
import BackButton from '../components/ui/BackButton';
import { useMyOrders } from '../features/orders/hooks/useMyOrders';
import { useLoyaltyPoints } from '../features/users/hooks/useLoyaltyPoints';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { useTruckPause } from '../features/trucks/hooks/useTruckPause';
import { useActiveOrdersCount } from '../features/orders/hooks/useActiveOrdersCount';
import LoyaltyProgressBar from '../components/loyalty/LoyaltyProgressBar';
import AddressAutocomplete from '../components/ui/AddressAutocomplete';
import { usePizzaioloTruckId } from '../features/pizzaiolo/hooks/usePizzaioloTruckId';
import { useAutoDismissMessage } from '../hooks/useAutoDismissMessage';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { orders, loading: _ordersLoading } = useMyOrders();
  const { flushToStorage } = useCart();
  const [truckData, setTruckData] = useState(null);
  const [loadingTruck, setLoadingTruck] = useState(false);

  const {
    truckId,
    loading: _loadingTruckId,
    error: truckIdError,
  } = usePizzaioloTruckId(user?.uid);

  const isPizzaiolo = Boolean(truckId);

  // Rediriger les pizzaiolos vers leur dashboard pro
  useEffect(() => {
    if (isPizzaiolo && !_loadingTruckId) {
      navigate('/pro/truck', { replace: true });
    }
  }, [isPizzaiolo, _loadingTruckId, navigate]);

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
  const [wantsDelivery, setWantsDelivery] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressMessage, setAddressMessage] = useState('');
  const [savingDeliveryPref, setSavingDeliveryPref] = useState(false);
  
  // Carte de fidélité
  const { points, currentTier, nextTier, progress, maxTierReached, loading: loyaltyLoading } = useLoyaltyPoints(user?.uid);

  // Les messages d'info/succès d'adresse doivent disparaître après 5s (les ❌ restent).
  useAutoDismissMessage(addressMessage, setAddressMessage, { delayMs: 5000, dismissErrors: false });

  // Charger les infos du camion (si pizzaiolo)
  useEffect(() => {
    let cancelled = false;

    // Reset si pas pizzaiolo / pas de camion
    if (!truckId) {
      setTruckData(null);
      setLoadingTruck(false);
      return () => {
        cancelled = true;
      };
    }

    if (!db) {
      // Mode DEV sans Firebase : ne pas bloquer l'UI
      setTruckData(null);
      setLoadingTruck(false);
      return () => {
        cancelled = true;
      };
    }

    setLoadingTruck(true);

    (async () => {
      try {
        const truckRef = ref(db, `public/trucks/${truckId}`);
        const truckSnap = await get(truckRef);
        if (cancelled) return;

        if (truckSnap.exists()) {
          setTruckData({ id: truckId, ...truckSnap.val() });
        } else {
          setTruckData(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[PLANIZZA] Erreur chargement camion:', err);
        setTruckData(null);
      } finally {
        if (!cancelled) setLoadingTruck(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [truckId]);

  // Log ciblé en cas d'erreur truckId (n'impacte pas l'UX)
  useEffect(() => {
    if (!truckIdError) return;
    console.error('[PLANIZZA] Erreur récupération truckId pizzaiolo:', truckIdError);
  }, [truckIdError]);

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
          
          // Charger la préférence de livraison
          setWantsDelivery(userData.preferences?.wantsDelivery || false);
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

    try {
      const newIsPaused = await togglePause(truckData.isPaused || false);
      setTruckData(prev => ({ ...prev, isPaused: newIsPaused }));

      // Si on vient de passer en pause et qu'il y a des commandes actives, afficher un rappel
      if (newIsPaused && activeOrdersCount > 0) {
        setTimeout(() => {
          alert(
            `✅ Mode pause activé\n\n` +
            `📋 Rappel : Vous avez ${activeOrdersCount} commande${activeOrdersCount > 1 ? 's' : ''} en cours à honorer.\n\n` +
            `Vous ne recevrez plus de nouvelles commandes jusqu'à la reprise de votre activité.`
          );
        }, 300);
      }
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
        preferences: {
          ...existingData.preferences,
          wantsDelivery
        },
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

  // Fonction pour changer la préférence de livraison instantanément
  const handleToggleDeliveryPreference = async (newValue) => {
    if (!user?.uid || savingDeliveryPref) return;

    setSavingDeliveryPref(true);
    setWantsDelivery(newValue);

    try {
      const userRef = ref(db, `users/${user.uid}`);
      const snap = await get(userRef);
      const existingData = snap.exists() ? snap.val() : {};

      await set(userRef, {
        ...existingData,
        preferences: {
          ...existingData.preferences,
          wantsDelivery: newValue
        },
        updatedAt: Date.now()
      });

      console.log('[Dashboard] Préférence de livraison mise à jour:', newValue);
    } catch (err) {
      console.error('[Dashboard] Erreur mise à jour préférence:', err);
      // Revenir à l'ancienne valeur en cas d'erreur
      setWantsDelivery(!newValue);
    } finally {
      setSavingDeliveryPref(false);
    }
  };

  // Stats client
  const recentOrders = orders.slice(0, 3);
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'ready' || o.status === 'completed').length;

  return (
    <div className="relative isolate mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 -z-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 -z-10 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />

      <BackButton className="mb-4" />

      {/* Hero Section - Avatar + Nom + Fidélité */}
      <div className="text-center space-y-6">
        <div className="flex flex-col items-center gap-6">
          {/* Avatar */}
          <Avatar className="h-28 w-28 ring-4 ring-primary/20 ring-offset-4 shadow-2xl">
            <AvatarImage src={user?.photoURL} alt={user?.displayName || 'User'} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-orange-500 text-white font-black text-3xl">
              {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          {/* Texte d'accueil */}
          <div className="space-y-2">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-premium-gradient">
              Salut, {user?.displayName?.split(' ')[0] || 'toi'} ! 👋
            </h1>
            <p className="text-muted-foreground font-medium text-lg">
              Ton espace client PLANIZZA
            </p>
          </div>
        </div>

        {/* Carte de fidélité */}
        {!loyaltyLoading && (
          <div className="max-w-lg mx-auto">
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

      {/* Quick Actions - Grille 3 colonnes */}
      <section>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Mes Commandes */}
          <Link to={ROUTES.myOrders} className="group">
            <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[28px] hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Receipt className="h-7 w-7 text-primary" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-xl font-black tracking-tight mb-2">Mes Commandes</h3>
              <p className="text-sm text-muted-foreground">
                {totalOrders === 0 ? 'Aucune commande' : `${totalOrders} commande${totalOrders > 1 ? 's' : ''}`}
              </p>
              {totalOrders > 0 && (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 mt-3">
                  <TrendingUp className="h-4 w-4" />
                  {completedOrders} terminée{completedOrders > 1 ? 's' : ''}
                </div>
              )}
            </Card>
          </Link>

          {/* Explorer */}
          <Link to={ROUTES.explore} className="group">
            <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[28px] hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-2xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                  <Pizza className="h-7 w-7 text-orange-500" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-xl font-black tracking-tight mb-2">Explorer</h3>
              <p className="text-sm text-muted-foreground">
                Découvre les camions près de toi
              </p>
            </Card>
          </Link>

          {/* Mon Profil */}
          <Link to="/mon-compte" className="group">
            <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[28px] hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-2xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                  <UserCircle className="h-7 w-7 text-purple-500" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-xl font-black tracking-tight mb-2">Mon Profil</h3>
              <p className="text-sm text-muted-foreground">
                Gérer mes informations
              </p>
            </Card>
          </Link>
        </div>
      </section>
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Receipt className="h-6 w-6 text-primary" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black tracking-tight">Mes Commandes</h3>
                  <p className="text-xs text-muted-foreground font-medium">
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
          <Link to="/mon-compte">
            <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px] hover:scale-[1.02] hover:shadow-2xl transition-all group cursor-pointer h-full">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <UserCircle className="h-6 w-6 text-primary" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black tracking-tight">Mon Profil</h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    Modifier mes informations
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          {/* Adresse postale */}
          <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px] h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-lg font-black tracking-tight">Adresse de livraison</h3>
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
            <div>
              <div className="text-gray-700 mb-4">
                {address.streetNumber || address.street || address.postalCode || address.city ? (
                  <div className="space-y-1">
                    {address.streetNumber && address.street && <p className="font-medium">{address.streetNumber} {address.street}</p>}
                    {!address.streetNumber && address.street && <p className="font-medium">{address.street}</p>}
                    {(address.postalCode || address.city) && (
                      <p>{address.postalCode} {address.city}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">Aucune adresse renseignée</p>
                )}
              </div>
              
              {/* Cellules de préférence de livraison */}
              <div className="pt-4 border-t border-white/10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Retrait au camion */}
                  <button
                    onClick={() => handleToggleDeliveryPreference(false)}
                    disabled={savingDeliveryPref}
                    className={`group relative overflow-hidden rounded-[24px] p-4 transition-all duration-300 ${
                      !wantsDelivery
                        ? 'bg-primary text-white shadow-xl shadow-primary/30'
                        : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                    } ${savingDeliveryPref ? 'cursor-wait' : 'cursor-pointer'}`}
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className={`p-3 rounded-xl transition-all ${
                        !wantsDelivery 
                          ? 'bg-white/20' 
                          : 'bg-primary/10 group-hover:bg-primary/20'
                      }`}>
                        <Store className="h-8 w-8" />
                      </div>
                      <div>
                        <div className="font-black text-lg tracking-tight">Retrait au camion</div>
                        <div className={`text-sm mt-1 ${
                          !wantsDelivery 
                            ? 'text-white/80' 
                            : 'text-muted-foreground'
                        }`}>
                          Gratuit • Prêt en 15-20 min
                        </div>
                      </div>
                      {!wantsDelivery && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Livraison à domicile */}
                  <button
                    onClick={() => handleToggleDeliveryPreference(true)}
                    disabled={savingDeliveryPref}
                    className={`group relative overflow-hidden rounded-[24px] p-4 transition-all duration-300 ${
                      wantsDelivery
                        ? 'bg-primary text-white shadow-xl shadow-primary/30'
                        : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                    } ${savingDeliveryPref ? 'cursor-wait' : 'cursor-pointer'}`}
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className={`p-3 rounded-xl transition-all ${
                        wantsDelivery 
                          ? 'bg-white/20' 
                          : 'bg-primary/10 group-hover:bg-primary/20'
                      }`}>
                        <Bike className="h-8 w-8" />
                      </div>
                      <div>
                        <div className="font-black text-lg tracking-tight">Livraison à domicile</div>
                        <div className={`text-sm mt-1 ${
                          wantsDelivery 
                            ? 'text-white/80' 
                            : 'text-muted-foreground'
                        }`}>
                          + 3,50€ • 30-40 min
                        </div>
                      </div>
                      {wantsDelivery && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveAddress} className="space-y-4">
              <AddressAutocomplete 
                address={address}
                onAddressChange={setAddress}
              />

              {/* Cellules de préférence de livraison */}
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Retrait au camion */}
                  <button
                    type="button"
                    onClick={() => setWantsDelivery(false)}
                    className={`group relative overflow-hidden rounded-[24px] p-4 transition-all duration-300 ${
                      !wantsDelivery
                        ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                        : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className={`p-3 rounded-xl transition-all ${
                        !wantsDelivery 
                          ? 'bg-white/20' 
                          : 'bg-primary/10 group-hover:bg-primary/20'
                      }`}>
                        <Store className="h-8 w-8" />
                      </div>
                      <div>
                        <div className="font-black text-lg tracking-tight">Retrait au camion</div>
                        <div className={`text-sm mt-1 ${
                          !wantsDelivery 
                            ? 'text-white/80' 
                            : 'text-muted-foreground'
                        }`}>
                          Gratuit • Prêt en 15-20 min
                        </div>
                      </div>
                      {!wantsDelivery && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Livraison à domicile */}
                  <button
                    type="button"
                    onClick={() => setWantsDelivery(true)}
                    className={`group relative overflow-hidden rounded-[24px] p-4 transition-all duration-300 ${
                      wantsDelivery
                        ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                        : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className={`p-3 rounded-xl transition-all ${
                        wantsDelivery 
                          ? 'bg-white/20' 
                          : 'bg-primary/10 group-hover:bg-primary/20'
                      }`}>
                        <Bike className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="font-black text-base tracking-tight">Livraison à domicile</div>
                        <div className={`text-xs mt-0.5 ${
                          wantsDelivery 
                            ? 'text-white/80' 
                            : 'text-muted-foreground'
                        }`}>
                          + 3,50€ • 30-40 min
                        </div>
                      </div>
                      {wantsDelivery && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>

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

      {/* Ma Livraison - Section unifiée */}
      <section>
        <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-[32px]">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight">Ma Livraison</h3>
                <p className="text-sm text-muted-foreground mt-1">Comment récupérer mes pizzas</p>
              </div>
            </div>
            {!isEditingAddress && (
              <Button onClick={() => setIsEditingAddress(true)} variant="outline" size="sm" className="rounded-2xl">
                <Edit2 className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            )}
          </div>

          {!isEditingAddress ? (
            <div className="space-y-6">
              {/* Adresse */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Adresse de livraison</p>
                <div className="text-gray-900">
                  {address.streetNumber || address.street || address.postalCode || address.city ? (
                    <div className="space-y-0.5">
                      {address.streetNumber && address.street && <p className="font-semibold text-lg">{address.streetNumber} {address.street}</p>}
                      {!address.streetNumber && address.street && <p className="font-semibold text-lg">{address.street}</p>}
                      {(address.postalCode || address.city) && (
                        <p className="text-muted-foreground">{address.postalCode} {address.city}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">Aucune adresse renseignée</p>
                  )}
                </div>
              </div>
              
              {/* Mode de récupération */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Mode de récupération préféré</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Retrait au camion */}
                  <button
                    onClick={() => handleToggleDeliveryPreference(false)}
                    disabled={savingDeliveryPref}
                    className={`group relative overflow-hidden rounded-[24px] p-5 transition-all duration-300 ${
                      !wantsDelivery
                        ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                        : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                    } ${savingDeliveryPref ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className={`p-3 rounded-xl transition-all ${
                        !wantsDelivery 
                          ? 'bg-white/20' 
                          : 'bg-primary/10 group-hover:bg-primary/20'
                      }`}>
                        <Store className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="font-black text-lg tracking-tight">Retrait au camion</div>
                        <div className={`text-sm mt-1 ${
                          !wantsDelivery 
                            ? 'text-white/90' 
                            : 'text-muted-foreground'
                        }`}>
                          Gratuit • 15-20 min
                        </div>
                      </div>
                      {!wantsDelivery && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Livraison à domicile */}
                  <button
                    onClick={() => handleToggleDeliveryPreference(true)}
                    disabled={savingDeliveryPref}
                    className={`group relative overflow-hidden rounded-[24px] p-5 transition-all duration-300 ${
                      wantsDelivery
                        ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                        : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                    } ${savingDeliveryPref ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className={`p-3 rounded-xl transition-all ${
                        wantsDelivery 
                          ? 'bg-white/20' 
                          : 'bg-primary/10 group-hover:bg-primary/20'
                      }`}>
                        <Bike className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="font-black text-lg tracking-tight">Livraison à domicile</div>
                        <div className={`text-sm mt-1 ${
                          wantsDelivery 
                            ? 'text-white/90' 
                            : 'text-muted-foreground'
                        }`}>
                          + 3,50€ • 30-40 min
                        </div>
                      </div>
                      {wantsDelivery && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveAddress} className="space-y-6">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Adresse de livraison</p>
                <AddressAutocomplete 
                  address={address}
                  onAddressChange={setAddress}
                />
              </div>

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Mode de récupération préféré</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Retrait au camion */}
                  <button
                    type="button"
                    onClick={() => setWantsDelivery(false)}
                    className={`group relative overflow-hidden rounded-[24px] p-5 transition-all duration-300 ${
                      !wantsDelivery
                        ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                        : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className={`p-3 rounded-xl transition-all ${
                        !wantsDelivery 
                          ? 'bg-white/20' 
                          : 'bg-primary/10 group-hover:bg-primary/20'
                      }`}>
                        <Store className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="font-black text-lg tracking-tight">Retrait au camion</div>
                        <div className={`text-sm mt-1 ${
                          !wantsDelivery 
                            ? 'text-white/90' 
                            : 'text-muted-foreground'
                        }`}>
                          Gratuit • 15-20 min
                        </div>
                      </div>
                      {!wantsDelivery && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Livraison à domicile */}
                  <button
                    type="button"
                    onClick={() => setWantsDelivery(true)}
                    className={`group relative overflow-hidden rounded-[24px] p-5 transition-all duration-300 ${
                      wantsDelivery
                        ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                        : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className={`p-3 rounded-xl transition-all ${
                        wantsDelivery 
                          ? 'bg-white/20' 
                          : 'bg-primary/10 group-hover:bg-primary/20'
                      }`}>
                        <Bike className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="font-black text-lg tracking-tight">Livraison à domicile</div>
                        <div className={`text-sm mt-1 ${
                          wantsDelivery 
                            ? 'text-white/90' 
                            : 'text-muted-foreground'
                        }`}>
                          + 3,50€ • 30-40 min
                        </div>
                      </div>
                      {wantsDelivery && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg">
                          <div className="w-3 h-3 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {addressMessage && (
                <div className={`p-4 rounded-2xl text-sm font-medium ${addressMessage.includes('✅') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                  {addressMessage}
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" disabled={savingAddress} className="flex-1 h-12 rounded-2xl font-bold">
                  {savingAddress ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsEditingAddress(false)} className="h-12 rounded-2xl">
                  Annuler
                </Button>
              </div>
            </form>
          )}
        </Card>
      </section>

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
