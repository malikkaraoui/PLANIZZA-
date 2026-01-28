import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, Trash2, Minus, Plus, Bike, Store } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Separator } from '../components/ui/separator';
import { Input } from '../components/ui/Input';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { buildCartSections } from '../features/cart/utils/cartSections';
import { formatCartItemName } from '../features/cart/utils/formatCartItemName';
import { useAuth } from '../app/providers/AuthProvider';
import { useCreateOrder } from '../features/orders/hooks/useCreateOrder';
import { ROUTES } from '../app/routes';
import { ref, get } from 'firebase/database';
import { db } from '../lib/firebase';
import { useTruck } from '../features/trucks/hooks/useTruck';
import { getTodayOpeningHours, isCurrentlyOpen } from '../lib/openingHours';
import { devLog } from '../lib/devLog';
import StickyAside from '../components/layout/StickyAside';
import DesiredTimePicker from '../features/orders/components/DesiredTimePicker';
import { getMinDesiredTime, validateDesiredTime } from '../features/orders/utils/desiredTime';
import BackButton from '../components/ui/BackButton';

const TVA_RATE = 0.10; // 10% TVA restauration
const DESIRED_TIME_STORAGE_KEY = 'planizza:desiredTime:v1';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

function isPizzaLikeCartItem(it) {
  const t = String(it?.type || '').toLowerCase();
  return t === 'pizza' || t === 'calzone';
}

