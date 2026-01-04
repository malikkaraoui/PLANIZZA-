import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ref, get, set, push, remove, onValue } from 'firebase/database';
import { useAuth } from '../../app/providers/AuthProvider';
import { db } from '../../lib/firebase';
import Card from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const ITEM_TYPES = [
  { value: 'pizza', label: '🍕 Pizza' },
  { value: 'calzone', label: '🥟 Calzone' },
  { value: 'dessert', label: '🍰 Dessert' },
  { value: 'soda', label: '🥤 Soda' },
  { value: 'eau', label: '💧 Eau (plate/pétillante)' },
  { value: 'biere', label: '🍺 Bière' },
  { value: 'vin', label: '🍷 Vin' }
];

const PIZZA_SIZES = [
  { value: 's', label: 'S (26cm)', defaultDiameter: 26 },
  { value: 'm', label: 'M (34cm)', defaultDiameter: 34 },
  { value: 'l', label: 'L (44cm)', defaultDiameter: 44 }
];

const PIZZAS_PREDEFINES = [
  { 
    name: 'La Reine', 
    ingredients: 'Sauce tomate, mozzarella, emmental, jambon, champignons, olives',
    emoji: '👑'
  },
  { 
    name: 'La Margarita', 
    ingredients: 'Sauce tomate, mozzarella, emmental, olives',
    emoji: '🌿'
  },
  { 
    name: 'La Chèvre Miel', 
    ingredients: 'Crème fraîche, mozzarella, emmental, chèvre, miel, olives',
    emoji: '🐐'
  },
  { 
    name: 'La Napoli', 
    ingredients: 'Sauce tomate, mozzarella, emmental, anchois, olives',
    emoji: '🐟'
  },
  { 
    name: 'La Perso', 
    ingredients: '',
    emoji: '✨',
    custom: true
  }
];

const BASES = ['Crème fraîche', 'Base Tomate'];

const GARNITURES = [
  'Champignons de Paris',
  'Oignons rouge',
  'Tomates cerises',
  'Poivrons'
];

const FROMAGES = [
  'Reblochon',
  'Emmental',
  'Gruyère',
  'Burrata',
  'Gorgonzola',
  'Parmesan',
  'Cabécou'
];

const DESSERTS = [
  { name: 'Tiramisu café', emoji: '☕', defaultPrice: 5.00 },
  { name: 'Tiramisu Nutella', emoji: '🍫', defaultPrice: 5.50 },
  { name: 'Tiramisu Spéculos', emoji: '🍪', defaultPrice: 5.50 },
  { name: 'Fondant chocolat', emoji: '🍰', defaultPrice: 6.00 },
  { name: 'Crumble pomme', emoji: '🍎', defaultPrice: 5.00 },
  { name: 'Crumble poire', emoji: '🍐', defaultPrice: 5.00 }
];

const SODAS = [
  { name: 'Coca Cola', emoji: '🥤' },
  { name: 'Coca Cola Zéro', emoji: '🥤' },
  { name: 'Fanta Orange', emoji: '🍊' },
  { name: 'Fanta Citron', emoji: '🍋' },
  { name: 'Oasis Fruits Rouges', emoji: '🍓' },
  { name: 'Oasis Tropical', emoji: '🥭' }
];

const EAUX = [
  { name: 'Badoit', emoji: '💧' },
  { name: 'Cristalline', emoji: '💧' },
  { name: 'Evian', emoji: '💧' }
];

const BIERES = [
  { name: 'Heineken', emoji: '🍺' },
  { name: 'Affligem', emoji: '🍺' },
  { name: '1664', emoji: '🍺' }
];

const VINS = [
  { name: 'GÉRARD BERTRAND : GRIS BLANC - 2023', defaultPrice: 11.50, emoji: '🍷' },
  { name: 'CLOS DES FEES - LES SORCIERES 2024', defaultPrice: 15.00, emoji: '🍷' }
];

const DRINK_SIZES = {
  soda: [
    { value: '25cl', label: '25cL', defaultPrice: 2.00 },
    { value: '33cl', label: '33cL', defaultPrice: 3.00 }
  ],
  eau: [
    { value: '50cl', label: '50cL', defaultPrice: 1.80 },
    { value: '1l', label: '1L', defaultPrice: 2.50 }
  ],
  biere: [
    { value: '25cl', label: '25cL', defaultPrice: 3.00 },
    { value: '33cl', label: '33cL', defaultPrice: 5.00 }
  ]
};

