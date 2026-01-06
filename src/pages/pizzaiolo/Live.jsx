import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, User, ShoppingCart, Check, Pizza, Wine, IceCream, Clock } from 'lucide-react';
import { ref, push, set } from 'firebase/database';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/providers/AuthProvider';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { usePizzaioloTruckId } from '../../features/pizzaiolo/hooks/usePizzaioloTruckId';
import { useMenu } from '../../features/menu/hooks/useMenu';

// Hooks et utilitaires menu
import { useLiveCart } from '../../features/menu/hooks/useLiveCart';
import { usePizzaCustomization } from '../../features/menu/hooks/usePizzaCustomization';
import { useMenuItem } from '../../features/menu/hooks/useMenuItem';
import { useLiveOrder } from '../../features/menu/hooks/useLiveOrder';
import { ALL_INGREDIENTS } from '../../features/menu/constants/ingredients';
import { filterMenuByCategory, hasMultipleSizes, getSingleSize } from '../../features/menu/utils/menuHelpers';
import { 
  calculateTVA, 
  calculateTotalTTC, 
  formatPrice,
  getDisplayPrice,
  hasValidPrice 
} from '../../features/menu/utils/priceCalculations';

export default function PizzaioloLive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { truckId, loading: loadingTruckId, error: truckIdError } = usePizzaioloTruckId(user?.uid);
  const { items: menuItems, loading: loadingMenu, error: menuError } = useMenu(truckId);

  const [menu, setMenu] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation UX: ne pas bloquer la saisie de l'heure au clavier.
  // On valide à la fin (blur) et lors de la création de commande.
  const [pickupTimeError, setPickupTimeError] = useState('');

  // Navigation entre catégories
  const [selectedCategory, setSelectedCategory] = useState(null);
  const pizzaRef = useRef(null);
  const boissonRef = useRef(null);
  const dessertRef = useRef(null);
  
  // Hooks métier
  const { 
    cart, 
    customerName, 
    setCustomerName,
    pickupTime,
    setPickupTime,
    addToCart, 
    removeFromCart, 
    deleteFromCart, 
    clearCart,
    totalCents,
    itemCount 
  } = useLiveCart();
  
  const {
    customizingPizza,
    startCustomization,
    cancelCustomization,
    toggleRemoveIngredient,
    toggleAddIngredient,
    getCustomization
  } = usePizzaCustomization();
  
  const {
    toggleItemSelection,
    clearSelection,
    flashItem,
    isItemSelected,
    isItemFlashing
  } = useMenuItem();
  
  const { clearLiveOrder } = useLiveOrder(truckId, user?.uid, cart, customerName);

  // Initialiser l'heure de retrait avec heure actuelle + 15 minutes
  useEffect(() => {
    if (!pickupTime) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15);
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setPickupTime(`${hours}:${minutes}`);
    }
  }, [pickupTime, setPickupTime]);

  // Synchroniser le menu local (format attendu par l'écran Live)
  useEffect(() => {
    if (!menuItems || !Array.isArray(menuItems)) {
      setMenu([]);
      return;
    }
    setMenu(menuItems);
  }, [menuItems]);

  // Scroll automatique vers la catégorie ouverte
  useEffect(() => {
    if (selectedCategory) {
      const refMap = {
        pizza: pizzaRef,
        boisson: boissonRef,
        dessert: dessertRef
      };
      const targetRef = refMap[selectedCategory];
      if (targetRef?.current) {
        setTimeout(() => {
          targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [selectedCategory]);

  // Gestionnaire d'ajout au panier avec feedback visuel
  const handleAddToCart = (item, size = null, customization = null) => {
    flashItem(item.id);
    addToCart(item, size, customization);
    clearSelection();
  };

  // Finaliser la personnalisation d'une pizza
  const finishCustomization = () => {
    if (!customizingPizza) return;
    
    handleAddToCart(
      customizingPizza.item,
      customizingPizza.size,
      getCustomization()
    );
    
    cancelCustomization();
  };

  // Filtrer le menu par catégorie
  const pizzas = filterMenuByCategory(menu, 'pizza');
  const boissons = filterMenuByCategory(menu, 'boisson');
  const desserts = filterMenuByCategory(menu, 'dessert');

  // Valider la commande
  const handleSubmitOrder = async () => {
    if (!customerName.trim()) {
      alert('Veuillez saisir un prénom');
      return;
    }

    if (cart.length === 0) {
      alert('Le panier est vide');
      return;
    }

    // Validation: empêcher les heures dans le passé (validation finale)
    if (pickupTime && /^\d{2}:\d{2}$/.test(pickupTime)) {
      const now = new Date();
      const [hours, minutes] = pickupTime.split(':').map(Number);
      const pickupDate = new Date();
      pickupDate.setHours(hours, minutes, 0, 0);

      if (pickupDate < now) {
        setPickupTimeError("L'heure de retrait ne peut pas être dans le passé");
        alert("❌ L'heure de retrait ne peut pas être dans le passé");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 1. Créer la commande dans orders (cycle normal)
      const ordersRef = ref(db, 'orders');
      const newOrderRef = push(ordersRef);
      
      const orderData = {
        truckId,
        uid: user.uid,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          priceCents: item.priceCents,
          qty: item.qty
        })),
        totalCents,
        status: 'received',
        createdAt: Date.now(),
        timeline: {},
        payment: {
          provider: 'manual',
          paymentStatus: 'pending', // Commande manuelle créée comme non-payée
        },
        deliveryMethod: 'pickup',
        customerName: customerName.trim(),
        pickupTime: pickupTime || null,
        source: 'manual'
      };

      await set(newOrderRef, orderData);

      // 2. Supprimer de liveOrders (brouillon)
      await clearLiveOrder();

      // 3. Nettoyer le panier
      clearCart();
      
      alert(`✅ Commande créée pour ${customerName}`);
      
    } catch (err) {
      console.error('[Live] Erreur création commande:', err);
      alert('❌ Erreur lors de la création de la commande');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadingTruck = loadingTruckId || loadingMenu;

  if (loadingTruck) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground font-medium">Chargement...</p>
      </div>
    );
  }

  if (truckIdError || menuError) {
    return (
      <Card className="glass-premium glass-glossy border-white/20 p-12 rounded-[32px] text-center">
        <h2 className="text-2xl font-black mb-2">Erreur de chargement</h2>
        <p className="text-muted-foreground">
          {truckIdError ? 'Impossible de déterminer votre camion.' : 'Impossible de charger le menu.'}
        </p>
        <p className="text-xs text-muted-foreground/70 font-mono break-all mt-3">
          {String((truckIdError || menuError)?.message || (truckIdError || menuError))}
        </p>
        <div className="mt-6">
          <Button className="rounded-2xl px-8 h-12 font-black bg-primary" onClick={() => window.location.reload()}>
            RECHARGER
          </Button>
        </div>
      </Card>
    );
  }

  if (!truckId) {
    return (
      <Card className="glass-premium glass-glossy border-white/20 p-12 rounded-[32px] text-center">
        <h2 className="text-2xl font-black mb-2">Aucun camion associé</h2>
        <p className="text-muted-foreground">Créez d'abord votre camion.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (customizingPizza) {
              cancelCustomization();
            } else {
              navigate(-1);
            }
          }}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {customizingPizza ? 'Annuler' : 'Retour'}
        </button>
        
        <h1 className="text-3xl font-black tracking-tight">
          {customizingPizza ? '✨ Personnaliser' : 'Nouvelle Commande'}
        </h1>
        
        <div className="w-20"></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Menu */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px]">
            
            {customizingPizza ? (
              /* Vue Personnalisation Pizza */
              <div className="space-y-6">
                <div className="text-center pb-4 border-b border-white/10">
                  <h3 className="text-2xl font-black">{customizingPizza.item.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Taille {customizingPizza.size.toUpperCase()} • {(customizingPizza.item.sizes[customizingPizza.size].priceCents / 100).toFixed(2)}€
                  </p>
                </div>

                {/* Ingrédients actuels (retirer) */}
                {customizingPizza.currentIngredients.length > 0 && (
                  <div>
                    <h4 className="text-sm font-black text-muted-foreground mb-3 uppercase">Ingrédients actuels (cliquer pour retirer)</h4>
                    <div className="flex flex-wrap gap-2">
                      {customizingPizza.currentIngredients.map((ingredient) => {
                        const isRemoved = customizingPizza.removedIngredients.includes(ingredient);
                        return (
                          <button
                            key={ingredient}
                            onClick={() => toggleRemoveIngredient(ingredient)}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                              isRemoved
                                ? 'bg-red-500/20 text-red-500 border-2 border-red-500 line-through'
                                : 'glass-premium glass-glossy border-white/20 hover:border-red-500/50'
                            }`}
                          >
                            {ingredient}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ingrédients disponibles (ajouter) */}
                <div>
                  <h4 className="text-sm font-black text-muted-foreground mb-3 uppercase">Ajouter des ingrédients</h4>
                  <div className="flex flex-wrap gap-2">
                    {ALL_INGREDIENTS
                      .filter(ing => !customizingPizza.currentIngredients.includes(ing))
                      .map((ingredient) => {
                        const isAdded = customizingPizza.addedIngredients.includes(ingredient);
                        return (
                          <button
                            key={ingredient}
                            onClick={() => toggleAddIngredient(ingredient)}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                              isAdded
                                ? 'bg-emerald-500 text-white border-2 border-emerald-500 shadow-lg'
                                : 'glass-premium glass-glossy border-white/20 hover:border-emerald-500/50'
                            }`}
                          >
                            {isAdded && '✓ '}{ingredient}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Bouton Ajouter au panier */}
                <Button
                  onClick={finishCustomization}
                  className="w-full h-14 rounded-2xl font-black text-lg bg-emerald-500 hover:bg-emerald-600"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Ajouter au panier
                </Button>
              </div>
            ) : (
              /* Vue principale avec catégories */
              <div className="space-y-6">
                {/* Pizza */}
                <div ref={pizzaRef}>
                  <button
                    onClick={() => setSelectedCategory(selectedCategory === 'pizza' ? null : 'pizza')}
                    className={`w-full glass-premium glass-glossy p-8 rounded-[24px] hover:scale-105 transition-all group ${
                      selectedCategory === 'pizza' ? 'border-2 border-orange-500' : 'border-white/20'
                    }`}
                  >
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 mx-auto rounded-full bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition">
                        <Pizza className="h-10 w-10 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black">Pizza</h3>
                        <p className="text-sm text-muted-foreground mt-1">{pizzas.length} produits</p>
                      </div>
                    </div>
                  </button>

                  {/* Contenu pizzas */}
                  {selectedCategory === 'pizza' && (
                    <div className="grid md:grid-cols-2 gap-3 mt-4">
                {pizzas.length === 0 ? (
                  <p className="col-span-2 text-center text-muted-foreground py-8">Aucune pizza dans le menu</p>
                ) : (
                  pizzas
                    .filter(item => hasValidPrice(item))
                    .map((item) => {
                    const isPizza = item.type === 'pizza';
                    const isExpanded = isItemSelected(item.id);
                    
                    const displayPrice = getDisplayPrice(item);
                    
                    return (
                      <div key={item.id} className={`transition-all ${isExpanded ? 'md:col-span-2' : ''}`}>
                        <button
                          onClick={() => {
                            if (isPizza) {
                              toggleItemSelection(item);
                            } else {
                              handleAddToCart(item);
                            }
                          }}
                          className={`glass-premium glass-glossy border-white/20 p-4 rounded-2xl hover:border-primary/50 transition-all text-left group w-full ${
                            isExpanded ? 'border-primary/50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h3 className="font-black text-lg group-hover:text-primary transition">{item.name}</h3>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                              )}
                            </div>
                            <div className="text-right">
                              {displayPrice ? (
                                <div className="text-xl font-black text-primary">
                                  {isPizza && '≈ '}{formatPrice(displayPrice)}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">Prix non défini</div>
                              )}
                            </div>
                          </div>
                        </button>
                        
                        {isExpanded && isPizza && item.sizes && (
                          <div className="mt-3 space-y-2">
                            {/* Choix de taille */}
                            <div className="grid grid-cols-3 gap-2">
                              {['s', 'm', 'l'].map((size) => {
                                const sizeData = item.sizes[size];
                                if (!sizeData) return null;
                                
                                return (
                                  <div key={size} className="space-y-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddToCart(item, size);
                                      }}
                                      className="w-full glass-premium glass-glossy border-white/20 p-3 rounded-xl hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all group"
                                    >
                                      <div className="text-center">
                                        <div className="text-lg font-black text-primary group-hover:text-emerald-500 transition">
                                          {size.toUpperCase()}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {sizeData.diameter}cm
                                        </div>
                                        <div className="text-lg font-bold mt-2">
                                          {formatPrice(sizeData.priceCents)}
                                        </div>
                                      </div>
                                    </button>
                                    
                                    {/* Bouton personnaliser */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startCustomization(item, size);
                                      }}
                                      className="w-full glass-premium glass-glossy border-orange-500/30 bg-orange-500/5 p-2 rounded-xl hover:border-orange-500/50 hover:bg-orange-500/10 transition-all text-xs font-bold text-orange-500"
                                    >
                                      Personnaliser
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
                </div>

                {/* Boisson */}
                <div ref={boissonRef}>
                  <button
                    onClick={() => setSelectedCategory(selectedCategory === 'boisson' ? null : 'boisson')}
                    className={`w-full glass-premium glass-glossy p-8 rounded-[24px] hover:scale-105 transition-all group ${
                      selectedCategory === 'boisson' ? 'border-2 border-blue-500' : 'border-white/20'
                    }`}
                  >
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition">
                        <Wine className="h-10 w-10 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black">Boisson</h3>
                        <p className="text-sm text-muted-foreground mt-1">{boissons.length} produits</p>
                      </div>
                    </div>
                  </button>

                  {/* Contenu boissons */}
                  {selectedCategory === 'boisson' && (
                    <div className="grid md:grid-cols-2 gap-3 mt-4">
                    {boissons.length === 0 ? (
                      <p className="col-span-2 text-center text-muted-foreground py-8">Aucune boisson dans le menu</p>
                    ) : (
                      boissons.map((item) => {
                        const multipleSizes = hasMultipleSizes(item);
                        const singleSizeData = getSingleSize(item);
                        const isExpanded = isItemSelected(item.id);
                        const isFlashing = isItemFlashing(item.id);
                        
                        return (
                          <div key={item.id} className={`transition-all ${isExpanded ? 'md:col-span-2' : ''}`}>
                            <button
                              onClick={() => {
                                if (singleSizeData) {
                                  // Une seule taille : ajouter directement
                                  handleAddToCart(item, singleSizeData.size);
                                } else if (multipleSizes) {
                                  // Plusieurs tailles : afficher sélecteur
                                  toggleItemSelection(item);
                                } else {
                                  // Pas de taille : ajouter directement
                                  handleAddToCart(item);
                                }
                              }}
                              className={`glass-premium glass-glossy border-white/20 p-4 rounded-2xl hover:border-primary/50 transition-all text-left group w-full ${
                                isExpanded ? 'border-primary/50' : ''
                              } ${
                                isFlashing ? 'bg-emerald-500/30 border-emerald-500 scale-105' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <h3 className="font-black text-lg group-hover:text-primary transition">{item.name}</h3>
                                {singleSizeData ? (
                                  <div className="text-xl font-black text-primary">
                                    {formatPrice(singleSizeData.data.priceCents)}
                                  </div>
                                ) : !multipleSizes && item.priceCents ? (
                                  <div className="text-xl font-black text-primary">
                                    {formatPrice(item.priceCents)}
                                  </div>
                                ) : null}
                              </div>
                            </button>
                            
                            {isExpanded && multipleSizes && (
                              <div className="mt-3 grid grid-cols-4 gap-2">
                                {Object.entries(item.sizes).map(([size, sizeData]) => (
                                  <button
                                    key={size}
                                    onClick={() => handleAddToCart(item, size)}
                                    className="glass-premium glass-glossy border-white/20 p-3 rounded-xl hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all"
                                  >
                                    <div className="text-center">
                                      <div className="text-sm font-black text-primary">
                                        {size}
                                      </div>
                                      <div className="text-lg font-bold mt-1">
                                        {formatPrice(sizeData.priceCents)}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  )}
                </div>

                {/* Dessert */}
                <div ref={dessertRef}>
                  <button
                    onClick={() => setSelectedCategory(selectedCategory === 'dessert' ? null : 'dessert')}
                    className={`w-full glass-premium glass-glossy p-8 rounded-[24px] hover:scale-105 transition-all group ${
                      selectedCategory === 'dessert' ? 'border-2 border-pink-500' : 'border-white/20'
                    }`}
                  >
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 mx-auto rounded-full bg-pink-500/20 flex items-center justify-center group-hover:bg-pink-500/30 transition">
                        <IceCream className="h-10 w-10 text-pink-500" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black">Dessert</h3>
                        <p className="text-sm text-muted-foreground mt-1">{desserts.length} produits</p>
                      </div>
                    </div>
                  </button>

                  {/* Contenu desserts */}
                  {selectedCategory === 'dessert' && (
                    <div className="grid md:grid-cols-2 gap-3 mt-4">
                    {desserts.length === 0 ? (
                      <p className="col-span-2 text-center text-muted-foreground py-8">Aucun dessert dans le menu</p>
                    ) : (
                      desserts.map((item) => {
                        const isFlashing = isItemFlashing(item.id);
                        return (
                        <button
                          key={item.id}
                          onClick={() => handleAddToCart(item)}
                          className={`glass-premium glass-glossy border-white/20 p-4 rounded-2xl hover:border-primary/50 transition-all text-left group ${
                            isFlashing ? 'bg-emerald-500/30 border-emerald-500 scale-105' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h3 className="font-black text-lg group-hover:text-primary transition">{item.name}</h3>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                              )}
                            </div>
                            <div className="text-right">
                              {item.priceCents ? (
                                <div className="text-xl font-black text-primary">
                                  {formatPrice(item.priceCents)}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">Prix non défini</div>
                              )}
                            </div>
                          </div>
                        </button>
                        );
                      })
                    )}
                  </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Panier */}
        <div className="space-y-4">
          <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px] sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-black">Panier</h2>
              {itemCount > 0 && (
                <span className="ml-auto bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">
                  {itemCount}
                </span>
              )}
            </div>

            {/* Prénom client */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-2">
                <User className="h-4 w-4" />
                Prénom du client
              </label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ex: Marie"
                className="rounded-xl"
              />
            </div>

            {/* Heure de retrait */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                Heure de retrait
              </label>
              <Input
                type="time"
                value={pickupTime}
                onChange={(e) => {
                  const newTime = e.target.value;
                  // IMPORTANT: ne pas valider pendant la frappe.
                  // Sinon l'input time "snap" sur une valeur (ex: 11:00) et déclenche l'erreur avant que
                  // l'utilisateur finisse d'entrer (ex: 12:30).
                  setPickupTimeError('');
                  setPickupTime(newTime);
                }}
                onBlur={() => {
                  // Validation douce à la fin de saisie (format complet)
                  if (!pickupTime || !/^\d{2}:\d{2}$/.test(pickupTime)) return;

                  const now = new Date();
                  const [hours, minutes] = pickupTime.split(':').map(Number);
                  const selectedDate = new Date();
                  selectedDate.setHours(hours, minutes, 0, 0);

                  if (selectedDate < now) {
                    setPickupTimeError("L'heure de retrait ne peut pas être dans le passé");
                  } else {
                    setPickupTimeError('');
                  }
                }}
                className="rounded-xl"
                min={(() => {
                  // Définir l'heure minimum (maintenant)
                  const now = new Date();
                  const h = String(now.getHours()).padStart(2, '0');
                  const m = String(now.getMinutes()).padStart(2, '0');
                  return `${h}:${m}`;
                })()}
              />
              {pickupTimeError && (
                <p className="mt-2 text-xs font-bold text-red-600">
                  ⚠️ {pickupTimeError}
                </p>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2 mb-4 max-h-75 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Panier vide</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="glass-premium glass-glossy border-white/10 p-3 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">{item.name}</span>
                      <button
                        onClick={() => deleteFromCart(item.id)}
                        className="text-red-500 hover:text-red-600 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition flex items-center justify-center"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="font-black text-lg w-8 text-center">{item.qty}</span>
                        <button
                          onClick={() => handleAddToCart({ id: item.id, name: item.name, priceCents: item.priceCents })}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition flex items-center justify-center"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <span className="font-bold text-primary">
                        {formatPrice(item.priceCents * item.qty)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total */}
            <div className="pt-4 border-t border-white/10 mb-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total HT</span>
                <span className="font-bold">
                  {formatPrice(totalCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">TVA (10%)</span>
                <span className="font-bold">
                  {formatPrice(calculateTVA(totalCents))}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="font-black text-xl">Total TTC</span>
                <span className="font-black text-3xl text-primary">
                  {formatPrice(calculateTotalTTC(totalCents))}
                </span>
              </div>
            </div>

            {/* Bouton valider */}
            <Button
              onClick={handleSubmitOrder}
              disabled={isSubmitting || cart.length === 0 || !customerName.trim()}
              className="w-full h-14 rounded-2xl font-black text-lg bg-emerald-500 hover:bg-emerald-600"
            >
              {isSubmitting ? (
                'Création...'
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  Valider la commande
                </>
              )}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
