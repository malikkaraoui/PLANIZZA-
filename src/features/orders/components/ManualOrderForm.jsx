import { useState, useEffect, useRef } from 'react';
import { Plus, Minus, Trash2, User, ShoppingCart, Check, Pizza, Wine, IceCream, ArrowLeft } from 'lucide-react';
import { ref, update } from 'firebase/database';
import { db } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';
import { pizzaioloCreateManualOrder } from '../../../lib/ordersApi';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useMenu } from '../../menu/hooks/useMenu';
import { useIngredients } from '../../menu/hooks/useIngredients';
import { useLiveCart } from '../../menu/hooks/useLiveCart';
import { usePizzaCustomization } from '../../menu/hooks/usePizzaCustomization';
import { useMenuItem } from '../../menu/hooks/useMenuItem';
import { useLiveOrder } from '../../menu/hooks/useLiveOrder';
import { filterMenuByCategory, hasMultipleSizes, getSingleSize } from '../../menu/utils/menuHelpers';
import {
  calculateTVA,
  calculateTotalTTC,
  formatPrice,
  getDisplayPrice,
  hasValidPrice
} from '../../menu/utils/priceCalculations';
import { formatDrinkVolumeLabel } from '../../menu/utils/formatDrinkVolumeLabel';
import DesiredTimePicker from './DesiredTimePicker';

const CATEGORIES = [
  { key: 'pizza', label: 'Pizza', icon: Pizza, color: 'orange' },
  { key: 'boisson', label: 'Boisson', icon: Wine, color: 'blue' },
  { key: 'dessert', label: 'Dessert', icon: IceCream, color: 'pink' },
];

