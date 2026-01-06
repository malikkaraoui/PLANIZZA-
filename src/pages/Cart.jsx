import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, Trash2, Minus, Plus, Bike, Store } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Separator } from '../components/ui/separator';
import { Input } from '../components/ui/Input';
import { useCart } from '../features/cart/hooks/useCart.jsx';
import { useAuth } from '../app/providers/AuthProvider';
import { useCreateOrder } from '../features/orders/hooks/useCreateOrder';
import { ROUTES } from '../app/routes';
import { ref, get } from 'firebase/database';
import { db } from '../lib/firebase';
import { useTruck } from '../features/trucks/hooks/useTruck';
import { isCurrentlyOpen } from '../lib/openingHours';
import { devLog } from '../lib/devLog';

const TVA_RATE = 0.10; // 10% TVA restauration

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function Cart() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, truckId: cartTruckId, updateItemQty, removeItem, totalCents } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { createOrder, loading: creatingOrder } = useCreateOrder();
  const [error, setError] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState('pickup'); // 'pickup' ou 'delivery'

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

  const handleContinueShopping = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    navigate(getExploreUrl());
  };
  
  // Adresse structurée
  const [deliveryAddress, setDeliveryAddress] = useState({
    streetNumber: '',
    street: '',
    postalCode: '',
    city: '',
  });

  const truckId = location.state?.truckId ?? cartTruckId ?? null;
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

  const handleCheckout = async () => {
    // Vérifier l'authentification
    if (!isAuthenticated || !user) {
      navigate(ROUTES.login);
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

    setError(null);
    
    try {
      // Formater l'adresse complète pour la commande
      const fullAddress = deliveryMethod === 'delivery' 
        ? `${deliveryAddress.streetNumber} ${deliveryAddress.street}, ${deliveryAddress.postalCode} ${deliveryAddress.city}`.trim()
        : null;

      // Créer la commande avec le mode de livraison choisi
      await createOrder({
        truckId,
        items,
        userUid: user.uid,
        customerName: user.displayName || 'Client',
        deliveryMethod: deliveryMethod,
        deliveryAddress: fullAddress,
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
            <Link to={getExploreUrl()}>
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Explorer les camions
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          to={getExploreUrl()}
          onClick={handleContinueShopping}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Continuer mes achats
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Panier</h1>
        <p className="text-muted-foreground mt-2">
          {items.length} article{items.length > 1 ? 's' : ''} dans votre panier
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Liste des articles */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Image (si disponible) */}
                  {item.photo && (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
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
                        <h3 className="font-semibold">{item.name}</h3>
                        {item.description && (
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
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">
                        {formatEUR(item.priceCents * item.qty)}
                      </span>

                      {/* Contrôles quantité */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateItemQty(item.id, Math.max(0, item.qty - 1))}
                        >
                          <Minus className="h-3 w-3" />
                          <span className="sr-only">Diminuer la quantité</span>
                        </Button>

                        <span className="w-8 text-center font-medium">{item.qty}</span>

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
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

        {/* Méthode de livraison */}
        <div className="lg:col-span-2">
          <Card className="glass-premium glass-glossy border-white/30">
            <CardHeader>
              <CardTitle className="text-xl font-black tracking-tight">Méthode de récupération</CardTitle>
              <CardDescription>Comment souhaitez-vous récupérer votre commande ?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Retrait au camion */}
                <button
                  onClick={() => setDeliveryMethod('pickup')}
                  className={`group relative overflow-hidden rounded-[28px] p-6 transition-all duration-300 ${
                    deliveryMethod === 'pickup'
                      ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                      : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`p-4 rounded-2xl transition-all ${
                      deliveryMethod === 'pickup' 
                        ? 'bg-white/20' 
                        : 'bg-primary/10 group-hover:bg-primary/20'
                    }`}>
                      <Store className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="font-black text-lg tracking-tight">Retrait au camion</div>
                      <div className={`text-sm mt-1 ${
                        deliveryMethod === 'pickup' 
                          ? 'text-white/80' 
                          : 'text-muted-foreground'
                      }`}>
                        Gratuit • Prêt en 15-20 min
                      </div>
                    </div>
                    {deliveryMethod === 'pickup' && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                </button>

                {/* Livraison à domicile */}
                <button
                  onClick={() => setDeliveryMethod('delivery')}
                  className={`group relative overflow-hidden rounded-[28px] p-6 transition-all duration-300 ${
                    deliveryMethod === 'delivery'
                      ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]'
                      : 'glass-premium border-white/20 hover:border-primary/30 hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`p-4 rounded-2xl transition-all ${
                      deliveryMethod === 'delivery' 
                        ? 'bg-white/20' 
                        : 'bg-primary/10 group-hover:bg-primary/20'
                    }`}>
                      <Bike className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="font-black text-lg tracking-tight">Livraison à domicile</div>
                      <div className={`text-sm mt-1 ${
                        deliveryMethod === 'delivery' 
                          ? 'text-white/80' 
                          : 'text-muted-foreground'
                      }`}>
                        + 3,50€ • 30-40 min
                      </div>
                    </div>
                    {deliveryMethod === 'delivery' && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                </button>
              </div>

              {/* Adresse de livraison si livraison sélectionnée */}
              {deliveryMethod === 'delivery' && (
                <div className="mt-6 p-4 rounded-2xl glass-deep border-white/10 space-y-4">
                  <label className="block text-sm font-bold mb-3">Adresse de livraison</label>
                  
                  {/* Numéro et rue sur la même ligne */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Input
                        type="text"
                        value={deliveryAddress.streetNumber}
                        onChange={(e) => setDeliveryAddress(prev => ({ ...prev, streetNumber: e.target.value }))}
                        placeholder="N°"
                        className="bg-white/50 border-white/20"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="text"
                        value={deliveryAddress.street}
                        onChange={(e) => setDeliveryAddress(prev => ({ ...prev, street: e.target.value }))}
                        placeholder="Nom de la rue"
                        className="bg-white/50 border-white/20"
                      />
                    </div>
                  </div>

                  {/* Code postal et ville */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Input
                        type="text"
                        value={deliveryAddress.postalCode}
                        onChange={async (e) => {
                          const cp = e.target.value;
                          setDeliveryAddress(prev => ({ ...prev, postalCode: cp }));
                          
                          // Auto-complétion ville depuis code postal
                          if (cp.length === 5) {
                            try {
                              const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom`);
                              const data = await res.json();
                              if (data.length > 0) {
                                setDeliveryAddress(prev => ({ ...prev, city: data[0].nom }));
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
                        onChange={(e) => setDeliveryAddress(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="Ville"
                        className="bg-white/50 border-white/20"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    🚨 La livraison via Uber Direct sera implémentée prochainement
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Récapitulatif */}
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-24 glass-premium glass-glossy border-white/30">
            <CardHeader>
              <CardTitle className="text-xl font-black tracking-tight">Récapitulatif</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
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
                  <span className="text-primary">{formatEUR(Math.round(totalCents * (1 + TVA_RATE)) + (deliveryMethod === 'delivery' ? 350 : 0))}</span>
                </div>
              </div>
            </CardContent>

            <CardFooter>
              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleCheckout}
                disabled={creatingOrder || loadingTruck || !truckId || !canOrder}
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
                  {loadingTruck ? '⏳ Vérification du statut du camion…' : '⚠️ Statut du camion indisponible (réseau).'}
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
          </Card>
        </div>
      </div>
    </div>
  );
}
