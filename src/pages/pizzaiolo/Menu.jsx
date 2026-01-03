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
  { value: 'dessert', label: '🍰 Dessert' }
];

const PIZZA_SIZES = [
  { value: 's', label: 'S (26cm)', defaultDiameter: 26 },
  { value: 'm', label: 'M (33cm)', defaultDiameter: 33 },
  { value: 'l', label: 'L (40cm)', defaultDiameter: 40 }
];

export default function PizzaioloMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [truckId, setTruckId] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulaire nouvel item
  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemType, setItemType] = useState('pizza');
  const [priceS, setPriceS] = useState('');
  const [priceM, setPriceM] = useState('');
  const [priceL, setPriceL] = useState('');
  const [diameterS, setDiameterS] = useState('26');
  const [diameterM, setDiameterM] = useState('33');
  const [diameterL, setDiameterL] = useState('40');
  
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
      
      // Au moins une taille doit être renseignée
      if (!sPrice && !mPrice && !lPrice) {
        setMessage('❌ Vous devez renseigner au moins une taille de pizza');
        return;
      }
      
      // Si plusieurs tailles sont renseignées, vérifier que les prix sont croissants
      if (sPrice && mPrice && mPrice < sPrice) {
        setMessage('❌ Le prix M doit être supérieur ou égal au prix S');
        return;
      }
      if (mPrice && lPrice && lPrice < mPrice) {
        setMessage('❌ Le prix L doit être supérieur ou égal au prix M');
        return;
      }
      if (sPrice && lPrice && lPrice < sPrice) {
        setMessage('❌ Le prix L doit être supérieur ou égal au prix S');
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
      setDiameterM('33');
      setDiameterL('40');
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
            <p className="mt-1 text-sm text-gray-600">Gérez votre carte : pizzas, calzones, desserts</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Annuler' : '+ Ajouter un article'}
          </Button>
        </div>

        {message && (
          <div className={`mt-4 p-4 rounded-lg ${message.includes('✅') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {message}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleAddItem} className="mt-6 space-y-4 border-t pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Type *</label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                required
              >
                {ITEM_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Nom *</label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Ex: Margherita, Tiramisu..."
                required
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                placeholder="Ex: Tomate, mozzarella, basilic frais..."
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />
            </div>

            {itemType === 'pizza' ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-700">Tailles et prix *</p>
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
                        required
                      />
                      <Input
                        value={diameterS}
                        onChange={(e) => setDiameterS(e.target.value)}
                        placeholder="Ø cm"
                        type="number"
                        min="15"
                        max="50"
                        required
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
                        required
                      />
                      <Input
                        value={diameterM}
                        onChange={(e) => setDiameterM(e.target.value)}
                        placeholder="Ø cm"
                        type="number"
                        min="15"
                        max="50"
                        required
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
                        required
                      />
                      <Input
                        value={diameterL}
                        onChange={(e) => setDiameterL(e.target.value)}
                        placeholder="Ø cm"
                        type="number"
                        min="15"
                        max="50"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700">Prix (€) *</label>
                <Input
                  value={priceS}
                  onChange={(e) => setPriceS(e.target.value)}
                  placeholder="5.00"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="mt-1"
                />
              </div>
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