export default function ManualOrderForm({ truckId, user, onOrderCreated }) {
  const { items: menuItems, loading: loadingMenu, error: menuError } = useMenu(truckId);
  const { ingredients } = useIngredients(truckId);

  const [menu, setMenu] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState('pizza');
  const migratedMenuNamesRef = useRef(new Set());

  const {
    cart, customerName, setCustomerName, pickupTime, setPickupTime,
    addToCart, removeFromCart, deleteFromCart, clearCart, totalCents, itemCount
  } = useLiveCart();

  const {
    customizingPizza, startCustomization, cancelCustomization,
    toggleRemoveIngredient, toggleAddIngredient, getCustomization
  } = usePizzaCustomization();

  const { toggleItemSelection, clearSelection, flashItem, isItemSelected, isItemFlashing } = useMenuItem();
  const { clearLiveOrder } = useLiveOrder(truckId, user?.uid, cart, customerName, pickupTime);

  useEffect(() => {
    if (!menuItems || !Array.isArray(menuItems)) { setMenu([]); return; }
    setMenu(menuItems);
  }, [menuItems]);

  // Migration données
  useEffect(() => {
    if (!truckId || !menuItems?.length) return;
    const toFix = menuItems.filter((it) => {
      if (!it?.id || typeof it?.name !== 'string') return false;
      if (migratedMenuNamesRef.current.has(it.id)) return false;
      return /\bCristalline\b/i.test(it.name);
    });
    if (!toFix.length) return;
    toFix.forEach((it) => {
      const corrected = it.name.replace(/\bCristalline\b/gi, 'Cristaline');
      if (corrected === it.name) return;
      migratedMenuNamesRef.current.add(it.id);
      update(ref(db, `${rtdbPaths.truckMenuItems(truckId)}/${it.id}`), { name: corrected }).catch(() => {
        migratedMenuNamesRef.current.delete(it.id);
      });
    });
  }, [truckId, menuItems]);

  const handleAddToCart = (item, size = null, customization = null) => {
    flashItem(item.id);
    addToCart(item, size, customization);
    clearSelection();
  };

  const finishCustomization = () => {
    if (!customizingPizza) return;
    handleAddToCart(customizingPizza.item, customizingPizza.size, getCustomization());
    cancelCustomization();
  };

  const pizzas = filterMenuByCategory(menu, 'pizza');
  const boissons = filterMenuByCategory(menu, 'boisson');
  const desserts = filterMenuByCategory(menu, 'dessert');
  const categoryItems = { pizza: pizzas, boisson: boissons, dessert: desserts };

  const handleSubmitOrder = async () => {
    if (!customerName.trim()) { alert('Veuillez saisir un prénom'); return; }
    if (cart.length === 0) { alert('Le panier est vide'); return; }
    setIsSubmitting(true);
    try {
      await pizzaioloCreateManualOrder({
        truckId, customerName: customerName.trim(), pickupTime: pickupTime || null,
        items: cart.map((item) => ({ id: item.id, name: item.name, priceCents: item.priceCents, qty: item.qty })),
        totalCents,
      });
      await clearLiveOrder({ clearAllMyDrafts: true });
      clearCart();
      if (onOrderCreated) onOrderCreated(customerName);
    } catch (err) {
      console.error('[ManualOrderForm] Erreur création commande:', err);
      alert('Erreur lors de la création de la commande');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingMenu) {
    return <div className="flex items-center justify-center h-48"><p className="text-muted-foreground font-medium">Chargement du menu...</p></div>;
  }

  if (menuError) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="text-lg font-bold mb-2">Erreur de chargement</h2>
        <p className="text-muted-foreground text-sm">Impossible de charger le menu.</p>
      </div>
    );
  }

  // Vue personnalisation pizza
  if (customizingPizza) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={cancelCustomization} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
          <h3 className="text-lg font-bold">
            {customizingPizza.item.name} ({customizingPizza.size.toUpperCase()}) — {formatPrice(customizingPizza.item.sizes[customizingPizza.size].priceCents)}
          </h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {customizingPizza.currentIngredients.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h4 className="text-xs font-bold text-muted-foreground mb-2 uppercase">Retirer</h4>
              <div className="flex flex-wrap gap-1.5">
                {customizingPizza.currentIngredients.map((ing) => {
                  const removed = customizingPizza.removedIngredients.includes(ing);
                  return (
                    <button key={ing} onClick={() => toggleRemoveIngredient(ing)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${removed ? 'bg-red-500/20 text-red-600 border border-red-500 line-through' : 'border border-border hover:border-red-400 text-foreground'}`}>
                      {ing}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h4 className="text-xs font-bold text-muted-foreground mb-2 uppercase">Ajouter</h4>
            <div className="flex flex-wrap gap-1.5">
              {ingredients.filter(ing => !customizingPizza.currentIngredients.includes(ing)).map((ing) => {
                const added = customizingPizza.addedIngredients.includes(ing);
                return (
                  <button key={ing} onClick={() => toggleAddIngredient(ing)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${added ? 'bg-emerald-500 text-white border border-emerald-500' : 'border border-border hover:border-emerald-400 text-foreground'}`}>
                    {added && '+ '}{ing}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <Button onClick={finishCustomization} className="w-full h-11 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600">
          <Plus className="h-4 w-4 mr-1.5" /> Ajouter au panier
        </Button>
      </div>
    );
  }

  const currentItems = categoryItems[activeCategory] || [];

  return (
    <div className="flex gap-4">
      {/* Colonne gauche : menu */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Onglets categories */}
        <div className="flex gap-1.5">
          {CATEGORIES.map(({ key, label, icon: Icon, color }) => {
            const count = categoryItems[key]?.length || 0;
            const isActive = activeCategory === key;
            const colorClasses = {
              orange: isActive ? 'bg-orange-500 text-white' : 'border border-border bg-card hover:bg-muted text-foreground',
              blue: isActive ? 'bg-blue-500 text-white' : 'border border-border bg-card hover:bg-muted text-foreground',
              pink: isActive ? 'bg-pink-500 text-white' : 'border border-border bg-card hover:bg-muted text-foreground',
            };
            return (
              <button key={key} onClick={() => setActiveCategory(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 py-2 md:py-3 px-3 md:px-5 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all ${colorClasses[color]}`}>
                <Icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Grille d'items */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {currentItems.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground text-sm py-6">Aucun produit</p>
          ) : (
            currentItems.filter(item => hasValidPrice(item) || item.type === 'pizza').map((item) => {
              const isPizza = item.type === 'pizza';
              const isExpanded = isItemSelected(item.id);
              const isFlashing = isItemFlashing(item.id);
              const multipleSizes = hasMultipleSizes(item);
              const singleSizeData = getSingleSize(item);
              const displayPrice = isPizza ? getDisplayPrice(item) : (singleSizeData?.data?.priceCents || item.priceCents);
              const drinkLabel = singleSizeData?.size ? formatDrinkVolumeLabel(singleSizeData.size) : null;

              return (
                <div key={item.id} className={`${isExpanded ? 'col-span-full' : ''}`}>
                  <button
                    onClick={() => {
                      if (isPizza || multipleSizes) {
                        toggleItemSelection(item);
                      } else if (singleSizeData) {
                        handleAddToCart(item, singleSizeData.size);
                      } else {
                        handleAddToCart(item);
                      }
                    }}
                    className={`w-full rounded-xl border p-2.5 text-left transition-all ${
                      isFlashing ? 'bg-emerald-100 border-emerald-500 scale-[1.02]'
                      : isExpanded ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-muted'
                    }`}
                  >
                    <div className="font-bold text-sm text-foreground truncate">{item.name}</div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-muted-foreground">{drinkLabel || (isPizza ? 'Choisir taille' : '')}</span>
                      {displayPrice ? (
                        <span className="text-sm font-bold text-primary">{isPizza && '~'}{formatPrice(displayPrice)}</span>
                      ) : null}
                    </div>
                  </button>

                  {/* Tailles pizza */}
                  {isExpanded && isPizza && item.sizes && (
                    <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                      {['s', 'm', 'l'].map((size) => {
                        const sizeData = item.sizes[size];
                        if (!sizeData) return null;
                        return (
                          <div key={size} className="space-y-1">
                            <button onClick={() => handleAddToCart(item, size)}
                              className="w-full rounded-lg border border-border bg-card hover:bg-emerald-50 hover:border-emerald-400 p-2 transition-all text-center">
                              <div className="text-sm font-bold text-foreground">{size.toUpperCase()}</div>
                              <div className="text-[10px] text-muted-foreground">{sizeData.diameter}cm</div>
                              <div className="text-sm font-bold text-primary">{formatPrice(sizeData.priceCents)}</div>
                            </button>
                            <button onClick={() => startCustomization(item, size)}
                              className="w-full rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 p-1 text-[10px] font-bold text-orange-600 transition-all">
                              Perso.
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Tailles boisson (multi) */}
                  {isExpanded && multipleSizes && !isPizza && (
                    <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                      {Object.entries(item.sizes).map(([size, sizeData]) => (
                        <button key={size} onClick={() => handleAddToCart(item, size)}
                          className="rounded-lg border border-border bg-card hover:bg-emerald-50 hover:border-emerald-400 p-2 transition-all text-center">
                          <div className="text-[10px] font-bold text-foreground">{formatDrinkVolumeLabel(size) || size}</div>
                          <div className="text-sm font-bold text-primary">{formatPrice(sizeData.priceCents)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Colonne droite : panier */}
      <div className="w-64 shrink-0 hidden md:block">
        <div className="sticky top-4 rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">Panier</span>
            {itemCount > 0 && (
              <span className="ml-auto bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{itemCount}</span>
            )}
          </div>

          {/* Client + heure */}
          <div className="space-y-2">
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Prénom client" className="h-8 rounded-lg text-xs" />
            <DesiredTimePicker label="" value={pickupTime} onChange={setPickupTime} disableValidation compact />
          </div>

          {/* Items */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-4">Panier vide</p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="rounded-lg border border-border p-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs truncate flex-1">{item.name}</span>
                    <button onClick={() => deleteFromCart(item.id)} className="text-red-500 hover:text-red-600 shrink-0">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1">
                      <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-bold text-xs w-5 text-center">{item.qty}</span>
                      <button onClick={() => handleAddToCart({ id: item.id, name: item.name, priceCents: item.priceCents })}
                        className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="font-bold text-xs text-primary">{formatPrice(item.priceCents * item.qty)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totaux */}
          <div className="pt-2 border-t border-border space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">HT</span><span className="font-bold">{formatPrice(totalCents)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TVA 10%</span><span className="font-bold">{formatPrice(calculateTVA(totalCents))}</span></div>
            <div className="flex justify-between pt-1 border-t border-border">
              <span className="font-bold text-sm">TTC</span>
              <span className="font-bold text-lg text-primary">{formatPrice(calculateTotalTTC(totalCents))}</span>
            </div>
          </div>

          <Button onClick={handleSubmitOrder} disabled={isSubmitting || cart.length === 0 || !customerName.trim()}
            className="w-full h-10 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-600">
            {isSubmitting ? 'Création...' : <><Check className="h-4 w-4 mr-1" /> Valider</>}
          </Button>
        </div>
      </div>

      {/* Panier mobile (sticky bottom) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Prénom" className="h-8 rounded-lg text-xs flex-1" />
          <DesiredTimePicker label="" value={pickupTime} onChange={setPickupTime} disableValidation compact />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-bold text-primary">{formatPrice(calculateTotalTTC(totalCents))}</span>
            <span className="text-muted-foreground text-xs ml-1">({itemCount} art.)</span>
          </div>
          <Button onClick={handleSubmitOrder} disabled={isSubmitting || cart.length === 0 || !customerName.trim()}
            size="sm" className="h-9 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600">
            {isSubmitting ? '...' : <><Check className="h-3.5 w-3.5 mr-1" /> Valider</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