export default function Cart() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, truckId: cartTruckId, updateItemQty, removeItem, totalCents } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { createOrder, loading: creatingOrder } = useCreateOrder();
  const [error, setError] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState('pickup'); // 'pickup' ou 'delivery'
  const [guestName, setGuestName] = useState(''); // Nom du guest pour les non-authentifiés
  const [desiredTime, setDesiredTime] = useState(() => {
    try {
      const raw = localStorage.getItem(DESIRED_TIME_STORAGE_KEY);
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      const storedTime = parsed?.value;
      if (typeof storedTime !== 'string' || !/^\d{2}:\d{2}$/.test(storedTime)) return '';
      return storedTime;
    } catch {
      return '';
    }
  });
  const [desiredTimeError, setDesiredTimeError] = useState('');
  const desiredTimeSaveTimerRef = useRef(null);

  // Règle simple et stable (pas de scroll/mesures):
  // - Sur desktop, si le panier est "petit", on met la méthode à droite sous le récap.
  // - Sinon, on la met sous la liste (colonne gauche).
  // Cette règle ne dépend PAS du mode pickup/delivery, et ne bouge pas au scroll/clic.
  const DOCK_METHOD_RIGHT_MAX_ITEMS = 3;
  const dockMethodRight = items.length <= DOCK_METHOD_RIGHT_MAX_ITEMS;

  const cartSections = useMemo(() => buildCartSections(items), [items]);
  const pizzaCount = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item?.qty || 0);
      if (!Number.isFinite(qty)) return sum;
      return isPizzaLikeCartItem(item) ? sum + qty : sum;
    }, 0);
  }, [items]);

  const getExploreUrl = () => {
    try {
      const lastExploreUrl = localStorage.getItem('planizza.lastExploreUrl');
      if (lastExploreUrl && typeof lastExploreUrl === 'string' && lastExploreUrl.startsWith('/explore')) {
        return lastExploreUrl;
      }
    } catch {
      // noop
    }
    return ROUTES.explore;
  };

  const safeFrom = useMemo(() => {
    const raw = location.state?.from;
    if (typeof raw !== 'string') return null;
    if (!raw.startsWith('/')) return null;
    if (raw.startsWith('//')) return null;
    // Ne jamais reboucler vers /panier
    if (raw.startsWith(ROUTES.cart)) return null;
    return raw;
  }, [location.state?.from]);

  const getBackToTruckUrl = (truckId) => {
    // Si la page source semble être un écran 'camion', on la préfère.
    if (safeFrom && !safeFrom.startsWith(ROUTES.explore) && !safeFrom.startsWith(ROUTES.checkout)) {
      return safeFrom;
    }

    if (truckId) return ROUTES.truck(truckId);
    return getExploreUrl();
  };

  const truckId = location.state?.truckId ?? cartTruckId ?? null;
  const continueUrl = getBackToTruckUrl(truckId);
  
  // Adresse structurée
  const [deliveryAddress, setDeliveryAddress] = useState({
    streetNumber: '',
    street: '',
    postalCode: '',
    city: '',
  });

  const { truck, loading: loadingTruck, error: truckError } = useTruck(truckId);

  // Les données historiques peuvent stocker les horaires sous différentes clés.
  const openingHours = truck?.openingHours || truck?.schedule || truck?.hours || null;
  const isPaused = truck?.isPaused === true;
  const isOpenByHours = openingHours ? isCurrentlyOpen(openingHours) : null;
  const isOpen = typeof isOpenByHours === 'boolean'
    ? isOpenByHours
    : typeof truck?.isOpenNow === 'boolean'
      ? truck.isOpenNow
      : true; // fallback UX (le back doit de toute façon valider si besoin)

  // Important: ne pas déclarer "fermé" tant que le camion n'est pas chargé.
  const canOrder = !loadingTruck && !truckError && Boolean(truckId) && isOpen && !isPaused;

  useEffect(() => {
    devLog('[Cart]', {
      truckId,
      loadingTruck,
      hasTruck: Boolean(truck),
      hasTruckError: Boolean(truckError),
      hasOpeningHours: Boolean(openingHours),
      openKeys: openingHours ? Object.keys(openingHours) : null,
      isOpenByHours,
      isOpenNow: typeof truck?.isOpenNow === 'boolean' ? truck.isOpenNow : null,
      isPaused,
      canOrder,
    });
  }, [truckId, loadingTruck, truck, truckError, openingHours, isOpenByHours, isPaused, canOrder]);

  // Charger les préférences utilisateur
  useEffect(() => {
    if (!user?.uid) return;

    const loadUserPreferences = async () => {
      try {
        const userRef = ref(db, `users/${user.uid}`);
        const snap = await get(userRef);
        
        if (snap.exists()) {
          const userData = snap.val();
          
          // Pré-sélectionner la méthode selon la préférence
          if (userData.preferences?.wantsDelivery) {
            setDeliveryMethod('delivery');
          }
          
          // Pré-remplir l'adresse si elle existe
          if (userData.address) {
            const addr = userData.address;
            setDeliveryAddress({
              streetNumber: addr.streetNumber || '',
              street: addr.street || '',
              postalCode: addr.postalCode || '',
              city: addr.city || '',
            });
          }
        }
      } catch (err) {
        console.error('[Cart] Erreur chargement préférences:', err);
      }
    };

    loadUserPreferences();
  }, [user?.uid]);

  const { minTime: minDesiredTime } = useMemo(() => {
    return getMinDesiredTime({
      now: new Date(),
      pizzaCount,
      deliveryMethod,
      baseLeadMinutes: 0,
      perPizzaMinutes: 5,
      deliveryExtraMinutes: 15,
    });
  }, [pizzaCount, deliveryMethod]);

  // Si le stockage correspond à un autre camion, on recale sur la valeur minimale
  useEffect(() => {
    if (!truckId || !desiredTime) return;
    try {
      const raw = localStorage.getItem(DESIRED_TIME_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const storedTruckId = parsed?.truckId || null;
      if (storedTruckId && storedTruckId !== truckId) {
        const t = setTimeout(() => setDesiredTime(minDesiredTime), 0);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, [truckId, desiredTime, minDesiredTime]);

  useEffect(() => {
    if (!desiredTime) {
      const t = setTimeout(() => setDesiredTime(minDesiredTime), 0);
      return () => clearTimeout(t);
    }
  }, [desiredTime, minDesiredTime]);

  // Sauvegarder l'heure souhaitée dans le storage navigateur
  useEffect(() => {
    if (desiredTimeSaveTimerRef.current) {
      clearTimeout(desiredTimeSaveTimerRef.current);
      desiredTimeSaveTimerRef.current = null;
    }

    if (!desiredTime) return;

    desiredTimeSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          DESIRED_TIME_STORAGE_KEY,
          JSON.stringify({
            value: desiredTime,
            truckId: truckId ?? null,
            updatedAt: Date.now(),
          })
        );
      } catch {
        // ignore
      }
    }, 1000);

    return () => {
      if (desiredTimeSaveTimerRef.current) {
        clearTimeout(desiredTimeSaveTimerRef.current);
      }
    };
  }, [desiredTime, truckId]);

  const handleCheckout = async () => {
    // Valider le nom du guest si non authentifié
    if (!isAuthenticated && !guestName.trim()) {
      setError('Veuillez renseigner votre nom pour que le pizzaiolo puisse vous identifier.');
      return;
    }

    // ❌ NE PAS traiter loadingTruck comme une erreur.
    // Si le truck charge encore, le bouton sera disabled (voir disabled ci-dessous).
    // On vérifie seulement les vraies erreurs + état final.

    if (truckError) {
      setError('Impossible de vérifier le statut du camion (réseau). Réessayez.');
      return;
    }

    // Si on n'a pas encore fini de charger, on ne fait rien (bouton disabled).
    // L'utilisateur ne devrait pas pouvoir cliquer de toute façon.
    if (loadingTruck) {
      return;
    }

    // Vérifier que le camion est ouvert
    if (!canOrder) {
      setError(isPaused 
        ? 'Le camion est en pause. Les commandes sont temporairement suspendues.' 
        : 'Le camion est actuellement fermé. Consultez les horaires d\'ouverture.');
      return;
    }

    // Vérifier qu'on a un truckId
    if (!truckId) {
      setError('Impossible de créer la commande : camion non identifié. Veuillez retourner à la fiche du camion.');
      return;
    }

    // Vérifier l'adresse de livraison si livraison à domicile
    if (deliveryMethod === 'delivery') {
      if (!deliveryAddress.streetNumber?.trim()) {
        setError('Veuillez renseigner le numéro de rue.');
        return;
      }
      if (!deliveryAddress.street?.trim()) {
        setError('Veuillez renseigner le nom de la rue.');
        return;
      }
      if (!deliveryAddress.postalCode?.trim()) {
        setError('Veuillez renseigner le code postal.');
        return;
      }
      if (!deliveryAddress.city?.trim()) {
        setError('Veuillez renseigner la ville.');
        return;
      }
    }

    // Vérifier l'heure souhaitée
    if (!desiredTime || !/^\d{2}:\d{2}$/.test(desiredTime)) {
      const msg = "Veuillez renseigner une heure souhaitée valide.";
      setDesiredTimeError(msg);
      setError(msg);
      return;
    }

    const { minDate } = getMinDesiredTime({
      now: new Date(),
      pizzaCount,
      deliveryMethod,
      baseLeadMinutes: 0,
      perPizzaMinutes: 5,
      deliveryExtraMinutes: 15,
    });

    const { error: timeError } = validateDesiredTime({
      value: desiredTime,
      now: new Date(),
      minDate,
      openingHours,
      getTodayOpeningHours,
    });

    if (timeError) {
      setDesiredTimeError(timeError);
      setError(timeError);
      return;
    }

    setError(null);
    
    try {
      // Formater l'adresse complète pour la commande
      const fullAddress = deliveryMethod === 'delivery' 
        ? `${deliveryAddress.streetNumber} ${deliveryAddress.street}, ${deliveryAddress.postalCode} ${deliveryAddress.city}`.trim()
        : null;

      // Créer la commande avec le mode de livraison choisi
      // Pour les guests : on ne passe pas userUid ici, ce sera géré par Checkout.jsx avec signInAnonymously
      await createOrder({
        truckId,
        items,
        userUid: user?.uid, // Peut être undefined pour les guests
        customerName: isAuthenticated ? (user.displayName || 'Client') : guestName.trim(),
        deliveryMethod: deliveryMethod,
        deliveryAddress: fullAddress,
        pickupTime: desiredTime,
      });
      // La fonction createOrder redirige automatiquement vers Stripe Checkout
    } catch (err) {
      console.error('Erreur lors de la création de la commande:', err);
      setError(err?.message || 'Erreur lors de la création de la commande. Veuillez réessayer.');
    }
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-2xl mb-2">Votre panier est vide</CardTitle>
            <CardDescription className="mb-6">
              Ajoutez des pizzas depuis un camion pour commencer
            </CardDescription>
            <Link to={continueUrl}>
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Continuer mes achats
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const methodCard = (
    <Card className="glass-premium glass-glossy border-white/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-black tracking-tight">Méthode de récupération</CardTitle>
        <CardDescription className="text-xs">Comment souhaitez-vous récupérer votre commande ?</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
          {/* Retrait au camion */}
          <button
            onClick={() => setDeliveryMethod('pickup')}
            className={`group relative overflow-hidden rounded-3xl p-4 transition-all duration-300 ${
              deliveryMethod === 'pickup'
                ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
            }`}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div
                className={`p-3 rounded-2xl transition-all ${
                  deliveryMethod === 'pickup' ? 'bg-white/20' : 'bg-primary/10 group-hover:bg-primary/20'
                }`}
              >
                <Store className="h-6 w-6" />
              </div>
              <div>
                <div className="font-black text-base tracking-tight">Retrait au camion</div>
                <div
                  className={`text-[11px] mt-1 ${
                    deliveryMethod === 'pickup' ? 'text-white/80' : 'text-muted-foreground'
                  }`}
                >
                  Gratuit • Prêt en 15-20 min
                </div>
              </div>
              {deliveryMethod === 'pickup' && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                </div>
              )}
            </div>
          </button>

          {/* Livraison à domicile */}
          <button
            onClick={() => setDeliveryMethod('delivery')}
            className={`group relative overflow-hidden rounded-3xl p-4 transition-all duration-300 ${
              deliveryMethod === 'delivery'
                ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
            }`}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div
                className={`p-3 rounded-2xl transition-all ${
                  deliveryMethod === 'delivery' ? 'bg-white/20' : 'bg-primary/10 group-hover:bg-primary/20'
                }`}
              >
                <Bike className="h-6 w-6" />
              </div>
              <div>
                <div className="font-black text-base tracking-tight">Livraison à domicile</div>
                <div
                  className={`text-[11px] mt-1 ${
                    deliveryMethod === 'delivery' ? 'text-white/80' : 'text-muted-foreground'
                  }`}
                >
                  + 3,50€ • 30-40 min
                </div>
              </div>
              {deliveryMethod === 'delivery' && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                </div>
              )}
            </div>
          </button>
        </div>
      </CardContent>
    </Card>
  );

  const deliveryAddressCard = deliveryMethod === 'delivery' ? (
    <Card className="glass-premium glass-glossy border-white/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-black tracking-tight">Adresse de livraison</CardTitle>
        <CardDescription className="text-xs">Renseignez l'adresse pour la livraison à domicile.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Numéro et rue sur la même ligne */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Input
              type="text"
              value={deliveryAddress.streetNumber}
              onChange={(e) => setDeliveryAddress((prev) => ({ ...prev, streetNumber: e.target.value }))}
              placeholder="N°"
              className="bg-white/50 border-white/20"
            />
          </div>
          <div className="col-span-2">
            <Input
              type="text"
              value={deliveryAddress.street}
              onChange={(e) => setDeliveryAddress((prev) => ({ ...prev, street: e.target.value }))}
              placeholder="Nom de la rue"
              className="bg-white/50 border-white/20"
            />
          </div>
        </div>

        {/* Code postal et ville */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <Input
              type="text"
              value={deliveryAddress.postalCode}
              onChange={async (e) => {
                const cp = e.target.value;
                setDeliveryAddress((prev) => ({ ...prev, postalCode: cp }));

                // Auto-complétion ville depuis code postal
                if (cp.length === 5) {
                  try {
                    const res = await fetch(
                      `https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom`,
                    );
                    const data = await res.json();
                    if (data.length > 0) {
                      setDeliveryAddress((prev) => ({ ...prev, city: data[0].nom }));
                    }
                  } catch (err) {
                    console.error('Erreur API commune:', err);
                  }
                }
              }}
              placeholder="Code postal"
              maxLength={5}
              className="bg-white/50 border-white/20"
            />
          </div>
          <div>
            <Input
              type="text"
              value={deliveryAddress.city}
              onChange={(e) => setDeliveryAddress((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="Ville"
              className="bg-white/50 border-white/20"
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          🚨 La livraison via Uber Direct sera implémentée prochainement
        </p>
      </CardContent>
    </Card>
  ) : null;

  const desiredTimeCard = (
    <Card className="glass-premium glass-glossy border-white/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-black tracking-tight">
          {!isAuthenticated ? 'Vos informations' : 'Heure souhaitée'}
        </CardTitle>
        <CardDescription className="text-xs">
          {!isAuthenticated
            ? 'Renseignez votre nom et l\'heure de retrait souhaitée.'
            : `Choisissez l'heure de ${deliveryMethod === 'delivery' ? 'livraison' : 'retrait'} souhaitée.`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Input nom pour les guests (non-authentifiés) */}
        {!isAuthenticated && (
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-2">
              👤 Votre nom
            </label>
            <Input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Ex: Jean Dupont"
              className="rounded-xl"
              required
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Votre nom permettra au pizzaiolo de vous identifier lors du retrait.
            </p>
          </div>
        )}

        {/* Sélecteur d'heure */}
        <DesiredTimePicker
          label={deliveryMethod === 'delivery' ? 'Heure de livraison' : 'Heure de retrait'}
          value={desiredTime}
          onChange={setDesiredTime}
          pizzaCount={pizzaCount}
          deliveryMethod={deliveryMethod}
          openingHours={openingHours}
          baseLeadMinutes={0}
          perPizzaMinutes={5}
          deliveryExtraMinutes={15}
          onErrorChange={setDesiredTimeError}
          helperText={
            deliveryMethod === 'delivery'
              ? 'Minimum: 5 min par pizza + 15 min de livraison.'
              : 'Minimum: 5 min par pizza.'
          }
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <BackButton className="mb-4" />

        {/* Titre + compteur sur UNE ligne (gain de place) */}
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Panier</h1>
          <div className="shrink-0 text-sm text-muted-foreground font-medium whitespace-nowrap">
            {items.length} article{items.length > 1 ? 's' : ''} dans votre panier
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne gauche: pile verticale indépendante de la hauteur du récapitulatif */}
        <div className="lg:col-span-2 space-y-6">
          {/* Liste des articles */}
          <div className="space-y-6">
            {cartSections.map((section) => (
              <div key={section.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">
                    {section.label}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {section.items.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {section.items.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          {/* Image (si disponible) */}
                          {item.photo && (
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                              <img
                                src={item.photo}
                                alt={item.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          )}

                          {/* Détails */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="font-semibold leading-tight">{formatCartItemName(item.name)}</h3>
                                {isPizzaLikeCartItem(item) && item.description && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                              </div>

                              {/* Bouton supprimer */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.id)}
                                className="shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Supprimer</span>
                              </Button>
                            </div>

                            {/* Prix et quantité */}
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-base font-bold text-primary">
                                {formatEUR(item.priceCents * item.qty)}
                              </span>

                              {/* Contrôles quantité */}
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateItemQty(item.id, Math.max(0, item.qty - 1))}
                                >
                                  <Minus className="h-3 w-3" />
                                  <span className="sr-only">Diminuer la quantité</span>
                                </Button>

                                <span className="w-7 text-center text-sm font-medium">{item.qty}</span>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateItemQty(item.id, item.qty + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                  <span className="sr-only">Augmenter la quantité</span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Zone “Méthode” sous la liste (position normale) */}
          <div className={dockMethodRight ? 'lg:hidden' : ''}>{methodCard}</div>

          {/* Heure souhaitée */}
          {desiredTimeCard}

          {/* Formulaire livraison: toujours dans la colonne gauche pour éviter les sauts de layout */}
          {deliveryAddressCard}
        </div>

        {/* Récapitulatif */}
        <div className="lg:col-span-1 lg:col-start-3 lg:row-start-1">
          <StickyAside>
            <Card className="glass-premium glass-glossy border-white/30 flex flex-col min-h-0 lg:max-h-[calc(100vh-12rem)]">
              <CardHeader className="shrink-0">
                <CardTitle className="text-xl font-black tracking-tight">Récapitulatif</CardTitle>
              </CardHeader>

              {/* Contenu scrollable si besoin (garde le bouton toujours visible) */}
              <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4">
                {error && (
                  <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total HT</span>
                    <span>{formatEUR(totalCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">TVA (10%)</span>
                    <span>{formatEUR(Math.round(totalCents * TVA_RATE))}</span>
                  </div>
                  {deliveryMethod === 'delivery' && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Frais de livraison</span>
                      <span>{formatEUR(350)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between font-bold text-lg">
                    <span>Total TTC</span>
                    <span className="text-primary">
                      {formatEUR(
                        Math.round(totalCents * (1 + TVA_RATE)) + (deliveryMethod === 'delivery' ? 350 : 0),
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>

              <div className="shrink-0">
                <CardFooter>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleCheckout}
                    disabled={creatingOrder || loadingTruck || !truckId || !canOrder || Boolean(desiredTimeError)}
                  >
                    {creatingOrder ? 'Préparation du paiement...' : loadingTruck ? 'Vérification...' : 'Commander'}
                  </Button>
                </CardFooter>

                {!loadingTruck && !truckError && !canOrder && truckId && (
                  <CardFooter className="pt-0">
                    <p className="text-xs text-destructive text-center w-full">
                      {isPaused
                        ? '⏸️ Le camion est en pause. Les commandes sont temporairement suspendues.'
                        : '🔒 Le camion est actuellement fermé. Consultez les horaires d\'ouverture.'}
                    </p>
                  </CardFooter>
                )}

                {(loadingTruck || truckError) && truckId && (
                  <CardFooter className="pt-0">
                    <p className="text-xs text-muted-foreground text-center w-full">
                      {loadingTruck
                        ? '⏳ Vérification du statut du camion…'
                        : '⚠️ Statut du camion indisponible (réseau).'}
                    </p>
                  </CardFooter>
                )}

                {!truckId && (
                  <CardFooter className="pt-0">
                    <p className="text-xs text-destructive text-center w-full">
                      ⚠️ Veuillez retourner à la fiche camion pour finaliser votre commande
                    </p>
                  </CardFooter>
                )}
              </div>
            </Card>

            {/* Zone “Méthode” dockée à droite (uniquement desktop, règle basée sur nb d'articles) */}
            {dockMethodRight && <div className="mt-6 hidden lg:block">{methodCard}</div>}
          </StickyAside>
        </div>
      </div>
    </div>
  );
}
