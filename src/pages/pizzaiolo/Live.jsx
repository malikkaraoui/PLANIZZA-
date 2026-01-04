import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, User, ShoppingCart, Check, Pizza, Wine, IceCream, ArrowRight } from 'lucide-react';
import { ref, get, push, set, remove, onValue } from 'firebase/database';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/providers/AuthProvider';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const STORAGE_KEY_CART = 'planizza_live_cart';
const STORAGE_KEY_CUSTOMER = 'planizza_live_customer';
const TVA_RATE = 0.10; // 10% TVA restauration

export default function PizzaioloLive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [truckId, setTruckId] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loadingTruck, setLoadingTruck] = useState(true);

  // Navigation
  const [selectedCategory, setSelectedCategory] = useState(null); // 'pizza', 'boisson', 'dessert'
  const [selectedSubCategory, setSelectedSubCategory] = useState(null); // 'sans-alcool', 'alcool'
  
  // Panier
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Item sélectionné pour choisir la taille (pizzas uniquement)
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Personnalisation pizza (pour vue customize-pizza)
  const [customizingPizza, setCustomizingPizza] = useState(null); // {item, size, removedIngredients: [], addedIngredients: []}
  
  // Ingrédients disponibles (depuis les pizzas prédéfinies)
  const availableIngredients = [
    'Crème fraîche', 'Base Tomate',
    'Champignons', 'Oignons rouge', 'Tomates cerises', 'Poivrons',
    'Reblochon', 'Emmental', 'Gruyère', 'Burrata', 'Gorgonzola', 'Parmesan', 'Cabécou',
    'Jambon', 'Chorizo', 'Lardons', 'Saucisse', 'Poulet',
    'Mozzarella', 'Olives', 'Basilic', 'Roquette', 'Tomate', 'Chèvre', 'Miel'
  ];
  
  // ID de la commande en cours (pour Firebase sync)
  const liveOrderIdRef = useRef(null);

  // Charger le truckId et le menu
  useEffect(() => {
    if (!user?.uid) return;

    const loadTruckData = async () => {
      try {
        const pizzaioloRef = ref(db, `pizzaiolos/${user.uid}`);
        const snap = await get(pizzaioloRef);
        
        if (snap.exists() && snap.val().truckId) {
          const tid = snap.val().truckId;
          setTruckId(tid);
          
          // Charger le menu du camion
          const truckRef = ref(db, `public/trucks/${tid}/menu/items`);
          const menuSnap = await get(truckRef);
          
          console.log('[Live] Menu snapshot exists:', menuSnap.exists());
          
          if (menuSnap.exists()) {
            const menuData = menuSnap.val();
            console.log('[Live] Menu data:', menuData);
            
            // Firebase stocke le menu comme un objet, pas un array
            if (typeof menuData === 'object' && menuData !== null) {
              const menuArray = Object.entries(menuData).map(([id, data]) => ({
                id,
                ...data
              }));
              console.log('[Live] Menu array:', menuArray);
              setMenu(menuArray);
            } else {
              setMenu([]);
            }
          } else {
            console.log('[Live] Aucun menu trouvé');
          }
        }
      } catch (err) {
        console.error('[Live] Erreur chargement:', err);
      } finally {
        setLoadingTruck(false);
      }
    };

    loadTruckData();
  }, [user?.uid]);

  // Restaurer depuis localStorage au chargement
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(STORAGE_KEY_CART);
      const savedCustomer = localStorage.getItem(STORAGE_KEY_CUSTOMER);
      
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
      if (savedCustomer) {
        setCustomerName(savedCustomer);
      }
    } catch (err) {
      console.error('[Live] Erreur restauration localStorage:', err);
    }
  }, []);

  // Sauvegarder dans localStorage à chaque changement
  useEffect(() => {
    if (cart.length > 0 || customerName) {
      localStorage.setItem(STORAGE_KEY_CART, JSON.stringify(cart));
      localStorage.setItem(STORAGE_KEY_CUSTOMER, customerName);
    }
  }, [cart, customerName]);

  // Synchroniser avec Firebase en temps réel
  useEffect(() => {
    if (!truckId || !user?.uid) return;
    if (cart.length === 0 && !customerName) return;

    const syncToFirebase = async () => {
      try {
        // Créer un ID unique pour cette commande en cours si pas déjà existant
        if (!liveOrderIdRef.current) {
          liveOrderIdRef.current = push(ref(db, 'liveOrders')).key;
        }

        const totalCents = cart.reduce((sum, item) => sum + (item.priceCents * item.qty), 0);

        const liveOrderRef = ref(db, `liveOrders/${truckId}/${liveOrderIdRef.current}`);
        await set(liveOrderRef, {
          items: cart,
          customerName: customerName.trim(),
          totalCents,
          truckId,
          pizzaioloUid: user.uid,
          updatedAt: Date.now(),
          status: 'draft' // Pas encore validée
        });

        console.log('[Live] Synced to Firebase:', liveOrderIdRef.current);
      } catch (err) {
        console.error('[Live] Erreur sync Firebase:', err);
      }
    };

    // Debounce pour éviter trop d'écritures
    const timer = setTimeout(syncToFirebase, 500);
    return () => clearTimeout(timer);
  }, [cart, customerName, truckId, user?.uid]);

  // Ajouter au panier (avec taille pour pizzas)
  const addToCart = (item, size = null, customization = null) => {
    // Pour les pizzas, size est obligatoire (s/m/l)
    // Pour desserts/calzones/boissons, size peut être null ou la taille de boisson
    
    let cartItemId, cartItemName, cartItemPrice;
    
    if (item.type === 'pizza' && size && item.sizes?.[size]) {
      cartItemId = `${item.id}-${size}`;
      cartItemName = `${item.name} (${size.toUpperCase()})`;
      cartItemPrice = item.sizes[size].priceCents;
      
      // Ajouter personnalisation au nom si présente
      if (customization && (customization.removedIngredients.length > 0 || customization.addedIngredients.length > 0)) {
        const changes = [];
        if (customization.removedIngredients.length > 0) {
          changes.push(`Sans: ${customization.removedIngredients.join(', ')}`);
        }
        if (customization.addedIngredients.length > 0) {
          changes.push(`Avec: ${customization.addedIngredients.join(', ')}`);
        }
        cartItemName += ` [${changes.join(' | ')}]`;
      }
    } else if (['soda', 'eau', 'biere'].includes(item.type) && size && item.sizes?.[size]) {
      // Boisson avec taille
      cartItemId = `${item.id}-${size}`;
      const sizeLabels = { '33cl': '33cL', '75cl': '75cL', '1l': '1L', '1.5l': '1,5L', '50cl': '50cL', '25cl': '25cL' };
      cartItemName = `${item.name} (${sizeLabels[size] || size})`;
      cartItemPrice = item.sizes[size].priceCents;
    } else if (item.priceCents) {
      // Dessert, vin, ou calzone avec prix unique
      cartItemId = item.id;
      cartItemName = item.name;
      cartItemPrice = item.priceCents;
    } else {
      console.error('[Live] Prix manquant pour', item);
      return;
    }
    
    const existingIndex = cart.findIndex((i) => i.id === cartItemId);
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].qty += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { 
        id: cartItemId,
        name: cartItemName,
        priceCents: cartItemPrice,
        qty: 1 
      }]);
    }
    
    // Fermer la sélection de taille après ajout
    setSelectedItem(null);
    setCustomizingPizza(null);
  };

  // Ouvrir la vue de personnalisation pour une pizza
  const startCustomizingPizza = (item, size) => {
    // Extraire les ingrédients actuels depuis la description
    const ingredients = item.description ? 
      item.description.split(',').map(i => i.trim()).filter(i => i.length > 0) : 
      [];
    
    setCustomizingPizza({
      item,
      size,
      currentIngredients: ingredients,
      removedIngredients: [],
      addedIngredients: []
    });
  };

  // Toggle un ingrédient actuel (le retirer ou le remettre)
  const toggleRemoveIngredient = (ingredient) => {
    if (!customizingPizza) return;
    
    const isRemoved = customizingPizza.removedIngredients.includes(ingredient);
    
    setCustomizingPizza({
      ...customizingPizza,
      removedIngredients: isRemoved
        ? customizingPizza.removedIngredients.filter(i => i !== ingredient)
        : [...customizingPizza.removedIngredients, ingredient]
    });
  };

  // Toggle un ingrédient supplémentaire
  const toggleAddIngredient = (ingredient) => {
    if (!customizingPizza) return;
    
    const isAdded = customizingPizza.addedIngredients.includes(ingredient);
    
    setCustomizingPizza({
      ...customizingPizza,
      addedIngredients: isAdded
        ? customizingPizza.addedIngredients.filter(i => i !== ingredient)
        : [...customizingPizza.addedIngredients, ingredient]
    });
  };

  // Finaliser la personnalisation
  const finishCustomization = () => {
    if (!customizingPizza) return;
    
    addToCart(
      customizingPizza.item,
      customizingPizza.size,
      {
        removedIngredients: customizingPizza.removedIngredients,
        addedIngredients: customizingPizza.addedIngredients
      }
    );
  };

  // Retirer du panier
  const removeFromCart = (itemId) => {
    const existingIndex = cart.findIndex((i) => i.id === itemId);
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      if (newCart[existingIndex].qty > 1) {
        newCart[existingIndex].qty -= 1;
      } else {
        newCart.splice(existingIndex, 1);
      }
      setCart(newCart);
    }
  };

  // Supprimer du panier
  const deleteFromCart = (itemId) => {
    setCart(cart.filter((i) => i.id !== itemId));
  };

  // Filtrer le menu par catégorie
  const pizzas = menu.filter(item => item.type === 'pizza' || item.type === 'calzone');
  const boissons = menu.filter(item => ['soda', 'eau', 'biere', 'vin'].includes(item.type));
  const desserts = menu.filter(item => item.type === 'dessert');
  
  // Sous-catégories boissons
  const boissonsAlcool = boissons.filter(item => ['biere', 'vin'].includes(item.type));
  const boissonsSansAlcool = boissons.filter(item => ['soda', 'eau'].includes(item.type));
  
  // Trier les boissons : Coca en premier
  const sortedBoissons = (list) => {
    return [...list].sort((a, b) => {
      if (a.name.toLowerCase().includes('coca')) return -1;
      if (b.name.toLowerCase().includes('coca')) return 1;
      return 0;
    });
  };
  
  // Trier les desserts : Tiramisu Nutella en premier
  const sortedDesserts = [...desserts].sort((a, b) => {
    if (a.name.toLowerCase().includes('tiramisu') && a.name.toLowerCase().includes('nutella')) return -1;
    if (b.name.toLowerCase().includes('tiramisu') && b.name.toLowerCase().includes('nutella')) return 1;
    return 0;
  });

  // Calculer le total
  const totalCents = cart.reduce((sum, item) => sum + (item.priceCents * item.qty), 0);

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

    setIsSubmitting(true);

    try {
      // 1. Créer la commande dans orders (cycle normal)
      const ordersRef = ref(db, 'orders');
      const newOrderRef = push(ordersRef);
      
      const orderData = {
        truckId,
        uid: user.uid, // Uid du pizzaiolo qui crée la commande
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          priceCents: item.priceCents,
          qty: item.qty
        })),
        totalCents,
        status: 'received', // Commande manuelle = à prendre en charge
        createdAt: Date.now(),
        timeline: {
          // Pas de timeline pour le moment, sera remplie lors de la prise en charge
        },
        payment: {
          provider: 'manual',
          paymentStatus: 'paid', // Payée à la main
          paidAt: Date.now()
        },
        deliveryMethod: 'pickup',
        customerName: customerName.trim(),
        source: 'manual' // Flag pour identifier les commandes manuelles
      };

      await set(newOrderRef, orderData);

      // 2. Supprimer de liveOrders (brouillon)
      if (liveOrderIdRef.current && truckId) {
        const liveOrderRef = ref(db, `liveOrders/${truckId}/${liveOrderIdRef.current}`);
        await remove(liveOrderRef);
        liveOrderIdRef.current = null;
      }

      // 3. Nettoyer localStorage
      localStorage.removeItem(STORAGE_KEY_CART);
      localStorage.removeItem(STORAGE_KEY_CUSTOMER);

      // 4. Réinitialiser l'état
      setCart([]);
      setCustomerName('');
      
      alert(`✅ Commande créée pour ${customerName}`);
      
      console.log('[Live] Commande validée et transférée vers orders');
      
    } catch (err) {
      console.error('[Live] Erreur création commande:', err);
      alert('❌ Erreur lors de la création de la commande');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingTruck) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground font-medium">Chargement...</p>
      </div>
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
              setCustomizingPizza(null);
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
                    {availableIngredients
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
                {/* 3 grosses tuiles principales */}
                <div className="grid md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setSelectedCategory(selectedCategory === 'pizza' ? null : 'pizza')}
                    className={`glass-premium glass-glossy p-8 rounded-[24px] hover:scale-105 transition-all group ${
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

                  <button
                    onClick={() => setSelectedCategory(selectedCategory === 'boisson' ? null : 'boisson')}
                    className={`glass-premium glass-glossy p-8 rounded-[24px] hover:scale-105 transition-all group ${
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

                  <button
                    onClick={() => setSelectedCategory(selectedCategory === 'dessert' ? null : 'dessert')}
                    className={`glass-premium glass-glossy p-8 rounded-[24px] hover:scale-105 transition-all group ${
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
                </div>

                {/* Contenu selon la catégorie sélectionnée */}
                {selectedCategory === 'pizza' && (
              <div className="grid md:grid-cols-2 gap-3">
                {pizzas.length === 0 ? (
                  <p className="col-span-2 text-center text-muted-foreground py-8">Aucune pizza dans le menu</p>
                ) : (
                  pizzas.map((item) => {
                    const isPizza = item.type === 'pizza';
                    const isExpanded = selectedItem?.id === item.id;
                    
                    const displayPrice = isPizza && item.sizes?.m?.priceCents
                      ? item.sizes.m.priceCents
                      : item.priceCents;
                    
                    return (
                      <div key={item.id} className={`transition-all ${isExpanded ? 'md:col-span-2' : ''}`}>
                        <button
                          onClick={() => {
                            if (isPizza) {
                              setSelectedItem(isExpanded ? null : item);
                            } else {
                              addToCart(item);
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
                                  {isPizza && '≈ '}{(displayPrice / 100).toFixed(2)}€
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
                                        addToCart(item, size);
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
                                          {(sizeData.priceCents / 100).toFixed(2)}€
                                        </div>
                                      </div>
                                    </button>
                                    
                                    {/* Bouton personnaliser */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startCustomizingPizza(item, size);
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

            {/* Vue Boissons sans alcool */}
            {currentView === 'boisson-sans-alcool' && (
              <div className="grid md:grid-cols-2 gap-3">
                {sortedBoissons(boissonsSansAlcool).length === 0 ? (
                  <p className="col-span-2 text-center text-muted-foreground py-8">Aucune boisson</p>
                ) : (
                  sortedBoissons(boissonsSansAlcool).map((item) => {
                    const isExpanded = selectedItem?.id === item.id;
                    const hasSizes = item.sizes && Object.keys(item.sizes).length > 0;
                    
                    return (
                      <div key={item.id} className={`transition-all ${isExpanded ? 'md:col-span-2' : ''}`}>
                        <button
                          onClick={() => {
                            if (hasSizes) {
                              setSelectedItem(isExpanded ? null : item);
                            } else {
                              addToCart(item);
                            }
                          }}
                          className={`glass-premium glass-glossy border-white/20 p-4 rounded-2xl hover:border-primary/50 transition-all text-left group w-full ${
                            isExpanded ? 'border-primary/50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="font-black text-lg group-hover:text-primary transition">{item.name}</h3>
                            {!hasSizes && item.priceCents && (
                              <div className="text-xl font-black text-primary">
                                {(item.priceCents / 100).toFixed(2)}€
                              </div>
                            )}
                          </div>
                        </button>
                        
                        {isExpanded && hasSizes && (
                          <div className="mt-3 grid grid-cols-4 gap-2">
                            {Object.entries(item.sizes).map(([size, sizeData]) => {
                              const labels = {
                                '33cl': '33cL',
                                '75cl': '75cL',
                                '1l': '1L',
                                '1.5l': '1,5L',
                                '50cl': '50cL'
                              };
                              
                              return (
                                <button
                                  key={size}
                                  onClick={() => addToCart(item, size)}
                                  className="glass-premium glass-glossy border-white/20 p-3 rounded-xl hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all"
                                >
                                  <div className="text-center">
                                    <div className="text-sm font-black text-primary">
                                      {labels[size] || size}
                                    </div>
                                    <div className="text-lg font-bold mt-1">
                                      {(sizeData.priceCents / 100).toFixed(2)}€
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Vue Boissons avec alcool */}
            {currentView === 'boisson-alcool' && (
              <div className="grid md:grid-cols-2 gap-3">
                {boissonsAlcool.length === 0 ? (
                  <p className="col-span-2 text-center text-muted-foreground py-8">Aucune boisson alcoolisée</p>
                ) : (
                  boissonsAlcool.map((item) => {
                    const isExpanded = selectedItem?.id === item.id;
                    const hasSizes = item.sizes && Object.keys(item.sizes).length > 0;
                    
                    return (
                      <div key={item.id} className={`transition-all ${isExpanded ? 'md:col-span-2' : ''}`}>
                        <button
                          onClick={() => {
                            if (hasSizes) {
                              setSelectedItem(isExpanded ? null : item);
                            } else {
                              addToCart(item);
                            }
                          }}
                          className={`glass-premium glass-glossy border-white/20 p-4 rounded-2xl hover:border-primary/50 transition-all text-left group w-full ${
                            isExpanded ? 'border-primary/50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="font-black text-lg group-hover:text-primary transition">{item.name}</h3>
                            {!hasSizes && item.priceCents && (
                              <div className="text-xl font-black text-primary">
                                {(item.priceCents / 100).toFixed(2)}€
                              </div>
                            )}
                          </div>
                        </button>
                        
                        {isExpanded && hasSizes && (
                          <div className="mt-3 grid grid-cols-4 gap-2">
                            {Object.entries(item.sizes).map(([size, sizeData]) => {
                              const labels = {
                                '25cl': '25cL',
                                '33cl': '33cL'
                              };
                              
                              return (
                                <button
                                  key={size}
                                  onClick={() => addToCart(item, size)}
                                  className="glass-premium glass-glossy border-white/20 p-3 rounded-xl hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all"
                                >
                                  <div className="text-center">
                                    <div className="text-sm font-black text-primary">
                                      {labels[size] || size}
                                    </div>
                                    <div className="text-lg font-bold mt-1">
                                      {(sizeData.priceCents / 100).toFixed(2)}€
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Vue Desserts */}
            {currentView === 'dessert' && (
              <div className="grid md:grid-cols-2 gap-3">
                {sortedDesserts.length === 0 ? (
                  <p className="col-span-2 text-center text-muted-foreground py-8">Aucun dessert</p>
                ) : (
                  sortedDesserts.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="glass-premium glass-glossy border-white/20 p-4 rounded-2xl hover:border-primary/50 transition-all text-left group"
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
                              {(item.priceCents / 100).toFixed(2)}€
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">Prix non défini</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Vue Personnalisation Pizza */}
            {currentView === 'customize-pizza' && customizingPizza && (
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
                    {availableIngredients
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
            )}
          </Card>
        </div>

        {/* Panier */}
        <div className="space-y-4">
          <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px] sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-black">Panier</h2>
              {cart.length > 0 && (
                <span className="ml-auto bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">
                  {cart.reduce((sum, item) => sum + item.qty, 0)}
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
                          onClick={() => addToCart(item)}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition flex items-center justify-center"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <span className="font-bold text-primary">
                        {((item.priceCents * item.qty) / 100).toFixed(2)}€
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
                  {(totalCents / 100).toFixed(2)}€
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">TVA (10%)</span>
                <span className="font-bold">
                  {(totalCents * TVA_RATE / 100).toFixed(2)}€
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="font-black text-xl">Total TTC</span>
                <span className="font-black text-3xl text-primary">
                  {(totalCents * (1 + TVA_RATE) / 100).toFixed(2)}€
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