export default function PizzaioloMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [truckId, setTruckId] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulaire nouvel item
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null); // 'pizza', 'calzone', 'boisson', 'dessert'
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemType, setItemType] = useState('pizza');
  const [priceS, setPriceS] = useState('');
  const [priceM, setPriceM] = useState('');
  const [priceL, setPriceL] = useState('');
  const [diameterS, setDiameterS] = useState('26');
  const [diameterM, setDiameterM] = useState('34');
  const [diameterL, setDiameterL] = useState('44');
  
  // États pour les boissons
  const [drinkName, setDrinkName] = useState('');
  const [drinkSizes, setDrinkSizes] = useState({});
  
  // États pour les pizzas personnalisées
  const [selectedBase, setSelectedBase] = useState('');
  const [selectedGarnitures, setSelectedGarnitures] = useState([]);
  const [selectedFromages, setSelectedFromages] = useState([]);
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Charger le truckId et les items du menu
  useEffect(() => {
    if (!user?.uid) return;

    const loadMenu = async () => {
      setLoading(true);
      try {
        const pizzaioloRef = ref(db, `pizzaiolos/${user.uid}`);
        const snap = await get(pizzaioloRef);
        
        if (snap.exists()) {
          const data = snap.val();
          const tid = data.truckId;
          setTruckId(tid);

          console.log('[PLANIZZA] Menu - TruckId:', tid);

          // Écouter les changements du menu en temps réel
          const menuRef = ref(db, `public/trucks/${tid}/menu/items`);
          const unsubscribe = onValue(menuRef, (menuSnap) => {
            if (menuSnap.exists()) {
              const items = Object.entries(menuSnap.val()).map(([id, data]) => ({
                id,
                ...data
              }));
              console.log('[PLANIZZA] Menu items chargés:', items.length, items);
              setMenuItems(items);
            } else {
              console.log('[PLANIZZA] Aucun item dans le menu');
              setMenuItems([]);
            }
            setLoading(false);
          });

          // Cleanup listener
          return () => unsubscribe();
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('[PLANIZZA] Erreur chargement menu:', err);
        setLoading(false);
      }
    };

    loadMenu();
  }, [user?.uid]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!truckId) return;

    // Validation des prix pour les pizzas
    if (itemType === 'pizza') {
      const sPrice = priceS ? parseFloat(priceS) : null;
      const mPrice = priceM ? parseFloat(priceM) : null;
      const lPrice = priceL ? parseFloat(priceL) : null;
      
      const sDiameter = diameterS ? parseInt(diameterS) : null;
      const mDiameter = diameterM ? parseInt(diameterM) : null;
      const lDiameter = diameterL ? parseInt(diameterL) : null;
      
      // Compter le nombre de tailles renseignées
      const sizesCount = [sPrice, mPrice, lPrice].filter(p => p && p > 0).length;
      
      // Au moins 1 taille, maximum 3 tailles
      if (sizesCount === 0) {
        setMessage('❌ Vous devez renseigner au moins une taille de pizza');
        return;
      }
      if (sizesCount > 3) {
        setMessage('❌ Maximum 3 tailles par pizza');
        return;
      }
      
      // Validation des prix croissants : S < M < L
      if (sPrice && mPrice && mPrice <= sPrice) {
        setMessage('❌ Le prix M doit être strictement supérieur au prix S');
        return;
      }
      if (mPrice && lPrice && lPrice <= mPrice) {
        setMessage('❌ Le prix L doit être strictement supérieur au prix M');
        return;
      }
      if (sPrice && lPrice && lPrice <= sPrice) {
        setMessage('❌ Le prix L doit être strictement supérieur au prix S');
        return;
      }
      
      // Validation des diamètres croissants : S < M < L
      if (sDiameter && mDiameter && mDiameter <= sDiameter) {
        setMessage('❌ Le diamètre M doit être strictement supérieur au diamètre S');
        return;
      }
      if (mDiameter && lDiameter && lDiameter <= mDiameter) {
        setMessage('❌ Le diamètre L doit être strictement supérieur au diamètre M');
        return;
      }
      if (sDiameter && lDiameter && lDiameter <= sDiameter) {
        setMessage('❌ Le diamètre L doit être strictement supérieur au diamètre S');
        return;
      }
      
      // Vérifier que chaque prix a son diamètre
      if (sPrice && !sDiameter) {
        setMessage('❌ Le diamètre S est obligatoire si vous renseignez un prix S');
        return;
      }
      if (mPrice && !mDiameter) {
        setMessage('❌ Le diamètre M est obligatoire si vous renseignez un prix M');
        return;
      }
      if (lPrice && !lDiameter) {
        setMessage('❌ Le diamètre L est obligatoire si vous renseignez un prix L');
        return;
      }
    }

    setSaving(true);
    setMessage('');

    try {
      const menuRef = ref(db, `public/trucks/${truckId}/menu/items`);
      const newItemRef = push(menuRef);

      const itemData = {
        name: itemName.trim(),
        description: itemDesc.trim(),
        type: itemType,
        createdAt: Date.now()
      };

      // Gestion des prix selon le type
      if (itemType === 'pizza') {
        itemData.sizes = {};
        
        // Ajouter uniquement les tailles qui ont un prix
        if (priceS && parseFloat(priceS) > 0) {
          itemData.sizes.s = { 
            priceCents: parseFloat(priceS) * 100,
            diameter: parseInt(diameterS)
          };
        }
        if (priceM && parseFloat(priceM) > 0) {
          itemData.sizes.m = { 
            priceCents: parseFloat(priceM) * 100,
            diameter: parseInt(diameterM)
          };
        }
        if (priceL && parseFloat(priceL) > 0) {
          itemData.sizes.l = { 
            priceCents: parseFloat(priceL) * 100,
            diameter: parseInt(diameterL)
          };
        }
      } else if (['soda', 'eau', 'biere'].includes(itemType)) {
        // Pour les boissons avec tailles
        itemData.sizes = {};
        Object.entries(drinkSizes).forEach(([size, price]) => {
          if (price && parseFloat(price) > 0) {
            itemData.sizes[size] = {
              priceCents: parseFloat(price) * 100
            };
          }
        });
        
        if (Object.keys(itemData.sizes).length === 0) {
          setMessage('❌ Vous devez renseigner au moins une taille');
          setSaving(false);
          return;
        }
      } else if (itemType === 'vin') {
        // Pour les vins, un seul prix par bouteille
        itemData.priceCents = parseFloat(priceS) * 100;
      } else {
        // Pour calzone et dessert, un seul prix
        itemData.priceCents = parseFloat(priceS) * 100;
      }

      await set(newItemRef, itemData);

      // Le listener onValue() mettra à jour automatiquement menuItems
      // Pas besoin de setMenuItems ici (évite les doublons)

      // Reset form
      setItemName('');
      setItemDesc('');
      setItemType('pizza');
      setPriceS('');
      setPriceM('');
      setPriceL('');
      setDiameterS('26');
      setDiameterM('34');
      setDiameterL('44');
      setDrinkName('');
      setDrinkSizes({});
      setShowForm(false);
      setMessage('✅ Article ajouté avec succès !');

      console.log('[PLANIZZA] Item ajouté:', itemData);
    } catch (err) {
      console.error('Erreur ajout item:', err);
      setMessage('❌ Erreur lors de l\'ajout. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!truckId || !confirm('Supprimer cet article du menu ?')) return;

    try {
      await remove(ref(db, `public/trucks/${truckId}/menu/items/${itemId}`));
      // Le listener onValue() mettra à jour automatiquement menuItems
      setMessage('✅ Article supprimé');
    } catch (err) {
      console.error('Erreur suppression item:', err);
      setMessage('❌ Erreur suppression');
    }
  };

  const formatPrice = (cents) => {
    return (cents / 100).toFixed(2) + ' €';
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-gray-600">Chargement du menu...</p>
      </Card>
    );
  }

  if (!truckId) {
    return (
      <Card className="p-6">
        <p className="text-gray-600">⚠️ Créez d'abord votre camion dans l'onglet "Profil"</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bouton retour */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">📋 Mon Menu</h2>
            <p className="mt-1 text-sm text-gray-600">Gérez votre carte : pizzas, calzones, boissons, desserts</p>
          </div>
          {showForm && (
            <Button variant="outline" onClick={() => {
              setShowForm(false);
              setSelectedCategory(null);
              setItemName('');
              setItemDesc('');
              setPriceS('');
              setPriceM('');
              setPriceL('');
              setDrinkSizes({});
            }}>
              Annuler
            </Button>
          )}
        </div>

        {message && (
          <div className={`mt-4 p-4 rounded-lg ${message.includes('✅') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {message}
          </div>
        )}

        {/* Tuiles de sélection de catégorie */}
        {!showForm && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => {
                setSelectedCategory('pizza');
                setItemType('pizza');
                setShowForm(true);
              }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              <div className="text-5xl mb-3">🍕</div>
              <h3 className="text-xl font-bold">PIZZA</h3>
              <p className="text-sm text-white/80 mt-1">Créer une pizza</p>
            </button>

            <button
              onClick={() => {
                setSelectedCategory('calzone');
                setItemType('calzone');
                setShowForm(true);
              }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              <div className="text-5xl mb-3">🥟</div>
              <h3 className="text-xl font-bold">CALZONE</h3>
              <p className="text-sm text-white/80 mt-1">Ajouter un calzone</p>
            </button>

            <button
              onClick={() => {
                setSelectedCategory('boisson');
                setShowForm(true);
              }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              <div className="text-5xl mb-3">🥤</div>
              <h3 className="text-xl font-bold">BOISSONS</h3>
              <p className="text-sm text-white/80 mt-1">Sodas, eaux, bières...</p>
            </button>

            <button
              onClick={() => {
                setSelectedCategory('dessert');
                setItemType('dessert');
                setShowForm(true);
              }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
            >
              <div className="text-5xl mb-3">🍰</div>
              <h3 className="text-xl font-bold">DESSERT</h3>
              <p className="text-sm text-white/80 mt-1">Ajouter un dessert</p>
            </button>
          </div>
        )}

        {/* Formulaire selon la catégorie sélectionnée */}
        {showForm && selectedCategory === 'boisson' && (
          <div className="mt-6 space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900">Type de boisson</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setItemType('soda')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  itemType === 'soda' 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">🥤</div>
                <div className="font-medium">Soda</div>
              </button>
              <button
                type="button"
                onClick={() => setItemType('eau')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  itemType === 'eau' 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">💧</div>
                <div className="font-medium">Eau</div>
              </button>
              <button
                type="button"
                onClick={() => setItemType('biere')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  itemType === 'biere' 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">🍺</div>
                <div className="font-medium">Bière</div>
              </button>
              <button
                type="button"
                onClick={() => setItemType('vin')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  itemType === 'vin' 
                    ? 'border-emerald-500 bg-emerald-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">🍷</div>
                <div className="font-medium">Vin</div>
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleAddItem} className="mt-6 space-y-6 border-t pt-6">
            {/* Sélection Pizza prédéfinie ou Dessert prédéfini */}
            {selectedCategory === 'pizza' && !itemName && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Choisissez une pizza</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PIZZAS_PREDEFINES.map(pizza => (
                    <button
                      key={pizza.name}
                      type="button"
                      onClick={() => {
                        setItemName(pizza.name);
                        setItemDesc(pizza.ingredients);
                      }}
                      className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
                    >
                      <div className="text-3xl mb-2">{pizza.emoji}</div>
                      <div className="font-semibold text-sm">{pizza.name}</div>
                      {pizza.ingredients && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">{pizza.ingredients}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedCategory === 'dessert' && !itemName && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Choisissez un dessert</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {DESSERTS.map(dessert => (
                    <button
                      key={dessert.name}
                      type="button"
                      onClick={() => {
                        setItemName(dessert.name);
                        setPriceS(dessert.defaultPrice.toString());
                      }}
                      className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center"
                    >
                      <div className="text-4xl mb-2">{dessert.emoji}</div>
                      <div className="font-semibold text-sm">{dessert.name}</div>
                      <div className="text-xs text-emerald-600 mt-1">{dessert.defaultPrice.toFixed(2)}€</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sélection type de boisson puis boisson spécifique */}
            {selectedCategory === 'boisson' && itemType && !itemName && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {itemType === 'soda' && 'Choisissez un soda'}
                  {itemType === 'eau' && 'Choisissez une eau'}
                  {itemType === 'biere' && 'Choisissez une bière'}
                  {itemType === 'vin' && 'Choisissez un vin'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {itemType === 'soda' && SODAS.map(soda => (
                    <button
                      key={soda.name}
                      type="button"
                      onClick={() => {
                        setItemName(soda.name);
                        const defaultSizes = {};
                        DRINK_SIZES.soda.forEach(size => {
                          defaultSizes[size.value] = size.defaultPrice.toString();
                        });
                        setDrinkSizes(defaultSizes);
                      }}
                      className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center"
                    >
                      <div className="text-4xl mb-2">{soda.emoji}</div>
                      <div className="font-semibold text-sm">{soda.name}</div>
                    </button>
                  ))}
                  {itemType === 'eau' && EAUX.map(eau => (
                    <button
                      key={eau.name}
                      type="button"
                      onClick={() => {
                        setItemName(eau.name);
                        const defaultSizes = {};
                        DRINK_SIZES.eau.forEach(size => {
                          defaultSizes[size.value] = size.defaultPrice.toString();
                        });
                        setDrinkSizes(defaultSizes);
                      }}
                      className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center"
                    >
                      <div className="text-4xl mb-2">{eau.emoji}</div>
                      <div className="font-semibold text-sm">{eau.name}</div>
                    </button>
                  ))}
                  {itemType === 'biere' && BIERES.map(biere => (
                    <button
                      key={biere.name}
                      type="button"
                      onClick={() => {
                        setItemName(biere.name);
                        const defaultSizes = {};
                        DRINK_SIZES.biere.forEach(size => {
                          defaultSizes[size.value] = size.defaultPrice.toString();
                        });
                        setDrinkSizes(defaultSizes);
                      }}
                      className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center"
                    >
                      <div className="text-4xl mb-2">{biere.emoji}</div>
                      <div className="font-semibold text-sm">{biere.name}</div>
                    </button>
                  ))}
                  {itemType === 'vin' && VINS.map(vin => (
                    <button
                      key={vin.name}
                      type="button"
                      onClick={() => {
                        setItemName(vin.name);
                        setPriceS(vin.defaultPrice.toString());
                      }}
                      className="p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
                    >
                      <div className="text-3xl mb-2">{vin.emoji}</div>
                      <div className="font-semibold text-xs">{vin.name}</div>
                      <div className="text-xs text-emerald-600 mt-1">{vin.defaultPrice.toFixed(2)}€</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pizza personnalisée : sélection ingrédients */}
            {itemName === 'La Perso' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Composez votre pizza</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {BASES.map(base => (
                      <button
                        key={base}
                        type="button"
                        onClick={() => setSelectedBase(base)}
                        className={`p-3 rounded-lg border-2 transition-all text-sm ${
                          selectedBase === base 
                            ? 'border-emerald-500 bg-emerald-50 font-semibold' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {base}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Garnitures</label>
                  <div className="grid grid-cols-2 gap-2">
                    {GARNITURES.map(garniture => (
                      <button
                        key={garniture}
                        type="button"
                        onClick={() => {
                          setSelectedGarnitures(prev => 
                            prev.includes(garniture) 
                              ? prev.filter(g => g !== garniture)
                              : [...prev, garniture]
                          );
                        }}
                        className={`p-2 rounded-lg border-2 transition-all text-xs ${
                          selectedGarnitures.includes(garniture)
                            ? 'border-emerald-500 bg-emerald-50 font-semibold' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {garniture}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fromages *</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {FROMAGES.map(fromage => (
                      <button
                        key={fromage}
                        type="button"
                        onClick={() => {
                          setSelectedFromages(prev => 
                            prev.includes(fromage) 
                              ? prev.filter(f => f !== fromage)
                              : [...prev, fromage]
                          );
                        }}
                        className={`p-2 rounded-lg border-2 transition-all text-xs ${
                          selectedFromages.includes(fromage)
                            ? 'border-emerald-500 bg-emerald-50 font-semibold' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {fromage}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Champs communs une fois le produit sélectionné */}
            {itemName && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nom</label>
                  <Input
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="mt-1"
                    readOnly={selectedCategory !== 'calzone'}
                  />
                </div>

                {(selectedCategory === 'pizza' || selectedCategory === 'calzone') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Ingrédients</label>
                    <textarea
                      value={itemDesc}
                      onChange={(e) => setItemDesc(e.target.value)}
                      placeholder="Ex: Tomate, mozzarella, basilic frais..."
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      rows={3}
                    />
                  </div>
                )}

                {(selectedCategory === 'pizza' || selectedCategory === 'calzone') && (
                  <div className="space-y-4">
                <p className="text-sm font-medium text-gray-700">Tailles et prix * (minimum 1, maximum 3)</p>
                <p className="text-xs text-gray-500">Prix : S {'<'} M {'<'} L • Diamètres : S {'<'} M {'<'} L</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">S (Petite)</label>
                    <div className="space-y-2">
                      <Input
                        value={priceS}
                        onChange={(e) => setPriceS(e.target.value)}
                        placeholder="Prix €"
                        type="number"
                        step="0.01"
                        min="0"
                      />
                      <Input
                        value={diameterS}
                        onChange={(e) => setDiameterS(e.target.value)}
                        placeholder="Ø cm"
                        type="number"
                        min="15"
                        max="50"
                        disabled={!priceS}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">M (Moyenne)</label>
                    <div className="space-y-2">
                      <Input
                        value={priceM}
                        onChange={(e) => setPriceM(e.target.value)}
                        placeholder="Prix €"
                        type="number"
                        step="0.01"
                        min="0"
                      />
                      <Input
                        value={diameterM}
                        onChange={(e) => setDiameterM(e.target.value)}
                        placeholder="Ø cm"
                        type="number"
                        min="15"
                        max="50"
                        disabled={!priceM}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">L (Grande)</label>
                    <div className="space-y-2">
                      <Input
                        value={priceL}
                        onChange={(e) => setPriceL(e.target.value)}
                        placeholder="Prix €"
                        type="number"
                        step="0.01"
                        min="0"
                      />
                      <Input
                        value={diameterL}
                        onChange={(e) => setDiameterL(e.target.value)}
                        placeholder="Ø cm"
                        type="number"
                        min="15"
                        max="50"
                        disabled={!priceL}
                      />
                    </div>
                  </div>
                </div>
                  </div>
                )}

                {['soda', 'eau', 'biere'].includes(itemType) && (
                  <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Tailles et prix *</p>
                {DRINK_SIZES[itemType]?.map(size => (
                  <div key={size.value} className="flex items-center gap-3">
                    <label className="w-24 text-sm text-gray-600">{size.label}</label>
                    <Input
                      value={drinkSizes[size.value] || ''}
                      onChange={(e) => setDrinkSizes(prev => ({
                        ...prev,
                        [size.value]: e.target.value
                      }))}
                      placeholder={`${size.defaultPrice.toFixed(2)} €`}
                      type="number"
                      step="0.01"
                      min="0"
                      className="flex-1"
                    />
                  </div>
                ))}
                  </div>
                )}

                {(itemType === 'vin' || itemType === 'dessert') && (
                  <div>
                <label className="block text-sm font-medium text-gray-700">Prix (€) *</label>
                <Input
                  value={priceS}
                  onChange={(e) => setPriceS(e.target.value)}
                  placeholder={itemType === 'vin' && itemName ? 
                    (VINS.find(v => v.name === itemName)?.defaultPrice?.toFixed(2) || '5.00') : 
                    '5.00'
                  }
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="mt-1"
                />
                  </div>
                )}
              </>
            )}

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Ajout en cours...' : 'Ajouter au menu'}
            </Button>
          </form>
        )}
      </Card>

      {/* Liste des items */}
      <div className="grid gap-4">
        {menuItems.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600">Aucun article dans votre menu. Commencez par en ajouter un !</p>
          </Card>
        ) : (
          menuItems.map(item => (
            <Card key={item.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{ITEM_TYPES.find(t => t.value === item.type)?.label.split(' ')[0]}</span>
                    <h3 className="font-bold text-gray-900">{item.name}</h3>
                    {item.type === 'pizza' && (
                      <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700">Pizza</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                  )}
                  
                  <div className="mt-3 flex items-center gap-4 flex-wrap">
                    {item.type === 'pizza' && item.sizes ? (
                      <>
                        {item.sizes.s && (
                          <span className="text-sm font-semibold text-gray-900">
                            S ({item.sizes.s.diameter}cm): {formatPrice(item.sizes.s.priceCents)}
                          </span>
                        )}
                        {item.sizes.m && (
                          <span className="text-sm font-semibold text-gray-900">
                            M ({item.sizes.m.diameter}cm): {formatPrice(item.sizes.m.priceCents)}
                          </span>
                        )}
                        {item.sizes.l && (
                          <span className="text-sm font-semibold text-gray-900">
                            L ({item.sizes.l.diameter}cm): {formatPrice(item.sizes.l.priceCents)}
                          </span>
                        )}
                      </>
                    ) : item.type === 'pizza' && item.prices ? (
                      // Retro-compatibilité ancien format
                      <>
                        <span className="text-sm font-semibold text-gray-900">
                          Classic: {formatPrice(item.prices.classic)}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          Large: {formatPrice(item.prices.large)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-gray-900">
                        {formatPrice(item.priceCents)}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => handleDeleteItem(item.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Supprimer
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
